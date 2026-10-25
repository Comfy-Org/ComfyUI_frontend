import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches,
  switchToWorkflowTab
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'WeakSet-guarded hook fires once per addition across repeated tab switches',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    await openSecondWorkflowTab(comfyPage)
    const before = await readLegacyGraphInstancePatches(comfyPage)
    const second = await comfyPage.nodeOps.addNode('KSampler')
    await comfyPage.nextFrame()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).safeOnNodeAdded.slice(
        before.safeOnNodeAdded.length
      )
    ).toEqual([String(second.id)])

    await switchToWorkflowTab(comfyPage, 0)
    await switchToWorkflowTab(comfyPage, 1)
    await switchToWorkflowTab(comfyPage, 0)
    const returned = await readLegacyGraphInstancePatches(comfyPage)
    const first = await comfyPage.nodeOps.addNode('KSampler')
    await comfyPage.nextFrame()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).safeOnNodeAdded.slice(
        returned.safeOnNodeAdded.length
      )
    ).toEqual([String(first.id)])
  }
)
