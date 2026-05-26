export function registerProfileRoutes(app) {
  app.get('/api/profile', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const { results } = await c.env.DB.prepare(
        "SELECT key, value FROM site_config WHERE key LIKE 'profile.%'"
      ).all()

      const profile = {}
      for (const row of results) {
        const key = row.key.replace('profile.', '')
        profile[key] = row.value
      }
      return c.json(profile)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/profile', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const body = await c.req.json()

      for (const [key, value] of Object.entries(body)) {
        await c.env.DB.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now', '+8 hours'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', '+8 hours')`
        ).bind(`profile.${key}`, String(value)).run()
      }

      const { results } = await c.env.DB.prepare(
        "SELECT key, value FROM site_config WHERE key LIKE 'profile.%'"
      ).all()

      const profile = {}
      for (const row of results) {
        const key = row.key.replace('profile.', '')
        profile[key] = row.value
      }
      return c.json(profile)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
