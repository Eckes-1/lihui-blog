import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const baseUrl = site?.href ? new URL(site.href).origin : 'https://eckes.de5.net'
  const sitemapUrl = new URL('sitemap-index.xml', baseUrl).href

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    }
  )
}