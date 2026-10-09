import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
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

  it('leads back to the workflows page', () => {
    mount()

    expect(
      screen.getByRole('link', { name: 'Back to workflows' })
    ).toHaveAttribute('href', '/hub/workflows/')
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

  it('offers only the download up top, leaving the run to the form', () => {
    mount()

    const actions = within(screen.getByTestId('workflow-hero')).getByTestId(
      'workflow-actions'
    )
    expect(
      within(actions)
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([['Download workflow JSON', template.downloadUrl]])
    expect(
      within(actions).getByRole('link', { name: 'Download workflow JSON' })
    ).toHaveAttribute('download')
    expect(within(actions).queryByRole('button')).toBeNull()
    expect(within(actions).queryByText(/cloud|run|sign in/i)).toBeNull()
  })

  it('offers no actions for a workflow with no template', () => {
    mount({
      ...model,
      workflow: { ...model.workflow, template: undefined }
    })

    expect(screen.queryByTestId('workflow-actions')).toBeNull()
  })

  it('reports the download once access is enabled', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    mount()
    const link = screen.getByRole('link', { name: 'Download workflow JSON' })
    link.addEventListener('click', (click) => click.preventDefault(), {
      once: true
    })

    await userEvent.setup().click(link)

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'workflow_download_clicked',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        workflow_id: model.workflowId
      })
    })
  })

  it('reports no download while Workflows access is off', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(false)))
    mount()
    const link = screen.getByRole('link', { name: 'Download workflow JSON' })
    link.addEventListener('click', (click) => click.preventDefault(), {
      once: true
    })
    await userEvent.setup().click(link)

    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })
})
