import nodemailer from 'nodemailer'
import axios from 'axios'
import db from './db.js'

const SMTP_TIMEOUT = 8000

db.exec(`CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  method TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
)`)

function getEmailConfig() {
  const rows = db.prepare("SELECT key, value FROM site_config WHERE key LIKE 'email.%'").all()
  const config = {}
  for (const row of rows) {
    const key = row.key.replace('email.', '')
    config[key] = row.value
  }
  return config
}

function createTransporter(auth) {
  if (!auth.user || !auth.pass) return null
  return nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    connectionTimeout: SMTP_TIMEOUT,
    greetingTimeout: SMTP_TIMEOUT,
    socketTimeout: SMTP_TIMEOUT,
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
  })
}

function logEmail(type, method, recipient, subject, status, error = null) {
  try {
    db.prepare(
      `INSERT INTO email_logs (type, method, recipient, subject, status, error) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(type, method, recipient, subject, status, error)
  } catch {}
}

export function getEmailLogs(limit = 50) {
  return db.prepare('SELECT * FROM email_logs ORDER BY id DESC LIMIT ?').all(limit)
}

export function getEmailStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM email_logs').get()?.count || 0
  const success = db.prepare("SELECT COUNT(*) as count FROM email_logs WHERE status = 'success'").get()?.count || 0
  const failed = db.prepare("SELECT COUNT(*) as count FROM email_logs WHERE status = 'failed'").get()?.count || 0
  const last24h = db.prepare(
    "SELECT COUNT(*) as count FROM email_logs WHERE created_at > datetime('now', 'localtime', '-24 hours')"
  ).get()?.count || 0
  return { total, success, failed, last24h }
}

export function clearEmailLogs() {
  db.prepare('DELETE FROM email_logs').run()
}

async function sendViaSmtp(to, subject, html, emailConfig) {
  const transporter = createTransporter(emailConfig)
  if (!transporter) throw new Error('邮件服务未配置')

  const fromName = emailConfig.fromName || 'LiHui Blog'
  const from = `"${fromName}" <${emailConfig.user}>`

  try {
    const info = await transporter.sendMail({ from, to, subject, html })
    return { method: 'smtp', info }
  } finally {
    transporter.close()
  }
}

async function sendViaResend(to, subject, html, emailConfig) {
  const apiKey = emailConfig.resendKey
  if (!apiKey) throw new Error('Resend API Key 未配置')

  const fromName = emailConfig.fromName || 'LiHui Blog'
  const fromEmail = emailConfig.resendFrom || emailConfig.user

  const resp = await axios.post('https://api.resend.com/emails', {
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html,
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })

  return { method: 'resend', info: resp.data }
}

export async function sendMail(to, subject, html) {
  const emailConfig = getEmailConfig()
  if (!emailConfig.user || !emailConfig.pass) throw new Error('邮件服务未配置')

  const mode = emailConfig.emailMode || 'smtp'
  let method = mode
  let error = null

  try {
    let result
    if (mode === 'resend') {
      result = await sendViaResend(to, subject, html, emailConfig)
      method = 'resend'
    } else {
      try {
        result = await sendViaSmtp(to, subject, html, emailConfig)
        method = 'smtp'
      } catch (smtpErr) {
        const msg = smtpErr.message || ''
        const isNetworkError = msg.includes('ETIMEDOUT') || msg.includes('ENETUNREACH') ||
          msg.includes('ECONNREFUSED') || msg.includes('超时') || msg.includes('timeout')

        if (isNetworkError && emailConfig.resendKey) {
          console.log('[Email] SMTP连接失败，自动切换到Resend API发送')
          result = await sendViaResend(to, subject, html, emailConfig)
          method = 'resend (fallback)'
        } else {
          throw smtpErr
        }
      }
    }
    logEmail('system', method, to, subject, 'success')
    return result
  } catch (err) {
    error = err.message
    logEmail('system', method, to, subject, 'failed', error)
    throw err
  }
}

export async function testEmailConfig(user, pass, to) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    connectionTimeout: SMTP_TIMEOUT,
    greetingTimeout: SMTP_TIMEOUT,
    socketTimeout: SMTP_TIMEOUT,
    auth: { user, pass },
  })
  try {
    await transporter.verify()
    if (to) {
      await transporter.sendMail({
        from: `"LiHui Blog" <${user}>`,
        to,
        subject: 'LiHui Blog 邮件测试',
        html: '<p>这是一封测试邮件，如果您收到了，说明邮件配置成功！</p>',
      })
    }
    logEmail('test', 'smtp', to || user, 'SMTP测试', 'success')
    return { method: 'smtp', success: true }
  } catch (err) {
    logEmail('test', 'smtp', to || user, 'SMTP测试', 'failed', err.message)
    throw err
  } finally {
    transporter.close()
  }
}

export async function testResendConfig(apiKey, fromEmail, to) {
  try {
    const resp = await axios.post('https://api.resend.com/emails', {
      from: `LiHui Blog <${fromEmail}>`,
      to: [to || fromEmail],
      subject: 'LiHui Blog 邮件测试 (Resend)',
      html: '<p>这是一封通过 Resend API 发送的测试邮件，如果您收到了，说明邮件配置成功！</p>',
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })
    logEmail('test', 'resend', to || fromEmail, 'Resend测试', 'success')
    return { method: 'resend', success: true, info: resp.data }
  } catch (err) {
    logEmail('test', 'resend', to || fromEmail, 'Resend测试', 'failed', err.response?.data?.message || err.message)
    throw err
  }
}

export async function diagnoseSmtp() {
  const results = []

  try {
    const dns = await import('dns/promises')
    const addresses = await dns.resolve4('smtp.qq.com')
    results.push({ step: 'DNS解析', status: 'success', detail: `smtp.qq.com → ${addresses.join(', ')}` })
  } catch (e) {
    results.push({ step: 'DNS解析', status: 'failed', detail: `解析失败: ${e.message}` })
  }

  const net = await import('net')
  const testPort = (host, port) => new Promise((resolve) => {
    const sock = net.createConnection({ host, port })
    sock.setTimeout(5000)
    sock.on('connect', () => { results.push({ step: `端口${port}`, status: 'success', detail: `${host}:${port} 可连接` }); sock.destroy(); resolve(true) })
    sock.on('timeout', () => { results.push({ step: `端口${port}`, status: 'failed', detail: `${host}:${port} 连接超时` }); sock.destroy(); resolve(false) })
    sock.on('error', (e) => { results.push({ step: `端口${port}`, status: 'failed', detail: `${host}:${port} ${e.code || e.message}` }); resolve(false) })
  })

  await testPort('smtp.qq.com', 465)
  await testPort('smtp.qq.com', 587)

  const httpsReachable = await new Promise((resolve) => {
    const sock = net.createConnection({ host: 'api.resend.com', port: 443 })
    sock.setTimeout(5000)
    sock.on('connect', () => { sock.destroy(); resolve(true) })
    sock.on('timeout', () => { sock.destroy(); resolve(false) })
    sock.on('error', () => { resolve(false) })
  })
  results.push({ step: 'HTTPS(443)', status: httpsReachable ? 'success' : 'failed', detail: httpsReachable ? 'Resend API 可达' : 'Resend API 不可达' })

  return results
}

const codeStore = new Map()

export function generateCode(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  codeStore.set(email, { code, expires: Date.now() + 5 * 60 * 1000 })
  return code
}

export function verifyCode(email, inputCode) {
  const entry = codeStore.get(email)
  if (!entry) return false
  if (Date.now() > entry.expires) {
    codeStore.delete(email)
    return false
  }
  if (entry.code !== inputCode) return false
  codeStore.delete(email)
  return true
}

export function isEmailConfigured() {
  const emailConfig = getEmailConfig()
  return !!(emailConfig.user && emailConfig.pass)
}
