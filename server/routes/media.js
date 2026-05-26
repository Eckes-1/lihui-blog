import { Router } from 'express'
import multer from 'multer'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, unlinkSync } from 'fs'
import db from '../db.js'
import { dataEvents } from '../index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

const storage = multer.diskStorage({
  destination: join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = file.originalname.split('.').pop()
    cb(null, uniqueSuffix + '.' + ext)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型，仅允许上传图片文件'), false)
    }
  }
})

const router = Router()

router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20))
    const offset = (page - 1) * pageSize

    const total = db.prepare('SELECT COUNT(*) as count FROM media').get().count
    const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset)

    res.json({
      media,
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

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' })
    }

    const { originalname, filename, size, mimetype, path: filepath } = req.file
    const alt_text = req.body.alt_text || ''

    const result = db.prepare(
      'INSERT INTO media (filename, path, size, mime_type, alt_text) VALUES (?, ?, ?, ?, ?)'
    ).run(originalname, `/uploads/${filename}`, size, mimetype, alt_text)

    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid)
    dataEvents.emit('change', { type: 'create', resource: 'media' })
    res.status(201).json(media)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
    if (!media) {
      return res.status(404).json({ error: '媒体文件不存在' })
    }

    const filePath = join(__dirname, '..', media.path)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }

    db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id)
    dataEvents.emit('change', { type: 'delete', resource: 'media' })
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
    if (!media) {
      return res.status(404).json({ error: '媒体文件不存在' })
    }

    const { alt_text } = req.body
    db.prepare('UPDATE media SET alt_text = ? WHERE id = ?').run(
      alt_text !== undefined ? alt_text : media.alt_text,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', resource: 'media' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
