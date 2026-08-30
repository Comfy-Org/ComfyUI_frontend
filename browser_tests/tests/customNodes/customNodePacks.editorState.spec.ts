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
      content: [
        'import torch',
        'from comfy_api.latest import io',
        '',
        'class CheckerboardMask(io.ComfyNode):',
        '    @classmethod',
        '    async def execute(cls, image: torch.Tensor) -> io.NodeOutput:',
        '        enabled = True',
        '        return io.NodeOutput(image if enabled else None)',
        ''
      ].join('\n'),
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
      path: 'v2/nodes/checkerboard_mask_with_a_long_filename.py',
      content: '# Additional node module\n',
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

  test('keeps the workbench compact and restores its editor state', async ({
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
    const pythonEditorContent = page
      .locator('.monaco-editor .view-lines')
      .last()
    await expect(pythonEditorContent).toContainText('import torch')
    await expect
      .poll(() =>
        pythonEditorContent
          .locator('.view-line')
          .first()
          .evaluate(
            (line) =>
              new Set(
                Array.from(
                  line.querySelectorAll<HTMLElement>('span[class*="mtk"]')
                ).map((token) => getComputedStyle(token).color)
              ).size
          )
      )
      .toBeGreaterThan(1)
    await expect(
      page.getByText('pyproject.toml', { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.getByText('secure-nodes.json', { exact: true }).first()
    ).toBeVisible()

    const toolbar = page.getByTestId('custom-node-editor-toolbar')
    const explorerToggle = toolbar.getByRole('button', {
      name: 'Toggle Explorer'
    })
    const agentToggle = toolbar.getByRole('button', {
      name: 'Toggle Node Agent'
    })
    const explorerPanel = page.locator('.monaco-tree-editor-list-wrapper')
    const agentPanel = page.locator('.agent-panel')
    await expect(explorerToggle).toBeVisible()
    await expect(agentToggle).toBeVisible()
    await expect(explorerToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(agentToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(explorerPanel).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Toggle Explorer' })
    ).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: 'Toggle Node Agent' })
    ).toHaveCount(1)
    await expect(page.locator('.left-sider-bar')).toBeHidden()

    await explorerToggle.click()
    await expect(explorerToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(explorerPanel).toBeHidden()
    await explorerToggle.click()
    await expect(explorerToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(explorerPanel).toBeVisible()

    await agentToggle.click()
    await expect(agentPanel).toHaveAttribute('data-open', 'false')
    await agentToggle.click()
    await expect(agentPanel).toHaveAttribute('data-open', 'true')

    const longFileName = page
      .getByText('checkerboard_mask_with_a_long_filename.py', { exact: true })
      .first()
    await expect(longFileName).toBeVisible()
    const longFileLayout = await longFileName.evaluate((element) => {
      const row = element.closest<HTMLElement>(
        '.monaco-tree-editor-list-file-item-row'
      )!
      return {
        clipped: element.scrollWidth > element.clientWidth,
        labelHeight: Math.round(element.getBoundingClientRect().height),
        rowHeight: Math.round(row.getBoundingClientRect().height),
        whiteSpace: getComputedStyle(element).whiteSpace
      }
    })
    expect(longFileLayout.whiteSpace).toBe('nowrap')
    expect(longFileLayout.clipped).toBe(true)
    expect(longFileLayout.labelHeight).toBeLessThanOrEqual(
      longFileLayout.rowHeight
    )

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
    await explorerToggle.click()

    const activeTab = page.locator('.monaco-tree-editor-opened-tab-item-active')
    await expect(activeTab).toContainText('README.md')
    await expect(agentPanel).toHaveAttribute('data-open', 'false')
    await expect(explorerPanel).toBeHidden()

    await page.reload()
    await comfyPage.waitForAppReady()
    await closeStartupDialogs(page)
    await openCustomNodeEditor(page, comfyPage)

    await expect(activeTab).toContainText('README.md')
    await expect(
      page.locator('.monaco-tree-editor-opened-tab-item')
    ).toContainText(['checkerboard.py', 'README.md'])
    await expect(agentPanel).toHaveAttribute('data-open', 'false')
    await expect(explorerPanel).toBeHidden()
    await expect(explorerToggle).toHaveAttribute('aria-expanded', 'false')
  })
})
