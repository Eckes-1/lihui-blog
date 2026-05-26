import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../auth.js'
import { dataEvents } from '../index.js'

const router = Router()

async function fetchQQInfo(email) {
  if (!email) return { nickname: '', avatar: '' }
  const match = email.match(/^(\d{5,11})@qq\.com$/i)
  if (!match) return { nickname: '', avatar: '' }
  const qq = match[1]
  const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  let nickname = ''
  try {
    const response = await fetch(`https://apione.apibyte.cn/qqinfo?qq=${qq}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    const data = await response.json()
    if (data.code === 200 && data.data && data.data.name) {
      nickname = data.data.name
    }
  } catch (e) {
    console.log('[QQ] 昵称接口失败:', e.message)
  }
  return { nickname, avatar: avatarUrl }
}

function formatComment(c) {
  let avatar = c.avatar || ''
  if (!avatar && c.email) {
    const match = c.email.match(/^(\d{5,11})@qq\.com$/i)
    if (match) avatar = `https://q1.qlogo.cn/g?b=qq&nk=${match[1]}&s=100`
  }
  return {
    id: c.id,
    post_id: c.post_id,
    postSlug: c.post_slug || '',
    postTitle: c.post_title || '',
    parent_id: c.parent_id,
    author: c.username,
    email: c.email || '',
    avatar,
    content: c.content,
    contentText: c.content,
    isAdmin: c.is_admin === 1,
    approved: c.approved,
    status: c.approved === 1 ? 'approved' : c.approved === 2 ? 'rejected' : 'pending',
    deleted: c.deleted === 1,
    created_at: c.created_at,
    pubDate: c.created_at,
  }
}

router.get('/', (req, res) => {
  try {
    const postSlug = req.query.post_slug
    const postId = req.query.post_id
    const nested = req.query.nested === 'true'
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 50))

    let where = ['approved = 1', 'c.parent_id IS NULL']
    let params = []

    if (postSlug) {
      const post = db.prepare('SELECT id FROM posts WHERE slug_id = ?').get(postSlug)
      if (post) {
        where.push('post_id = ?')
        params.push(post.id)
      } else {
        return res.json({ success: true, data: { comments: [], pagination: { page, pageSize, total: 0, totalPage: 0 } } })
      }
    } else if (postId) {
      where.push('post_id = ?')
      params.push(postId)
    }

    const whereClause = 'WHERE ' + where.join(' AND ')
    const total = db.prepare(`SELECT COUNT(*) as count FROM comments c ${whereClause} AND c.deleted = 0`).get(...params).count
    const rawComments = db.prepare(
      `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ${whereClause} ORDER BY c.created_at ASC`
    ).all(...params)

    const formatted = rawComments.map(c => {
      const formattedItem = formatComment(c)
      const rawReplies = db.prepare(
        `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.parent_id = ? AND c.deleted = 0 AND c.approved = 1 ORDER BY c.created_at ASC`
      ).all(c.id)
      formattedItem.replies = rawReplies.map(formatComment)
      return formattedItem
    })

    if (nested) {
      res.json({ success: true, data: { comments: formatted, pagination: { page, pageSize, total, totalPage: Math.ceil(total / pageSize) } } })
    } else {
      res.json({ success: true, data: { comments: formatted, pagination: { page, pageSize, total, totalPage: Math.ceil(total / pageSize) } } })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { post_slug, post_id, author, username, email, content, url, parent_id } = req.body
    let submitAuthor = author || username
    let finalPostId = post_id
    let avatar = ''

    if (!submitAuthor || !content) {
      return res.status(400).json({ success: false, error: '用户名和内容不能为空' })
    }

    if (post_slug && !finalPostId) {
      const post = db.prepare('SELECT id FROM posts WHERE slug_id = ?').get(post_slug)
      if (!post) return res.status(404).json({ success: false, error: '文章不存在' })
      finalPostId = post.id
    }

    if (!finalPostId) {
      return res.status(400).json({ success: false, error: '文章ID不能为空' })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: '邮箱格式不正确' })
    }

    if (email) {
      const qqInfo = await fetchQQInfo(email)
      if (qqInfo.nickname && qqInfo.nickname.length >= 2 && !qqInfo.nickname.startsWith('QQ用户')) {
        submitAuthor = qqInfo.nickname
      }
      if (qqInfo.avatar) {
        avatar = qqInfo.avatar
      }
    }

    const result = db.prepare(
      `INSERT INTO comments (post_id, parent_id, username, email, avatar, content, is_admin, approved) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`
    ).run(finalPostId, parent_id || null, submitAuthor, email || '', avatar, content)

    const comment = db.prepare('SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?').get(result.lastInsertRowid)
    dataEvents.emit('change', { type: 'new', comment: formatComment(comment) })
    res.status(201).json({ success: true, message: '评论提交成功', data: formatComment(comment) })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/admin/list', authMiddleware, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10))
    const status = req.query.status
    const search = req.query.search
    const sort = req.query.sort || 'desc'
    const startDate = req.query.startDate
    const endDate = req.query.endDate
    const offset = (page - 1) * pageSize

    let where = ['c.parent_id IS NULL']
    let params = []

    if (status === 'approved') {
      where.push('c.approved = 1')
      where.push('c.deleted = 0')
    } else if (status === 'rejected') {
      where.push('c.approved = 2')
      where.push('c.deleted = 0')
    } else if (status === 'pending') {
      where.push('c.approved = 0')
      where.push('c.deleted = 0')
    } else if (status === 'deleted') {
      where.push('c.deleted = 1')
    } else {
      where.push('c.deleted = 0')
    }

    if (search && search.trim()) {
      const keyword = `%${search.trim()}%`
      where.push('(c.username LIKE ? OR c.email LIKE ? OR c.content LIKE ?)')
      params.push(keyword, keyword, keyword)
    }

    if (startDate) {
      where.push('c.created_at >= ?')
      params.push(startDate + ' 00:00:00')
    }
    if (endDate) {
      where.push('c.created_at <= ?')
      params.push(endDate + ' 23:59:59')
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''
    const total = db.prepare(`SELECT COUNT(*) as count FROM comments c ${whereClause}`).get(...params).count

    const orderDir = sort === 'asc' ? 'ASC' : 'DESC'
    const rawComments = db.prepare(
      `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ${whereClause} ORDER BY c.created_at ${orderDir} LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset)

    const comments = rawComments.map(c => {
      const formatted = formatComment(c)
      const rawReplies = db.prepare(
        `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.parent_id = ? AND c.deleted = 0 ORDER BY c.created_at ASC`
      ).all(c.id)
      formatted.replies = rawReplies.map(formatComment)
      return formatted
    })

    const totalAll = db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id IS NULL').get().count
    const approvedAll = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 1 AND parent_id IS NULL').get().count
    const pendingAll = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 0 AND parent_id IS NULL').get().count
    const rejectedAll = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 2 AND parent_id IS NULL').get().count
    const deletedAll = db.prepare('SELECT COUNT(*) as count FROM comments WHERE deleted = 1 AND parent_id IS NULL').get().count
    const todayAll = db.prepare("SELECT COUNT(*) as count FROM comments WHERE date(created_at) = date('now') AND parent_id IS NULL").get().count

    res.json({
      success: true,
      data: {
        comments,
        pagination: { page, pageSize, total, totalPage: Math.ceil(total / pageSize) },
        stats: { total: totalAll, approved: approvedAll, pending: pendingAll, rejected: rejectedAll, deleted: deletedAll, today: todayAll }
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/admin/stats', authMiddleware, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id IS NULL').get().count
    const approved = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 1 AND parent_id IS NULL').get().count
    const pending = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 0 AND parent_id IS NULL').get().count
    const rejected = db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 2 AND parent_id IS NULL').get().count
    const deleted = db.prepare('SELECT COUNT(*) as count FROM comments WHERE deleted = 1 AND parent_id IS NULL').get().count
    const today = db.prepare("SELECT COUNT(*) as count FROM comments WHERE date(created_at) = date('now') AND parent_id IS NULL").get().count
    res.json({ success: true, data: { total, approved, pending, rejected, deleted, today } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/admin/export', authMiddleware, (req, res) => {
  try {
    const status = req.query.status
    let where = []
    let params = []

    if (status === 'approved') {
      where.push('c.approved = 1')
    } else if (status === 'rejected') {
      where.push('c.approved = 2')
    } else if (status === 'pending') {
      where.push('c.approved = 0')
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''
    const rawComments = db.prepare(
      `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ${whereClause} ORDER BY c.created_at DESC`
    ).all(...params)

    const header = 'ID,作者,邮箱,内容,状态,文章,创建时间\n'
    const rows = rawComments.map(c => {
      const statusMap = { 0: '待审核', 1: '已通过', 2: '已拒绝' }
      const content = (c.content || '').replace(/"/g, '""').replace(/\n/g, ' ')
      const author = (c.username || '').replace(/"/g, '""')
      const email = (c.email || '').replace(/"/g, '""')
      const postTitle = (c.post_title || '').replace(/"/g, '""')
      return `${c.id},"${author}","${email}","${content}","${statusMap[c.approved] || '未知'}","${postTitle}","${c.created_at || ''}"`
    }).join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=comments_export.csv')
    res.send('\uFEFF' + header + rows)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/admin/batch', authMiddleware, (req, res) => {
  try {
    const { ids, action } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择评论' })
    }
    if (!['approve', 'reject', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的操作' })
    }

    const placeholders = ids.map(() => '?').join(',')
    let affected = 0

    if (action === 'delete') {
      const result = db.prepare(`UPDATE comments SET deleted = 1 WHERE id IN (${placeholders})`).run(...ids)
      affected = result.changes
    } else if (action === 'approve') {
      const result = db.prepare(`UPDATE comments SET approved = 1 WHERE id IN (${placeholders})`).run(...ids)
      affected = result.changes
    } else if (action === 'reject') {
      const result = db.prepare(`UPDATE comments SET approved = 2 WHERE id IN (${placeholders})`).run(...ids)
      affected = result.changes
    }

    dataEvents.emit('change', { type: 'batch', action, ids })
    res.json({ success: true, message: `成功处理 ${affected} 条评论`, data: { affected } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/admin/status', authMiddleware, (req, res) => {
  try {
    const { id, status } = req.query
    if (!id) return res.status(400).json({ success: false, error: '评论ID不能为空' })

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id)
    if (!comment) return res.status(404).json({ success: false, error: '评论不存在' })

    let approved
    if (status === 'approved') approved = 1
    else if (status === 'rejected') approved = 2
    else if (status === 'deleted') {
      db.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').run(id)
      dataEvents.emit('change', { type: 'delete', id })
      return res.json({ success: true, message: '已移至回收站' })
    } else if (status === 'pending') approved = 0
    else return res.status(400).json({ success: false, error: '无效的状态' })

    db.prepare('UPDATE comments SET approved = ? WHERE id = ?').run(approved, id)
    const updated = db.prepare('SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?').get(id)
    dataEvents.emit('change', { type: 'status', id, status, comment: formatComment(updated) })
    res.json({ success: true, data: formatComment(updated) })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id)
    if (!comment) return res.status(404).json({ success: false, error: '评论不存在' })

    const { approved, content } = req.body
    const updates = []
    const params = []

    if (approved !== undefined) {
      updates.push('approved = ?')
      params.push(approved ? 1 : 0)
    }
    if (content !== undefined) {
      updates.push('content = ?')
      params.push(content)
    }

    if (updates.length === 0) return res.status(400).json({ success: false, error: '没有要更新的字段' })

    params.push(req.params.id)
    db.prepare(`UPDATE comments SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    const updated = db.prepare('SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', id: parseInt(req.params.id), comment: formatComment(updated) })
    res.json({ success: true, data: formatComment(updated) })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id)
    if (!comment) return res.status(404).json({ success: false, error: '评论不存在' })

    if (comment.deleted === 1) {
      db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
      dataEvents.emit('change', { type: 'delete', id: parseInt(req.params.id) })
      res.json({ success: true, message: '已彻底删除' })
    } else {
      db.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').run(req.params.id)
      dataEvents.emit('change', { type: 'delete', id: parseInt(req.params.id) })
      res.json({ success: true, message: '已移至回收站' })
    }
  } catch (err) { res.status(500).json({ success: false, error: err.message }) }
})

