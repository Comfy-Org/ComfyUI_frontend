import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { AlgoliaNodePack } from '@/types/algoliaTypes'
import type {
  AssetMetadata,
  AssetItem,
  ModelFolder
} from '@/platform/assets/schemas/assetSchema'
import type { components as ManagerComponents } from '@/workbench/extensions/manager/types/generatedManagerTypes'
import type { components as RegistryComponents } from '@comfyorg/registry-types'
import {
  STABLE_CHECKPOINT,
  STABLE_LORA,
  STABLE_VAE
} from '@e2e/fixtures/data/assetFixtures'
import {
  makeTemplate,
  mockTemplateIndex
} from '@e2e/fixtures/data/templateFixtures'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

type InstalledPacksResponse =
  ManagerComponents['schemas']['InstalledPacksResponse']
type RegistryNodePack = RegistryComponents['schemas']['Node']

interface AlgoliaSearchResult {
  hits: Array<Partial<AlgoliaNodePack> | AlgoliaSuggestionHit>
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
}

interface AlgoliaSearchResponse {
  results: AlgoliaSearchResult[]
}

interface AlgoliaSuggestionHit {
  query: string
  popularity: number
}

const RAISED_DIALOG_Z_INDEX = 4200

const MODEL_ASSETS: AssetItem[] = [
  {
    ...STABLE_CHECKPOINT,
    id: 'fe-569-checkpoint',
    tags: STABLE_CHECKPOINT.tags ?? [],
    is_immutable: false
  },
  {
    ...STABLE_LORA,
    id: 'fe-569-lora',
    tags: STABLE_LORA.tags ?? [],
    is_immutable: false
  },
  {
    ...STABLE_VAE,
    id: 'fe-569-vae',
    tags: STABLE_VAE.tags ?? [],
    is_immutable: false
  }
]

const MODEL_FOLDERS: ModelFolder[] = [
  { name: 'checkpoints', folders: [] },
  { name: 'loras', folders: [] },
  { name: 'vae', folders: [] }
]

const MOCK_PACK_A: RegistryNodePack = {
  id: 'test-pack-a',
  name: 'Test Pack A',
  description: 'A test custom node pack',
  downloads: 5000,
  status: 'NodeStatusActive',
  publisher: { id: 'test-publisher', name: 'Test Publisher' },
  latest_version: { version: '1.0.0', status: 'NodeVersionStatusActive' },
  repository: 'https://github.com/test/pack-a',
  tags: ['image', 'processing']
}

const MOCK_PACK_B: RegistryNodePack = {
  id: 'test-pack-b',
  name: 'Test Pack B',
  description: 'Another test custom node pack for testing search',
  downloads: 3000,
  status: 'NodeStatusActive',
  publisher: { id: 'another-publisher', name: 'Another Publisher' },
  latest_version: { version: '2.1.0', status: 'NodeVersionStatusActive' },
  repository: 'https://github.com/test/pack-b',
  tags: ['video', 'generation']
}

const MOCK_INSTALLED_PACKS: InstalledPacksResponse = {
  'test-pack-a': {
    ver: '1.0.0',
    cnr_id: 'test-pack-a',
    enabled: true
  }
}

const MOCK_HIT_A: Partial<AlgoliaNodePack> = {
  objectID: 'test-pack-a',
  id: 'test-pack-a',
  name: 'Test Pack A',
  description: 'A test custom node pack',
  total_install: 5000,
  status: 'NodeStatusActive',
  publisher_id: 'test-publisher',
  latest_version: '1.0.0',
  latest_version_status: 'NodeVersionStatusActive',
  repository_url: 'https://github.com/test/pack-a',
  comfy_nodes: ['TestNodeA'],
  create_time: '2024-01-01T00:00:00Z',
  update_time: '2024-06-01T00:00:00Z',
  license: 'MIT',
  tags: ['image', 'processing']
}

