import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { workshopPages } from '@/config/workshop-page-content'
import { prepareModelPage } from '@/routes/models/model-page'
import {
  useWorkshopAuthFlag,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import ModelPage from './ModelPage.vue'

vi.mock(import('@/scripts/posthog'))

let workflowsEnabled: Ref<boolean>

beforeEach(() => {
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
  workflowsEnabled = ref(true)
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
    readonly(workflowsEnabled)
  )
})

const usedSlug = workshopPages.find(
  (page) => page.name === 'Nano Banana Pro Image Edit'
)?.slug
if (!usedSlug) throw new Error('Missing Nano Banana Pro Image Edit')

async function pageFor(slug: string) {
  const page = await prepareModelPage(slug)
  if (page.kind !== 'page') throw new Error(`${slug} is not a page`)
  const { model } = page
  if (model.workflow !== undefined)
    throw new Error(`${slug} is a workflow, not a hosted model`)
  return { ...page, model }
}

const usedPage = await pageFor(usedSlug)
const unusedPage = await pageFor('bfl--flux-2-max--generate-images')

describe('ModelPage', () => {
  it('puts the way back and a sentence-case breadcrumb on one row', () => {
    render(ModelPage, { props: { page: usedPage } })

    const trail = screen.getByTestId('model-trail')
    expect(within(trail).getByTestId('model-back')).toBeTruthy()
    const crumbs = within(trail).getByRole('navigation', {
      name: 'Breadcrumb'
    })
    expect(crumbs).toHaveClass('max-sm:hidden')
    expect(
      within(crumbs)
        .getAllByRole('listitem')
        .map((item) => item.textContent.replace('›', '').trim())
    ).toEqual(['Hub', 'Models', usedPage.model.name])
    expect(
      within(crumbs).getByRole('link', { name: 'Hub' }).getAttribute('href')
    ).toBe('/hub/')
    expect(
      within(crumbs).getByRole('link', { name: 'Models' }).getAttribute('href')
    ).toBe('/hub/models/')
  })

  it('offers three ways to use the model under the summary', async () => {
    const scroll = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)
    onTestFinished(() => scroll.mockRestore())
    render(ModelPage, { props: { page: usedPage } })

    const paths = screen.getByRole('list', { name: 'Ways to use this model' })
    const run = within(paths).getByRole('link', { name: 'Run here' })
    const cloud = within(paths).getByRole('link', { name: 'Open in Cloud' })
    const api = within(paths).getByRole('link', { name: 'Use via API' })
    expect(run.getAttribute('href')).toBe('#playground')
    expect(cloud.getAttribute('href')).toBe(WORKSHOP_CLOUD_BASE_URL)
    expect(cloud.getAttribute('target')).toBe('_blank')
    expect(api.getAttribute('href')).toBe('#api')

    const visitor = userEvent.setup()
    await visitor.click(run)
    await visitor.click(api)
    expect(scroll.mock.contexts).toEqual([
      expect.objectContaining({ id: 'playground' }),
      expect.objectContaining({ id: 'api' })
    ])
  })

  it('lists the real workflows that use the model, behind the workflows flag', async () => {
    render(ModelPage, { props: { page: usedPage } })

    const row = await screen.findByRole('region', {
      name: `Workflows that use ${usedPage.model.name}`
    })
    const hrefs = within(row)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/hub/workflows/virtual-try-on/')

    workflowsEnabled.value = false
    await vi.waitFor(() =>
      expect(screen.queryByTestId('model-workflows')).toBeNull()
    )
  })

  it('leaves the row out when no workflow names the model', async () => {
    expect(unusedPage.workflows).toEqual([])
    render(ModelPage, { props: { page: unusedPage } })
    await screen.findByTestId('model-hero')
    expect(screen.queryByTestId('model-workflows')).toBeNull()
  })
})
