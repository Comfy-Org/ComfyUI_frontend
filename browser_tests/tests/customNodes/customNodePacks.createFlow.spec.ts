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
  }
]

test.describe('Custom node create flow', { tag: ['@cloud', '@ui'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page }) => {
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })
    await page.route('**/api/customnodes', async (route) => {
      await route.fulfill({ json: ownedPacks })
    })
    await page.route('**/api/customnodes/editor/sessions**', async (route) => {
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
  })

  test('asks for names before opening the editor, and cancels cleanly', async ({
    page,
    request
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await page.goto(APP_URL)
    await comfyPage.waitForAppReady()
    const closeWarning = page
      .getByRole('alert')
      .getByRole('button', { name: 'Close' })
    if (await closeWarning.isVisible()) await closeWarning.click()
    const closeTemplateDialog = page.getByRole('button', {
      name: 'Close dialog'
    })
    if (await closeTemplateDialog.isVisible()) await closeTemplateDialog.click()

    await page.locator('#graph-canvas').click({
      button: 'right',
      position: { x: 120, y: 420 }
    })
    await page.getByText('Create Node', { exact: true }).click()
    await page.getByText('In a new pack…', { exact: true }).click()

    const dialog = page.getByTestId('custom-node-create-dialog')
    await expect(dialog).toBeVisible()
    const packField = page.getByLabel('Pack name')
    const nodeField = page.getByLabel('Node name')
    await expect(packField).toHaveValue('New Node Pack')
    await expect(nodeField).toHaveValue('New Node')

    // An invalid name blocks Create and explains why.
    await nodeField.fill('!!')
    await expect(page.getByText(/Use 1-80 letters/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled()

    // A pack name already in use is rejected too.
    await nodeField.fill('Cool Blur')
    await packField.fill('Alpha Pack')
    await expect(
      page.getByText('You already have a pack with this name.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled()

    // Cancel returns to the graph without opening the editor.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('custom-node-workbench')).toHaveCount(0)
  })

  test('creates the named node and opens the editor', async ({
    page,
    request
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await page.goto(APP_URL)
    await comfyPage.waitForAppReady()
    const closeWarning = page
      .getByRole('alert')
      .getByRole('button', { name: 'Close' })
    if (await closeWarning.isVisible()) await closeWarning.click()
    const closeTemplateDialog = page.getByRole('button', {
      name: 'Close dialog'
    })
    if (await closeTemplateDialog.isVisible()) await closeTemplateDialog.click()

    const sessionRequests: string[] = []
    page.on('request', (candidate) => {
      if (
        candidate.method() === 'POST' &&
        candidate.url().endsWith('/editor/sessions')
      ) {
        sessionRequests.push(candidate.postData() ?? '')
      }
    })

    await page.locator('#graph-canvas').click({
      button: 'right',
      position: { x: 120, y: 420 }
    })
    await page.getByText('Create Node', { exact: true }).click()
    await page.getByText('In a new pack…', { exact: true }).click()
    await page.getByLabel('Node name').fill('Cool Blur')
    await page.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByTestId('custom-node-workbench')).toBeVisible()
    expect(sessionRequests.join()).toContain('"node_name":"Cool Blur"')
  })

  test('keeps the pack overflow menu above the packs dialog', async ({
    page,
    request
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await page.goto(APP_URL)
    await comfyPage.waitForAppReady()
    const closeWarning = page
      .getByRole('alert')
      .getByRole('button', { name: 'Close' })
    if (await closeWarning.isVisible()) await closeWarning.click()
    const closeTemplateDialog = page.getByRole('button', {
      name: 'Close dialog'
    })
    if (await closeTemplateDialog.isVisible()) await closeTemplateDialog.click()

    await comfyPage.menu.nodeLibraryTabV2.open()
    await comfyPage.menu.nodeLibraryTabV2.sidebarContent
      .getByRole('button', { name: 'Custom Nodes', exact: true })
      .click()

    await page.getByRole('button', { name: 'Actions for Alpha Pack' }).click()
    const createNodeItem = page.getByRole('menuitem', { name: 'Create node' })
    await expect(createNodeItem).toBeVisible()

    // The menu must be the topmost element at its own centre, not painted
    // beneath the dialog it belongs to.
    const box = await createNodeItem.boundingBox()
    expect(box).not.toBeNull()
    const hit = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y)
        const menu = element?.closest('[role="menuitem"]') ?? null
        const describe = (node: Element | null) =>
          node ? `${node.tagName}.${node.className}`.slice(0, 120) : 'none'
        return {
          onTop: menu !== null,
          element: describe(element),
          covering: describe(element?.closest('[class*="z-"]') ?? null)
        }
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    )
    expect(hit.onTop, `covered by ${hit.covering}`).toBe(true)
  })
})
