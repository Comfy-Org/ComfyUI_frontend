import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'boot onNodeAdded wrapper follows the active workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const before = await readLegacyGraphInstancePatches(comfyPage)
    const first = await comfyPage.nodeOps.addNode('KSampler')
    await comfyPage.nextFrame()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).bootOnNodeAdded.slice(
        before.bootOnNodeAdded.length
      )
    ).toEqual([String(first.id)])

    await openSecondWorkflowTab(comfyPage)
    const switched = await readLegacyGraphInstancePatches(comfyPage)
    const second = await comfyPage.nodeOps.addNode('KSampler')
    await comfyPage.nextFrame()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).bootOnNodeAdded.slice(
        switched.bootOnNodeAdded.length
      )
    ).toEqual([String(second.id)])
  }
)
