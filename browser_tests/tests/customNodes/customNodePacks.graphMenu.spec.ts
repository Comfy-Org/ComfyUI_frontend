import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  nodeAgentEditorFiles,
  nodeAgentEditorSession
} from '@e2e/fixtures/data/customNodeWorkbench'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const ownedPacks = [
  {
    revision_id: 'alpha-pack-x01234567',
    name: 'Alpha Pack',
    owner: 'w-1',
    snapshot: 's-1',
    uploaded_at: '2026-08-29T12:00:00Z'
  },
  {
    revision_id: 'beta-pack-x89abcdef',
    name: 'Beta Pack',
    owner: 'w-1',
    snapshot: 's-2',
    uploaded_at: '2026-08-29T12:01:00Z'
  }
]

function setupRoutes(
  page: Parameters<typeof setupCloudApp>[0],
  packs: object[]
) {
  return Promise.all([
    page.route('**/api/customnodes', async (route) => {
      await route.fulfill({ json: packs })
    }),
    page.route('**/api/customnodes/editor/sessions**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/files')) {
        await route.fulfill({ json: nodeAgentEditorFiles })
        return
      }
      await route.fulfill({
        status: path.endsWith('/sessions') ? 202 : 200,
        json: nodeAgentEditorSession
      })
    })
  ])
}

async function openApp(
  page: Parameters<typeof setupCloudApp>[0],
  request: never
) {
  const comfyPage = new ComfyPage(page, request)
  await page.goto(APP_URL)
  await comfyPage.waitForAppReady()
  const closeWarning = page
    .getByRole('alert')
    .getByRole('button', { name: 'Close' })
  if (await closeWarning.isVisible()) await closeWarning.click()
  const closeTemplateDialog = page.getByRole('button', { name: 'Close dialog' })
  if (await closeTemplateDialog.isVisible()) await closeTemplateDialog.click()
  return comfyPage
}

test.describe('Custom node graph menu', { tag: ['@cloud', '@ui'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('creates a new pack straight from the canvas menu', async ({
    page,
    request
  }) => {
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })
    await setupRoutes(page, [])
    await openApp(page, request as never)

    await page.locator('#graph-canvas').click({
      button: 'right',
      position: { x: 120, y: 420 }
    })
    const createItem = page.getByText('Create Node', { exact: true })
    await expect(createItem).toBeVisible()
    await createItem.click()

    await expect(page.getByTestId('custom-node-workbench')).toBeVisible()
  })

  test('asks which pack to create the node in when packs exist', async ({
    page,
    request
  }) => {
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })
    await setupRoutes(page, ownedPacks)
    await openApp(page, request as never)

    await page.locator('#graph-canvas').click({
      button: 'right',
      position: { x: 120, y: 420 }
    })
    const createItem = page.getByText('Create Node', { exact: true })
    await expect(createItem).toBeVisible()
    await createItem.click()

    await expect(
      page.getByText('In a new pack…', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('In Alpha Pack', { exact: true })).toBeVisible()
    await page.getByText('In Beta Pack', { exact: true }).click()

    await expect(page.getByTestId('custom-node-workbench')).toBeVisible()
  })
})
