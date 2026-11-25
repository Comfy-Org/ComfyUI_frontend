import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyGraphInstancePatchesFixture'
import {
  openSecondWorkflowTab,
  readLegacyGraphInstancePatches
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test(
  'boot configure wrapper reaches imports in another workflow',
  { tag: '@canvas' },
  async ({ comfyPage }) => {
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).configure
    ).toBeGreaterThan(0)
    await openSecondWorkflowTab(comfyPage)
    const before = await readLegacyGraphInstancePatches(comfyPage)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    expect(
      (await readLegacyGraphInstancePatches(comfyPage)).configure
    ).toBeGreaterThan(before.configure)
  }
)
