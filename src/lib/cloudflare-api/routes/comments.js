const commentRateLimit = new Map()
const RATE_LIMIT_WINDOW = 600000
const RATE_LIMIT_MAX = 5

function checkCommentRateLimit(ip) {
  const now = Date.now()
  const entry = commentRateLimit.get(ip)
  if (!entry || now - entry.startTime > RATE_LIMIT_WINDOW) {
    commentRateLimit.set(ip, { startTime: now, count: 1 })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

const qqRateLimit = new Map()
const QQ_RATE_WINDOW = 60000
const QQ_RATE_MAX = 10

function checkQqRateLimit(ip) {
  const now = Date.now()
  const entry = qqRateLimit.get(ip)
  if (!entry || now - entry.startTime > QQ_RATE_WINDOW) {
    qqRateLimit.set(ip, { startTime: now, count: 1 })
    return true
  }
  if (entry.count >= QQ_RATE_MAX) return false
  entry.count++
  return true
}

function cleanupCommentRateLimits() {
  const now = Date.now()
  for (const [key, entry] of commentRateLimit) {
    if (now - entry.startTime > RATE_LIMIT_WINDOW) commentRateLimit.delete(key)
  }
  for (const [key, entry] of qqRateLimit) {
    if (now - entry.startTime > QQ_RATE_WINDOW) qqRateLimit.delete(key)
  }
}

function sanitizeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

async function fetchQQInfo(email) {
  if (!email) return { nickname: '', avatar: '' }
  const match = email.match(/^(\d{5,11})@qq\.com$/i)
  if (!match) return { nickname: '', avatar: '' }
  const qq = match[1]
  const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
  let nickname = ''
  try {
    const response = await fetch(`https://apione.apibyte.cn/qqinfo?qq=${qq}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const data = await response.json()
    if (data.code === 200 && data.data?.name) nickname = data.data.name
  } catch {}
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
    contentText: sanitizeHtml(c.content),
    isAdmin: c.is_admin === 1,
    approved: c.approved,
    status: c.approved === 1 ? 'approved' : c.approved === 2 ? 'rejected' : 'pending',
    deleted: c.deleted === 1,
    created_at: c.created_at,
    pubDate: c.created_at,
  }
}

async function purgeCommentsCache(c) {
  try {
    const cache = caches.default
    const base = new URL(c.req.url).origin
    const urlsToPurge = [`${base}/api/comments`]
    for (const url of urlsToPurge) {
      await cache.delete(new Request(url))
    }
  } catch (e) {}
}

export function registerCommentsRoutes(app) {
  app.get('/api/comments', async (c) => {
    try {
      const db = c.env.DB
      const postSlug = c.req.query('post_slug')
      const postId = c.req.query('post_id')
      const page = Math.max(1, parseInt(c.req.query('page')) || 1)
      const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize')) || 50))

      let where = ['approved = 1', 'c.parent_id IS NULL']
      let params = []

      if (postSlug) {
        const post = await db.prepare('SELECT id FROM posts WHERE slug_id = ?').bind(postSlug).first()
        if (post) {
          where.push('post_id = ?')
          params.push(post.id)
        } else {
          return c.json({ success: true, data: { comments: [], pagination: { page, pageSize, total: 0, totalPage: 0 } } })
        }
      } else if (postId) {
        where.push('post_id = ?')
        params.push(postId)
      }

      const whereClause = 'WHERE ' + where.join(' AND ')
      const totalResult = await db.prepare(
        `SELECT COUNT(*) as count FROM comments c ${whereClause} AND c.deleted = 0`
      ).bind(...params).first()
      const total = totalResult?.count || 0

      const { results: rawComments } = await db.prepare(
        `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ${whereClause} ORDER BY c.created_at ASC`
      ).bind(...params).all()

      const parentIds = rawComments.map(c => c.id)
      let repliesMap = {}
      if (parentIds.length > 0) {
        const { results: allReplies } = await db.prepare(
          `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.post_id = ? AND c.parent_id IS NOT NULL AND c.deleted = 0 AND c.approved = 1 ORDER BY c.created_at ASC`
        ).bind(rawComments[0].post_id).all()
        for (const r of allReplies) {
          if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
          repliesMap[r.parent_id].push(r)
        }
      }

      function buildReplyTree(parentId) {
        const directReplies = (repliesMap[parentId] || []).map(formatComment)
        for (const reply of directReplies) {
          reply.replies = buildReplyTree(reply.id)
        }
        return directReplies
      }

      const formatted = rawComments.map(c => {
        const formattedItem = formatComment(c)
        formattedItem.replies = buildReplyTree(c.id)
        return formattedItem
      })

      const { results: configRows } = await db.prepare(
        "SELECT key, value FROM site_config WHERE key LIKE 'comments.%'"
      ).all()
      const commentsConfig = {}
      for (const row of configRows) {
        commentsConfig[row.key] = row.value
      }

      return c.json({
        success: true,
        data: {
          comments: formatted,
          pagination: { page, pageSize, total, totalPage: Math.ceil(total / pageSize) },
          blogger_badge_enabled: commentsConfig['comments.bloggerBadgeEnabled'] || 'false',
          blogger_badge_text: commentsConfig['comments.bloggerBadgeText'] || '',
          placeholder_name: commentsConfig['comments.placeholderName'] || '',
          placeholder_email: commentsConfig['comments.placeholderEmail'] || '',
          placeholder_content: commentsConfig['comments.placeholderContent'] || '',
          placeholder_url: commentsConfig['comments.placeholderUrl'] || '',
          admin_comment_key_configured: commentsConfig['comments.adminCommentKey'] || 'false',
          admin_email_hash: ''
        }
      })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/comments', async (c) => {
    try {
      const db = c.env.DB
      const body = await c.req.json()
      const post_id = body.post_id
      const url = body.url
      const parent_id = body.parent_id
      const username = (body.author || body.username || '').trim()
      const email = (body.email || '').trim()
      const content = (body.content || '').trim()
      const post_slug = (body.post_slug || '').trim().toLowerCase()
      const clientIp = c.req.header('cf-connecting-ip') || 'unknown'
      if (!checkCommentRateLimit(clientIp)) {
        return c.json({ success: false, error: '评论太频繁，请10分钟后再试' }, 429)
      }
      cleanupCommentRateLimits()
      let submitAuthor = username
      let finalPostId = post_id
      let avatar = ''

      if (!submitAuthor || !content) {
        return c.json({ success: false, error: '用户名和内容不能为空' }, 400)
      }

      if (username.length > 50) {
        return c.json({ success: false, error: '用户名不能超过50个字符' }, 400)
      }
      if (content.length > 5000) {
        return c.json({ success: false, error: '评论内容不能超过5000字' }, 400)
      }

      if (email && email.length > 100) {
        return c.json({ success: false, error: '邮箱不能超过100个字符' }, 400)
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return c.json({ success: false, error: '邮箱格式不正确' }, 400)
      }

      if (post_slug && !finalPostId) {
        const post = await db.prepare('SELECT id FROM posts WHERE slug_id = ?').bind(post_slug).first()
        if (!post) return c.json({ success: false, error: '文章不存在' }, 404)
        finalPostId = post.id
      }

      if (post_slug && post_slug.length > 200) {
        return c.json({ success: false, error: '文章标识不合法' }, 400)
      }

      if (!finalPostId) {
        return c.json({ success: false, error: '文章ID不能为空' }, 400)
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

      const result = await db.prepare(
        `INSERT INTO comments (post_id, parent_id, username, email, avatar, content, is_admin, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, datetime('now', '+8 hours'))`
      ).bind(finalPostId, parent_id || null, submitAuthor, email || '', avatar, content).run()

      const comment = await db.prepare(
        'SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?'
      ).bind(result.meta.last_row_id).first()

      await purgeCommentsCache(c)
      return c.json({ success: true, message: '评论提交成功', data: formatComment(comment) }, 201)
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/comments/admin/list', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const page = Math.max(1, parseInt(c.req.query('page')) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize')) || 10))
      const status = c.req.query('status')
      const search = c.req.query('search')
      const sort = c.req.query('sort') || 'desc'
      const startDate = c.req.query('startDate')
      const endDate = c.req.query('endDate')
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
      const totalResult = await db.prepare(
        `SELECT COUNT(*) as count FROM comments c ${whereClause}`
      ).bind(...params).first()
      const total = totalResult?.count || 0

      const orderDir = sort === 'asc' ? 'ASC' : 'DESC'
      const { results: rawComments } = await db.prepare(
        `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ${whereClause} ORDER BY c.created_at ${orderDir} LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all()

      const parentIds = rawComments.map(rc => rc.id)
      let repliesMap = {}
      if (parentIds.length > 0) {
        const postIds = [...new Set(rawComments.map(rc => rc.post_id).filter(Boolean))]
        if (postIds.length > 0) {
          const placeholders = postIds.map(() => '?').join(',')
          const { results: allReplies } = await db.prepare(
            `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.post_id IN (${placeholders}) AND c.parent_id IS NOT NULL AND c.deleted = 0 ORDER BY c.created_at ASC`
          ).bind(...postIds).all()
          for (const r of allReplies) {
            if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
            repliesMap[r.parent_id].push(r)
          }
        }
      }

      function buildAdminReplyTree(parentId) {
        const directReplies = (repliesMap[parentId] || []).map(formatComment)
        for (const reply of directReplies) {
          reply.replies = buildAdminReplyTree(reply.id)
        }
        return directReplies
      }

      const comments = rawComments.map(rc => {
        const formatted = formatComment(rc)
        formatted.replies = buildAdminReplyTree(rc.id)
        return formatted
      })

      const totalAllResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id IS NULL').first()
      const approvedAllResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 1 AND parent_id IS NULL').first()
      const pendingAllResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 0 AND parent_id IS NULL').first()
      const rejectedAllResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 2 AND parent_id IS NULL').first()
      const deletedAllResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE deleted = 1 AND parent_id IS NULL').first()
      const todayAllResult = await db.prepare("SELECT COUNT(*) as count FROM comments WHERE date(created_at) = date('now','+8 hours') AND parent_id IS NULL").first()

      return c.json({
        success: true,
        data: {
          comments,
          pagination: { page, pageSize, total, totalPage: Math.ceil(total / pageSize) },
          stats: {
            total: totalAllResult?.count || 0,
            approved: approvedAllResult?.count || 0,
            pending: pendingAllResult?.count || 0,
            rejected: rejectedAllResult?.count || 0,
            deleted: deletedAllResult?.count || 0,
            today: todayAllResult?.count || 0,
          }
        }
      })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/comments/admin/stats', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const totalResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE parent_id IS NULL').first()
      const approvedResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 1 AND parent_id IS NULL').first()
      const pendingResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 0 AND parent_id IS NULL').first()
      const rejectedResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE approved = 2 AND parent_id IS NULL').first()
      const deletedResult = await db.prepare('SELECT COUNT(*) as count FROM comments WHERE deleted = 1 AND parent_id IS NULL').first()
      const todayResult = await db.prepare("SELECT COUNT(*) as count FROM comments WHERE date(created_at) = date('now','+8 hours') AND parent_id IS NULL").first()

      return c.json({
        success: true,
        data: {
          total: totalResult?.count || 0,
          approved: approvedResult?.count || 0,
          pending: pendingResult?.count || 0,
          rejected: rejectedResult?.count || 0,
          deleted: deletedResult?.count || 0,
          today: todayResult?.count || 0,
        }
      })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/comments/admin/export', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const status = c.req.query('status')
      let where = ['c.deleted = 0']
      let params = []

      if (status === 'approved') {
        where.push('c.approved = 1')
      } else if (status === 'rejected') {
        where.push('c.approved = 2')
      } else if (status === 'pending') {
        where.push('c.approved = 0')
      }

      const whereClause = 'WHERE ' + where.join(' AND ')
      const { results: rawComments } = await db.prepare(
        `SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ${whereClause} ORDER BY c.created_at DESC`
      ).bind(...params).all()

      const header = 'ID,作者,邮箱,内容,状态,文章,创建时间\n'
      const rows = rawComments.map(c => {
        const statusMap = { 0: '待审核', 1: '已通过', 2: '已拒绝' }
        const content = (c.content || '').replace(/"/g, '""').replace(/\n/g, ' ')
        const author = (c.username || '').replace(/"/g, '""')
        const email = (c.email || '').replace(/"/g, '""')
        const postTitle = (c.post_title || '').replace(/"/g, '""')
        const safeContent = /^[=+\-@]/.test(content) ? '\t' + content : content
        const safeAuthor = /^[=+\-@]/.test(author) ? '\t' + author : author
        const safeEmail = /^[=+\-@]/.test(email) ? '\t' + email : email
        const safePostTitle = /^[=+\-@]/.test(postTitle) ? '\t' + postTitle : postTitle
        return `${c.id},"${safeAuthor}","${safeEmail}","${safeContent}","${statusMap[c.approved] || '未知'}","${safePostTitle}","${c.created_at || ''}"`
      }).join('\n')

      return c.text('\uFEFF' + header + rows, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=comments_export.csv'
      })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/comments/admin/batch', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const { ids, action } = await c.req.json()
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return c.json({ success: false, error: '请选择评论' }, 400)
      }
      if (ids.length > 100) {
        return c.json({ success: false, error: '单次操作不能超过100条' }, 400)
      }
      if (!['approve', 'reject', 'delete'].includes(action)) {
        return c.json({ success: false, error: '无效的操作' }, 400)
      }

      const placeholders = ids.map(() => '?').join(',')
      let affected = 0

      if (action === 'delete') {
        const result = await db.prepare(
          `UPDATE comments SET deleted = 1 WHERE id IN (${placeholders})`
        ).bind(...ids).run()
        affected = result.meta.changes
      } else if (action === 'approve') {
        const result = await db.prepare(
          `UPDATE comments SET approved = 1 WHERE id IN (${placeholders})`
        ).bind(...ids).run()
        affected = result.meta.changes
      } else if (action === 'reject') {
        const result = await db.prepare(
          `UPDATE comments SET approved = 2 WHERE id IN (${placeholders})`
        ).bind(...ids).run()
        affected = result.meta.changes
      }

      await purgeCommentsCache(c)
      return c.json({ success: true, message: `成功处理 ${affected} 条评论`, data: { affected } })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/comments/admin/status', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const id = c.req.query('id')
      const status = c.req.query('status')
      if (!id) return c.json({ success: false, error: '评论ID不能为空' }, 400)

      const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first()
      if (!comment) return c.json({ success: false, error: '评论不存在' }, 404)

      let approved
      if (status === 'approved') approved = 1
      else if (status === 'rejected') approved = 2
      else if (status === 'deleted') {
        await db.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').bind(id).run()
        await purgeCommentsCache(c)
        return c.json({ success: true, message: '已移至回收站' })
      } else if (status === 'pending') approved = 0
      else return c.json({ success: false, error: '无效的状态' }, 400)

      await db.prepare('UPDATE comments SET approved = ? WHERE id = ?').bind(approved, id).run()
      const updated = await db.prepare(
        'SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?'
      ).bind(id).first()

      return c.json({ success: true, data: formatComment(updated) })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/comments/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const id = c.req.param('id')
      const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first()
      if (!comment) return c.json({ success: false, error: '评论不存在' }, 404)

      const { approved, content } = await c.req.json()
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

      if (updates.length === 0) return c.json({ success: false, error: '没有要更新的字段' }, 400)

      params.push(id)
      await db.prepare(`UPDATE comments SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

      const updated = await db.prepare(
        'SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?'
      ).bind(id).first()

      return c.json({ success: true, data: formatComment(updated) })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.delete('/api/comments/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const id = c.req.param('id')
      const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first()
      if (!comment) return c.json({ success: false, error: '评论不存在' }, 404)

      if (comment.deleted === 1) {
        await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run()
        await purgeCommentsCache(c)
        return c.json({ success: true, message: '已彻底删除' })
      } else {
        await db.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').bind(id).run()
        await purgeCommentsCache(c)
        return c.json({ success: true, message: '已移至回收站' })
      }
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/comments/:id/restore', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const id = c.req.param('id')
      const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first()
      if (!comment) return c.json({ success: false, error: '评论不存在' }, 404)
      if (comment.deleted !== 1) return c.json({ success: false, error: '该评论未被删除' }, 400)

      await db.prepare('UPDATE comments SET deleted = 0 WHERE id = ?').bind(id).run()
      const updated = await db.prepare(
        'SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?'
      ).bind(id).first()

      await purgeCommentsCache(c)
      return c.json({ success: true, data: formatComment(updated), message: '已恢复' })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.delete('/api/comments/:id/permanent', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const id = c.req.param('id')
      const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first()
      if (!comment) return c.json({ success: false, error: '评论不存在' }, 404)

      await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run()
      await purgeCommentsCache(c)
      return c.json({ success: true, message: '已彻底删除' })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/comments/:id/reply', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const db = c.env.DB
      const id = c.req.param('id')
      const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first()
      if (!comment) return c.json({ success: false, error: '评论不存在' }, 404)

      const { content, email } = await c.req.json()
      if (!content) return c.json({ success: false, error: '回复内容不能为空' }, 400)

      if (content.length > 5000) {
        return c.json({ success: false, error: '回复内容不能超过5000字' }, 400)
      }

      let username = user.username
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

      const result = await db.prepare(
        `INSERT INTO comments (post_id, parent_id, username, email, avatar, content, is_admin, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, datetime('now', '+8 hours'))`
      ).bind(comment.post_id, comment.id, username, finalEmail, avatar, content).run()

      const reply = await db.prepare(
        'SELECT c.*, p.slug_id as post_slug, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?'
      ).bind(result.meta.last_row_id).first()

      await purgeCommentsCache(c)
      return c.json({ success: true, data: formatComment(reply) }, 201)
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/comments/qq-info', async (c) => {
    try {
      const qq = c.req.query('qq')
      if (!qq || !/^\d{5,11}$/.test(qq)) {
        return c.json({ success: false, error: '无效的QQ号' }, 400)
      }

      const clientIp = c.req.header('cf-connecting-ip') || 'unknown'
      if (!checkQqRateLimit(clientIp)) {
        return c.json({ success: false, error: '请求太频繁' }, 429)
      }

      const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
      let nickname = ''

      try {
        const response = await fetch(`https://apione.apibyte.cn/qqinfo?qq=${qq}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        })
        const data = await response.json()
        if (data.code === 200 && data.data?.name) {
          nickname = data.data.name
        }
      } catch {}

      if (!nickname) {
        nickname = `QQ用户${qq.slice(-4)}`
      }

      return c.json({ success: true, data: { qq, nickname, avatar: avatarUrl } })
    } catch (err) {
      return c.json({ success: false, error: '服务器内部错误' }, 500)
    }
  })
}
