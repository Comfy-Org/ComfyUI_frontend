import type { Asset } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import {
  FLAT_FOLDER_TEMP_ASSET,
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

type Reveal = (tab: AssetsSidebarTab) => Promise<void>

const asCard: Reveal = async () => {}
const inExpandedStack =
  (index: number): Reveal =>
  (tab) =>
    tab.expandOutputStack(index)

const rootControls = (asset: Asset) => [`${asset.hash} [output]`, asset.name]
const folderControls = (asset: Asset) => [
  `previews/${asset.hash} [output]`,
  `previews/${asset.hash} [input]`,
  `previews/${asset.name} [output]`,
  `previews/${asset.name} [input]`
]
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
      TEMP_FOLDER_SINGLE,
      FLAT_FOLDER_TEMP_ASSET
    ],
    total: 8,
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

async function addControls(comfyPage: ComfyPage, values: string[]) {
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
    { titles: values.map((_, index) => controlTitle(index)), values }
  )
}

async function controlRefs(comfyPage: ComfyPage, count: number) {
  return Promise.all(
    Array.from(
      { length: count },
      async (_, index) =>
        (await comfyPage.nodeOps.getNodeRefsByTitle(controlTitle(index)))[0]
    )
  )
}

async function openAssetRow(
  comfyPage: ComfyPage,
  asset: Asset,
  reveal: Reveal
) {
  const tab = comfyPage.menu.assetsTab
  await tab.open()
  await tab.openSettingsMenu()
  await tab.listViewOption.click()
  await tab.closeSettingsMenu()
  await reveal(tab)
  const row = comfyPage.page.getByRole('button', {
    name: `${asset.name} - image asset`,
    exact: true
  })
  await expect(row).toBeVisible()
  return row
}

for (const route of [
  {
    shape: 'a group card tagged output and temp',
    asset: STALE_TEMP_ASSET,
    reveal: asCard,
    written: `${STALE_TEMP_ASSET.hash} [temp]`,
    controls: rootControls(STALE_TEMP_ASSET)
  },
  {
    shape: 'an expanded-stack child at the root folder',
    asset: TEMP_STACK_PREVIEW,
    reveal: inExpandedStack(1),
    written: `${TEMP_STACK_PREVIEW.name} [temp]`,
    controls: rootControls(TEMP_STACK_PREVIEW)
  },
  {
    shape: 'a card with no job at the root folder',
    asset: FLAT_TEMP_ASSET,
    reveal: asCard,
    written: `${FLAT_TEMP_ASSET.hash} [temp]`,
    controls: rootControls(FLAT_TEMP_ASSET)
  },
  {
    shape: 'a card with no job whose metadata names only its subfolder',
    asset: FLAT_FOLDER_TEMP_ASSET,
    reveal: asCard,
    written: `previews/${FLAT_FOLDER_TEMP_ASSET.hash} [temp]`,
    controls: folderControls(FLAT_FOLDER_TEMP_ASSET)
  }
]) {
  test.describe(
    `Temp asset inserted as a node from ${route.shape}, then deleted`,
    { tag: ['@cloud'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await addControls(comfyPage, route.controls)
      })

      test('writes the temp root and folder, and deleting the asset clears only that reference', async ({
        comfyPage
      }) => {
        const controls = await controlRefs(comfyPage, route.controls.length)
        const existing = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
        const row = await openAssetRow(comfyPage, route.asset, route.reveal)
        const tab = comfyPage.menu.assetsTab

        await row.click({ button: 'right' })
        await tab.contextMenuItem('Insert as node in workflow').click()
        await expect
          .poll(
            async () =>
              (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
          )
          .toBe(existing.length + 1)
        const inserted = (
          await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
        ).find((node) => existing.every(({ id }) => id !== node.id))
        if (!inserted) throw new Error('Inserted Load Image node not found')
        const insertedWidget = await inserted.getWidgetByName('image')
        const insertedPreviewCount = () =>
          comfyPage.page.evaluate(
            (id) => window.app!.graph.getNodeById(id)?.imgs?.length ?? 0,
            inserted.id
          )
        await expect.poll(() => insertedWidget.getValue()).toBe(route.written)
        await expect.poll(insertedPreviewCount).toBeGreaterThan(0)

        const deleteRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'DELETE' &&
            new URL(request.url()).pathname === `/api/assets/${route.asset.id}`
        )
        await row.click({ button: 'right' })
        await tab.contextMenuItem('Delete').click()
        await comfyPage.confirmDialog.click('delete')
        await deleteRequest

        await expect.poll(() => insertedWidget.getValue()).toBe('')
        await expect.poll(insertedPreviewCount).toBe(0)
        await expect
          .poll(() =>
            Promise.all(
              controls.map(async (node) =>
                (await node.getWidgetByName('image')).getValue()
              )
            )
          )
          .toEqual(route.controls)
        await openErrorsTab(comfyPage)
        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.missingMediaRow)
        ).toHaveText(['Load Image - image'])
      })
    }
  )
}

