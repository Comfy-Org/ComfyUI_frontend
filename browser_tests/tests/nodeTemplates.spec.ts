import fs from 'node:fs'

import type { TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import { nodeTemplatesFixture as test } from '@e2e/fixtures/nodeTemplatesFixture'

type NodeMode = 'vue' | 'litegraph'

function templateName(mode: NodeMode | 'shared', testInfo: TestInfo) {
  return `tpl-${mode}-${testInfo.parallelIndex}-${testInfo.title.replace(/\W+/g, '-')}`
}

function isStoreTemplatesRequest(url: string, method: string): boolean {
  return method === 'POST' && url.includes('/api/userdata/comfy.templates.json')
}

function defineNodeTemplatesTests(mode: NodeMode) {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('Save Selected as Template persists the selection under the given name', async ({
    nodeTemplates
  }, testInfo) => {
    const name = templateName(mode, testInfo)
    const { manageDialog } = nodeTemplates

    await nodeTemplates.saveKSamplerAsTemplate(name)

    await test.step('Manage dialog lists the saved template', async () => {
      await nodeTemplates.openManageDialog()
      await expect(manageDialog.rowByName(name)).toHaveCount(1)
      await manageDialog.close()
    })
  })

  test('Saved template appears in the submenu and pastes nodes on click', async ({
    comfyPage,
    nodeTemplates
  }, testInfo) => {
    const name = templateName(mode, testInfo)

    await nodeTemplates.saveKSamplerAsTemplate(name)

    const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

    await test.step('Insert template from canvas submenu', async () => {
      await nodeTemplates.insertTemplate(name)
    })

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialNodeCount + 1)
  })

  test('Deleting a template in the manage dialog removes it from the list', async ({
    comfyPage,
    nodeTemplates
  }, testInfo) => {
    const name = templateName(mode, testInfo)
    const { manageDialog } = nodeTemplates

    await nodeTemplates.saveKSamplerAsTemplate(name)

    await test.step('Delete the template and assert it is persisted server-side', async () => {
      await nodeTemplates.openManageDialog()
      const row = manageDialog.rowByName(name)
      await expect(row).toHaveCount(1)

      const storeResponse = comfyPage.page.waitForResponse((res) =>
        isStoreTemplatesRequest(res.url(), res.request().method())
      )
      await row.getByRole('button', { name: 'Delete' }).click()
      const response = await storeResponse
      expect(response.ok()).toBe(true)
      const stored = JSON.parse(response.request().postData() ?? '') as {
        name: string
        data: string
      }[]
      expect(stored.map((t) => t.name)).not.toContain(name)

      await expect(row).toHaveCount(0)
      await manageDialog.close()
    })
  })
}

test.describe('Node Templates', { tag: ['@canvas'] }, () => {
  test.describe('Vue nodes', { tag: ['@vue-nodes'] }, () => {
    defineNodeTemplatesTests('vue')
  })

  test.describe('Litegraph nodes', () => {
    defineNodeTemplatesTests('litegraph')
  })

  // Import/Export are dialog-only flows unaffected by node rendering mode;
  // run once outside the Vue/Litegraph matrix.
  test.describe('Dialog import/export', () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('Export downloads a JSON file containing the saved template', async ({
      comfyPage,
      nodeTemplates
    }, testInfo) => {
      const name = templateName('shared', testInfo)
      const { manageDialog } = nodeTemplates

      await nodeTemplates.saveKSamplerAsTemplate(name)

      await test.step('Export and verify the downloaded file contents', async () => {
        await nodeTemplates.openManageDialog()
        const downloadPromise = comfyPage.page.waitForEvent('download')
        await manageDialog
          .rowByName(name)
          .getByRole('button', { name: 'Export' })
          .click()
        const download = await downloadPromise

        expect(download.suggestedFilename()).toContain(name)
        const downloadPath = await download.path()
        if (!downloadPath) throw new Error('Download path unavailable')
        const parsed = JSON.parse(fs.readFileSync(downloadPath, 'utf-8')) as {
          templates: { name: string; data: string }[]
        }
        expect(parsed.templates.map((t) => t.name)).toEqual([name])

        await manageDialog.close()
      })
    })

    test('Import adds templates from a JSON file', async ({
      comfyPage,
      nodeTemplates
    }, testInfo) => {
      const name = templateName('shared', testInfo)
      const { manageDialog } = nodeTemplates
      const payload = {
        templates: [{ name, data: JSON.stringify({ nodes: [] }) }]
      }

      await nodeTemplates.openManageDialog()
      await expect(manageDialog.rowByName(name)).toHaveCount(0)

      const storeResponse = comfyPage.page.waitForResponse((res) =>
        isStoreTemplatesRequest(res.url(), res.request().method())
      )
      await manageDialog.importInput.setInputFiles({
        name: 'templates.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(payload))
      })
      expect((await storeResponse).ok()).toBe(true)
      await manageDialog.waitForHidden()

      await nodeTemplates.openManageDialog()
      await expect(manageDialog.rowByName(name)).toHaveCount(1)
      await manageDialog.close()
    })
  })
})
