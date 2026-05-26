import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'momo-blog-secret-key-2026'

export function authMiddleware(req, res, next) {
  if (req.method === 'GET') {
    return next()
  }

  const path = req.path || ''
  if (path.endsWith('/login') || path.endsWith('/register')) {
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }

  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期' })
  }
}
