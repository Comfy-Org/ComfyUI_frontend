import { expect } from '@playwright/test'

import type { GlobalSubgraphData } from '@/scripts/api'
import blueprint from '@e2e/../tools/devtools/subgraphs/test blueprint.json' with { type: 'json' }
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Blueprint dynamic combo preview', { tag: '@ui' }, () => {
  test('renders an options-free boundary input without an assertion', async ({
    comfyPage
  }, testInfo) => {
    const data = structuredClone(blueprint)
    data.nodes[0].inputs[0].name = 'boundary_model'
    data.nodes[0].inputs[0].type = 'COMFY_DYNAMICCOMBO_V3'
    const subgraphs: Record<string, GlobalSubgraphData> = {
      reconciliation18037: {
        name: 'Dynamic combo blueprint',
        info: { node_pack: 'ComfyUI_devtools' },
        data: JSON.stringify(data)
      }
    }
    const assertionErrors: string[] = []
    comfyPage.page.on('pageerror', (error) => {
      assertionErrors.push(error.message)
    })
    await comfyPage.page.route('**/global_subgraphs', async (route) => {
      await route.fulfill({ json: subgraphs })
    })
    await comfyPage.workflow.reloadAndWaitForApp()
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await tab.allTab.click()
    await tab.expandFolder('Comfy Blueprints')
    await tab.getNode('Dynamic combo blueprint').hover()
    await expect(tab.nodePreview).toBeVisible()
    await expect(
      tab.nodePreview.getByText('boundary_model', { exact: true })
    ).toBeVisible()
    await expect(
      tab.nodePreview.getByText('COMFY_DYNAMICCOMBO_V3', { exact: true })
    ).toBeVisible()
    await tab.nodePreview.screenshot({
      path: testInfo.outputPath('preview.png')
    })
    expect(assertionErrors).toEqual([])
  })
})
