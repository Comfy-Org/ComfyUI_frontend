import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import WorkflowPage from './WorkflowPage.vue'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/scripts/posthog'))

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')

const mount = (selected = model) =>
  render(WorkflowPage, {
    props: { model: selected },
    global: { stubs: { WorkflowPlayground: true } }
  })

describe('WorkflowPage header', () => {
  it('sends the shelf it names to that shelf, filtered', () => {
    mount()

    const shelf = screen.getByTestId('workflow-use-case')
    expect(shelf.textContent.trim()).toBe('Edit images')
    expect(shelf.getAttribute('href')).toBe('/hub/workflows/?category=cleanup')
  })

  it('leads back to the workflows page beside a trail to the Hub', () => {
    mount()

    const row = screen.getByTestId('workflow-back-row')
    expect(
      within(row).getByRole('link', { name: 'Back to workflows' })
    ).toHaveAttribute('href', '/hub/workflows/')
    const trail = within(row).getByRole('navigation', { name: 'Breadcrumb' })
    expect(
      within(trail)
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([
      ['Hub', '/hub/'],
      ['Workflows', '/hub/workflows/']
    ])
    expect(within(trail).getByText(model.name)).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('offers the download, the playground and the API as its three paths', () => {
    mount()

    const paths = screen.getByRole('navigation', {
      name: 'Ways to use this workflow'
    })
    expect(
      within(paths)
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([
      ['Download workflow', template.downloadUrl],
      ['Run in Cloud', '#playground'],
      ['API', '#api']
    ])
    expect(
      within(paths).getByRole('link', { name: 'Download workflow' })
    ).toHaveAttribute('download')
  })

  it('scrolls to the section a path names', async () => {
    mount()
    const api = document.createElement('section')
    api.id = 'api'
    const scrollIntoView = vi.fn()
    api.scrollIntoView = scrollIntoView
    document.body.append(api)
    onTestFinished(() => api.remove())

    await userEvent.setup().click(screen.getByRole('link', { name: 'API' }))

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start' })
    )
    expect(location.hash).toBe('#api')
  })

  it('reports workflow downloads from the hero once access is enabled', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    mount()
    const download = screen.getByRole('link', { name: 'Download workflow' })
    download.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })

    await userEvent.setup().click(download)

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'workflow_download_clicked',
      properties: expect.objectContaining({ model_slug: model.slug })
    })
  })

  it('offers no download path for a workflow with no file to download', () => {
    mount({
      ...model,
      workflow: { ...model.workflow, template: undefined }
    })

    expect(screen.queryByRole('link', { name: 'Download workflow' })).toBeNull()
  })

  it('says nothing about a shelf a workflow has none of', () => {
    mount({
      ...model,
      useCases: [],
      task: undefined,
      modality: undefined
    })

    expect(screen.queryByTestId('workflow-use-case')).toBeNull()
  })

  it('leaves the credit and the models to the Details tab', () => {
    mount()

    const hero = screen.getByTestId('workflow-hero')
    expect(hero).toHaveTextContent(model.name)
    expect(hero).not.toHaveTextContent(`Template by ${template.author}`)
    for (const name of template.models) expect(hero).not.toHaveTextContent(name)
  })
})
