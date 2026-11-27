import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches,
  removeGraphNode
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'boot add and remove wrappers reach another workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const before = await readLegacyGraphInstancePatches(comfyPage)
    const first = await comfyPage.nodeOps.addNode('KSampler')
    await removeGraphNode(comfyPage, first)
    const initial = await readLegacyGraphInstancePatches(comfyPage)
    expect(initial.add).toHaveLength(before.add.length + 1)
    expect(initial.remove.slice(before.remove.length)).toEqual([
      String(first.id)
    ])

    await openSecondWorkflowTab(comfyPage)
    const switched = await readLegacyGraphInstancePatches(comfyPage)
    const second = await comfyPage.nodeOps.addNode('KSampler')
    await removeGraphNode(comfyPage, second)
    const result = await readLegacyGraphInstancePatches(comfyPage)
    expect.soft(result.add).toHaveLength(switched.add.length + 1)
    expect
      .soft(result.remove.slice(switched.remove.length))
      .toEqual([String(second.id)])
  }
)
