import type { Asset } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import {
  FLAT_TEMP_ASSET,
  STALE_TEMP_ASSET,
  TEMP_FOLDER_JOB_ID,
  TEMP_FOLDER_PREVIEW,
  TEMP_FOLDER_SAVED,
  TEMP_FOLDER_SINGLE,
  TEMP_STACK_JOB_ID,
  TEMP_STACK_PREVIEW,
  TEMP_STACK_SAVED
} from '@e2e/fixtures/data/assetFixtures'
import { openErrorsTab } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

const rootControls = (asset: Asset) => [`${asset.hash} [output]`, asset.name]
const controlTitle = (index: number) => `Survivor control ${index + 1}`

test.use({
  initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true }
})

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.assets.mockCloudAssets({
    assets: [
      STALE_TEMP_ASSET,
      TEMP_STACK_SAVED,
      TEMP_STACK_PREVIEW,
      FLAT_TEMP_ASSET,
      TEMP_FOLDER_SAVED,
      TEMP_FOLDER_PREVIEW,
      TEMP_FOLDER_SINGLE
    ],
    total: 7,
    has_more: false
  })
  for (const [jobId, jobAssets] of [
    [TEMP_STACK_JOB_ID, [TEMP_STACK_SAVED, TEMP_STACK_PREVIEW]],
    [TEMP_FOLDER_JOB_ID, [TEMP_FOLDER_SAVED, TEMP_FOLDER_PREVIEW]]
  ] as const) {
    await comfyPage.page.route(
      new RegExp(`/api/jobs/${jobId}/assets(\\?.*)?$`),
      (route) =>
        route.fulfill({
          json: {
            job_id: jobId,
            assets: jobAssets.map(({ id, name, mime_type }) => ({
              id,
              name,
              mime_type,
              preview_url: `/api/assets/${id}/content`
            }))
          }
        })
    )
  }
  await comfyPage.page.route(/\/api\/assets\/[^/?#]+$/, (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 204, body: '' })
      : route.fallback()
  )
  await comfyPage.page.route(
    /\/api\/(view|assets\/[^/?#]+\/content)/,
    (route) => route.fulfill({ path: assetPath('test_upload_image.png') })
  )
})

for (const route of [
  {
    shape: 'a group card tagged output and temp',
    asset: STALE_TEMP_ASSET,
    written: `${STALE_TEMP_ASSET.hash} [temp]`,
    controls: rootControls(STALE_TEMP_ASSET),
    expand: false
  },
  {
    shape: 'an expanded-stack child at the root folder',
    asset: TEMP_STACK_PREVIEW,
    written: `${TEMP_STACK_PREVIEW.name} [temp]`,
    controls: rootControls(TEMP_STACK_PREVIEW),
    expand: true
  },
  {
    shape: 'a card with no job tagged output and temp',
    asset: FLAT_TEMP_ASSET,
    written: `${FLAT_TEMP_ASSET.hash} [temp]`,
    controls: rootControls(FLAT_TEMP_ASSET),
    expand: false
  },
  {
    shape: 'dropping an expanded-stack child',
    asset: TEMP_STACK_PREVIEW,
    written: `${TEMP_STACK_PREVIEW.name} [temp]`,
    controls: rootControls(TEMP_STACK_PREVIEW),
    expand: true,
    drop: true
  },
  {
    shape: 'dropping an expanded-stack child in a subfolder',
    asset: TEMP_FOLDER_PREVIEW,
    written: `previews/${TEMP_FOLDER_PREVIEW.name} [temp]`,
    controls: [
      `previews/${TEMP_FOLDER_PREVIEW.hash} [output]`,
      `previews/${TEMP_FOLDER_PREVIEW.hash} [input]`,
      `previews/${TEMP_FOLDER_PREVIEW.name} [output]`,
      `previews/${TEMP_FOLDER_PREVIEW.name} [input]`
    ],
    expand: true,
    drop: true
  },
  {
    shape: 'dropping a card with no job',
    asset: FLAT_TEMP_ASSET,
    written: `${FLAT_TEMP_ASSET.name} [temp]`,
    controls: rootControls(FLAT_TEMP_ASSET),
    expand: false,
    drop: true
  }
]) {
  test.describe(
    `Temp asset ${route.drop ? 'written by' : 'inserted as a node from'} ${route.shape}${route.drop ? ' onto Load Image' : ''}, then deleted`,
    { tag: route.drop ? ['@cloud', '@vue-nodes'] : ['@cloud'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
        await comfyPage.page.evaluate(
          ({ titles, values }) => {
            const graph = window.app!.graph
            const [first] = graph.findNodesByType('LoadImage')
            titles.forEach((title, index) => {
              const node = window.LiteGraph!.createNode('LoadImage')
              if (!node) throw new Error('LoadImage could not be created')
              node.title = title
              node.pos = [first.pos[0] + 400 * (index + 1), first.pos[1]]
              graph.add(node)
              const widget = node.widgets?.find((w) => w.name === 'image')
              if (!widget) throw new Error('Load Image widget not found')
              widget.value = values[index]
            })
          },
          {
            titles: route.controls.map((_, index) => controlTitle(index)),
            values: route.controls
          }
        )
      })

      test('writes the temp root and deleting the asset clears only that reference', async ({
        comfyPage
      }) => {
        const controls = await Promise.all(
          route.controls.map(
            async (_, index) =>
              (
                await comfyPage.nodeOps.getNodeRefsByTitle(controlTitle(index))
              )[0]
          )
        )
        const controlValues = () =>
          Promise.all(
            controls.map(async (node) =>
              (await node.getWidgetByName('image')).getValue()
            )
          )
        const [target] =
          await comfyPage.nodeOps.getNodeRefsByTitle('Load Image')
        const tab = comfyPage.menu.assetsTab
        await tab.open()
        await tab.openSettingsMenu()
        await tab.listViewOption.click()
        await tab.closeSettingsMenu()
        if (route.expand)
          await tab.expandOutputStack(
            route.asset.job_id === TEMP_FOLDER_JOB_ID ? 0 : 1
          )
        const row = comfyPage.page.getByRole('button', {
          name: `${route.asset.name} - image asset`,
          exact: true
        })
        await expect(row).toBeVisible()

        const written = await test.step('Write the reference', async () => {
          if (route.drop) {
            await target.centerOnNode()
            await row.dragTo(comfyPage.vueNodes.getNodeByTitle('Load Image'))
            return target
          }
          await row.click({ button: 'right' })
          await tab.contextMenuItem('Insert as node in workflow').click()
          await expect
            .poll(
              async () =>
                (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
            )
            .toBe(route.controls.length + 2)
          const inserted = (
            await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
          ).find(
            (node) =>
              node.id !== target.id &&
              controls.every((control) => control.id !== node.id)
          )
          if (!inserted) throw new Error('Inserted Load Image node not found')
          return inserted
        })

        const writtenWidget = await written.getWidgetByName('image')
        const writtenPreviewCount = () =>
          comfyPage.page.evaluate(
            (id) => window.app!.graph.getNodeById(id)?.imgs?.length ?? 0,
            written.id
          )
        await expect.poll(() => writtenWidget.getValue()).toBe(route.written)
        await expect.poll(writtenPreviewCount).toBeGreaterThan(0)

        await test.step('Delete the asset from the same row', async () => {
          const deleteRequest = comfyPage.page.waitForRequest(
            (request) =>
              request.method() === 'DELETE' &&
              new URL(request.url()).pathname ===
                `/api/assets/${route.asset.id}`
          )
          await row.click({ button: 'right' })
          await tab.contextMenuItem('Delete').click()
          await comfyPage.confirmDialog.click('delete')
          await deleteRequest
        })

        await expect.poll(() => writtenWidget.getValue()).toBe('')
        await expect.poll(writtenPreviewCount).toBe(0)
        await expect.poll(controlValues).toEqual(route.controls)

        if (route.drop) return
        await openErrorsTab(comfyPage)
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingMediaRow)
        ).toHaveText(['Load Image - image'])
      })
    }
  )
}