const MOCK_HIT_B: Partial<AlgoliaNodePack> = {
  objectID: 'test-pack-b',
  id: 'test-pack-b',
  name: 'Test Pack B',
  description: 'Another test custom node pack',
  total_install: 3000,
  status: 'NodeStatusActive',
  publisher_id: 'another-publisher',
  latest_version: '2.1.0',
  latest_version_status: 'NodeVersionStatusActive',
  repository_url: 'https://github.com/test/pack-b',
  comfy_nodes: ['TestNodeB'],
  create_time: '2024-02-01T00:00:00Z',
  update_time: '2024-07-01T00:00:00Z',
  license: 'Apache-2.0',
  tags: ['video', 'generation']
}

const MOCK_ALGOLIA_RESPONSE: AlgoliaSearchResponse = {
  results: [
    {
      hits: [MOCK_HIT_A, MOCK_HIT_B],
      nbHits: 2,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20
    },
    {
      hits: [{ query: 'Test Pack A', popularity: 100 }],
      nbHits: 1,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20
    }
  ]
}

test.use({
  initialFeatureFlags: {
    model_upload_button_enabled: true,
    private_models_enabled: true
  }
})

test.describe('PrimeVue dialog child overlays', () => {
  test('keeps workflow template filters above the template dialog', async ({
    comfyPage
  }) => {
    await mockTemplateLibrary(comfyPage)
    await forcePrimeVueDialogZIndex(comfyPage.page)

    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    const dialog = comfyPage.templatesDialog.root
    await expect(comfyPage.templates.content).toBeVisible()

    await dialog.getByRole('button', { name: /Model Filter/ }).click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'Flux' })
    )
    await comfyPage.page.keyboard.press('Escape')

    await dialog.getByRole('combobox', { name: /Sort by/ }).click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'Popular' })
    )
  })

  test('keeps manager header controls above the manager dialog', async ({
    comfyPage
  }) => {
    await setupManagerDialog(comfyPage)
    await forcePrimeVueDialogZIndex(comfyPage.page)
    await comfyPage.command.executeCommand('Comfy.OpenManagerDialog')

    const dialog = comfyPage.page.getByRole('dialog').last()
    await expect(dialog).toBeVisible()

    await dialog.getByText('Node Pack').first().click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'Nodes' })
    )
    await comfyPage.page.getByRole('option', { name: 'Nodes' }).click()

    await dialog.getByRole('combobox', { name: 'Sort' }).click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'Name' })
    )
  })

  test('keeps asset browser filters above the asset browser dialog', async ({
    comfyPage
  }) => {
    const dialog = await openAssetBrowser(comfyPage)

    await dialog.getByRole('button', { name: 'File formats' }).click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: '.safetensors' })
    )
    await comfyPage.page.keyboard.press('Escape')

    await dialog.getByRole('combobox', { name: 'Sort by' }).click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'A-Z' })
    )
  })

  test('keeps the model info selector above the asset browser dialog', async ({
    comfyPage
  }) => {
    const dialog = await openAssetBrowser(comfyPage)
    const card = dialog
      .locator('[data-component-id="AssetCard"]')
      .filter({ hasText: STABLE_CHECKPOINT.name })
      .first()

    await card.hover()
    await card.getByRole('button', { name: 'Model Info' }).click()

    const modelInfoPanel = dialog.locator(
      '[data-component-id="ModelInfoPanel"]'
    )
    await expect(modelInfoPanel).toBeVisible()

    await modelInfoPanel.getByRole('combobox').click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'LoRA' })
    )
  })

  test('keeps the upload model selector above the upload dialog', async ({
    comfyPage
  }) => {
    const assetBrowserDialog = await openAssetBrowser(comfyPage)
    await mockRemoteModelMetadata(comfyPage.page)

    await assetBrowserDialog
      .locator('[data-attr="upload-model-button"]')
      .click()

    const uploadDialog = comfyPage.page.getByRole('dialog').last()
    await expect(uploadDialog).toContainText('Import a model')

    await uploadDialog
      .locator('[data-attr="upload-model-step1-url-input"]')
      .fill('https://civitai.com/models/123/fe-569-test')
    await uploadDialog
      .locator('[data-attr="upload-model-step1-continue-button"]')
      .click()

    const trigger = uploadDialog.locator(
      '[data-attr="upload-model-step2-type-selector"]'
    )
    await expect(trigger).toBeVisible()
    await trigger.click()

    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'LoRA' })
    )
  })

  test('keeps keybinding controls above the settings dialog', async ({
    comfyPage
  }) => {
    await registerNoBindingCommand(comfyPage)
    await forcePrimeVueDialogZIndex(comfyPage.page)
    await comfyPage.settingDialog.open()
    await comfyPage.settingDialog.category('Keybinding').click()

    const dialog = comfyPage.settingDialog.root
    await expect(
      comfyPage.page.getByPlaceholder('Search Keybindings...')
    ).toBeVisible()

    await dialog
      .locator('#keybinding-panel-actions')
      .locator('button[role="combobox"]')
      .click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('option', { name: 'Default Preset' })
    )
    await comfyPage.page.getByRole('option', { name: 'Default Preset' }).click()

    await searchKeybindings(comfyPage.page, 'Comfy.SaveWorkflow')
    const saveWorkflowCommand = /^Comfy\.SaveWorkflow$/
    await getCommandRow(comfyPage.page, saveWorkflowCommand)
      .getByTitle(saveWorkflowCommand)
      .click({ button: 'right' })
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('menuitem', { name: /Change keybinding/i })
    )

    await comfyPage.page.getByTestId(TestIds.keybindings.presetMenu).click()
    await expectOverlayItemAboveRaisedDialog(
      comfyPage.page.getByRole('menuitem', { name: 'Import preset' })
    )
  })
})

