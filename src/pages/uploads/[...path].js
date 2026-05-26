import apiApp from '../../lib/cloudflare-api/index.js'

export const ALL = async (context) => {
  const env = context.locals.runtime.env
  return apiApp.fetch(context.request, env, context.locals.runtime.ctx)
}
