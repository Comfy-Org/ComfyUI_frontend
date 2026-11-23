import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches,
  removeGraphNode
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'overwrite-only onNodeRemoved follows the active workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const first = await comfyPage.nodeOps.addNode('KSampler')
    await removeGraphNode(comfyPage, first)
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).overwriteOnNodeRemoved
    ).toContain(String(first.id))

    await openSecondWorkflowTab(comfyPage)
    const second = await comfyPage.nodeOps.addNode('KSampler')
    const before = await readLegacyGraphInstancePatches(comfyPage)
    await removeGraphNode(comfyPage, second)
    expect(
      (
        await readLegacyGraphInstancePatches(comfyPage)
      ).overwriteOnNodeRemoved.slice(before.overwriteOnNodeRemoved.length)
    ).toEqual([String(second.id)])
  }
)