async function forcePrimeVueDialogZIndex(page: Page) {
  await page.addStyleTag({
    content: `
      .p-dialog-mask {
        z-index: ${RAISED_DIALOG_Z_INDEX} !important;
      }
    `
  })
}

async function expectOverlayItemAboveRaisedDialog(item: Locator) {
  await expect(item).toBeVisible()

  const overlay = item.locator(
    'xpath=ancestor-or-self::*[contains(@style, "z-index")][1]'
  )
  await expect(overlay).toHaveCount(1)

  const overlayZIndex = await readZIndex(overlay)

  expect(overlayZIndex).toBeGreaterThan(RAISED_DIALOG_Z_INDEX)
}

async function readZIndex(locator: Locator): Promise<number> {
  const rawZIndex = await locator.evaluate(
    (element) => getComputedStyle(element).zIndex
  )
  const zIndex = Number.parseInt(rawZIndex, 10)

  expect(Number.isFinite(zIndex)).toBe(true)

  return zIndex
}

async function mockTemplateLibrary(comfyPage: ComfyPage) {
  await comfyPage.settings.setSetting('Comfy.Templates.SelectedModels', [])
  await comfyPage.settings.setSetting('Comfy.Templates.SelectedUseCases', [])
  await comfyPage.settings.setSetting('Comfy.Templates.SelectedRunsOn', [])
  await comfyPage.settings.setSetting('Comfy.Templates.SortBy', 'default')

  await comfyPage.page.route('**/templates/**.webp', async (route) => {
    await route.fulfill({
      status: 200,
      path: 'browser_tests/assets/example.webp',
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store'
      }
    })
  })

  await comfyPage.page.route('**/templates/index.json', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify(
        mockTemplateIndex([
          makeTemplate({
            name: 'flux-template',
            title: 'Flux Template',
            models: ['Flux'],
            tags: ['Image']
          }),
          makeTemplate({
            name: 'wan-template',
            title: 'Wan Template',
            models: ['Wan 2.2'],
            tags: ['Video'],
            openSource: false
          })
        ])
      ),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  })
}

