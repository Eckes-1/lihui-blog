import { Router } from 'express'
import db from '../db.js'
import { dataEvents } from '../index.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const rows = db.prepare("SELECT key, value FROM site_config WHERE key LIKE 'profile.%'").all()
    const profile = {}
    for (const row of rows) {
      const key = row.key.replace('profile.', '')
      profile[key] = row.value
    }
    res.json(profile)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', (req, res) => {
  try {
    const upsert = db.prepare(
      `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')`
    )

    const updateMany = db.transaction((fields) => {
      for (const [key, value] of Object.entries(fields)) {
        upsert.run(`profile.${key}`, String(value))
      }
    })
    updateMany(req.body)

    const rows = db.prepare("SELECT key, value FROM site_config WHERE key LIKE 'profile.%'").all()
    const profile = {}
    for (const row of rows) {
      const key = row.key.replace('profile.', '')
      profile[key] = row.value
    }
    res.json(profile)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
