import { expect } from '@playwright/test'

import type { UploadImageResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AGENT_ATTACH_ACCEPT } from '@/workbench/extensions/agent/utils/attachableFiles'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Only formats that already have a fixture in browser_tests/assets are covered
 * here: .json, .glb and .obj on the accepted side and .exr on the rejected one.
 * The rest of the agreed list (PM-1855) has no asset to drive a real upload
 * with, and is pinned by the unit suite over attachableFiles instead.
 */
const ACCEPTED_FIXTURES = ['default.json', 'animated_triangle.glb', 'cube.obj']

test.describe(
  'Agent panel attachment file types',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/api/upload/image', (route) => {
        const response: UploadImageResponse = {
          name: 'uploaded',
          subfolder: '',
          type: 'input'
        }
        return route.fulfill(jsonRoute(response))
      })
      await comfyPage.nodeOps.clearGraph()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('advertises extensions only, so the OS picker cannot offer a rejected type', async ({
      agentPanel
    }) => {
      await agentPanel.open()

      // image/*, video/* and audio/* wildcards are exactly what let .exr, .hdr,
      // .wmv and .wma reach a paperclip that did no checking of its own.
      await expect(agentPanel.fileInput).toHaveAttribute(
        'accept',
        AGENT_ATTACH_ACCEPT
      )
      expect(AGENT_ATTACH_ACCEPT).not.toContain('/*')
      expect(AGENT_ATTACH_ACCEPT).toContain('.json')
    })

    for (const file of ACCEPTED_FIXTURES) {
      test(`attaches ${file} picked through the file browser`, async ({
        agentPanel
      }) => {
        await agentPanel.open()
        const { fileInput, composerAssetSection: assetSection } = agentPanel

        await fileInput.setInputFiles(assetPath(file))
        await expect(assetSection).toContainText(file)
        await expect(
          assetSection.locator(`[aria-label="${enMessages.agent.uploading}"]`)
        ).toHaveCount(0)
      })
    }

    test('refuses a rejected type picked through the file browser and says why', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()

      // "All Files" in the OS picker defeats the accept attribute, so the
      // paperclip has to run the same check drag and paste do (PM-1854), and
      // has to say something when it refuses (PM-1856).
      await agentPanel.fileInput.setInputFiles(
        assetPath('test_upload_image.exr')
      )

      await expect(
        comfyPage.page.getByText('test_upload_image.exr', { exact: false })
      ).toBeVisible()
      await expect(agentPanel.composerAssetSection).toHaveCount(0)
    })

    test('attaches a .json dropped on the panel instead of opening it as a workflow', async ({
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

      // Dropping onto the composer means "attach this to the chat" (PM-1855).
      // The canvas still opens a workflow, through its own drop handler.
      await expect(assetSection).toContainText('default.json')
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })
  }
)
