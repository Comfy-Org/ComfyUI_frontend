import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { nodeGraphWorkflowSample } from '@/lib/hub/node-graph-workflow'
import WorkflowNodeGraphPage from './WorkflowNodeGraphPage.vue'

function renderPage() {
  return render(WorkflowNodeGraphPage, {
    props: { workflow: nodeGraphWorkflowSample },
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

    expect(download.getAttribute('href')).toBe(
      nodeGraphWorkflowSample.downloadUrl
    )
    expect(download.hasAttribute('download')).toBe(true)
    expect(cloud.getAttribute('href')).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/?template=templates-character_sheet`
    )
    expect(cloud.getAttribute('target')).toBe('_blank')
  })

  it('shows the graph and its facts without tabs', () => {
    renderPage()

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByTestId('node-graph-graph')).toBeTruthy()

    const facts = screen.getByTestId('workflow-facts')
    for (const text of [
      ...nodeGraphWorkflowSample.models,
      ...nodeGraphWorkflowSample.customNodes,
      'Runs in ComfyUI'
    ])
      expect(facts.textContent).toContain(text)
  })
})
