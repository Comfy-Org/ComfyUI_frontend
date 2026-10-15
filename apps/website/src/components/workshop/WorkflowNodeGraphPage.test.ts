import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
  it('offers Try on Comfy Cloud and Download where Run would be', () => {
    renderPage()

    const cloud = screen.getByTestId('node-graph-try-cloud')
    expect(cloud.textContent).toContain('Try on Comfy Cloud')
    expect(cloud.getAttribute('href')).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/?template=templates-character_sheet`
    )
    expect(cloud.getAttribute('target')).toBe('_blank')

    const download = screen.getByTestId('node-graph-download')
    expect(download.textContent).toContain('Download workflow')
    expect(download.getAttribute('href')).toBe(
      nodeGraphWorkflowSample.downloadUrl
    )
    expect(download.hasAttribute('download')).toBe(true)
    expect(screen.queryByTestId('workflow-run')).toBeNull()
  })

  it('lists what running it takes', () => {
    renderPage()

    const panel = screen.getByTestId('node-graph-run-panel')
    for (const name of [
      ...nodeGraphWorkflowSample.inputs,
      ...nodeGraphWorkflowSample.models,
      ...nodeGraphWorkflowSample.customNodes
    ])
      expect(panel.textContent).toContain(name)
  })

  it('switches between the overview and the graph', async () => {
    const user = userEvent.setup()
    renderPage()

    const overview = screen.getByRole('tab', { name: 'Overview' })
    const workflow = screen.getByRole('tab', { name: 'Workflow' })
    expect(overview.getAttribute('aria-selected')).toBe('true')

    await user.click(workflow)
    expect(workflow.getAttribute('aria-selected')).toBe('true')
    expect(overview.getAttribute('aria-selected')).toBe('false')
  })
})
