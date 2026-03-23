import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'

test.describe('Vue Nodes - Slot Context Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('Right-clicking an input slot dot shows the slot context menu', async ({
    comfyPage
  }) => {
    // KSampler has input slots with connections — find any input slot
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const inputSlot = ksamplerNode.locator('.lg-slot--input').first()
    await expect(inputSlot).toBeVisible()

    await inputSlot.locator('.slot-dot').click({ button: 'right' })

    // The custom slot context menu should appear (role="menu" is on the
    // teleported menu, not on the PrimeVue node context menu)
    const slotMenu = comfyPage.page.locator(
      'div[role="menu"]:not(.p-contextmenu)'
    )
    await expect(slotMenu).toBeVisible()

    // Should show "Rename" since standard slots are not nameLocked
    await expect(
      slotMenu.getByRole('menuitem', { name: 'Rename' })
    ).toBeVisible()
  })

  test('Right-clicking the node body shows the node context menu, not the slot menu', async ({
    comfyPage
  }) => {
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const nodeBody = ksamplerNode.locator('[data-testid^="node-body-"]')
    await expect(nodeBody).toBeVisible()

    await nodeBody.click({ button: 'right' })
    await comfyPage.nextFrame()

    // The PrimeVue node context menu should appear
    const nodeMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(nodeMenu).toBeVisible()

    // Slot-specific items should NOT be present
    await expect(
      comfyPage.page.getByRole('menuitem', { name: 'Disconnect Links' })
    ).not.toBeVisible()
  })

  test('Right-clicking an output slot dot shows the slot context menu', async ({
    comfyPage
  }) => {
    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const outputSlot = checkpointNode.locator('.lg-slot--output').first()
    await expect(outputSlot).toBeVisible()

    await outputSlot.locator('.slot-dot').click({ button: 'right' })

    const slotMenu = comfyPage.page.locator(
      'div[role="menu"]:not(.p-contextmenu)'
    )
    await expect(slotMenu).toBeVisible()

    await expect(
      slotMenu.getByRole('menuitem', { name: 'Rename' })
    ).toBeVisible()
  })

  test('Slot context menu closes when clicking outside', async ({
    comfyPage
  }) => {
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const inputSlot = ksamplerNode.locator('.lg-slot--input').first()
    await expect(inputSlot).toBeVisible()

    await inputSlot.locator('.slot-dot').click({ button: 'right' })

    const slotMenu = comfyPage.page.locator(
      'div[role="menu"]:not(.p-contextmenu)'
    )
    await expect(slotMenu).toBeVisible()

    // Press Escape to close the menu
    await comfyPage.page.keyboard.press('Escape')

    await expect(slotMenu).not.toBeVisible()
  })

  test('Rename Slot updates the slot label reactively in the DOM', async ({
    comfyPage
  }) => {
    // Find a KSampler input slot that is renamable (not widget-backed)
    const slotInfo = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const node = graph.findNodesByType('KSampler', [])[0]
      if (!node?.inputs) return null
      const idx = node.inputs.findIndex(
        (i) => !i.nameLocked && !('widget' in i && i.widget)
      )
      if (idx < 0) return null
      return {
        index: idx,
        originalName: node.inputs[idx].label || node.inputs[idx].name
      }
    })
    expect(slotInfo).not.toBeNull()

    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const inputSlot = ksamplerNode
      .locator('.lg-slot--input')
      .nth(slotInfo!.index)
    await expect(inputSlot).toBeVisible()

    // Right-click to open slot context menu
    await inputSlot.locator('.slot-dot').click({ button: 'right' })

    const slotMenu = comfyPage.page.locator(
      'div[role="menu"]:not(.p-contextmenu)'
    )
    await expect(slotMenu).toBeVisible()

    // Click "Rename"
    await slotMenu.getByRole('menuitem', { name: 'Rename' }).click()

    // Menu should close, prompt dialog should appear
    await expect(slotMenu).not.toBeVisible()

    const promptInput = comfyPage.page.locator('.prompt-dialog-content input')
    await expect(promptInput).toBeVisible()

    // Type a new name and confirm
    await promptInput.fill('MyCustomSlot')
    await comfyPage.page.locator('.prompt-dialog-content button').click()

    // Wait for dialog to close
    await expect(promptInput).not.toBeVisible()
    await comfyPage.nextFrame()

    // The slot label in the DOM should reactively reflect the new name
    await expect(inputSlot).toContainText('MyCustomSlot')

    // Verify the underlying graph data also changed
    const labelInGraph = await comfyPage.page.evaluate((idx) => {
      const graph = window.app!.graph!
      const node = graph.findNodesByType('KSampler', [])[0]
      return node?.inputs?.[idx]?.label
    }, slotInfo!.index)
    expect(labelInGraph).toBe('MyCustomSlot')
  })

  test('Slot context menu Disconnect Links removes connections', async ({
    comfyPage
  }) => {
    // Use page.evaluate to find a KSampler input with an active link
    const connectedSlot = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const nodes = graph.findNodesByType('KSampler', [])
      const ksamplerNode = nodes.find((n) =>
        n.inputs?.some((i) => i.link != null)
      )
      if (!ksamplerNode) return null
      const slotIndex = ksamplerNode.inputs!.findIndex((i) => i.link != null)
      return { nodeId: ksamplerNode.id, slotIndex }
    })
    expect(connectedSlot).not.toBeNull()

    // Find the corresponding Vue input slot by node ID
    const ksamplerNode = comfyPage.page.locator(
      `[data-node-id="${connectedSlot!.nodeId}"]`
    )
    const inputSlot = ksamplerNode
      .locator('.lg-slot--input')
      .nth(connectedSlot!.slotIndex)
    await expect(inputSlot).toBeVisible()

    await inputSlot.locator('.slot-dot').click({ button: 'right' })

    const slotMenu = comfyPage.page.locator(
      'div[role="menu"]:not(.p-contextmenu)'
    )
    await expect(slotMenu).toBeVisible()

    await expect(
      slotMenu.getByRole('menuitem', { name: 'Disconnect Links' })
    ).toBeVisible()

    await slotMenu.getByRole('menuitem', { name: 'Disconnect Links' }).click()

    // Menu should close
    await expect(slotMenu).not.toBeVisible()

    // Verify the link was removed in the graph
    const linkRemoved = await comfyPage.page.evaluate(
      ({ nodeId, slotIndex }) => {
        const graph = window.app!.graph!
        const node = graph.getNodeById(nodeId)
        return node?.inputs?.[slotIndex]?.link == null
      },
      connectedSlot!
    )
    expect(linkRemoved).toBe(true)
  })
})
