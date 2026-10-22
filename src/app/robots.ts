import type { MetadataRoute } from 'next'

// App interno: nenhum buscador deve indexar (A2)
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
