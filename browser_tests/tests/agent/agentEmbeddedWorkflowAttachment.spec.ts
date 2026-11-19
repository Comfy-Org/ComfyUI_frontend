import { expect } from '@playwright/test'

import { agentEmbeddedWorkflowAttachmentTest as test } from '@e2e/tests/agent/agentEmbeddedWorkflowAttachmentFixture'

test(
  'lifts the workflow out of an attached image and reaches the Agent without replacing the active canvas',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  async ({ embeddedWorkflowAttachment }) => {
    const {
      activeCanvasNode,
      agentPanel,
      derivedName,
      embeddedSourceNode,
      expectedRequest,
      imageName,
      importedName,
      importedResultNode,
      topbar,
      userRequest
    } = embeddedWorkflowAttachment

    await embeddedWorkflowAttachment.attachImage()

    await expect(agentPanel.attachmentChip(imageName)).toBeVisible()
    await expect(agentPanel.attachmentChip(derivedName)).toBeVisible()

    expect(await embeddedWorkflowAttachment.liftedWorkflowHasMarker()).toBe(
      true
    )
    expect(embeddedWorkflowAttachment.uploadedNames()).toEqual([
      imageName,
      derivedName
    ])

    await embeddedWorkflowAttachment.sendTurn()

    await expect(agentPanel.userMessageBubbles).toHaveText([userRequest])
    await expect(agentPanel.stopButton).toBeVisible()
    expect(await embeddedWorkflowAttachment.postedTurn()).toMatchObject(
      expectedRequest
    )

    await expect(activeCanvasNode).toBeVisible()
    await expect(embeddedSourceNode).toHaveCount(0)
    await expect(importedResultNode).toHaveCount(0)
    await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow')

    await embeddedWorkflowAttachment.openImportedResult()

    await expect(importedResultNode).toBeVisible()
    await expect(topbar.getActiveTab()).toContainText(importedName)
    await expect(topbar.tabs).toHaveCount(2)
    await expect(activeCanvasNode).toHaveCount(0)

    await topbar.getTab(0).click()
    await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
    await expect(activeCanvasNode).toBeVisible()
    await expect(importedResultNode).toHaveCount(0)
  }
)
