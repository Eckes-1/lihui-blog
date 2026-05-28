export function registerMusicRoutes(app) {
  const CHUNK_SIZE = 500000

  function arrayBufferToBase64(buffer) {
    const uint8 = new Uint8Array(buffer)
    let binaryStr = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length))
      binaryStr += String.fromCharCode.apply(null, chunk)
    }
    return btoa(binaryStr)
  }

  function base64ToBytes(base64) {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  function commaStringToBytes(str) {
    const parts = String(str).split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 255)
    return new Uint8Array(parts)
  }

  function decodeStoredData(data) {
    try {
      return base64ToBytes(data)
    } catch {
      return commaStringToBytes(data)
    }
  }

  async function storeChunks(db, musicId, base64Data) {
    const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE)
    for (let i = 0; i < totalChunks; i++) {
      const chunk = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      await db.prepare(
        'INSERT INTO music_chunks (music_id, chunk_index, data) VALUES (?, ?, ?)'
      ).bind(musicId, i, chunk).run()
    }
  }

  async function readChunks(db, musicId) {
    const { results } = await db.prepare(
      'SELECT chunk_index, data FROM music_chunks WHERE music_id = ? ORDER BY chunk_index'
    ).bind(musicId).all()
    if (!results || results.length === 0) return null
    let combined = ''
    for (const row of results) {
      combined += row.data
    }
    return combined
  }

  async function deleteChunks(db, musicId) {
    await db.prepare('DELETE FROM music_chunks WHERE music_id = ?').bind(musicId).run()
  }

  app.get('/api/music', async (c) => {
    try {
      const { results } = await c.env.DB.prepare(
        'SELECT id, title, artist, filename, path, size, mime_type, duration, cover_path, created_at FROM music ORDER BY created_at DESC'
      ).all()
      return c.json({ songs: results || [] })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.get('/api/music/stream/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const song = await c.env.DB.prepare(
        'SELECT id, title, mime_type FROM music WHERE id = ?'
      ).bind(id).first()

      if (!song) {
        return c.json({ error: '歌曲不存在' }, 404)
      }

      const storedData = await readChunks(c.env.DB, id)
      if (!storedData) {
        return c.json({ error: '音频数据不存在' }, 404)
      }

      const bytes = decodeStoredData(storedData)
      const rangeHeader = c.req.header('Range')

      if (rangeHeader) {
        const matches = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
        if (matches) {
          const start = parseInt(matches[1])
          const end = matches[2] ? parseInt(matches[2]) : bytes.length - 1
          const clampedEnd = Math.min(end, bytes.length - 1)
          const chunk = bytes.slice(start, clampedEnd + 1)
          return new Response(chunk, {
            status: 206,
            headers: {
              'Content-Type': song.mime_type || 'audio/mpeg',
              'Content-Range': `bytes ${start}-${clampedEnd}/${bytes.length}`,
              'Content-Length': String(chunk.length),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=86400',
            }
          })
        }
      }

      return new Response(bytes, {
        headers: {
          'Content-Type': song.mime_type || 'audio/mpeg',
          'Content-Length': String(bytes.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        }
      })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.post('/api/music/upload', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const formData = await c.req.parseBody()
      const file = formData.file
      if (!file) {
        return c.json({ error: '请选择音频文件' }, 400)
      }

      const title = (formData.title || file.name.replace(/\.[^/.]+$/, '')).trim()
      const artist = (formData.artist || '').trim()
      const duration = parseFloat(formData.duration) || 0
      const coverPath = (formData.cover_path || '').trim()

      const ext = file.name.split('.').pop().toLowerCase() || 'mp3'
      const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext
      const path = '/api/music/stream/'

      const mimeMap = {
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
        oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
        flac: 'audio/flac', webm: 'audio/webm', wma: 'audio/x-ms-wma'
      }
      const mimeType = file.type || mimeMap[ext] || 'audio/mpeg'

      const fileBuffer = await file.arrayBuffer()
      const base64Data = arrayBufferToBase64(fileBuffer)

      const result = await c.env.DB.prepare(
        "INSERT INTO music (title, artist, filename, path, size, mime_type, duration, cover_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))"
      ).bind(title, artist, filename, path, file.size, mimeType, duration, coverPath).run()

      const musicId = result.meta.last_row_id

      await c.env.DB.prepare(
        'UPDATE music SET path = ? WHERE id = ?'
      ).bind(path + musicId, musicId).run()

      try {
        await storeChunks(c.env.DB, musicId, base64Data)
      } catch (chunkErr) {
        await c.env.DB.prepare('DELETE FROM music WHERE id = ?').bind(musicId).run()
        return c.json({ error: '音频存储失败: ' + (chunkErr.message || '数据过大') }, 500)
      }

      const song = await c.env.DB.prepare(
        'SELECT id, title, artist, filename, path, size, mime_type, duration, cover_path, created_at FROM music WHERE id = ?'
      ).bind(musicId).first()

      return c.json(song, 201)
    } catch (err) {
      return c.json({ error: '上传失败: ' + (err.message || '服务器内部错误') }, 500)
    }
  })

  app.delete('/api/music/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const song = await c.env.DB.prepare(
        'SELECT * FROM music WHERE id = ?'
      ).bind(id).first()

      if (!song) {
        return c.json({ error: '歌曲不存在' }, 404)
      }

      await deleteChunks(c.env.DB, id)
      await c.env.DB.prepare('DELETE FROM music WHERE id = ?').bind(id).run()

      return c.json({ message: '删除成功' })
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })

  app.put('/api/music/:id', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ error: '未认证' }, 401)

    try {
      const id = c.req.param('id')
      const song = await c.env.DB.prepare(
        'SELECT * FROM music WHERE id = ?'
      ).bind(id).first()

      if (!song) {
        return c.json({ error: '歌曲不存在' }, 404)
      }

      const body = await c.req.json()
      const updates = []
      const values = []

      if (body.title !== undefined) {
        updates.push('title = ?')
        values.push(body.title)
      }
      if (body.artist !== undefined) {
        updates.push('artist = ?')
        values.push(body.artist)
      }
      if (body.cover_path !== undefined) {
        updates.push('cover_path = ?')
        values.push(body.cover_path)
      }

      if (updates.length === 0) {
        return c.json(song)
      }

      values.push(id)
      await c.env.DB.prepare(
        'UPDATE music SET ' + updates.join(', ') + ' WHERE id = ?'
      ).bind(...values).run()

      const updated = await c.env.DB.prepare(
        'SELECT id, title, artist, filename, path, size, mime_type, duration, cover_path, created_at FROM music WHERE id = ?'
      ).bind(id).first()

      return c.json(updated)
    } catch (err) {
      return c.json({ error: '服务器内部错误' }, 500)
    }
  })
}
