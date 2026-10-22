import { describe, expect, it } from 'vitest'

import { hubModelSlugs } from '@/config/hub-models'
import { workshopPagePaths } from '@/config/workshop-page-content'
import { prepareModelPage } from '@/routes/models/model-page'
import { detailPageHead } from './detail-head'
import { modelTitle, workflowTitle } from './model-title'

const SITE = 'https://comfy.org'

async function staticPage(id: string) {
  const page = await prepareModelPage(id)
  if (page.kind !== 'page') throw new Error(`${id} is a redirect`)
  return page
}

describe(detailPageHead, () => {
  it('gives a static workflow page the workflow title, JSON-LD and crumbs', async () => {
    const page = await staticPage(workshopPagePaths[0])
    expect(page.model.workflowId).toBeDefined()
    const head = detailPageHead(page, `${SITE}${page.model.href}`, SITE)
    expect(head.title).toBe(workflowTitle(page.model))
    expect(head.jsonLd.extraJsonLd[0]).toMatchObject({
      '@type': 'SoftwareSourceCode'
    })
    expect(head.jsonLd.breadcrumbs[1]).toMatchObject({
      url: `${SITE}/hub/workflows/`
    })
  })

  it('gives a model page the model title', async () => {
    const [id] = hubModelSlugs.keys()
    const page = await staticPage(id)
    const head = detailPageHead(page, `${SITE}${page.model.href}`, SITE)
    expect(head.title).toBe(modelTitle(page.model))
  })
})
