import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

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

test.describe(
  'Agent composer placeholder reset (PM-1331)',
  { tag: '@cloud' },
  () => {
    // PM-1331 (child of PM-1330): removing a node's reference chip from an
    // otherwise-empty composer never brings the placeholder back.
    // `insertComposerReference` (composerPrompt.ts) pads `prompt.text` with a
    // literal space on first insert into an empty draft; `setNodes()` /
    // `removeReference()` (agentComposerStore.ts) filter `references` on
    // removal but leave `text` untouched, so the leftover space survives.
    // The placeholder guard in Composer.vue
    // (`!composer.draft.value && !composer.prompt.value.references.length`)
    // then never re-shows the placeholder, because `draft.value` is a
    // non-empty (but invisible) string.
    test.use({ objectInfo: 'server' })

    test('restores the placeholder after removing the only node reference from an empty composer', async ({
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
      const placeholder = panel.getByText(/^Describe ideas/)
      await expect(placeholder).toBeVisible()

      await panel
        .getByRole('button', { name: enMessages.agent.addToPrompt })
        .click()
      await comfyPage.page
        .getByRole('menuitem', { name: enMessages.agent.nodes })
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
      await expect(placeholder).toHaveCount(0)

      await removeButton.click()
      await expect(removeButton).toHaveCount(0)

      await comfyPage.page.screenshot({
        path: test
          .info()
          .outputPath(
            'pm-1331-composer-placeholder-missing-after-chip-removal.png'
          )
      })

      await expect(placeholder).toBeVisible()
    })
  }
)
