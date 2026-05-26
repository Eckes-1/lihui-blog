import { Router } from 'express'
import db from '../db.js'

const router = Router()

router.get('/stats', (req, res) => {
  try {
    const totalPosts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count
    const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get().count
    const pendingComments = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 0').get().count
    const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get().count
    const totalMedia = db.prepare('SELECT COUNT(*) as count FROM media').get().count

    const recentPosts = db.prepare(
      'SELECT id, title, slug_id, draft, created_at FROM posts ORDER BY created_at DESC LIMIT 5'
    ).all()

    const recentComments = db.prepare(
      `SELECT c.id, c.post_id, c.username, c.content, c.approved, c.created_at, p.title as post_title
       FROM comments c LEFT JOIN posts p ON c.post_id = p.id
       ORDER BY c.created_at DESC LIMIT 5`
    ).all()

    res.json({
      totalPosts,
      totalComments,
      pendingComments,
      totalCategories,
      totalMedia,
      recentPosts,
      recentComments
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
