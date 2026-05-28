import apiApp from '../../lib/cloudflare-api/index.js'

export const ALL = async (context) => {
  const env = context.locals.runtime.env
  try {
    return apiApp.fetch(context.request, env, context.locals.runtime.ctx)
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
