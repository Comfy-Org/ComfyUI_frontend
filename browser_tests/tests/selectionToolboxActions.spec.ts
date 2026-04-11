import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

const BYPASS_CLASS = /before:bg-bypass\/60/

function getNodeWrapper(comfyPage: ComfyPage, nodeTitle: string): Locator {
  return comfyPage.page
    .locator('[data-node-id]')
    .filter({ hasText: nodeTitle })
    .getByTestId('node-inner-wrapper')
}

async function selectNodeWithPan(comfyPage: ComfyPage, nodeRef: NodeReference) {
  const nodePos = await nodeRef.getPosition()
  await comfyPage.page.evaluate((pos) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[0] = -pos.x + canvas.canvas.width / 2
    canvas.ds.offset[1] = -pos.y + canvas.canvas.height / 2 + 100
    canvas.setDirty(true, true)
  }, nodePos)
  await comfyPage.nextFrame()
  await nodeRef.click('title')
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})

test.describe('Selection Toolbox - Button Actions', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()
  })

  test('delete button removes selected node', async ({ comfyPage }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    const deleteButton = comfyPage.page.getByTestId('delete-button')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click({ force: true })
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.graph!._nodes.length)
      )
      .toBe(initialCount - 1)
  })

  test('info button opens properties panel', async ({ comfyPage }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const infoButton = comfyPage.page.getByTestId('info-button')
    await expect(infoButton).toBeVisible()
    await infoButton.click({ force: true })
    await expect(comfyPage.page.getByTestId('properties-panel')).toBeVisible()
  })

  test('convert-to-subgraph button visible with multi-select', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
    await comfyPage.nextFrame()

    await expect(
      comfyPage.page.getByTestId('convert-to-subgraph-button')
    ).toBeVisible()
  })

  test('delete button removes multiple selected nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
    await comfyPage.nextFrame()

    const initialCount = await comfyPage.page.evaluate(
      () => window.app!.graph!._nodes.length
    )

    const deleteButton = comfyPage.page.getByTestId('delete-button')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click({ force: true })
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.graph!._nodes.length)
      )
      .toBe(initialCount - 2)
  })

  test('bypass button toggles bypass on single node', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.vueNodes.waitForNodes()

    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    await expect.poll(() => nodeRef.isBypassed()).toBe(false)

    const bypassButton = comfyPage.page.getByTestId('bypass-button')
    await expect(bypassButton).toBeVisible()
    await bypassButton.click({ force: true })
    await comfyPage.nextFrame()

    await expect.poll(() => nodeRef.isBypassed()).toBe(true)
    await expect(getNodeWrapper(comfyPage, 'KSampler')).toHaveClass(
      BYPASS_CLASS
    )

    await bypassButton.click({ force: true })
    await comfyPage.nextFrame()

    await expect.poll(() => nodeRef.isBypassed()).toBe(false)
    await expect(getNodeWrapper(comfyPage, 'KSampler')).not.toHaveClass(
      BYPASS_CLASS
    )
  })

  test('convert-to-subgraph button converts node to subgraph', async ({
    comfyPage
  }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const convertButton = comfyPage.page.getByTestId(
      'convert-to-subgraph-button'
    )
    await expect(convertButton).toBeVisible()
    await convertButton.click({ force: true })
    await comfyPage.nextFrame()

    // KSampler should be gone, replaced by a subgraph node
    await expect
      .poll(() => comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))
      .toHaveLength(0)

    await expect
      .poll(() => comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph'))
      .toHaveLength(1)
  })

  test('convert-to-subgraph button converts multiple nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
    await comfyPage.nextFrame()

    const convertButton = comfyPage.page.getByTestId(
      'convert-to-subgraph-button'
    )
    await expect(convertButton).toBeVisible()
    await convertButton.click({ force: true })
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph'))
      .toHaveLength(1)

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount - 1)
  })

  test('frame nodes button creates group from multiple selected nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    const initialGroupCount = await comfyPage.page.evaluate(
      () => window.app!.graph.groups.length
    )

    await comfyPage.nodeOps.selectNodes(['KSampler', 'Empty Latent Image'])
    await comfyPage.nextFrame()

    const frameButton = comfyPage.page.getByRole('button', {
      name: /Frame Nodes/i
    })
    await expect(frameButton).toBeVisible()
    await comfyPage.page
      .getByRole('button', { name: /Frame Nodes/i })
      .click({ force: true })
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.graph.groups.length)
      )
      .toBe(initialGroupCount + 1)
  })

  test('frame nodes button is not visible for single selection', async ({
    comfyPage
  }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const frameButton = comfyPage.page.getByRole('button', {
      name: /Frame Nodes/i
    })
    await expect(frameButton).toBeHidden()
  })

  test('execute button visible when output node selected', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.nextFrame()

    // Select the SaveImage node by panning to it
    const saveImageRef = (
      await comfyPage.nodeOps.getNodeRefsByTitle('Save Image')
    )[0]
    await selectNodeWithPan(comfyPage, saveImageRef)

    const executeButton = comfyPage.page.getByRole('button', {
      name: /Execute to selected output nodes/i
    })
    await expect(executeButton).toBeVisible()
  })

  test('execute button not visible when non-output node selected', async ({
    comfyPage
  }) => {
    const nodeRef = (await comfyPage.nodeOps.getNodeRefsByTitle('KSampler'))[0]
    await selectNodeWithPan(comfyPage, nodeRef)

    const executeButton = comfyPage.page.getByRole('button', {
      name: /Execute to selected output nodes/i
    })
    await expect(executeButton).toBeHidden()
  })
})
