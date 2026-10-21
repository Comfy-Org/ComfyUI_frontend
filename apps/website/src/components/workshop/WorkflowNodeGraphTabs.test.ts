import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import WorkflowNodeGraphTabs from './WorkflowNodeGraphTabs.vue'

const graph = {
  nodes: [
    { type: 'LoadAudio', properties: { cnr_id: 'comfy-core' } },
    { type: 'LoadImage', title: 'Load Character Image' },
    { type: 'Separate', properties: { cnr_id: 'comfyui-kjnodes' } }
  ]
}

const workflow: NodeGraphWorkflow = {
  name: 'Make your character sing',
  description: ['Animates a character.', 'Then renders it.'],
  graphSource: '/workflow-graphs/singing-character.json',
  downloadUrl: '/workflow-graphs/singing-character.json',
  cloudHref: 'https://cloud.comfy.org/?share=0123456789ab',
  models: ['Wan2.1 InfiniteTalk'],
  output: 'video',
  author: 'hellorob',
  examples: []
}

function renderTabs(
  overrides: Partial<NodeGraphWorkflow> = {},
  respond: () => Response = () => Response.json(graph)
) {
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(respond()))
  return render(WorkflowNodeGraphTabs, {
    props: { workflow: { ...workflow, ...overrides } },
    slots: { api: '<p>Catalog API panel</p>' },
    global: { stubs: { WorkflowGraph: true } }
  })
}

async function openTab(name: string) {
  const tab = screen.getByRole('tab', { name })
  await userEvent.setup().click(tab)
  return tab
}

describe('WorkflowNodeGraphTabs', () => {
  it('mirrors the runnable tabs and opens on Overview', () => {
    renderTabs()

    expect(
      screen.getAllByRole('tab').map((tab) => tab.textContent.trim())
    ).toEqual(['Overview', 'Details', 'API'])
    expect(
      screen
        .getByRole('tab', { name: 'Overview' })
        .getAttribute('aria-selected')
    ).toBe('true')
  })

  it('reads what the reader provides from the graph, images first', async () => {
    renderTabs()

    expect(screen.getByTestId('node-graph-inputs-loading')).toBeTruthy()
    const inputs = within(screen.getByTestId('node-graph-inputs'))
    await vi.waitFor(() =>
      expect(
        inputs.getAllByRole('listitem').map((item) => item.textContent.trim())
      ).toEqual(['Character image', 'Audio'])
    )
  })

  it('pins Try in Cloud in the About footer when the workflow opens in Cloud', () => {
    renderTabs()

    const footer = within(screen.getByTestId('node-graph-footer'))
    expect(
      footer.getByRole('link', { name: /Try in Cloud/i }).getAttribute('href')
    ).toBe(workflow.cloudHref)
  })

  it('offers Download in the footer when the workflow cannot open in Cloud', async () => {
    const { emitted } = renderTabs({ cloudHref: undefined })

    const footer = within(screen.getByTestId('node-graph-footer'))
    expect(footer.queryByRole('link', { name: /Try in Cloud/i })).toBeNull()
    await userEvent
      .setup()
      .click(footer.getByRole('link', { name: /Download workflow/i }))
    expect(emitted('download')).toHaveLength(1)
  })

  it('lists the graph’s custom node packs on the Details tab', async () => {
    renderTabs()
    const tab = await openTab('Details')

    expect(tab.getAttribute('aria-selected')).toBe('true')
    const packs = within(screen.getByTestId('workflow-custom-nodes'))
    await vi.waitFor(() =>
      expect(packs.getByText('ComfyUI-KJNodes')).toBeVisible()
    )
    expect(
      packs.getByRole('heading', { name: 'Requires custom nodes' })
    ).toBeVisible()
  })

  it('shows the API panel it is given on the API tab', async () => {
    renderTabs()
    await openTab('API')

    expect(screen.getByRole('tabpanel', { name: 'API' })).toBeVisible()
    expect(screen.getByText('Catalog API panel')).toBeVisible()
  })

  it('says the graph could not be read instead of listing no needs', async () => {
    renderTabs({}, () => new Response('', { status: 404 }))

    await vi.waitFor(() =>
      expect(screen.getByTestId('node-graph-inputs-failed')).toBeTruthy()
    )
    expect(screen.getByTestId('workflow-custom-nodes-failed')).toBeTruthy()
  })

  it('lets a workflow with several versions pick the graph it shows', async () => {
    const files = [
      { name: 'Version 1', href: '/v1.json' },
      { name: 'Version 2', href: '/v2.json' }
    ]
    renderTabs({ files, graphSource: '/v2.json' })
    await openTab('Details')

    const versions = within(screen.getByTestId('workflow-versions'))
    await userEvent
      .setup()
      .selectOptions(versions.getByRole('combobox'), '/v1.json')
    expect(
      versions
        .getByRole('link', { name: /Download workflow/i })
        .getAttribute('href')
    ).toBe('/v1.json')
  })
})