async function setupManagerDialog(comfyPage: ComfyPage) {
  const statsWithManager = {
    ...mockSystemStats,
    system: {
      ...mockSystemStats.system,
      argv: ['main.py', '--enable-manager']
    }
  }

  await comfyPage.page.route('**/system_stats**', async (route) => {
    await route.fulfill({ json: statsWithManager })
  })

  await comfyPage.page.route('**/v2/customnode/installed**', async (route) => {
    await route.fulfill({ json: MOCK_INSTALLED_PACKS })
  })

  await comfyPage.page.route('**/v2/manager/queue/status**', async (route) => {
    await route.fulfill({
      json: {
        history: {},
        running_queue: [],
        pending_queue: [],
        installed_packs: {}
      }
    })
  })

  await comfyPage.page.route('**/v2/manager/queue/history**', async (route) => {
    await route.fulfill({ json: {} })
  })

  await comfyPage.page.route('**/*.algolia.net/**', async (route) => {
    await route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
  })
  await comfyPage.page.route('**/*.algolianet.com/**', async (route) => {
    await route.fulfill({ json: MOCK_ALGOLIA_RESPONSE })
  })

  const registryListResponse = {
    total: 2,
    nodes: [MOCK_PACK_A, MOCK_PACK_B],
    page: 1,
    limit: 64,
    totalPages: 1
  }

  await comfyPage.page.route(
    '**/api.comfy.org/nodes/search**',
    async (route) => {
      await route.fulfill({ json: registryListResponse })
    }
  )

  await comfyPage.page.route(
    (url) => url.hostname === 'api.comfy.org' && url.pathname === '/nodes',
    async (route) => {
      await route.fulfill({ json: registryListResponse })
    }
  )

  await comfyPage.page.route(
    '**/v2/customnode/getmappings**',
    async (route) => {
      await route.fulfill({ json: {} })
    }
  )

  await comfyPage.page.route(
    '**/v2/customnode/import_fail_info**',
    async (route) => {
      await route.fulfill({ json: {} })
    }
  )

  await comfyPage.setup()

  await comfyPage.page.evaluate(() => {
    const api = window.app!.api
    api.serverFeatureFlags.value = {
      ...api.serverFeatureFlags.value,
      extension: {
        manager: {
          supports_v4: true,
          supports_csrf_post: true
        }
      }
    }
  })
}

async function openAssetBrowser(comfyPage: ComfyPage): Promise<Locator> {
  await mockModelFolders(comfyPage.page)
  await forcePrimeVueDialogZIndex(comfyPage.page)
  await showAssetBrowserModal(comfyPage.page)

  const assetBrowser = comfyPage.page.locator(
    '[data-component-id="AssetBrowserModal"]'
  )
  await expect(assetBrowser).toBeVisible()
  await expect(
    assetBrowser.getByRole('heading', { name: STABLE_CHECKPOINT.name })
  ).toBeVisible()

  return assetBrowser.locator('xpath=ancestor::*[@role="dialog"][1]')
}

async function showAssetBrowserModal(page: Page) {
  await page.evaluate((assets) => {
    Object.assign(window, { __fe569ModelAssets: assets })
  }, MODEL_ASSETS)

  await page.addScriptTag({
    type: 'module',
    content: `
      const { useDialogService } = await import('/src/services/dialogService.ts')
      const AssetBrowserModal = (await import('/src/platform/assets/components/AssetBrowserModal.vue')).default

      useDialogService().showLayoutDialog({
        key: 'fe-569-asset-browser',
        component: AssetBrowserModal,
        props: {
          showLeftPanel: true,
          assetType: 'models',
          title: 'Model Library',
          overrideAssets: window.__fe569ModelAssets,
          onClose: () => {}
        }
      })
    `
  })
}

async function mockModelFolders(page: Page) {
  await page.route('**/experiment/models', async (route) => {
    await route.fulfill({ json: MODEL_FOLDERS })
  })
}

async function mockRemoteModelMetadata(page: Page) {
  const metadata: AssetMetadata = {
    content_length: 1234,
    final_url: 'https://civitai.com/api/download/models/123',
    filename: 'fe-569-upload-test.safetensors',
    tags: []
  }

  await page.route('**/assets/remote-metadata**', async (route) => {
    await route.fulfill({ json: metadata })
  })
}

async function registerNoBindingCommand(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    const app = window.app!
    app.registerExtension({
      name: 'TestExtension.PrimeVueRekaOverlayZIndex',
      commands: [
        { id: 'TestCommand.PrimeVueRekaOverlay.NoBinding', function: () => {} }
      ]
    })
  })
}

async function searchKeybindings(page: Page, query: string) {
  await page.getByPlaceholder('Search Keybindings...').fill(query)
}

function getCommandRow(page: Page, commandTitle: RegExp): Locator {
  return page
    .locator('.keybinding-panel tr')
    .filter({ has: page.getByTitle(commandTitle) })
}
