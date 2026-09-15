import type { APIRoute, GetStaticPaths } from 'astro'

import { workshopModels } from '../../config/workshop-browse-content'
import { prepareModelPage } from './model-page'

export const getStaticPaths: GetStaticPaths = () =>
  workshopModels.map((model) => ({ params: { slug: model.slug } }))

export const GET: APIRoute = async ({ params }) => {
  const page = await prepareModelPage(params.slug)
  if (page.kind !== 'page') throw new Error('Expected a canonical Models route')
  return new Response(
    JSON.stringify({
      ...page,
      model: { ...page.model, form: undefined }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
