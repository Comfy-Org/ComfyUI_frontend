import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

async function waitForCanvasViewToSettle(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const { ds } = window.app!.canvas
        const [scale, offsetX, offsetY] = [ds.scale, ds.offset[0], ds.offset[1]]
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve(
              ds.scale === scale &&
                ds.offset[0] === offsetX &&
                ds.offset[1] === offsetY
            )
          )
        )
      })
  )
}

test.describe('Agent node selection chip removal', { tag: '@cloud' }, () => {
  // Source: https://linear.app/comfyorg/issue/PM-1227
  test.use({ objectInfo: 'server' })

  test('clears the canvas highlight when its reference chip is removed from the composer', async ({
    agentPanel,
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()
    const node = await comfyPage.nodeOps.addNode('KSampler', undefined, {
      x: 400,
      y: 300
    })
    await comfyPage.nextFrame()

    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const panel = agentPanel.root
    await panel
      .getByRole('button', { name: enMessages.agent.addToPrompt })
      .click()
    await comfyPage.page
      .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
      .click()
    await expect(
      comfyPage.page.getByTestId('node-selection-mode-banner')
    ).toBeVisible()

    await waitForCanvasViewToSettle(comfyPage.page)
    const [{ x, y }, { width, height }] = await Promise.all([
      node.getPosition(),
      node.getSize()
    ])
    await comfyPage.canvasOps.mouseClickAt({
      x: x + width / 2,
      y: y + height / 2
    })

    const removeButton = panel.getByRole('button', {
      name: `Remove KSampler #${node.id} reference`
    })
    await expect(removeButton).toBeVisible()
    expect(await node.getProperty<boolean>('is_selected')).toBe(true)

    await removeButton.click()
    await expect(removeButton).toHaveCount(0)

    expect(await node.getProperty<boolean>('is_selected')).toBe(false)
  })
})
