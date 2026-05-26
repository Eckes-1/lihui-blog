function getDB(): any {
  if (typeof globalThis !== 'undefined') {
    if ((globalThis as any).__D1_DB) return (globalThis as any).__D1_DB
    const cfEnv = (globalThis as any).__CF_ENV
    if (cfEnv?.DB) {
      ;(globalThis as any).__D1_DB = cfEnv.DB
      return cfEnv.DB
    }
  }
  return null
}

function flatToNested(rows: Array<{ key: string; value: string }>): any {
  const result: any = {}
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

function resolveDB(explicitDB?: any): any {
  return explicitDB || getDB()
}

export async function getPosts(params?: { page?: number; pageSize?: number; category?: string; draft?: string; db?: any }) {
  const db = resolveDB(params?.db)
  if (db) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.min(50, Math.max(1, params?.pageSize || 10))
    const offset = (page - 1) * pageSize

    let where: string[] = []
    let sqlParams: any[] = []

    if (params?.category) {
      where.push('category = ?')
      sqlParams.push(params.category)
    }
    if (params?.draft !== undefined) {
      where.push('draft = ?')
      sqlParams.push(params.draft === 'false' || params.draft === '0' ? 0 : 1)
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''

    const { count } = await db.prepare(
      `SELECT COUNT(*) as count FROM posts ${whereClause}`
    ).bind(...sqlParams).first()

    const { results: posts } = await db.prepare(
      `SELECT * FROM posts ${whereClause} ORDER BY pin_top DESC, pub_date DESC, created_at DESC LIMIT ? OFFSET ?`
    ).bind(...sqlParams, pageSize, offset).all()

    return {
      posts,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    }
  }

  return { posts: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
}

export async function getPost(id: number, db?: any) {
  db = resolveDB(db)
  if (db) {
    const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
    if (!post) throw new Error('API Error: 404 文章不存在')
    return post
  }
  return null
}

export async function getPostBySlug(slug: string, db?: any) {
  db = resolveDB(db)
  if (db) {
    const post = await db.prepare('SELECT * FROM posts WHERE slug_id = ? AND draft = 0').bind(slug).first()
    return post || null
  }
  return null
}

export async function getAllPosts(db?: any) {
  db = resolveDB(db)
  if (db) {
    const { results: posts } = await db.prepare(
      'SELECT * FROM posts WHERE draft = 0 ORDER BY pin_top DESC, pub_date DESC, created_at DESC'
    ).all()
    return { posts, pagination: { page: 1, pageSize: 1000, total: posts.length, totalPages: 1 } }
  }
  return { posts: [], pagination: { page: 1, pageSize: 1000, total: 0, totalPages: 0 } }
}

export async function getCategories(db?: any) {
  db = resolveDB(db)
  if (db) {
    const { results: categories } = await db.prepare(`
      SELECT c.*, COUNT(p.id) as postCount
      FROM categories c
      LEFT JOIN posts p ON p.category = c.name
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all()
    return categories
  }
  return []
}

export async function getConfig(db?: any) {
  db = resolveDB(db)
  if (db) {
    const { results } = await db.prepare('SELECT key, value FROM site_config').all()
    return flatToNested(results)
  }
  return {}
}

export async function getProfile(db?: any) {
  db = resolveDB(db)
  if (db) {
    const { results } = await db.prepare(
      "SELECT key, value FROM site_config WHERE key LIKE 'profile.%'"
    ).all()
    const profile: any = {}
    for (const row of results) {
      const key = row.key.replace('profile.', '')
      profile[key] = row.value
    }
    return profile
  }
  return {}
}

export async function getFriendLinks(db?: any) {
  db = resolveDB(db)
  if (db) {
    const { results } = await db.prepare(
      'SELECT * FROM friend_links ORDER BY sort_order ASC, created_at ASC'
    ).all()
    return results
  }
  return []
}

export async function getDashboardStats(token: string) {
  const db = getDB()
  if (db) {
    const [postCount, commentCount, categoryCount, linkCount] = await Promise.all([
      db.prepare('SELECT COUNT(*) as c FROM posts').first(),
      db.prepare('SELECT COUNT(*) as c FROM comments').first(),
      db.prepare('SELECT COUNT(*) as c FROM categories').first(),
      db.prepare('SELECT COUNT(*) as c FROM friend_links').first(),
    ])
    return {
      postCount: (postCount as any)?.c || 0,
      commentCount: (commentCount as any)?.c || 0,
      categoryCount: (categoryCount as any)?.c || 0,
      linkCount: (linkCount as any)?.c || 0,
    }
  }
  return {}
}
