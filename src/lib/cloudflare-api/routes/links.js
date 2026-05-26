export function registerLinksRoutes(app) {
  app.get('/api/links', async (c) => {
    try {
      const { results } = await c.env.DB.prepare(
        'SELECT * FROM friend_links ORDER BY sort_order ASC, created_at ASC'
      ).all()
      return c.json(results)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/links', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const { name, avatar, url, description, sort_order } = await c.req.json()

      if (!name || !url) {
        return c.json({ error: '名称和链接不能为空' }, 400)
      }

      try {
        const parsedUrl = new URL(url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return c.json({ error: '链接必须以 http:// 或 https:// 开头' }, 400)
        }
      } catch {
        return c.json({ error: '链接格式不正确' }, 400)
      }

      const result = await c.env.DB.prepare(
        "INSERT INTO friend_links (name, avatar, url, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+8 hours'))"
      ).bind(name, avatar || '', url, description || '', sort_order || 0).run()

      const link = await c.env.DB.prepare(
        'SELECT * FROM friend_links WHERE id = ?'
      ).bind(result.meta.last_row_id).first()

      return c.json(link, 201)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/links/reorder', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const { order } = await c.req.json()
      if (!Array.isArray(order)) {
        return c.json({ error: 'order必须为数组' }, 400)
      }

      for (let i = 0; i < order.length; i++) {
        await c.env.DB.prepare(
          'UPDATE friend_links SET sort_order = ? WHERE id = ?'
        ).bind(i, order[i]).run()
      }

      const { results } = await c.env.DB.prepare(
        'SELECT * FROM friend_links ORDER BY sort_order ASC, created_at ASC'
      ).all()

      return c.json(results)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/links/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const link = await c.env.DB.prepare(
        'SELECT * FROM friend_links WHERE id = ?'
      ).bind(id).first()

      if (!link) {
        return c.json({ error: '友链不存在' }, 404)
      }

      const { name, avatar, url, description, sort_order } = await c.req.json()

      await c.env.DB.prepare(
        'UPDATE friend_links SET name = ?, avatar = ?, url = ?, description = ?, sort_order = ? WHERE id = ?'
      ).bind(
        name !== undefined ? name : link.name,
        avatar !== undefined ? avatar : link.avatar,
        url !== undefined ? url : link.url,
        description !== undefined ? description : link.description,
        sort_order !== undefined ? sort_order : link.sort_order,
        id
      ).run()

      const updated = await c.env.DB.prepare(
        'SELECT * FROM friend_links WHERE id = ?'
      ).bind(id).first()

      return c.json(updated)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.delete('/api/links/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const link = await c.env.DB.prepare(
        'SELECT * FROM friend_links WHERE id = ?'
      ).bind(id).first()

      if (!link) {
        return c.json({ error: '友链不存在' }, 404)
      }

      await c.env.DB.prepare('DELETE FROM friend_links WHERE id = ?').bind(id).run()
      return c.json({ message: '删除成功' })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
