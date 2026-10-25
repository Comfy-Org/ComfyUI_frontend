import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches,
  removeGraphNode
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'boot beforeChange and afterChange wrappers reach edits in another workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const first = await comfyPage.nodeOps.addNode('KSampler')
    const before = await readLegacyGraphInstancePatches(comfyPage)
    await removeGraphNode(comfyPage, first)
    const initial = await readLegacyGraphInstancePatches(comfyPage)
    expect(initial.beforeChange).toBeGreaterThan(before.beforeChange)
    expect(initial.afterChange).toBeGreaterThan(before.afterChange)

    await openSecondWorkflowTab(comfyPage)
    const second = await comfyPage.nodeOps.addNode('KSampler')
    const switched = await readLegacyGraphInstancePatches(comfyPage)
    await removeGraphNode(comfyPage, second)
    const result = await readLegacyGraphInstancePatches(comfyPage)
    expect.soft(result.beforeChange).toBeGreaterThan(switched.beforeChange)
    expect.soft(result.afterChange).toBeGreaterThan(switched.afterChange)
  }
)
