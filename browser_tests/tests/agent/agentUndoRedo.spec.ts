import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import type { WorkspaceStore } from '@e2e/types/globals'

async function graphNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => window.app!.graph.nodes.length)
}

// The change tracker records a restored state only once its async graph load
// has resolved, so this settles before the next history keypress.
async function restoredNodeCount(page: Page): Promise<number | undefined> {
  return page.evaluate(
    () =>
      (window.app!.extensionManager as WorkspaceStore).workflow.activeWorkflow
        ?.changeTracker.activeState.nodes.length
  )
}

// The change tracker handles keydown one animation frame later, and a modifier
// keyup that lands before that frame snapshots the canvas first. Holding the
// chord across a frame keeps the keyups after the handler has run.
async function pressHistoryChord(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) await page.keyboard.down(key)
  await nextFrame(page)
  for (const key of keys.toReversed()) await page.keyboard.up(key)
}

async function clickEmptyCanvas(page: Page): Promise<void> {
  const box = await page.locator('#graph-canvas').boundingBox()
  if (!box) throw new Error('graph canvas is not visible')
  await page.mouse.click(box.x + box.width / 4, box.y + 80)
}

test.describe('Agent edit undo/redo', { tag: ['@cloud', '@vue-nodes'] }, () => {
  test.use({ conversationCase: 'agent-rec-three-sequential-adds' })

  test.beforeEach(async ({ agentConversation, page }) => {
    test.setTimeout(90_000)
    await agentConversation.runTurns()
    await page.locator('#graph-canvas').focus()
  })

  test('redo restores an agent edit that was just undone', async ({ page }) => {
    const afterAgentEdit = await graphNodeCount(page)
    expect(afterAgentEdit).toBeGreaterThan(0)

    await pressHistoryChord(page, ['Control', 'KeyZ'])
    await expect.poll(() => restoredNodeCount(page)).toBe(afterAgentEdit - 1)
    expect(await graphNodeCount(page)).toBe(afterAgentEdit - 1)

    await pressHistoryChord(page, ['Control', 'Shift', 'KeyZ'])
    await expect.poll(() => restoredNodeCount(page)).toBe(afterAgentEdit)
    expect(await graphNodeCount(page)).toBe(afterAgentEdit)
  })

  test('redo survives a canvas click that follows the undo', async ({
    page
  }) => {
    const afterAgentEdit = await graphNodeCount(page)

    await pressHistoryChord(page, ['Control', 'KeyZ'])
    await expect.poll(() => restoredNodeCount(page)).toBe(afterAgentEdit - 1)

    await clickEmptyCanvas(page)

    await pressHistoryChord(page, ['Control', 'Shift', 'KeyZ'])
    await expect.poll(() => restoredNodeCount(page)).toBe(afterAgentEdit)
  })
})
