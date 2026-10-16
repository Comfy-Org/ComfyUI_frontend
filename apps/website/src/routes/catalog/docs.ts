import type { APIRoute } from 'astro'
import { proxyCatalogDocumentation } from '@/lib/cms/discovery'

export const GET: APIRoute = () =>
  proxyCatalogDocumentation('/api/v1/catalog/docs')
