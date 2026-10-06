import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopModels } from '@/config/workshop-browse-content'
import { getRouterWorkshopModelDetail } from '@/config/workshop-router-content'
import { auditExampleGallery } from './models-gallery-audit'
import {
  auditMediaLabels,
  auditModelDefinition,
  auditModelPage
} from './models-html-audit'

const DIST = join(process.cwd(), 'dist')

function detailOf(slug: string) {
  const detail = getRouterWorkshopModelDetail(slug)
  if (!detail) throw new Error(`Missing model record: ${slug}`)
  return detail
}

const pagedModels = workshopModels.flatMap(({ href, slug }) =>
  href === undefined ? [] : [{ href, detail: detailOf(slug) }]
)

const errors = pagedModels.flatMap(({ href, detail }) => {
  const html = readFileSync(join(DIST, href, 'index.html'), 'utf-8')
  return [
    ...auditModelPage(html, detail.name),
    ...auditModelDefinition(html, detail),
    ...auditMediaLabels(html),
    ...auditExampleGallery(html, detail.examples.length)
  ].map((error) => `${href}: ${error}`)
})

if (errors.length > 0) {
  console.error(`[models-html] ${errors.length} problem(s):`)
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.warn(
  `[models-html] ${pagedModels.length} model pages carry their model in the HTML.`
)
