import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches,
  switchToWorkflowTab
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'per-node wrappers stay with their graph without stacking again on return',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const first = await comfyPage.nodeOps.addNode('ConditioningZeroOut')
    const other = await comfyPage.nodeOps.addNode('ConditioningZeroOut')
    await comfyPage.nextFrame()
    await openSecondWorkflowTab(comfyPage)
    const second = await comfyPage.nodeOps.addNode('ConditioningZeroOut')
    await comfyPage.nextFrame()
    const before = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.page.evaluate(() => window.app!.graph.afterChange())
    await comfyPage.nextFrame()
    expect(
      (
        await readLegacyGraphInstancePatches(comfyPage)
      ).stackedAfterChange.slice(before.stackedAfterChange.length)
    ).toEqual([String(second.id)])

    await switchToWorkflowTab(comfyPage, 0)
    const returned = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.page.evaluate(() => window.app!.graph.afterChange())
    await comfyPage.nextFrame()
    expect(
      (
        await readLegacyGraphInstancePatches(comfyPage)
      ).stackedAfterChange.slice(returned.stackedAfterChange.length)
    ).toEqual([String(first.id), String(other.id)])
  }
)
