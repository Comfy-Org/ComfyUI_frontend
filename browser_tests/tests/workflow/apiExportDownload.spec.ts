import { readFile } from 'node:fs/promises'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('API workflow export download', { tag: ['@workflow'] }, () => {
  test('downloads a non-empty API workflow with executable node schema', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.DevMode', true)
    await comfyPage.workflow.loadWorkflow('default')

    const downloadPromise = comfyPage.page.waitForEvent('download')
    await comfyPage.menu.topbar.triggerTopbarCommand(['File', 'Export (API)'])
    await comfyPage.menu.topbar.getSaveDialog().fill('workflow_api')
    await comfyPage.page.keyboard.press('Enter')
    const download = await downloadPromise
    const downloadPath = await download.path()

    expect(download.suggestedFilename()).toBe('workflow_api.json')
    expect(downloadPath).not.toBeNull()
    const contents = await readFile(downloadPath, 'utf8')
    expect(contents.length).toBeGreaterThan(0)

    const workflow = JSON.parse(contents)
    expect(Object.keys(workflow).length).toBeGreaterThan(0)
    for (const node of Object.values(workflow)) {
      expect(node).toEqual(
        expect.objectContaining({
          class_type: expect.any(String),
          inputs: expect.any(Object)
        })
      )
    }
  })
})
