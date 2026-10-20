import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { nodeGraphWorkflowSample } from '@/lib/hub/node-graph-workflow'
import WorkflowNodeGraphPage from './WorkflowNodeGraphPage.vue'

const workflow = {
  ...nodeGraphWorkflowSample,
  inputs: [{ media: 'image', title: 'Character image' }, { media: 'video' }]
} as const

function renderPage() {
  return render(WorkflowNodeGraphPage, {
    props: { workflow },
    global: { stubs: { WorkflowGraph: true } }
  })
}

describe('WorkflowNodeGraphPage', () => {
  it('offers Download and the primary Try in Cloud under the title', () => {
    renderPage()

    const actions = screen.getByTestId('workflow-actions')
    const download = screen.getByTestId('node-graph-download')
    const cloud = screen.getByTestId('node-graph-try-cloud')
    expect(actions.contains(download)).toBe(true)
    expect(actions.contains(cloud)).toBe(true)

    expect(download.textContent.trim()).toBe('Download Workflow')
    expect(download.getAttribute('href')).toBe(
      nodeGraphWorkflowSample.downloadUrl
    )
    expect(download.hasAttribute('download')).toBe(true)
    expect(cloud.getAttribute('href')).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/?template=templates-character_sheet`
    )
    expect(cloud.getAttribute('target')).toBe('_blank')
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

    const facts = within(screen.getByTestId('workflow-facts'))
    expect(
      [
        'Nano Banana Pro',
        'ComfyUI-KJNodes',
        'ComfyUI-Impact-Pack',
        'Runs in ComfyUI'
      ].map((text) => facts.queryByText(text) !== null)
    ).toEqual([true, true, true, true])
  })

  it('leaves Output and Author to the Details facts', () => {
    renderPage()

    expect(screen.getByTestId('node-graph-about').textContent).not.toContain(
      'Author'
    )
    expect(screen.getByTestId('workflow-facts').textContent).toContain('Author')
  })

  it('points the API at Comfy Cloud, starting from an API key', () => {
    renderPage()

    const api = screen.getByTestId('node-graph-api')
    expect(within(api).getByTestId('node-graph-api-key')).toBeTruthy()
    expect(
      within(api).getByTestId('node-graph-api-snippet').textContent
    ).toContain(WORKSHOP_CLOUD_BASE_URL)
  })

  it('answers the workflow FAQ below the tabs', () => {
    renderPage()

    expect(
      [
        'What kind of reference image works best?',
        'Can I change which views go on the sheet?',
        'Why does it need custom nodes?',
        'How do I keep a character consistent across runs?'
      ].map((question) => screen.queryByText(question) !== null)
    ).toEqual([true, true, true, true])
  })

  it('leaves the About footer to the Runs in ComfyUI note, with no button', () => {
    renderPage()

    const footer = screen.getByTestId('node-graph-footer')
    expect(within(footer).queryByRole('link')).toBeNull()
    expect(footer.textContent).toContain('Runs in ComfyUI')
  })
})
