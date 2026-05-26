import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { JWT_SECRET } from '../auth.js'
import { verifyCode, isEmailConfigured } from '../email.js'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const { username, password, code, email } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) {
      return res.status(400).json({ error: '用户名或密码错误' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(400).json({ error: '用户名或密码错误' })
    }

    if (isEmailConfigured()) {
      if (!code || !email) {
        return res.status(400).json({ error: '请输入邮箱和验证码' })
      }
      if (!verifyCode(email, code)) {
        return res.status(400).json({ error: '验证码无效或已过期' })
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token, user: { id: user.id, username: user.username } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6位' })
    }

    if (!/^[a-zA-Z0-9_.@]{3,30}$/.test(username)) {
      return res.status(400).json({ error: '用户名格式不正确，只允许字母、数字、下划线、点和@，长度3-30位' })
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword)

    const token = jwt.sign(
      { id: result.lastInsertRowid, username },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({ token, user: { id: result.lastInsertRowid, username } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/me', (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码不能为空' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度不能少于6位' })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const valid = await bcrypt.compare(oldPassword, user.password)
    if (!valid) {
      return res.status(400).json({ error: '旧密码错误' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id)

    res.json({ message: '密码修改成功' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
