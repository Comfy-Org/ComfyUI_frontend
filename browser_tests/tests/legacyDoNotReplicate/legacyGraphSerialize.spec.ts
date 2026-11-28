import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'boot serialize wrapper reaches exports from another workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    const before = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.workflow.getExportedWorkflow()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).serialize
    ).toBeGreaterThan(before.serialize)

    await openSecondWorkflowTab(comfyPage)
    const switched = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.workflow.getExportedWorkflow()
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).serialize
    ).toBeGreaterThan(switched.serialize)
  }
)
