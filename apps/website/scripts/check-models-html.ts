import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isIndexableModelPage } from '@/config/indexing'
import { getRoutes } from '@/config/routes'
import { workshopModels } from '@/config/workshop-browse-content'
import { getRouterWorkshopModelDetail } from '@/config/workshop-router-content'
import { auditExampleGallery } from './models-gallery-audit'
import {
  auditMediaLabels,
  auditModelPage,
  auditModelsHub
} from './models-html-audit'

const DIST = join(process.cwd(), 'dist')

function examplesOf(slug: string) {
  const detail = getRouterWorkshopModelDetail(slug)
  if (!detail) throw new Error(`Missing model record: ${slug}`)
  return detail.examples
}

const pagedModels = workshopModels.flatMap(({ href, name, slug }) =>
  href === undefined ? [] : [{ href, name, slug }]
)

const hubPath = getRoutes().workshop
const hubErrors = auditModelsHub(
  readFileSync(join(DIST, hubPath, 'index.html'), 'utf-8'),
  (href) => isIndexableModelPage(href)
).map((error) => `${hubPath}: ${error}`)

const modelErrors = pagedModels.flatMap((model) => {
  const html = readFileSync(join(DIST, model.href, 'index.html'), 'utf-8')
  return [
    ...auditModelPage(html, model.name),
    ...auditMediaLabels(html),
    ...auditExampleGallery(html, examplesOf(model.slug).length)
  ].map((error) => `${model.href}: ${error}`)
})
const errors = [...hubErrors, ...modelErrors]

if (errors.length > 0) {
  console.error(`[models-html] ${errors.length} problem(s):`)
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.warn(
  `[models-html] ${pagedModels.length} model pages carry their model in the HTML; ${hubPath} lists them in its JSON-LD.`
)
