import type { Page } from '@playwright/test'

import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const editorSession = {
  id: 'file-operations-session',
  mode: 'create',
  name: 'New Custom Node',
  status: 'ready',
  editor_kind: 'workbench',
  agent_enabled: true,
  created_at: '2026-08-30T07:00:00Z',
  updated_at: '2026-08-30T07:00:00Z'
}

interface EditorOperation {
  kind: string
  path: string
  destination?: string
  content?: string
}

async function closeStartupDialogs(page: Page) {
  const closeWarning = page
    .getByRole('alert')
    .getByRole('button', { name: 'Close' })
  if (await closeWarning.isVisible()) await closeWarning.click()

  const closeTemplateDialog = page.getByRole('button', {
    name: 'Close dialog'
  })
  if (await closeTemplateDialog.isVisible()) await closeTemplateDialog.click()
}

async function openEditor(page: Page, comfyPage: ComfyPage) {
  await comfyPage.menu.nodeLibraryTabV2.open()
  await comfyPage.menu.nodeLibraryTabV2.sidebarContent
    .getByRole('button', { name: 'Custom Nodes', exact: true })
    .click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page
    .getByTestId('custom-node-create-dialog')
    .getByRole('button', { name: 'Create', exact: true })
    .click()
  await expect(page.getByTestId('custom-node-workbench')).toBeVisible()
}

test.describe(
  'Custom node project tree operations',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('creates, renames, moves, and deletes files and folders', async ({
      page,
      request
    }) => {
      test.setTimeout(60_000)
      await setupCloudApp(page, {
        workspace: workspace('personal', 'owner')
      })
      await page.route('**/api/customnodes', async (route) => {
        await route.fulfill({ json: [] })
      })

      const files = new Map([
        ['README.md', '# New Custom Node\n'],
        ['v2/nodes/checkerboard.py', '# checkerboard\n']
      ])
      const directories = new Set(['v2', 'v2/nodes'])
      const operations: EditorOperation[] = []
      let revision = 1
      const response = () => ({
        files: [...files].map(([path, content]) => ({
          path,
          content,
          editable: true
        })),
        directories: [...directories],
        initial_path: 'v2/nodes/checkerboard.py',
        digest: `digest-${revision}`
      })

      await page.route(
        '**/api/customnodes/editor/sessions**',
        async (route) => {
          const request = route.request()
          const path = new URL(request.url()).pathname
          if (!path.endsWith('/files')) {
            await route.fulfill({
              status: path.endsWith('/sessions') ? 202 : 200,
              json: editorSession
            })
            return
          }
          if (request.method() === 'GET') {
            await route.fulfill({ json: response() })
            return
          }

          const body = request.postDataJSON() as {
            baseline_digest?: string
            operations?: EditorOperation[]
          }
          expect(body.baseline_digest).toBe(`digest-${revision}`)
          for (const operation of body.operations ?? []) {
            operations.push(operation)
            switch (operation.kind) {
              case 'create_directory':
                directories.add(operation.path)
                break
              case 'create_file':
                files.set(operation.path, operation.content ?? '')
                break
              case 'move_file': {
                const content = files.get(operation.path)
                if (content === undefined || !operation.destination) {
                  throw new Error('Invalid mocked move operation')
                }
                files.delete(operation.path)
                files.set(operation.destination, content)
                break
              }
              case 'delete_file':
                files.delete(operation.path)
                break
            }
          }
          revision += 1
          await route.fulfill({ json: response() })
        }
      )

      const comfyPage = new ComfyPage(page, request)
      await page.goto(APP_URL)
      await comfyPage.waitForAppReady()
      await closeStartupDialogs(page)
      await openEditor(page, comfyPage)

      const projectRow = page.locator(
        '.monaco-tree-editor-list-title + .monaco-tree-editor-list-split'
      )
      await projectRow.hover()
      await projectRow.locator('label[title="New Folder.."]').click()
      await page
        .locator('.monaco-tree-editor-list-file-item-new')
        .last()
        .fill('helpers')
      await page.keyboard.press('Enter')
      await expect(
        page.getByText('helpers', { exact: true }).first()
      ).toBeVisible()

      const helpersRow = page
        .locator('.monaco-tree-editor-list-file-item-row')
        .filter({ hasText: 'helpers' })
        .first()
      await helpersRow.hover()
      await helpersRow.locator('label[title="New File.."]').click()
      await page
        .locator('.monaco-tree-editor-list-file-item-new')
        .last()
        .fill('helper.py')
      await page.keyboard.press('Enter')
      await expect(
        page.getByText('helper.py', { exact: true }).first()
      ).toBeVisible()

      const helperRow = page
        .locator('.monaco-tree-editor-list-file-item-row')
        .filter({ hasText: 'helper.py' })
        .first()
      await helperRow.hover()
      await helperRow.locator('label[title="Rename.."]').click()
      const renameInput = page
        .locator('.monaco-tree-editor-list-file-item-new')
        .last()
      await renameInput.fill('utility.py')
      await page.keyboard.press('Enter')
      await expect(
        page.getByText('utility.py', { exact: true }).first()
      ).toBeVisible()

      const utilityRow = page
        .locator('.monaco-tree-editor-list-file-item-row')
        .filter({ hasText: 'utility.py' })
        .first()
      await utilityRow.click({ button: 'right' })
      await page.getByText('Move File…', { exact: true }).click()
      const moveDialog = page.getByRole('dialog', { name: 'Move File…' })
      await expect(moveDialog).toBeVisible()
      const destination = moveDialog.getByRole('textbox', {
        name: 'Project-relative destination'
      })
      await destination.fill('v2/nodes/utility.py')
      await moveDialog
        .getByRole('button', { name: 'Move', exact: true })
        .click()

      const movedRow = page
        .locator('.monaco-tree-editor-list-file-item-row')
        .filter({ hasText: 'utility.py' })
        .first()
      await expect(movedRow).toBeVisible()
      await movedRow.hover()
      await movedRow.locator('label[title="Delete"]').click()
      await page.getByText('DELETE', { exact: true }).last().click()
      await expect(page.getByText('utility.py', { exact: true })).toHaveCount(0)

      expect(operations).toEqual([
        { kind: 'create_directory', path: 'helpers' },
        { kind: 'create_file', path: 'helpers/helper.py', content: '' },
        {
          kind: 'move_file',
          path: 'helpers/helper.py',
          destination: 'helpers/utility.py'
        },
        {
          kind: 'move_file',
          path: 'helpers/utility.py',
          destination: 'v2/nodes/utility.py'
        },
        { kind: 'delete_file', path: 'v2/nodes/utility.py' }
      ])
    })
  }
)
