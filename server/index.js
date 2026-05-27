import express from 'express'
import cors from 'cors'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { EventEmitter } from 'events'
import { authMiddleware } from './auth.js'

import authRoutes from './routes/auth.js'
import postsRoutes from './routes/posts.js'
import categoriesRoutes from './routes/categories.js'
import configRoutes from './routes/config.js'
import profileRoutes from './routes/profile.js'
import linksRoutes from './routes/links.js'
import mediaRoutes from './routes/media.js'
import dashboardRoutes from './routes/dashboard.js'
import commentsRoutes from './routes/comments.js'
import emailRoutes from './routes/email.js'

import './db.js'

export const dataEvents = new EventEmitter()
dataEvents.setMaxListeners(100)

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '5mb' }))

app.use('/uploads', express.static(join(__dirname, 'uploads')))

app.use('/api/auth', authMiddleware, authRoutes)
app.use('/api/posts', authMiddleware, postsRoutes)
app.use('/api/categories', authMiddleware, categoriesRoutes)
app.use('/api/config', authMiddleware, configRoutes)
app.use('/api/profile', authMiddleware, profileRoutes)
app.use('/api/links', authMiddleware, linksRoutes)
app.use('/api/media', authMiddleware, mediaRoutes)
app.use('/api/dashboard', authMiddleware, dashboardRoutes)
app.use('/api/comments', (req, res, next) => {
  next()
}, commentsRoutes)

app.use('/api/email', emailRoutes)

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
  res.write('data: {"type":"connected"}\n\n')

  const onDataChange = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  dataEvents.on('change', onDataChange)

  req.on('close', () => {
    dataEvents.off('change', onDataChange)
  })
})

const IS_DEV = process.env.NODE_ENV !== 'production'

if (IS_DEV) {
  const adminDist = join(__dirname, '..', 'admin', 'dist')
  app.use('/admin', express.static(adminDist))
  app.get('/admin/{*splat}', (req, res) => {
    res.sendFile(join(adminDist, 'index.html'))
  })
  console.log('[LiHui] 开发模式: 管理面板使用静态文件 (运行 dev:admin 启动 Vite HMR)')
} else {
  const adminDist = join(__dirname, '..', 'admin', 'dist')
  app.use('/admin', express.static(adminDist))
  app.get('/admin/{*splat}', (req, res) => {
    res.sendFile(join(adminDist, 'index.html'))
  })
}

const astroDist = join(__dirname, '..', 'dist')
const astroClientDist = join(astroDist, 'client')
app.use('/_astro', express.static(join(astroClientDist, '_astro')))

let astroHandler = null
try {
  const astroEntry = await import(join(astroDist, 'server', 'entry.mjs'))
  astroHandler = astroEntry.handler
} catch (e) {
  console.warn('[LiHui] Astro SSR handler 加载失败，前台页面不可用:', e.message)
}

if (astroHandler) {
  app.use((req, res, next) => {
    const urlPath = req.originalUrl || req.url || req.path
    if (urlPath.startsWith('/api/') || urlPath.startsWith('/admin')) {
      return next()
    }
    astroHandler(req, res, next)
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[LiHui] Blog 服务器已启动: http://localhost:${PORT}`)
  console.log(`[LiHui] API 地址: http://localhost:${PORT}/api/`)
  console.log(`[LiHui] 管理面板: http://localhost:${PORT}/admin/`)
})
