export function registerCategoriesRoutes(app) {
  app.get('/api/categories', async (c) => {
    try {
      const { results: categories } = await c.env.DB.prepare(`
        SELECT c.*, COUNT(p.id) as postCount
        FROM categories c
        LEFT JOIN posts p ON p.category = c.name
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `).all()

      return c.json(categories)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/categories', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const { name, slug, description } = await c.req.json()

      if (!name || !slug) {
        return c.json({ error: '分类名称和slug不能为空' }, 400)
      }

      const existingName = await c.env.DB.prepare(
        'SELECT id FROM categories WHERE name = ?'
      ).bind(name).first()
      if (existingName) {
        return c.json({ error: '分类名称已存在' }, 409)
      }

      const existingSlug = await c.env.DB.prepare(
        'SELECT id FROM categories WHERE slug = ?'
      ).bind(slug).first()
      if (existingSlug) {
        return c.json({ error: 'slug已存在' }, 409)
      }

      const { meta } = await c.env.DB.prepare(
        "INSERT INTO categories (name, slug, description, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))"
      ).bind(name, slug, description || '').run()

      const category = await c.env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(meta.last_row_id).first()

      return c.json(category, 201)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/categories/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const category = await c.env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first()

      if (!category) {
        return c.json({ error: '分类不存在' }, 404)
      }

      const { name, slug, description } = await c.req.json()

      if (name && name !== category.name) {
        const existingName = await c.env.DB.prepare(
          'SELECT id FROM categories WHERE name = ? AND id != ?'
        ).bind(name, id).first()
        if (existingName) {
          return c.json({ error: '分类名称已存在' }, 409)
        }
      }

      if (slug && slug !== category.slug) {
        const existingSlug = await c.env.DB.prepare(
          'SELECT id FROM categories WHERE slug = ? AND id != ?'
        ).bind(slug, id).first()
        if (existingSlug) {
          return c.json({ error: 'slug已存在' }, 409)
        }
      }

      await c.env.DB.prepare(
        'UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?'
      ).bind(
        name !== undefined ? name : category.name,
        slug !== undefined ? slug : category.slug,
        description !== undefined ? description : category.description,
        id
      ).run()

      const updated = await c.env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first()

      return c.json(updated)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.delete('/api/categories/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const category = await c.env.DB.prepare(
        'SELECT * FROM categories WHERE id = ?'
      ).bind(id).first()

      if (!category) {
        return c.json({ error: '分类不存在' }, 404)
      }

      await c.env.DB.prepare(
        'DELETE FROM categories WHERE id = ?'
      ).bind(id).run()

      return c.json({ message: '删除成功' })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
