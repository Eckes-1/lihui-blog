function flatToNested(rows) {
  const result = {}
  for (const row of rows) {
    const parts = row.key.split('.')
    let current = result
    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        current[parts[i]] = row.value
      } else {
        if (!current[parts[i]]) current[parts[i]] = {}
        current = current[parts[i]]
      }
    }
  }
  return result
}

function flatten(obj, prefix = '') {
  let result = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result = result.concat(flatten(value, fullKey))
    } else {
      result.push([fullKey, String(value)])
    }
  }
  return result
}

export function registerConfigRoutes(app) {
  app.get('/api/config', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const { results } = await c.env.DB.prepare('SELECT key, value FROM site_config').all()
      const config = flatToNested(results)
      return c.json(config)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/config', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const body = await c.req.json()
      const flat = flatten(body)

      for (const [key, value] of flat) {
        await c.env.DB.prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now', '+8 hours'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', '+8 hours')`
        ).bind(key, value).run()
      }

      const { results } = await c.env.DB.prepare('SELECT key, value FROM site_config').all()
      const config = flatToNested(results)
      return c.json(config)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/config/:key', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const key = c.req.param('key')
      const exactRow = await c.env.DB.prepare('SELECT key, value FROM site_config WHERE key = ?').bind(key).first()
      if (exactRow) {
        return c.json({ [key]: exactRow.value })
      }

      const { results } = await c.env.DB.prepare(
        'SELECT key, value FROM site_config WHERE key = ? OR key LIKE ?'
      ).bind(key, `${key}.%`).all()

      if (results.length === 0) {
        return c.json({ error: '配置项不存在' }, 404)
      }

      const config = flatToNested(results)
      return c.json(config)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
