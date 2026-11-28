import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'boot clear wrapper reaches clearing another workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const before = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.nodeOps.clearGraph()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).clear
    ).toBeGreaterThan(before.clear)

    await openSecondWorkflowTab(comfyPage)
    await comfyPage.nodeOps.addNode('KSampler')
    const switched = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.nodeOps.clearGraph()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).clear
    ).toBeGreaterThan(switched.clear)
  }
)
