export function registerPostsRoutes(app) {
  async function purgePostCache(c, slug) {
    try {
      const cache = caches.default
      const base = new URL(c.req.url).origin
      const urlsToPurge = [
        `${base}/api/posts`,
        `${base}/api/posts/stats`,
      ]
      if (slug) {
        urlsToPurge.push(`${base}/api/posts/${slug}`)
        urlsToPurge.push(`${base}/blog/${slug}`)
      }
      urlsToPurge.push(`${base}/`)
      urlsToPurge.push(`${base}/blog`)
      for (const url of urlsToPurge) {
        const req = new Request(url)
        await cache.delete(req)
      }
    } catch (e) {}
  }

  app.get('/api/posts', async (c) => {
    try {
      const page = Math.max(1, parseInt(c.req.query('page')) || 1)
      const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize')) || 10))
      const category = c.req.query('category')
      const draft = c.req.query('draft')
      const search = c.req.query('search')
      const slugId = c.req.query('slugId')
      const sort = c.req.query('sort') || 'desc'
      const offset = (page - 1) * pageSize

      let where = []
      let params = []

      if (slugId) {
        where.push('slug_id = ?')
        params.push(slugId)
      }
      if (category) {
        where.push('category = ?')
        params.push(category)
      }
      if (draft !== undefined && draft !== '') {
        where.push('draft = ?')
        const draftVal = draft === 'false' || draft === '0' ? 0 : 1
        params.push(draftVal)
      }
      if (search) {
        where.push('(title LIKE ? OR content LIKE ?)')
        params.push(`%${search}%`, `%${search}%`)
      }

      const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''

      const { count } = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM posts ${whereClause}`
      ).bind(...params).first()

      const orderDir = sort === 'asc' ? 'ASC' : 'DESC'
      const { results: posts } = await c.env.DB.prepare(
        `SELECT * FROM posts ${whereClause} ORDER BY pin_top DESC, pub_date ${orderDir}, created_at ${orderDir} LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all()

      return c.json({
        posts,
        pagination: {
          page,
          pageSize,
          total: count,
          totalPages: Math.ceil(count / pageSize)
        }
      })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/posts/stats', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM posts').first()
      const publishedRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM posts WHERE draft = 0').first()
      const draftRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM posts WHERE draft = 1').first()
      const pinnedRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM posts WHERE pin_top > 0').first()
      const todayRow = await c.env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE date(created_at) = date('now', '+8 hours')").first()

      return c.json({
        total: totalRow.count,
        published: publishedRow.count,
        draft: draftRow.count,
        pinned: pinnedRow.count,
        today: todayRow.count
      })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/posts/batch', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const body = await c.req.json()
      const { ids, action } = body
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return c.json({ error: '请选择文章' }, 400)
      }
      if (ids.length > 100) {
        return c.json({ error: '单次操作不能超过100条' }, 400)
      }

      const placeholders = ids.map(() => '?').join(',')

      if (action === 'delete') {
        await c.env.DB.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).bind(...ids).run()
        await purgePostCache(c)
        return c.json({ message: `已删除 ${ids.length} 篇文章` })
      }

      if (action === 'publish') {
        await c.env.DB.prepare(`UPDATE posts SET draft = 0, updated_at = datetime('now', '+8 hours') WHERE id IN (${placeholders})`).bind(...ids).run()
        await purgePostCache(c)
        return c.json({ message: `已发布 ${ids.length} 篇文章` })
      }

      if (action === 'draft') {
        await c.env.DB.prepare(`UPDATE posts SET draft = 1, updated_at = datetime('now', '+8 hours') WHERE id IN (${placeholders})`).bind(...ids).run()
        await purgePostCache(c)
        return c.json({ message: `已转为草稿 ${ids.length} 篇文章` })
      }

      if (action === 'pin') {
        await c.env.DB.prepare(`UPDATE posts SET pin_top = 1, updated_at = datetime('now', '+8 hours') WHERE id IN (${placeholders})`).bind(...ids).run()
        await purgePostCache(c)
        return c.json({ message: `已置顶 ${ids.length} 篇文章` })
      }

      if (action === 'unpin') {
        await c.env.DB.prepare(`UPDATE posts SET pin_top = 0, updated_at = datetime('now', '+8 hours') WHERE id IN (${placeholders})`).bind(...ids).run()
        await purgePostCache(c)
        return c.json({ message: `已取消置顶 ${ids.length} 篇文章` })
      }

      if (action === 'moveCategory') {
        const { category } = body
        await c.env.DB.prepare(`UPDATE posts SET category = ?, updated_at = datetime('now', '+8 hours') WHERE id IN (${placeholders})`).bind(category, ...ids).run()
        await purgePostCache(c)
        return c.json({ message: `已移动 ${ids.length} 篇文章到分类「${category || '未分类'}」` })
      }

      return c.json({ error: '未知操作' }, 400)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/posts/:id', async (c) => {
    try {
      const post = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(c.req.param('id')).first()

      if (!post) {
        return c.json({ error: '文章不存在' }, 404)
      }
      return c.json(post)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/posts', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const { title, slug_id, content, description, image, category, pin_top, draft, pub_date } = await c.req.json()

      if (!title || !slug_id) {
        return c.json({ error: '标题和slug_id不能为空' }, 400)
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug_id)) {
        return c.json({ error: 'slug_id格式不正确，只允许小写字母、数字和连字符' }, 400)
      }

      const existing = await c.env.DB.prepare(
        'SELECT id FROM posts WHERE slug_id = ?'
      ).bind(slug_id).first()
      if (existing) {
        return c.json({ error: 'slug_id已存在' }, 409)
      }

      const { meta } = await c.env.DB.prepare(
        `INSERT INTO posts (title, slug_id, content, description, image, category, pin_top, draft, pub_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), date('now', '+8 hours')), datetime('now', '+8 hours'), datetime('now', '+8 hours'))`
      ).bind(
        title,
        slug_id,
        content || '',
        description || '',
        image || '',
        category || '',
        pin_top || 0,
        draft !== undefined ? draft : 0,
        pub_date || ''
      ).run()

      const post = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(meta.last_row_id).first()

      await purgePostCache(c, slug_id)
      return c.json(post, 201)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/posts/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const post = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first()

      if (!post) {
        return c.json({ error: '文章不存在' }, 404)
      }

      const { title, slug_id, content, description, image, category, pin_top, draft, pub_date } = await c.req.json()

      if (slug_id && slug_id !== post.slug_id) {
        const existing = await c.env.DB.prepare(
          'SELECT id FROM posts WHERE slug_id = ? AND id != ?'
        ).bind(slug_id, id).first()
        if (existing) {
          return c.json({ error: 'slug_id已存在' }, 409)
        }
      }

      await c.env.DB.prepare(
        `UPDATE posts SET title = ?, slug_id = ?, content = ?, description = ?, image = ?, category = ?,
         pin_top = ?, draft = ?, pub_date = ?, updated_at = datetime('now', '+8 hours') WHERE id = ?`
      ).bind(
        title !== undefined ? title : post.title,
        slug_id !== undefined ? slug_id : post.slug_id,
        content !== undefined ? content : post.content,
        description !== undefined ? description : post.description,
        image !== undefined ? image : post.image,
        category !== undefined ? category : post.category,
        pin_top !== undefined ? pin_top : post.pin_top,
        draft !== undefined ? draft : post.draft,
        pub_date !== undefined ? pub_date : post.pub_date,
        id
      ).run()

      const updated = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first()

      await purgePostCache(c, updated.slug_id || post.slug_id)
      return c.json(updated)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.delete('/api/posts/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const post = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first()

      if (!post) {
        return c.json({ error: '文章不存在' }, 404)
      }

      await c.env.DB.prepare(
        'DELETE FROM posts WHERE id = ?'
      ).bind(id).run()

      await purgePostCache(c, post.slug_id)
      return c.json({ message: '删除成功' })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/posts/:id/clone', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
      if (!post) return c.json({ error: '文章不存在' }, 404)

      const newSlug = post.slug_id + '-copy'
      let suffix = 1
      let slugToUse = newSlug
      while (true) {
        const existing = await c.env.DB.prepare('SELECT id FROM posts WHERE slug_id = ?').bind(slugToUse).first()
        if (!existing) break
        suffix++
        slugToUse = `${newSlug}-${suffix}`
      }

      const { meta } = await c.env.DB.prepare(
        `INSERT INTO posts (title, slug_id, content, description, image, category, pin_top, draft, pub_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, date('now', '+8 hours'), datetime('now', '+8 hours'), datetime('now', '+8 hours'))`
      ).bind(
        post.title + ' (副本)',
        slugToUse,
        post.content || '',
        post.description || '',
        post.image || '',
        post.category || ''
      ).run()

      const cloned = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(meta.last_row_id).first()
      await purgePostCache(c, slugToUse)
      return c.json(cloned, 201)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/posts/:id/toggle-draft', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const post = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first()

      if (!post) {
        return c.json({ error: '文章不存在' }, 404)
      }

      const newDraft = post.draft === 0 ? 1 : 0
      await c.env.DB.prepare(
        "UPDATE posts SET draft = ?, updated_at = datetime('now', '+8 hours') WHERE id = ?"
      ).bind(newDraft, id).run()

      const updated = await c.env.DB.prepare(
        'SELECT * FROM posts WHERE id = ?'
      ).bind(id).first()

      await purgePostCache(c, post.slug_id)
      return c.json(updated)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/posts/:id/toggle-pin', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
      if (!post) return c.json({ error: '文章不存在' }, 404)

      const newPin = post.pin_top ? 0 : 1
      await c.env.DB.prepare("UPDATE posts SET pin_top = ?, updated_at = datetime('now', '+8 hours') WHERE id = ?").bind(newPin, id).run()

      const updated = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
      await purgePostCache(c, post.slug_id)
      return c.json(updated)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
