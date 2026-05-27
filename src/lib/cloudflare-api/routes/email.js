async function sendViaResend(to, subject, html, apiKey, fromEmail, fromName) {
  const resp = await fetch('https://api.resend.com/email', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName || 'LiHui Blog'} <${fromEmail}>`,
      to: [to],
      subject,
      html
    })
  })
  if (!resp.ok) {
    let errMsg = `Resend API error: ${resp.status}`
    try {
      const err = await resp.json()
      errMsg = err.message || err.error?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }
  return resp.json()
}

async function sendViaSmtp(config, to, subject, html) {
  const { sendSmtp } = await import('../smtp-client.js')
  return sendSmtp({
    host: config.smtpHost || 'smtp.qq.com',
    port: config.smtpPort || '465',
    username: config.user,
    password: config.pass,
    from: config.user,
    fromName: config.fromName || 'LiHui Blog',
    to,
    subject,
    html
  })
}

async function logEmail(db, type, method, recipient, subject, status, error = null) {
  try {
    await db.prepare(
      `INSERT INTO email_logs (type, method, recipient, subject, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))`
    ).bind(type, method, recipient, subject, status, error).run()
  } catch {}
}

async function getEmailConfig(db) {
  const { results: rows } = await db.prepare(
    "SELECT key, value FROM site_config WHERE key LIKE 'email.%'"
  ).all()
  const config = {}
  for (const row of rows) {
    const key = row.key.replace('email.', '')
    config[key] = row.value
  }
  return config
}

async function sendEmail(env, db, config, to, subject, html) {
  const mode = config.emailMode || 'smtp'
  const fromName = config.fromName || 'LiHui Blog'

  if (mode === 'smtp') {
    if (!config.user || !config.pass || !config.smtpHost) {
      throw new Error('请先配置 SMTP 邮箱、授权码和服务器地址')
    }
    try {
      await sendViaSmtp(config, to, subject, html)
      await logEmail(db, 'system', 'smtp', to, subject, 'success')
    } catch (err) {
      await logEmail(db, 'system', 'smtp', to, subject, 'failed', err.message)
      throw err
    }
  } else {
    if (!config.resendKey) {
      throw new Error('请先配置 Resend API Key')
    }
    const fromEmail = config.resendFrom || config.user
    if (!fromEmail) throw new Error('未配置发件邮箱')
    try {
      await sendViaResend(to, subject, html, config.resendKey, fromEmail, fromName)
      await logEmail(db, 'system', 'resend', to, subject, 'success')
    } catch (err) {
      await logEmail(db, 'system', 'resend', to, subject, 'failed', err.message)
      throw err
    }
  }
}

function isSmtpConfigured(config) {
  return !!(config.user && config.pass && config.smtpHost)
}

function isResendConfigured(config) {
  return !!(config.resendKey)
}

export function registerEmailRoutes(app) {
  app.get('/api/email/configured', async (c) => {
    try {
      const db = c.env.DB
      const config = await getEmailConfig(db)
      const mode = config.emailMode || 'smtp'
      const configured = mode === 'smtp' ? isSmtpConfigured(config) : isResendConfigured(config)
      return c.json({ success: true, configured })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/email/send-code', async (c) => {
    try {
      const db = c.env.DB
      const config = await getEmailConfig(db)
      const mode = config.emailMode || 'smtp'

      const isConfigured = mode === 'smtp' ? isSmtpConfigured(config) : isResendConfigured(config)
      if (!isConfigured) {
        return c.json({ success: false, error: mode === 'smtp' ? '邮件服务未配置，请在邮件设置中配置 SMTP 信息' : '邮件服务未配置，请在邮件设置中配置 Resend API Key' }, 400)
      }

      const { email } = await c.req.json()
      if (!email) return c.json({ success: false, error: '请输入邮箱地址' }, 400)

      const adminEmail = config.user
      if (!adminEmail) {
        return c.json({ success: false, error: '请先在邮件设置中填写收件邮箱' }, 400)
      }

      if (email !== adminEmail) {
        return c.json({ success: false, error: '该邮箱不是管理员邮箱' }, 400)
      }

      const code = String(Math.floor(100000 + Math.random() * 900000))

      await db.prepare(
        `INSERT INTO verify_codes (email, code, expires_at) VALUES (?, ?, datetime('now', '+8 hours', '+5 minutes')) ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = datetime('now', '+8 hours', '+5 minutes')`
      ).bind(email, code).run()

      const siteTitleRow = await db.prepare(
        "SELECT value FROM site_config WHERE key = 'site.title'"
      ).first()
      const title = siteTitleRow?.value || 'LiHui Blog'

      const html = `
      <div style="max-width:400px;margin:0 auto;padding:20px;font-family:sans-serif;">
        <div style="background:#f9f9f9;border-radius:12px;padding:24px;text-align:center;">
          <h2 style="margin:0 0 16px;color:#333;">${title}</h2>
          <p style="color:#666;margin:0 0 20px;">您的登录验证码为：</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111;background:#fff;border-radius:8px;padding:12px;display:inline-block;">${code}</div>
          <p style="color:#999;font-size:12px;margin:16px 0 0;">验证码5分钟内有效，请勿泄露</p>
        </div>
      </div>`

      await sendEmail(c.env, db, config, email, `${title} - 登录验证码`, html)

      return c.json({ success: true, message: '验证码已发送' })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/email/config', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const config = await getEmailConfig(db)
      config.pass = config.pass ? '••••••' : ''
      config.resendKey = config.resendKey ? '••••••' : ''
      return c.json(config)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/email/config', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const { user: emailUser, pass, fromName, emailMode, resendKey, resendFrom, smtpHost, smtpPort } = await c.req.json()

      const MASK = '••••••'
      const stmts = [
        db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.user', emailUser || ''),
        db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.fromName', fromName || ''),
        db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.emailMode', emailMode || 'smtp'),
        db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.resendFrom', resendFrom || ''),
        db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.smtpHost', smtpHost || 'smtp.qq.com'),
        db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.smtpPort', smtpPort || '465'),
      ]

      if (pass && pass !== MASK) {
        stmts.push(db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.pass', pass))
      }
      if (resendKey && resendKey !== MASK) {
        stmts.push(db.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','+8 hours')`
        ).bind('email.resendKey', resendKey))
      }

      await db.batch(stmts)

      const config = await getEmailConfig(db)
      config.pass = config.pass ? MASK : ''
      config.resendKey = config.resendKey ? MASK : ''
      return c.json(config)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/email/test', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const config = await getEmailConfig(db)
      const { to } = await c.req.json()
      const mode = config.emailMode || 'smtp'

      const isConfigured = mode === 'smtp' ? isSmtpConfigured(config) : isResendConfigured(config)
      if (!isConfigured) {
        return c.json({ success: false, error: mode === 'smtp' ? '请先配置 SMTP 信息' : '请先配置 Resend API Key' }, 400)
      }

      const targetEmail = to || config.user
      if (!targetEmail) return c.json({ success: false, error: '请先配置收件邮箱' }, 400)

      try {
        await sendEmail(c.env, db, config, targetEmail, 'LiHui Blog 邮件测试',
          '<p>这是一封测试邮件，如果您收到了，说明邮件配置成功！</p>')
        return c.json({ success: true, message: '测试邮件已发送，请查收' })
      } catch (err) {
        return c.json({ success: false, error: '邮件发送失败，请检查配置' }, 400)
      }
    } catch (err) {
      return c.json({ success: false, error: 'SMTP测试失败，请检查配置' }, 400)
    }
  })

  app.post('/api/email/test-smtp', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const { smtpHost, smtpPort, username, password, fromName, to } = await c.req.json()
      if (!smtpHost) return c.json({ success: false, error: '请填写 SMTP 服务器地址' }, 400)
      if (!username) return c.json({ success: false, error: '请填写邮箱账号' }, 400)
      if (!password) return c.json({ success: false, error: '请填写授权码' }, 400)

      const targetEmail = to || username
      const config = { smtpHost, smtpPort: smtpPort || '465', user: username, pass: password, fromName: fromName || 'LiHui Blog' }

      try {
        await sendViaSmtp(config, targetEmail, 'LiHui Blog SMTP 测试',
          '<p>这是一封通过 SMTP 发送的测试邮件，如果您收到了，说明 SMTP 配置成功！</p>')
        await logEmail(db, 'test', 'smtp', targetEmail, 'SMTP测试', 'success')
        return c.json({ success: true, message: 'SMTP 测试邮件已发送，请查收' })
      } catch (err) {
        await logEmail(db, 'test', 'smtp', targetEmail, 'SMTP测试', 'failed', err.message)
        throw err
      }
    } catch (err) {
      return c.json({ success: false, error: 'SMTP测试失败，请检查配置' }, 400)
    }
  })

  app.post('/api/email/test-resend', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const { apiKey, fromEmail, to } = await c.req.json()
      if (!apiKey) return c.json({ success: false, error: '请填写 Resend API Key' }, 400)
      if (!fromEmail) return c.json({ success: false, error: '请填写发件邮箱' }, 400)

      const fromName = 'LiHui Blog'
      const targetEmail = to || fromEmail

      try {
        await sendViaResend(
          targetEmail,
          'LiHui Blog 邮件测试 (Resend)',
          '<p>这是一封通过 Resend API 发送的测试邮件，如果您收到了，说明邮件配置成功！</p>',
          apiKey,
          fromEmail,
          fromName
        )
        await logEmail(db, 'test', 'resend', targetEmail, 'Resend测试', 'success')
        return c.json({ success: true, message: to ? '测试邮件已发送，请查收' : 'Resend API 验证成功' })
      } catch (err) {
        await logEmail(db, 'test', 'resend', targetEmail, 'Resend测试', 'failed', err.message)
        throw err
      }
    } catch (err) {
      return c.json({ success: false, error: 'Resend API 验证失败，请检查配置' }, 400)
    }
  })

  app.get('/api/email/stats', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const totalResult = await db.prepare('SELECT COUNT(*) as count FROM email_logs').first()
      const successResult = await db.prepare("SELECT COUNT(*) as count FROM email_logs WHERE status = 'success'").first()
      const failedResult = await db.prepare("SELECT COUNT(*) as count FROM email_logs WHERE status = 'failed'").first()
      const last24hResult = await db.prepare(
        "SELECT COUNT(*) as count FROM email_logs WHERE created_at > datetime('now','+8 hours','-24 hours')"
      ).first()

      return c.json({
        total: totalResult?.count || 0,
        success: successResult?.count || 0,
        failed: failedResult?.count || 0,
        last24h: last24hResult?.count || 0,
      })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/email/logs', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const limit = parseInt(c.req.query('limit')) || 50
      const { results } = await db.prepare(
        'SELECT * FROM email_logs ORDER BY id DESC LIMIT ?'
      ).bind(limit).all()
      return c.json(results)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.delete('/api/email/logs', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      await db.prepare('DELETE FROM email_logs').run()
      return c.json({ success: true })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/email/diagnose', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const results = []
      const db = c.env.DB
      const config = await getEmailConfig(db)
      const mode = config.emailMode || 'smtp'

      results.push({
        step: '邮件发送模式',
        status: 'success',
        detail: mode === 'smtp' ? `SMTP 模式 (${config.smtpHost || 'smtp.qq.com'}:${config.smtpPort || '465'})` : 'Resend API 模式'
      })

      if (mode === 'smtp') {
        if (config.smtpHost) {
          results.push({ step: 'SMTP 服务器', status: 'success', detail: config.smtpHost })
        } else {
          results.push({ step: 'SMTP 服务器', status: 'failed', detail: '未配置 SMTP 服务器地址' })
        }
        if (config.user) {
          results.push({ step: '邮箱账号', status: 'success', detail: config.user })
        } else {
          results.push({ step: '邮箱账号', status: 'failed', detail: '未配置邮箱账号' })
        }
        if (config.pass) {
          results.push({ step: '授权码', status: 'success', detail: '已配置' })
        } else {
          results.push({ step: '授权码', status: 'failed', detail: '未配置授权码' })
        }
        const port = config.smtpPort || '465'
        if (port === '25') {
          results.push({ step: '端口检查', status: 'failed', detail: '端口 25 已被 Cloudflare 禁止，请使用 465 或 587' })
        } else {
          results.push({ step: '端口检查', status: 'success', detail: `端口 ${port} 可用` })
        }
      } else {
        try {
          const resp = await fetch('https://api.resend.com', { method: 'HEAD' })
          results.push({
            step: 'Resend API 连通性',
            status: resp.status < 500 ? 'success' : 'failed',
            detail: `HTTP ${resp.status} - Resend API 可达`
          })
        } catch (e) {
          results.push({
            step: 'Resend API 连通性',
            status: 'failed',
            detail: '无法连接 Resend API'
          })
        }
        if (config.resendKey) {
          results.push({ step: 'Resend API Key', status: 'success', detail: '已配置' })
        } else {
          results.push({ step: 'Resend API Key', status: 'failed', detail: '未配置' })
        }
      }

      return c.json(results)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
