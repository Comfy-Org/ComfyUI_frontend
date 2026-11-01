import { expect } from '@playwright/test'

import { agentAttachedWorkflowImportTest as test } from '@e2e/tests/agent/agentAttachedWorkflowImportFixture'

test(
  'imports an attached workflow into the Agent result without replacing the active canvas',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  async ({ attachedWorkflowImport }) => {
    const {
      activeCanvasNode,
      agentPanel,
      attachedSourceNode,
      attachmentName,
      expectedRequest,
      importedName,
      importedResultNode,
      topbar,
      userRequest
    } = attachedWorkflowImport

    await attachedWorkflowImport.attachWorkflow()
    await expect(agentPanel.attachmentChip(attachmentName)).toBeVisible()
    await attachedWorkflowImport.sendTurn()

    await expect(agentPanel.userMessageBubbles).toHaveText([userRequest])
    await expect(agentPanel.stopButton).toBeVisible()
    expect(attachedWorkflowImport.postedTurn()).toMatchObject(expectedRequest)
    await expect(activeCanvasNode).toBeVisible()
    await expect(attachedSourceNode).toHaveCount(0)
    await expect(importedResultNode).toHaveCount(0)
    await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow')

    await attachedWorkflowImport.openImportedResult()

    await expect(importedResultNode).toBeVisible()
    await expect(attachedSourceNode).toHaveCount(0)
    await expect(topbar.getActiveTab()).toContainText(importedName)
  }
)
