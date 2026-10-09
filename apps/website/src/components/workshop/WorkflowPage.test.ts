import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { defineComponent, h, readonly, ref } from 'vue'

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

const PlaygroundStub = defineComponent({
  render: () => h('div', { 'data-testid': 'workflow-playground' })
})

const mount = (selected = model) =>
  render(WorkflowPage, {
    props: { model: selected },
    global: {
      stubs: { WorkflowPlayground: PlaygroundStub, WorkflowGraph: true }
    }
  })

// The More like this row reads the catalogue; nothing here reaches the network.
beforeEach(() => {
  vi.mocked(fetch).mockImplementation(async () => Response.error())
})

describe('WorkflowPage header', () => {
  it('leads back to the workflows page through one trail to the Hub', () => {
    mount()

    const row = screen.getByTestId('workflow-back-row')
    expect(
      within(row).getByRole('link', { name: 'Back to Workflows' })
    ).toHaveAttribute('href', '/hub/workflows/')
    expect(within(row).getAllByRole('link')).toHaveLength(3)
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

  it('leads with Comfy Cloud, then the download and the API, with no Run here up top', () => {
    mount()

    const paths = screen.getByRole('navigation', {
      name: 'Ways to use this workflow'
    })
    expect(
      within(paths)
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([
      [
        'Try in Comfy Cloud (opens in a new tab)',
        expect.stringContaining(`?template=${template.id}`)
      ],
      ['Download workflow', template.downloadUrl],
      ['API', '#api']
    ])
    expect(
      within(paths).getByRole('link', { name: /Try in Comfy Cloud/ })
    ).toHaveAttribute('data-variant', 'default')
    expect(within(paths).queryByRole('link', { name: 'Run here' })).toBeNull()
    expect(
      within(paths).getByRole('link', { name: 'Download workflow' })
    ).toHaveAttribute('download')
    expect(
      within(paths).getByRole('link', { name: /Try in Comfy Cloud/ })
    ).toHaveAttribute('target', '_blank')
  })

  it.for([
    { kind: 'needs a server of its own', change: { type: 'SERVERLESS' } },
    {
      kind: 'has no graph prepared for Cloud',
      change: { workflow: { ...model.workflow, cloud: undefined } }
    },
    {
      kind: 'is incomplete',
      change: { incompleteReason: 'missing-input-schema' }
    }
  ] as const)(
    'offers no run and no API for a workflow that $kind',
    ({ change }) => {
      mount({ ...model, ...change })

      const paths = screen.getByRole('navigation', {
        name: 'Ways to use this workflow'
      })
      expect(
        within(paths)
          .getAllByRole('link')
          .map((link) => link.textContent.trim())
      ).toEqual([
        'Try in Comfy Cloud (opens in a new tab)',
        'Download workflow'
      ])
      expect(
        within(paths).getByRole('link', { name: /Try in Comfy Cloud/ })
      ).toHaveAttribute('data-variant', 'default')
      expect(screen.queryByTestId('workflow-playground')).toBeNull()
      expect(screen.getByTestId('workflow-inside')).toBeTruthy()
      expect(screen.queryByTestId('workflow-actions')).toBeNull()
      expect(screen.getAllByRole('link', { name: /Download/ })).toHaveLength(1)
    }
  )

  it('puts the playground on a workflow that runs here', () => {
    mount()

    expect(screen.getByTestId('workflow-playground')).toBeTruthy()
    expect(screen.queryByTestId('workflow-inside')).toBeNull()
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

  it.for([
    { name: 'Download workflow', event: 'workflow_download_clicked' },
    { name: /Try in Comfy Cloud/, event: 'try_in_cloud_clicked' }
  ])(
    'reports $event from the hero once access is enabled',
    async ({ name, event }) => {
      vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
      vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
        readonly(ref(true))
      )
      mount()
      const link = screen.getByRole('link', { name })
      link.addEventListener('click', (click) => click.preventDefault(), {
        once: true
      })

      await userEvent.setup().click(link)

      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: event,
        properties: expect.objectContaining({
          model_slug: model.slug,
          page_type: 'workflow',
          workflow_id: model.workflowId
        })
      })
    }
  )

  it('reports no hero clicks while Workflows access is off', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(false)))
    mount()
    const visitor = userEvent.setup()
    for (const name of ['Download workflow', /Try in Comfy Cloud/]) {
      const link = screen.getByRole('link', { name })
      link.addEventListener('click', (click) => click.preventDefault(), {
        once: true
      })
      await visitor.click(link)
    }

    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('offers no download path for a workflow with no file to download', () => {
    mount({
      ...model,
      workflow: { ...model.workflow, template: undefined }
    })

    expect(screen.queryByRole('link', { name: 'Download workflow' })).toBeNull()
  })

  it('leaves the credit and the models to the Details tab', () => {
    mount()

    const hero = screen.getByTestId('workflow-hero')
    expect(hero).toHaveTextContent(model.name)
    expect(hero).not.toHaveTextContent(`Template by ${template.author}`)
    for (const name of template.models) expect(hero).not.toHaveTextContent(name)
  })
})
