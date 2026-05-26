import { Router } from 'express'
import db from '../db.js'
import { dataEvents } from '../index.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10))
    const category = req.query.category
    const draft = req.query.draft
    const search = req.query.search
    const slugId = req.query.slugId
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

    const total = db.prepare(`SELECT COUNT(*) as count FROM posts ${whereClause}`).get(...params).count

    const posts = db.prepare(
      `SELECT * FROM posts ${whereClause} ORDER BY pin_top DESC, pub_date DESC, created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset)

    res.json({
      posts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
    if (!post) {
      return res.status(404).json({ error: '文章不存在' })
    }
    res.json(post)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const { title, slug_id, content, description, image, category, pin_top, draft, pub_date } = req.body

    if (!title || !slug_id) {
      return res.status(400).json({ error: '标题和slug_id不能为空' })
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug_id)) {
      return res.status(400).json({ error: 'slug_id格式不正确，只允许小写字母、数字和连字符' })
    }

    const existing = db.prepare('SELECT id FROM posts WHERE slug_id = ?').get(slug_id)
    if (existing) {
      return res.status(409).json({ error: 'slug_id已存在' })
    }

    const result = db.prepare(
      `INSERT INTO posts (title, slug_id, content, description, image, category, pin_top, draft, pub_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title,
      slug_id,
      content || '',
      description || '',
      image || '',
      category || '',
      pin_top || 0,
      draft !== undefined ? draft : 0,
      pub_date || new Date().toISOString().slice(0, 10)
    )

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid)
    dataEvents.emit('change', { type: 'create', resource: 'posts' })
    res.status(201).json(post)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
    if (!post) {
      return res.status(404).json({ error: '文章不存在' })
    }

    const { title, slug_id, content, description, image, category, pin_top, draft, pub_date } = req.body

    if (slug_id && slug_id !== post.slug_id) {
      const existing = db.prepare('SELECT id FROM posts WHERE slug_id = ? AND id != ?').get(slug_id, req.params.id)
      if (existing) {
        return res.status(409).json({ error: 'slug_id已存在' })
      }
    }

    db.prepare(
      `UPDATE posts SET title = ?, slug_id = ?, content = ?, description = ?, image = ?, category = ?,
       pin_top = ?, draft = ?, pub_date = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(
      title !== undefined ? title : post.title,
      slug_id !== undefined ? slug_id : post.slug_id,
      content !== undefined ? content : post.content,
      description !== undefined ? description : post.description,
      image !== undefined ? image : post.image,
      category !== undefined ? category : post.category,
      pin_top !== undefined ? pin_top : post.pin_top,
      draft !== undefined ? draft : post.draft,
      pub_date !== undefined ? pub_date : post.pub_date,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', resource: 'posts' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
    if (!post) {
      return res.status(404).json({ error: '文章不存在' })
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id)
    dataEvents.emit('change', { type: 'delete', resource: 'posts' })
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/toggle-draft', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
    if (!post) {
      return res.status(404).json({ error: '文章不存在' })
    }

    const newDraft = post.draft === 0 ? 1 : 0
    db.prepare('UPDATE posts SET draft = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(newDraft, req.params.id)

    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', resource: 'posts' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
