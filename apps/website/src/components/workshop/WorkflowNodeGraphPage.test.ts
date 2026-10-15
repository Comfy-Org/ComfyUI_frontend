import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import {
  nodeGraphWorkflowSample,
  nodeGraphWorkflowWithApiSample
} from '@/lib/hub/node-graph-workflow'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'
import WorkflowNodeGraphPage from './WorkflowNodeGraphPage.vue'

function renderPage(workflow: NodeGraphWorkflow = nodeGraphWorkflowSample) {
  return render(WorkflowNodeGraphPage, {
    props: { workflow },
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

  it('shows the graph and its details on one page without tabs', () => {
    renderPage()

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByTestId('node-graph-graph')).toBeTruthy()
    expect(screen.getByTestId('node-graph-run-panel')).toBeTruthy()
    expect(screen.queryByTestId('node-graph-api')).toBeNull()
  })

  it('adds an API tab when the workflow has an API', async () => {
    const user = userEvent.setup()
    renderPage(nodeGraphWorkflowWithApiSample)

    const details = screen.getByRole('tab', { name: 'Details' })
    const api = screen.getByRole('tab', { name: 'API' })
    expect(details.getAttribute('aria-selected')).toBe('true')

    await user.click(api)
    expect(api.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('node-graph-api').textContent).toContain(
      'curl -X POST'
    )
  })
})
