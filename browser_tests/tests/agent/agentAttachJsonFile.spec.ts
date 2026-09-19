import { expect } from '@playwright/test'

import type { UploadImageResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AGENT_ATTACH_ACCEPT } from '@/workbench/extensions/agent/utils/attachableFiles'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

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
    })

    test('advertises .json in the attach accept list and attaches a .json file end to end', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()
      const panel = agentPanel.root
      const fileInput = panel.getByTestId('agent-file-input')

      // The OS picker filters on this attribute; a missing `.json`/
      // `application/json` entry is exactly what hid JSON files from it.
      await expect(fileInput).toHaveAttribute('accept', AGENT_ATTACH_ACCEPT)
      expect(AGENT_ATTACH_ACCEPT.split(',')).toEqual(
        expect.arrayContaining(['.json', 'application/json'])
      )

      // Browse flow: picking a .json file through the input lands it in the
      // composer instead of being silently ignored.
      await fileInput.setInputFiles(assetPath('default.json'))
      const assetSection = panel.getByTestId('composer-asset-section')
      await expect(assetSection).toContainText('default.json')
      await expect(
        assetSection.locator(`[aria-label="${enMessages.agent.uploading}"]`)
      ).toHaveCount(0)

      await assetSection
        .getByRole('button', { name: enMessages.agent.remove, exact: true })
        .click()
      await expect(assetSection).toHaveCount(0)

      // Drag-and-drop flow: this is the path application code actually gates
      // (`isAgentAttachable`/`EXTRA_ATTACHABLE_EXTENSIONS`), so it is the real
      // end-to-end proof that dropped .json files are accepted too.
      const panelBox = await panel.boundingBox()
      if (!panelBox) throw new Error('Agent panel is not visible')
      await comfyPage.dragDrop.dragAndDropFile('default.json', {
        dropPosition: {
          x: panelBox.x + panelBox.width / 2,
          y: panelBox.y + panelBox.height / 2
        }
      })
      await expect(assetSection).toContainText('default.json')
    })
  }
)
