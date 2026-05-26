import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const runtime = context.locals.runtime
    const env = runtime?.env
    if (env) {
      ;(globalThis as any).__CF_ENV = env
      if (env.DB) {
        ;(globalThis as any).__D1_DB = env.DB
      }
    }
  } catch (e) {
    console.error('[Middleware] Error accessing runtime:', e)
  }

  try {
    const siteUrl = context.site?.toString().replace(/\/$/, '') ||
      new URL(context.request.url).origin
    ;(globalThis as any).__ASTRO_SITE_URL = siteUrl
  } catch {}

  const response = await next()

  const url = new URL(context.request.url)
  const path = url.pathname

  if (path.startsWith('/admin') || path.startsWith('/api/')) {
    return response
  }

  if (response.status === 200) {
    try {
      const existing = response.headers.get('Cache-Control')
      if (!existing) {
        const newHeaders = new Headers(response.headers)
        newHeaders.set('Cache-Control', 'public, max-age=0, s-maxage=5, must-revalidate')
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        })
      }
    } catch {}
  }

  return response
})
