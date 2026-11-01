import { expect } from '@playwright/test'

import type { AgentRunMode, UploadImageResponse } from '@comfyorg/ingest-types'
import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const CURRENT_WORKFLOW_ID = '4d6f7e8a-1b2c-43d5-96e7-8f9a0b1c2d3e'
const IMPORTED_WORKFLOW_ID = '8a7b6c5d-4e3f-4210-9a8b-7c6d5e4f3a2b'
const THREAD_ID = '2c3d4e5f-6a7b-4890-8c9d-0e1f2a3b4c5d'
const MESSAGE_ID = '7e6d5c4b-3a2f-4109-8e7d-6c5b4a3f2e1d'
const IMPORTED_NAME = 'portrait-workflow'
const UPLOADED_REF = 'assets/portrait-workflow.json'
const MARKER_TYPE = 'AttachedWorkflowMarker'
const MARKER_TITLE = 'Imported portrait workflow'
const USER_REQUEST = 'Change the attached workflow and open the result.'

const NODE_DEFINITIONS: Record<string, ComfyNodeDef> = {
  [MARKER_TYPE]: {
    name: MARKER_TYPE,
    display_name: 'Attached Workflow Marker',
    description: '',
    category: 'testing',
    python_module: 'testing',
    output_node: false,
    input: { required: {} },
    output: [],
    output_is_list: [],
    output_name: []
  }
}

const ATTACHED_WORKFLOW: WorkflowJSON = {
  last_node_id: 41,
  last_link_id: 0,
  nodes: [
    {
      id: 41,
      type: MARKER_TYPE,
      title: MARKER_TITLE,
      pos: [320, 240],
      size: [260, 60],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test(
  'imports an attached workflow into the Agent result without replacing the active canvas',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  async ({ page, agentFlagEnabled }) => {
    const host = new HostDoc(IMPORTED_WORKFLOW_ID, ATTACHED_WORKFLOW, {
      types: {}
    })
    const hostSocket = new AgentFollowerHostSocket(
      page,
      IMPORTED_WORKFLOW_ID,
      host
    )
    let posted: Record<string, unknown> | undefined
    const upload: UploadImageResponse = {
      name: UPLOADED_REF,
      subfolder: '',
      type: 'input'
    }
    const runMode: AgentRunMode = {
      mode: 'ask_approval',
      credit_limit: null
    }

    await hostSocket.install()
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await page.route('**/api/agent/threads?*', (route) =>
      route.fulfill(jsonRoute(emptyAgentThreadList()))
    )
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    await page.route('**/api/upload/image', (route) =>
      route.fulfill(jsonRoute(upload))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST')
        return route.fulfill(jsonRoute([]))
      posted = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({
        ...jsonRoute({
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID,
          workflow_id: IMPORTED_WORKFLOW_ID
        }),
        status: 202
      })
    })

    await bootAgentApp(page, agentFlagEnabled, {
      objectInfo: NODE_DEFINITIONS,
      vueNodes: true,
      beforeNavigate: async (page) => {
        await mockWorkflowPersistence(page, CURRENT_WORKFLOW_ID)
      }
    })

    const agentPanel = new AgentPanel(page)
    const marker = new VueNodeHelpers(page).getNodeByTitle(MARKER_TITLE)
    const topbar = new Topbar(page)

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.fileInput.setInputFiles({
      name: `${IMPORTED_NAME}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(ATTACHED_WORKFLOW))
    })
    await expect(
      agentPanel.attachmentChip(`${IMPORTED_NAME}.json`)
    ).toBeVisible()
    await agentPanel.sendMessage(USER_REQUEST)

    await expect.poll(() => posted).toBeDefined()
    expect(posted).toMatchObject({
      workflow_id: CURRENT_WORKFLOW_ID,
      attachments: [UPLOADED_REF]
    })
    await expect(marker).toHaveCount(0)
    await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow')

    hostSocket.send({
      type: 'agent_active_tab',
      data: {
        workflow_id: IMPORTED_WORKFLOW_ID,
        name: IMPORTED_NAME,
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID
      }
    })
    hostSocket.send({
      type: 'agent_message_done',
      data: { thread_id: THREAD_ID, message_id: MESSAGE_ID, usage: null }
    })

    await hostSocket.waitForSubscribe()
    await expect(marker).toBeVisible()
    await expect(topbar.getActiveTab()).toContainText(IMPORTED_NAME)
  }
)