for (const route of [
  {
    shape: 'an expanded-stack child at the root folder',
    asset: TEMP_STACK_PREVIEW,
    reveal: inExpandedStack(1),
    written: `${TEMP_STACK_PREVIEW.name} [temp]`,
    controls: rootControls(TEMP_STACK_PREVIEW)
  },
  {
    shape: 'an expanded-stack child whose metadata names only its subfolder',
    asset: TEMP_FOLDER_PREVIEW,
    reveal: inExpandedStack(0),
    written: `previews/${TEMP_FOLDER_PREVIEW.name} [temp]`,
    controls: folderControls(TEMP_FOLDER_PREVIEW)
  },
  {
    shape: 'a card with no job at the root folder',
    asset: FLAT_TEMP_ASSET,
    reveal: asCard,
    written: `${FLAT_TEMP_ASSET.name} [temp]`,
    controls: rootControls(FLAT_TEMP_ASSET)
  },
  {
    shape: 'a card with no job whose metadata names only its subfolder',
    asset: FLAT_FOLDER_TEMP_ASSET,
    reveal: asCard,
    written: `previews/${FLAT_FOLDER_TEMP_ASSET.name} [temp]`,
    controls: folderControls(FLAT_FOLDER_TEMP_ASSET)
  }
]) {
  test.describe(
    `Temp asset dropped onto Load Image from ${route.shape}, then deleted`,
    { tag: ['@cloud', '@vue-nodes'] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await addControls(comfyPage, route.controls)
      })

      test('writes the temp root and folder, and deleting the asset clears only that reference', async ({
        comfyPage
      }) => {
        const controls = await controlRefs(comfyPage, route.controls.length)
        const [target] =
          await comfyPage.nodeOps.getNodeRefsByTitle('Load Image')
        const targetWidget = await target.getWidgetByName('image')
        const targetPreviewCount = () =>
          comfyPage.page.evaluate(
            (id) => window.app!.graph.getNodeById(id)?.imgs?.length ?? 0,
            target.id
          )
        const row = await openAssetRow(comfyPage, route.asset, route.reveal)
        const tab = comfyPage.menu.assetsTab

        await target.centerOnNode()
        await row.dragTo(comfyPage.vueNodes.getNodeByTitle('Load Image'))
        await expect.poll(() => targetWidget.getValue()).toBe(route.written)
        await expect.poll(targetPreviewCount).toBeGreaterThan(0)

        const deleteRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'DELETE' &&
            new URL(request.url()).pathname === `/api/assets/${route.asset.id}`
        )
        await row.click({ button: 'right' })
        await tab.contextMenuItem('Delete').click()
        await comfyPage.confirmDialog.click('delete')
        await deleteRequest

        await expect.poll(() => targetWidget.getValue()).toBe('')
        await expect.poll(targetPreviewCount).toBe(0)
        await expect
          .poll(() =>
            Promise.all(
              controls.map(async (node) =>
                (await node.getWidgetByName('image')).getValue()
              )
            )
          )
          .toEqual(route.controls)
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
    shape: 'a group card whose metadata names only its subfolder',
    asset: TEMP_FOLDER_SINGLE,
    written: `previews/${TEMP_FOLDER_SINGLE.hash} [temp]`
  },
  {
    shape: 'a card with no job whose metadata names only its subfolder',
    asset: FLAT_FOLDER_TEMP_ASSET,
    written: `previews/${FLAT_FOLDER_TEMP_ASSET.hash} [temp]`
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

        const row = await openAssetRow(comfyPage, option.asset, asCard)
        await row.click({ button: 'right' })
        await comfyPage.menu.assetsTab.contextMenuItem('Delete').click()
        await comfyPage.confirmDialog.click('delete')

        await expect.poll(() => imageWidget.getValue()).toBe('')
      })
    }
  )
}
