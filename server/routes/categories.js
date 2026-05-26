import { Router } from 'express'
import db from '../db.js'
import { dataEvents } from '../index.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as postCount
      FROM categories c
      LEFT JOIN posts p ON p.category = c.name
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all()
    res.json(categories)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const { name, slug, description } = req.body

    if (!name || !slug) {
      return res.status(400).json({ error: '分类名称和slug不能为空' })
    }

    const existingName = db.prepare('SELECT id FROM categories WHERE name = ?').get(name)
    if (existingName) {
      return res.status(409).json({ error: '分类名称已存在' })
    }

    const existingSlug = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)
    if (existingSlug) {
      return res.status(409).json({ error: 'slug已存在' })
    }

    const result = db.prepare(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
    ).run(name, slug, description || '')

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
    dataEvents.emit('change', { type: 'create', resource: 'categories' })
    res.status(201).json(category)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
    if (!category) {
      return res.status(404).json({ error: '分类不存在' })
    }

    const { name, slug, description } = req.body

    if (name && name !== category.name) {
      const existingName = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name, req.params.id)
      if (existingName) {
        return res.status(409).json({ error: '分类名称已存在' })
      }
    }

    if (slug && slug !== category.slug) {
      const existingSlug = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, req.params.id)
      if (existingSlug) {
        return res.status(409).json({ error: 'slug已存在' })
      }
    }

    db.prepare(
      'UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?'
    ).run(
      name !== undefined ? name : category.name,
      slug !== undefined ? slug : category.slug,
      description !== undefined ? description : category.description,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', resource: 'categories' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
    if (!category) {
      return res.status(404).json({ error: '分类不存在' })
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id)
    dataEvents.emit('change', { type: 'delete', resource: 'categories' })
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
