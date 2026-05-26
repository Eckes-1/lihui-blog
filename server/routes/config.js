import { Router } from 'express'
import db from '../db.js'
import { dataEvents } from '../index.js'

const router = Router()

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

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM site_config').all()
    const config = flatToNested(rows)
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', (req, res) => {
  try {
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

    const flat = flatten(req.body)
    const upsert = db.prepare(
      `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')`
    )

    const updateMany = db.transaction((items) => {
      for (const [key, value] of items) {
        upsert.run(key, value)
      }
    })
    updateMany(flat)

    const rows = db.prepare('SELECT key, value FROM site_config').all()
    const config = flatToNested(rows)
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:key', (req, res) => {
  try {
    const key = req.params.key
    const exactRow = db.prepare('SELECT key, value FROM site_config WHERE key = ?').get(key)
    if (exactRow) {
      return res.json({ [key]: exactRow.value })
    }

    const allRows = db.prepare('SELECT key, value FROM site_config WHERE key = ? OR key LIKE ?').all(key, `${key}.%`)
    if (allRows.length === 0) {
      return res.status(404).json({ error: '配置项不存在' })
    }

    const config = flatToNested(allRows)
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
