import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AGENT_ATTACH_ACCEPT } from '@/workbench/extensions/agent/utils/attachableFiles'

test.describe(
  'Agent panel .json attachment',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      const response: UploadImageResponse = {
        name: 'default.json',
        subfolder: '',
        type: 'input'
      }
      await comfyPage.page.route('**/api/upload/image', (route) =>
        route.fulfill(jsonRoute(response))
      )
      await comfyPage.nodeOps.clearGraph()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('advertises .json in the attach accept list and accepts a .json file through the file browser', async ({
      agentPanel
    }) => {
      await agentPanel.open()
      const { fileInput, composerAssetSection: assetSection } = agentPanel

      // The OS picker filters on this attribute; a missing `.json`/
      // `application/json` entry is exactly what hid JSON files from it.
      await expect(fileInput).toHaveAttribute('accept', AGENT_ATTACH_ACCEPT)

      // Browse flow: picking a .json file through the input lands it in the
      // composer instead of being silently ignored. This is the actual bug
      // that was reported (the OS picker hid .json files) and the actual fix
      // (AGENT_ATTACH_ACCEPT now lists .json/application/json).
      await fileInput.setInputFiles(assetPath('default.json'))
      await expect(assetSection).toContainText('default.json')
      await expect(
        assetSection.locator(`[aria-label="${enMessages.agent.uploading}"]`)
      ).toHaveCount(0)

      await assetSection
        .getByRole('button', { name: enMessages.agent.remove, exact: true })
        .click()
      await expect(assetSection).toHaveCount(0)
    })

    test('leaves a drag-and-dropped .json file unclaimed for the graph loader', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()
      const { root: panel, composerAssetSection: assetSection } = agentPanel
      await expect(assetSection).toHaveCount(0)

      const panelBox = await panel.boundingBox()
      if (!panelBox) throw new Error('Agent panel is not visible')
      await comfyPage.dragDrop.dragAndDropFile('default.json', {
        preserveNativePropagation: true,
        dropPosition: {
          x: panelBox.x + panelBox.width / 2,
          y: panelBox.y + panelBox.height / 2
        }
      })

      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
      expect(
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      ).toHaveLength(1)
      expect(
        await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      ).toHaveLength(2)
      await expect(assetSection).toHaveCount(0)
    })
  }
)