for (const option of [
  {
    shape: 'a group card at the root folder',
    asset: STALE_TEMP_ASSET,
    written: `${STALE_TEMP_ASSET.hash} [temp]`
  },
  {
    shape: 'a group card in a subfolder',
    asset: TEMP_FOLDER_SINGLE,
    written: `previews/${TEMP_FOLDER_SINGLE.hash} [temp]`
  }
]) {
  test.describe(
    `Temp output from ${option.shape} selected in the Load Image dropdown, then deleted`,
    { tag: ['@cloud', '@vue-nodes'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      })

      test('writes the temp root and folder, and deleting the asset clears the widget', async ({
        comfyPage
      }) => {
        const [loadImageRef] =
          await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
        const imageWidget = await loadImageRef.getWidgetByName('image')
        const dropdown = new WidgetSelectDropdownFixture(
          comfyPage.vueNodes.getWidgetRowByLabel('Load Image', 'image')
        )

        await dropdown.selectOption(`${option.asset.name} [temp]`)
        await expect.poll(() => imageWidget.getValue()).toBe(option.written)

        const tab = comfyPage.menu.assetsTab
        await tab.open()
        await tab.openSettingsMenu()
        await tab.listViewOption.click()
        await tab.closeSettingsMenu()
        await comfyPage.page
          .getByRole('button', {
            name: `${option.asset.name} - image asset`,
            exact: true
          })
          .click({ button: 'right' })
        await tab.contextMenuItem('Delete').click()
        await comfyPage.confirmDialog.click('delete')

        await expect.poll(() => imageWidget.getValue()).toBe('')
      })
    }
  )
}
