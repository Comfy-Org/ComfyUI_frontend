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

    test('advertises .json in the attach accept list and accepts a .json file through the file browser', async ({
      agentPanel
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
      // composer instead of being silently ignored. This is the actual bug
      // that was reported (the OS picker hid .json files) and the actual fix
      // (AGENT_ATTACH_ACCEPT now lists .json/application/json).
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
    })

    test('leaves a drag-and-dropped .json file unclaimed for the graph loader', async ({
      agentPanel,
      comfyPage
    }) => {
      // Drag-and-drop is a different path from the file browser above, gated
      // by `isAgentAttachable`/`EXTRA_ATTACHABLE_EXTENSIONS`, which
      // deliberately excludes .json: a saved workflow file dropped anywhere
      // in the app -- including over the agent panel -- must stay unclaimed
      // so the pre-existing "drop a workflow onto the canvas to open it"
      // graph loader can still pick it up. See attachableFiles.ts and the
      // AgentPanelRoot.test.ts unit coverage for the same contract; the
      // graph loader's own drag-and-drop behavior is already covered by
      // metadataWorkflowImport.spec.ts, so it is not re-asserted here.
      await agentPanel.open()
      const panel = agentPanel.root
      const assetSection = panel.getByTestId('composer-asset-section')
      await expect(assetSection).toHaveCount(0)

      const panelBox = await panel.boundingBox()
      if (!panelBox) throw new Error('Agent panel is not visible')
      await comfyPage.dragDrop.dragAndDropFile('default.json', {
        dropPosition: {
          x: panelBox.x + panelBox.width / 2,
          y: panelBox.y + panelBox.height / 2
        }
      })

      // The composer must not have claimed it.
      await expect(assetSection).toHaveCount(0)
    })
  }
)
