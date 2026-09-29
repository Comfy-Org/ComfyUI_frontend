import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopModels } from '../src/config/workshop-browse-content'
import { getRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import { auditExampleGallery } from './models-gallery-audit'
import { auditModelPage } from './models-html-audit'

const DIST = join(process.cwd(), 'dist')

const errors = workshopModels.flatMap((model) => {
  const html = readFileSync(
    join(DIST, 'models', model.slug, 'index.html'),
    'utf-8'
  )
  return [
    ...auditModelPage(html, model.name),
    ...auditExampleGallery(
      html,
      getRouterWorkshopModelDetail(model.slug)?.examples ?? []
    )
  ].map((error) => `/models/${model.slug}/: ${error}`)
})

if (errors.length > 0) {
  console.error(`[models-html] ${errors.length} problem(s):`)
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.warn(
  `[models-html] ${workshopModels.length} model pages carry their model in the HTML.`
)
