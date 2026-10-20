import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { nodeGraphWorkflowSample } from '@/lib/hub/node-graph-workflow'
import WorkflowNodeGraphPage from './WorkflowNodeGraphPage.vue'

const workflow = {
  ...nodeGraphWorkflowSample,
  inputs: [{ media: 'image', title: 'Character image' }, { media: 'video' }]
} as const

function renderPage(
  props: { cloudAvailable?: boolean; primaryAction?: 'panel' | 'header' } = {}
) {
  return render(WorkflowNodeGraphPage, {
    props: { workflow, ...props },
    global: { stubs: { WorkflowGraph: true } }
  })
}

describe('WorkflowNodeGraphPage', () => {
  it('offers Download and Try in Cloud under the title', () => {
    renderPage()

    const actions = screen.getByTestId('workflow-actions')
    const download = screen.getByTestId('node-graph-download')
    const cloud = screen.getByTestId('node-graph-try-cloud')
    expect(actions.contains(download)).toBe(true)
    expect(actions.contains(cloud)).toBe(true)

    expect(download.textContent.trim()).toBe('Download workflow')
    expect(download.getAttribute('href')).toBe(
      nodeGraphWorkflowSample.downloadUrl
    )
    expect(download.hasAttribute('download')).toBe(true)
    expect(cloud.getAttribute('href')).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/?template=templates-character_sheet`
    )
    expect(cloud.getAttribute('target')).toBe('_blank')
  })

  it('orders the header actions like a runnable workflow page', () => {
    renderPage()

    const [first, second] = within(
      screen.getByTestId('workflow-actions')
    ).getAllByRole('link')
    expect(first).toBe(screen.getByTestId('node-graph-download'))
    expect(second).toBe(screen.getByTestId('node-graph-try-cloud'))
  })

  it('offers only Download when the workflow cannot open in Cloud', () => {
    renderPage({ cloudAvailable: false })

    expect(screen.queryByTestId('node-graph-try-cloud')).toBeNull()
    expect(screen.getByTestId('node-graph-download')).toBeTruthy()
    expect(screen.getByTestId('node-graph-footer').textContent).toContain(
      'Download workflow'
    )
  })

  it('mirrors the runnable tabs as Overview, Details and API', () => {
    renderPage()

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent.trim())
    expect(tabs).toEqual(['Overview', 'Details', 'API'])
    expect(
      screen
        .getByRole('tab', { name: 'Overview' })
        .getAttribute('aria-selected')
    ).toBe('true')
  })

  it('opens on the description, the inputs and a sample output', () => {
    renderPage()

    const about = screen.getByTestId('node-graph-about')
    expect(about.textContent).toContain(nodeGraphWorkflowSample.description[0])
    expect(
      within(screen.getByTestId('node-graph-inputs'))
        .getAllByRole('listitem')
        .map((item) => item.textContent.trim())
    ).toEqual(['Character image', 'Video'])
    const [sample] = nodeGraphWorkflowSample.examples
    expect(
      within(screen.getByTestId('node-graph-output'))
        .getByRole('img', { name: sample.title })
        .getAttribute('src')
    ).toBe(sample.outputUrl)
  })

  it('shows the graph and its facts on the Details tab', () => {
    renderPage()

    expect(screen.getByTestId('node-graph-graph')).toBeTruthy()

    const facts = screen.getByTestId('workflow-facts')
    for (const text of [
      ...nodeGraphWorkflowSample.models,
      ...nodeGraphWorkflowSample.customNodes,
      'Runs in ComfyUI'
    ])
      expect(facts.textContent).toContain(text)
  })

  it('leaves Output and Author to the Details facts', () => {
    renderPage()

    expect(screen.getByTestId('node-graph-about').textContent).not.toContain(
      'Author'
    )
    expect(screen.getByTestId('workflow-facts').textContent).toContain('Author')
  })

  it('points the API at Cloud with a key, or at a local ComfyUI without one', async () => {
    const { unmount } = renderPage()
    const cloudApi = screen.getByTestId('node-graph-api')
    expect(within(cloudApi).getByTestId('node-graph-api-key')).toBeTruthy()
    expect(
      within(cloudApi).getByTestId('node-graph-api-snippet').textContent
    ).toContain(WORKSHOP_CLOUD_BASE_URL)
    unmount()

    renderPage({ cloudAvailable: false })
    const localApi = screen.getByTestId('node-graph-api')
    expect(within(localApi).queryByTestId('node-graph-api-key')).toBeNull()
    expect(
      within(localApi).getByTestId('node-graph-api-snippet').textContent
    ).toContain('http://127.0.0.1:8188')
  })

  it('answers the workflow FAQ below the tabs', () => {
    renderPage()

    for (const { question } of nodeGraphWorkflowSample.faq)
      expect(screen.getByText(question)).toBeTruthy()
  })

  it('moves the only Try in Cloud to the header when the header leads', () => {
    renderPage({ primaryAction: 'header' })

    expect(
      within(screen.getByTestId('workflow-actions')).getByRole('link', {
        name: /Try in Cloud/i
      })
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('node-graph-footer')).queryByRole('link')
    ).toBeNull()
    expect(screen.getByTestId('node-graph-footer').textContent).toContain(
      'Runs in ComfyUI'
    )
  })
})
