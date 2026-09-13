import { readFile } from 'node:fs/promises'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
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

    const parsed: unknown = JSON.parse(contents)
    const isApiWorkflow = await comfyPage.page.evaluate(
      (data) => window.app!.isApiJson(data),
      parsed
    )
    expect(isApiWorkflow).toBe(true)
    const workflow = parsed as ComfyApiWorkflow
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
