import type { Page } from '@playwright/test'

import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const editorSession = {
  id: 'editor-state-session',
  mode: 'create',
  name: 'New Custom Node',
  status: 'ready',
  editor_kind: 'workbench',
  agent_enabled: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z'
}

const editorFiles = {
  files: [
    {
      path: 'README.md',
      content: '# New Custom Node\n',
      editable: true
    },
    {
      path: 'v2/nodes/checkerboard.py',
      content: 'import torch\nfrom comfy_api.latest import io\n',
      editable: true
    },
    {
      path: 'v2/pyproject.toml',
      content: '[project]\nname = "new-custom-node"\nversion = "0.1.0"\n',
      editable: true
    },
    {
      path: 'v2/secure-nodes.json',
      content: '{\n  "format": "comfy-secure-nodes-v1"\n}\n',
      editable: true
    },
    {
      path: 'v2/web/js/checkerboard.js',
      content: '// checkerboard extension\n',
      editable: true
    }
  ],
  initial_path: 'v2/nodes/checkerboard.py'
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

async function openCustomNodeEditor(page: Page, comfyPage: ComfyPage) {
  await comfyPage.menu.nodeLibraryTabV2.open()
  const customNodesButton =
    comfyPage.menu.nodeLibraryTabV2.sidebarContent.getByRole('button', {
      name: 'Custom Nodes',
      exact: true
    })
  await expect(customNodesButton).toBeVisible()
  await customNodesButton.click()
  await expect(
    page.getByRole('heading', { name: 'Custom node packs', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByTestId('custom-node-workbench')).toBeVisible()
}

test.describe('Custom node editor state', { tag: ['@cloud', '@ui'] }, () => {
  test.beforeEach(async ({ page }) => {
    await setupCloudApp(page, {
      workspace: workspace('personal', 'owner')
    })
    await page.route('**/api/customnodes', async (route) => {
      await route.fulfill({ json: [] })
    })
    await page.route('**/api/customnodes/editor/sessions**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/files')) {
        await route.fulfill({ json: editorFiles })
        return
      }
      await route.fulfill({
        status: path.endsWith('/sessions') ? 202 : 200,
        json: editorSession
      })
    })
  })

  test('restores open tabs, the active file, and Node Agent visibility', async ({
    page,
    request
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await page.goto(APP_URL)
    await comfyPage.waitForAppReady()
    await closeStartupDialogs(page)
    await openCustomNodeEditor(page, comfyPage)

    await expect(
      page.locator('.monaco-tree-editor-opened-tab-item-active')
    ).toContainText('checkerboard.py')
    await expect(
      page.locator('.monaco-editor .view-lines').last()
    ).toContainText('import torch')
    await expect(
      page.getByText('pyproject.toml', { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.getByText('secure-nodes.json', { exact: true }).first()
    ).toBeVisible()

    const treeHeader = await page
      .locator('.custom-node-tree-editor')
      .evaluate((root) => {
        const title = root.querySelector<HTMLElement>(
          '.monaco-tree-editor-list-title'
        )!
        const projectRow = root.querySelector<HTMLElement>(
          '.monaco-tree-editor-list-title + .monaco-tree-editor-list-split'
        )!
        const projectName =
          projectRow.querySelector<HTMLElement>(':scope > span')!
        const titleBox = title.getBoundingClientRect()
        const rowBox = projectRow.getBoundingClientRect()
        const nameBox = projectName.getBoundingClientRect()
        return {
          name: projectName.textContent,
          nameBottom: Math.round(nameBox.bottom),
          nameTop: Math.round(nameBox.top),
          rowBottom: Math.round(rowBox.bottom),
          rowTop: Math.round(rowBox.top),
          titleBottom: Math.round(titleBox.bottom),
          whiteSpace: getComputedStyle(projectName).whiteSpace
        }
      })
    expect(treeHeader.name).toBe('New Custom Node')
    expect(treeHeader.whiteSpace).toBe('nowrap')
    expect(treeHeader.titleBottom).toBeLessThanOrEqual(treeHeader.rowTop)
    expect(treeHeader.nameTop).toBeGreaterThanOrEqual(treeHeader.rowTop)
    expect(treeHeader.nameBottom).toBeLessThanOrEqual(treeHeader.rowBottom)

    await page.getByText('README.md', { exact: true }).first().click()
    const editorContent = page.locator('.monaco-editor .view-lines').last()
    await expect(editorContent).toContainText('# New Custom Node')
    await page
      .getByRole('button', { name: 'Close Node Agent', exact: true })
      .click()

    const activeTab = page.locator('.monaco-tree-editor-opened-tab-item-active')
    await expect(activeTab).toContainText('README.md')
    const agentPanel = page.locator('.agent-panel')
    await expect(agentPanel).toHaveAttribute('data-open', 'false')

    await page.reload()
    await comfyPage.waitForAppReady()
    await closeStartupDialogs(page)
    await openCustomNodeEditor(page, comfyPage)

    await expect(activeTab).toContainText('README.md')
    await expect(
      page.locator('.monaco-tree-editor-opened-tab-item')
    ).toContainText(['checkerboard.py', 'README.md'])
    await expect(agentPanel).toHaveAttribute('data-open', 'false')
  })
})
