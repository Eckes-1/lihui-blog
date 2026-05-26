import { Router } from 'express'
import db from '../db.js'
import { testEmailConfig, testResendConfig, generateCode, sendMail, isEmailConfigured, getEmailLogs, getEmailStats, clearEmailLogs, diagnoseSmtp } from '../email.js'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.js'

const router = Router()

const REQUEST_TIMEOUT = 15000

function withTimeout(promise, ms = REQUEST_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('连接超时')), ms)
    ),
  ])
}

function emailAuth(req, res, next) {
  if (req.method === 'GET' && req.path === '/configured') return next()
  if (req.method === 'POST' && req.path === '/send-code') return next()
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }
  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期' })
  }
}

router.use(emailAuth)

router.get('/config', (req, res) => {
  try {
    const rows = db.prepare("SELECT key, value FROM site_config WHERE key LIKE 'email.%'").all()
    const config = {}
    for (const row of rows) {
      const key = row.key.replace('email.', '')
      config[key] = row.value
    }
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/config', (req, res) => {
  try {
    const { user, pass, fromName, emailMode, resendKey, resendFrom } = req.body
    const upsert = db.prepare(
      `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')`
    )
    const updateMany = db.transaction((items) => {
      for (const [key, value] of items) {
        upsert.run(key, value)
      }
    })
    updateMany([
      ['email.user', user || ''],
      ['email.pass', pass || ''],
      ['email.fromName', fromName || ''],
      ['email.emailMode', emailMode || 'smtp'],
      ['email.resendKey', resendKey || ''],
      ['email.resendFrom', resendFrom || ''],
    ])
    const rows = db.prepare("SELECT key, value FROM site_config WHERE key LIKE 'email.%'").all()
    const config = {}
    for (const row of rows) {
      const key = row.key.replace('email.', '')
      config[key] = row.value
    }
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/stats', (req, res) => {
  try {
    res.json(getEmailStats())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    res.json(getEmailLogs(limit))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/logs', (req, res) => {
  try {
    clearEmailLogs()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/diagnose', async (req, res) => {
  try {
    const results = await withTimeout(diagnoseSmtp(), 20000)
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/test', async (req, res) => {
  try {
    const { user, pass, to } = req.body
    if (!user || !pass) return res.status(400).json({ success: false, error: '请填写QQ邮箱和授权码' })
    await withTimeout(testEmailConfig(user, pass, to))
    res.json({ success: true, message: to ? '测试邮件已发送' : 'SMTP连接验证成功' })
  } catch (err) {
    const msg = err.message || ''
    if (msg.includes('ETIMEDOUT') || msg.includes('ENETUNREACH') || msg.includes('ECONNREFUSED') || msg.includes('超时')) {
      return res.status(400).json({ success: false, error: '无法连接SMTP服务器（端口465可能被防火墙封锁），建议切换到 Resend API 模式' })
    }
    if (msg.includes('EAUTH') || msg.includes('Invalid login')) {
      return res.status(400).json({ success: false, error: 'SMTP认证失败，请检查QQ邮箱和授权码是否正确' })
    }
    res.status(400).json({ success: false, error: '邮件配置验证失败: ' + msg })
  }
})

router.post('/test-resend', async (req, res) => {
  try {
    const { apiKey, fromEmail, to } = req.body
    if (!apiKey) return res.status(400).json({ success: false, error: '请填写 Resend API Key' })
    if (!fromEmail) return res.status(400).json({ success: false, error: '请填写发件邮箱' })
    await withTimeout(testResendConfig(apiKey, fromEmail, to))
    res.json({ success: true, message: to ? '测试邮件已发送，请查收' : 'Resend API 验证成功' })
  } catch (err) {
    const msg = err.message || ''
    if (err.response) {
      const data = err.response.data
      if (data?.message) {
        return res.status(400).json({ success: false, error: 'Resend API 错误: ' + data.message })
      }
    }
    res.status(400).json({ success: false, error: 'Resend API 验证失败: ' + msg })
  }
})

router.get('/configured', (req, res) => {
  res.json({ success: true, configured: isEmailConfigured() })
})

router.post('/send-code', async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ success: false, error: '邮件服务未配置，请在邮件设置中配置QQ邮箱和授权码' })
    }

    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, error: '请输入邮箱地址' })

    const emailConfig = db.prepare("SELECT value FROM site_config WHERE key = 'email.user'").get()
    if (!emailConfig || !emailConfig.value) {
      return res.status(400).json({ success: false, error: '邮件服务未配置' })
    }

    const adminEmail = emailConfig.value
    if (email !== adminEmail) {
      return res.status(400).json({ success: false, error: '该邮箱不是管理员邮箱' })
    }

    const code = generateCode(email)
    const siteTitle = db.prepare("SELECT value FROM site_config WHERE key = 'site.title'").get()
    const title = siteTitle?.value || 'Momo Blog'

    await withTimeout(sendMail(email, `${title} - 登录验证码`, `
      <div style="max-width:400px;margin:0 auto;padding:20px;font-family:sans-serif;">
        <div style="background:#f9f9f9;border-radius:12px;padding:24px;text-align:center;">
          <h2 style="margin:0 0 16px;color:#333;">${title}</h2>
          <p style="color:#666;margin:0 0 20px;">您的登录验证码为：</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111;background:#fff;border-radius:8px;padding:12px;display:inline-block;">${code}</div>
          <p style="color:#999;font-size:12px;margin:16px 0 0;">验证码5分钟内有效，请勿泄露</p>
        </div>
      </div>
    `))

    res.json({ success: true, message: '验证码已发送' })
  } catch (err) {
    const msg = err.message || ''
    if (msg.includes('ETIMEDOUT') || msg.includes('ENETUNREACH') || msg.includes('ECONNREFUSED') || msg.includes('超时')) {
      return res.status(400).json({ success: false, error: '无法连接SMTP服务器，请切换到 Resend API 模式或在邮件设置中配置 Resend' })
    }
    if (msg.includes('EAUTH') || msg.includes('Invalid login')) {
      return res.status(400).json({ success: false, error: 'SMTP认证失败，请检查邮件配置' })
    }
    res.status(500).json({ success: false, error: '发送验证码失败: ' + msg })
  }
})

export default router
