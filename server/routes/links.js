import { Router } from 'express'
import db from '../db.js'
import { dataEvents } from '../index.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const links = db.prepare('SELECT * FROM friend_links ORDER BY sort_order ASC, created_at ASC').all()
    res.json(links)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const { name, avatar, url, description, sort_order } = req.body

    if (!name || !url) {
      return res.status(400).json({ error: '名称和链接不能为空' })
    }

    try {
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: '链接必须以 http:// 或 https:// 开头' })
      }
    } catch {
      return res.status(400).json({ error: '链接格式不正确' })
    }

    const result = db.prepare(
      'INSERT INTO friend_links (name, avatar, url, description, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(name, avatar || '', url, description || '', sort_order || 0)

    const link = db.prepare('SELECT * FROM friend_links WHERE id = ?').get(result.lastInsertRowid)
    dataEvents.emit('change', { type: 'create', resource: 'links' })
    res.status(201).json(link)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/reorder', (req, res) => {
  try {
    const { order } = req.body
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order必须为数组' })
    }

    const updateMany = db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        db.prepare('UPDATE friend_links SET sort_order = ? WHERE id = ?').run(i, items[i])
      }
    })
    updateMany(order)

    const links = db.prepare('SELECT * FROM friend_links ORDER BY sort_order ASC, created_at ASC').all()
    dataEvents.emit('change', { type: 'update', resource: 'links' })
    res.json(links)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const link = db.prepare('SELECT * FROM friend_links WHERE id = ?').get(req.params.id)
    if (!link) {
      return res.status(404).json({ error: '友链不存在' })
    }

    const { name, avatar, url, description, sort_order } = req.body

    db.prepare(
      'UPDATE friend_links SET name = ?, avatar = ?, url = ?, description = ?, sort_order = ? WHERE id = ?'
    ).run(
      name !== undefined ? name : link.name,
      avatar !== undefined ? avatar : link.avatar,
      url !== undefined ? url : link.url,
      description !== undefined ? description : link.description,
      sort_order !== undefined ? sort_order : link.sort_order,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM friend_links WHERE id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', resource: 'links' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const link = db.prepare('SELECT * FROM friend_links WHERE id = ?').get(req.params.id)
    if (!link) {
      return res.status(404).json({ error: '友链不存在' })
    }

    db.prepare('DELETE FROM friend_links WHERE id = ?').run(req.params.id)
    dataEvents.emit('change', { type: 'delete', resource: 'links' })
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