router.put('/:id/restore', authMiddleware, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id)
    if (!comment) return res.status(404).json({ success: false, error: '评论不存在' })
    if (comment.deleted !== 1) return res.status(400).json({ success: false, error: '该评论未被删除' })

    db.prepare('UPDATE comments SET deleted = 0 WHERE id = ?').run(req.params.id)
    const updated = db.prepare('SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?').get(req.params.id)
    dataEvents.emit('change', { type: 'update', id: parseInt(req.params.id), comment: formatComment(updated) })
    res.json({ success: true, data: formatComment(updated), message: '已恢复' })
  } catch (err) { res.status(500).json({ success: false, error: err.message }) }
})

router.delete('/:id/permanent', authMiddleware, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id)
    if (!comment) return res.status(404).json({ success: false, error: '评论不存在' })

    db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
    dataEvents.emit('change', { type: 'delete', id: parseInt(req.params.id) })
    res.json({ success: true, message: '已彻底删除' })
  } catch (err) { res.status(500).json({ success: false, error: err.message }) }
})

router.post('/:id/reply', authMiddleware, async (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id)
    if (!comment) return res.status(404).json({ success: false, error: '评论不存在' })

    const { content, email } = req.body
    if (!content) return res.status(400).json({ success: false, error: '回复内容不能为空' })

    let username = req.user.username
    let avatar = ''
    let finalEmail = email || ''

    if (finalEmail) {
      const qqInfo = await fetchQQInfo(finalEmail)
      if (qqInfo.nickname && qqInfo.nickname.length >= 2 && !qqInfo.nickname.startsWith('QQ用户')) {
        username = qqInfo.nickname
      }
      if (qqInfo.avatar) {
        avatar = qqInfo.avatar
      }
    }

    const result = db.prepare(
      `INSERT INTO comments (post_id, parent_id, username, email, avatar, content, is_admin, approved) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`
    ).run(comment.post_id, comment.id, username, finalEmail, avatar, content)

    const reply = db.prepare('SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?').get(result.lastInsertRowid)
    dataEvents.emit('change', { type: 'new', comment: formatComment(reply) })
    res.status(201).json({ success: true, data: formatComment(reply) })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/qq-info', async (req, res) => {
  try {
    const { qq } = req.query
    if (!qq || !/^\d{5,11}$/.test(qq)) {
      return res.status(400).json({ success: false, error: '无效的QQ号' })
    }

    const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
    let nickname = ''

    try {
      const response = await fetch(`https://apione.apibyte.cn/qqinfo?qq=${qq}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      const data = await response.json()
      if (data.code === 200 && data.data && data.data.name) {
        nickname = data.data.name
      }
    } catch (e) {
      console.log('[QQ] 昵称接口失败:', e.message)
    }

    if (!nickname) {
      nickname = `QQ用户${qq.slice(-4)}`
    }

    res.json({
      success: true,
      data: {
        qq,
        nickname,
        avatar: avatarUrl
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
