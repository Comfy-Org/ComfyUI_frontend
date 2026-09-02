import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { AssetBrowserModal } from '@e2e/fixtures/components/AssetBrowserModal'
import {
  BARE_MODEL,
  EDITABLE_MODEL,
  IMMUTABLE_MODEL,
  MOCK_MODEL_FOLDERS
} from '@e2e/fixtures/data/assetBrowserFixtures'
import { AssetBrowserHelper } from '@e2e/fixtures/helpers/AssetBrowserHelper'
import type { TagMutationCall } from '@e2e/fixtures/helpers/AssetBrowserHelper'
import { withAsset } from '@e2e/fixtures/helpers/AssetHelper'

type UserMetadataUpdate = {
  name?: string
  user_description?: string
  base_model?: string[]
  additional_tags?: string[]
}

type MetadataBody = {
  user_metadata?: UserMetadataUpdate
}

test.describe('Asset Browser - ModelInfoPanel', () => {
  let modal: AssetBrowserModal
  let assetBrowserHelper: AssetBrowserHelper
  let tagCalls: { getCalls(): TagMutationCall[] }

  async function focusEditableModel() {
    await modal.clickAsset(EDITABLE_MODEL.id)
    await modal.waitForAssetContent('cinematic_details_v2.safetensors')
  }

  async function focusImmutableModel() {
    await modal.clickAsset(IMMUTABLE_MODEL.id)
    await modal.waitForAssetContent('sdxl_base_1.0.safetensors')
  }

  async function focusBareModel() {
    await modal.clickAsset(BARE_MODEL.id)
    await modal.waitForAssetContent('bare_checkpoint.safetensors')
  }

  function metadataMutations(comfyPage: ComfyPage) {
    return comfyPage.assetApi
      .getMutations()
      .filter(
        (mutation) =>
          mutation.method === 'PUT' &&
          /\/assets\/[^/]+$/.test(mutation.endpoint)
      )
  }

  function getLastMetadataBody(
    comfyPage: ComfyPage
  ): MetadataBody | undefined {
    const last = metadataMutations(comfyPage).at(-1)
    return typeof last?.body === 'object' && last.body !== null
      ? (last.body as MetadataBody)
      : undefined
  }

  test.beforeEach(async ({ comfyPage }) => {
    comfyPage.assetApi.configure(
      withAsset(EDITABLE_MODEL),
      withAsset(IMMUTABLE_MODEL),
      withAsset(BARE_MODEL)
    )
    await comfyPage.assetApi.mock()

    assetBrowserHelper = new AssetBrowserHelper(comfyPage.page)
    await comfyPage.modelLibrary.mockModelFolders(MOCK_MODEL_FOLDERS)
    tagCalls = await assetBrowserHelper.mockAssetTags()

    await comfyPage.setup()
    await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
    await comfyPage.command.executeCommand('Comfy.BrowseModelAssets')

    modal = new AssetBrowserModal(comfyPage.page)
    await expect(modal.root).toBeVisible()

    await focusEditableModel()
  })

  test.afterEach(async ({ comfyPage }) => {
    await assetBrowserHelper.clearMocks()
    await comfyPage.modelLibrary.clearMocks()
    await comfyPage.assetApi.clearMocks()
  })

  test.describe('1) Panel Rendering & Basic Info', () => {
    test('shows panel after focusing an asset', async () => {
      await expect(modal.modelInfoPanel).toBeVisible()
    })

    test('renders filename from metadata filename', async () => {
      await expect(modal.fileNameText).toContainText(
        'cinematic_details_v2.safetensors'
      )
    })

    test('renders user description in textarea', async () => {
      await expect(modal.userDescriptionTextarea).toHaveValue(
        'Great for close-up portraits and high-frequency details.'
      )
    })

    test('hides optional metadata blocks for bare model', async () => {
      await focusBareModel()
      await expect(modal.sourceLink).toBeHidden()
      await expect(modal.descriptionText).toBeHidden()
      await expect(modal.triggerPhrasesCopyAllButton).toBeHidden()
    })
  })

  test.describe('2) Immutable vs Mutable', () => {
    test('hides display-name edit button for immutable asset', async () => {
      await focusImmutableModel()
      await expect(modal.editDisplayNameButton).toBeHidden()
    })

    test('does not render model type combobox for immutable asset', async () => {
      await focusImmutableModel()
      await expect(modal.modelTypeSelect).toBeHidden()
    })

    test('disables base-model tags input for immutable asset', async () => {
      await focusImmutableModel()
      await expect(modal.baseModelsInput).toBeDisabled()
    })

    test('disables additional-tags input for immutable asset', async () => {
      await focusImmutableModel()
      await expect(modal.additionalTagsInput).toBeDisabled()
    })

    test('disables user description textarea for immutable asset', async () => {
      await focusImmutableModel()
      await expect(modal.userDescriptionTextarea).toBeDisabled()
    })

    test('shows edit controls for mutable asset', async () => {
      await focusImmutableModel()
      await focusEditableModel()
      await expect(modal.editDisplayNameButton).toBeVisible()
      await expect(modal.modelTypeSelect).toBeVisible()
    })

    test('enables user description textarea for mutable asset', async () => {
      await focusImmutableModel()
      await focusEditableModel()
      await expect(modal.userDescriptionTextarea).toBeEnabled()
    })
  })

  test.describe('3) Display Name Editing', () => {
    test('enters edit mode on display-name double-click', async () => {
      await modal.displayNameText.dblclick()
      await expect(modal.displayNameInput).toBeVisible()
    })

    test('enters edit mode on edit button click', async () => {
      await modal.editDisplayNameButton.click()
      await expect(modal.displayNameInput).toBeVisible()
    })

    test('submitting new display name sends metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.editDisplayNameButton.click()
      await modal.displayNameInput.fill('My Renamed Model')
      await modal.displayNameInput.press('Enter')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      expect(lastBody?.user_metadata?.name).toBe('My Renamed Model')
    })

    test('submitting same display name does not send metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.editDisplayNameButton.click()
      await modal.displayNameInput.fill('Cinematic Details v2')
      await modal.displayNameInput.press('Enter')

      await modal.editDisplayNameButton.click()
      await modal.displayNameInput.fill('Sentinel Name')
      await modal.displayNameInput.press('Enter')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBe(initial + 1)
    })

    test('canceling display-name edit restores original text', async () => {
      await modal.editDisplayNameButton.click()
      await modal.displayNameInput.fill('Temporary Name')
      await modal.displayNameInput.press('Escape')

      await expect(modal.displayNameText).toContainText('Cinematic Details v2')
      await expect(modal.displayNameInput).toBeHidden()
    })

    test('submitting empty display name does not send metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.editDisplayNameButton.click()
      await modal.displayNameInput.fill('')
      await modal.displayNameInput.press('Enter')

      await modal.editDisplayNameButton.click()
      await modal.displayNameInput.fill('Sentinel Name')
      await modal.displayNameInput.press('Enter')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBe(initial + 1)
    })
  })

  test.describe('4) Model Type Selection', () => {
    test('shows model type options when combobox is opened', async () => {
      await modal.modelTypeSelect.click()
      await expect(
        modal.page.getByRole('option', { name: /loras/i })
      ).toBeVisible()
    })

    test('changing model type sends tag mutation requests', async () => {
      const initial = tagCalls.getCalls().length

      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /checkpoints/i }).click()

      await expect
        .poll(() => tagCalls.getCalls().length)
        .toBeGreaterThan(initial)

      const lastCall = tagCalls.getCalls().at(-1)
      expect(lastCall).toBeDefined()
      expect(lastCall?.body.tags).toContain('checkpoints')
    })

    test('selecting same model type does not send tag mutations', async () => {
      const initial = tagCalls.getCalls().length

      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /lora/i }).click()

      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /checkpoints/i }).click()

      await expect
        .poll(() => tagCalls.getCalls().length)
        .toBe(initial + 2)
    })

    test('updates combobox value immediately after selecting new model type', async () => {
      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /checkpoints/i }).click()
      await expect(modal.modelTypeSelect).toContainText(/checkpoints/i)
    })
  })

  test.describe('5) Base Models & Additional Tags', () => {
    test('shows existing base model values', async () => {
      await expect(modal.modelTaggingSection).toContainText('sdxl')
      await expect(modal.modelTaggingSection).toContainText('flux.1-dev')
    })

    test('shows existing additional tags values', async () => {
      await expect(modal.modelTaggingSection).toContainText('portrait')
      await expect(modal.modelTaggingSection).toContainText('detail')
    })

    test('adding a base model sends metadata update', async ({ comfyPage }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.baseModelsInput.click()
      await modal.baseModelsInput.fill('sd3.5-large')
      await modal.baseModelsInput.press('Enter')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      const baseModels = lastBody?.user_metadata?.base_model
      expect(baseModels).toContain('sd3.5-large')
      expect(baseModels).toContain('sdxl')
      expect(baseModels).toContain('flux.1-dev')
    })

    test('removing a base model sends metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      const removeButtons = modal.baseModelsField.getByRole('button', {
        name: /remove/i
      })
      await removeButtons.first().click()

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      const baseModels = lastBody?.user_metadata?.base_model
      expect(baseModels).toBeDefined()
      expect(baseModels).toHaveLength(1)
    })

    test('adding an additional tag sends metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.additionalTagsInput.click()
      await modal.additionalTagsInput.fill('cinematic')
      await modal.additionalTagsInput.press('Enter')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      const tags = lastBody?.user_metadata?.additional_tags
      expect(tags).toContain('cinematic')
      expect(tags).toContain('portrait')
      expect(tags).toContain('detail')
    })

    test('removing an additional tag sends metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      const removeButtons = modal.additionalTagsField.getByRole('button', {
        name: /remove/i
      })
      await removeButtons.first().click()

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      const tags = lastBody?.user_metadata?.additional_tags
      expect(tags).toBeDefined()
      expect(tags).toHaveLength(1)
    })
  })

  test.describe('6) User Description', () => {
    test('shows existing user description value', async () => {
      await expect(modal.userDescriptionTextarea).toHaveValue(
        'Great for close-up portraits and high-frequency details.'
      )
    })

    test('typing new description sends debounced metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.userDescriptionTextarea.fill('Updated description body')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      expect(lastBody?.user_metadata?.user_description).toBe(
        'Updated description body'
      )
    })

    test('escape key blurs user description textarea', async () => {
      await modal.userDescriptionTextarea.click()
      await modal.userDescriptionTextarea.press('Escape')

      await expect
        .poll(() =>
          modal.userDescriptionTextarea.evaluate(
            (element) => element === document.activeElement
          )
        )
        .toBe(false)
    })

    test('clearing description sends empty-string metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.userDescriptionTextarea.fill('')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBeGreaterThan(initial)

      const lastBody = getLastMetadataBody(comfyPage)
      expect(lastBody?.user_metadata?.user_description).toBe('')
    })
  })

  test.describe('7) Watchers & State Reset', () => {
    test('switching assets resets pending metadata updates', async () => {
      await modal.userDescriptionTextarea.fill('pending draft')

      await focusBareModel()
      await focusEditableModel()

      await expect(modal.userDescriptionTextarea).toHaveValue(
        'Great for close-up portraits and high-frequency details.'
      )
    })

    test('switching assets resets pending model-type state', async () => {
      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /checkpoints/i }).click()
      await expect(modal.modelTypeSelect).toContainText(/checkpoints/i)

      await focusImmutableModel()
      await focusEditableModel()

      await expect(modal.modelTypeSelect).toContainText(/lora/i)
    })
  })

  test.describe('8) Debounce Behavior', () => {
    test('rapid description edits coalesce into one metadata update', async ({
      comfyPage
    }) => {
      const initial = metadataMutations(comfyPage).length

      await modal.userDescriptionTextarea.fill('draft 1')
      await modal.userDescriptionTextarea.fill('draft 2')
      await modal.userDescriptionTextarea.fill('final debounced value')

      await expect
        .poll(() => metadataMutations(comfyPage).length)
        .toBe(initial + 1)

      const lastBody = getLastMetadataBody(comfyPage)
      expect(lastBody?.user_metadata?.user_description).toBe(
        'final debounced value'
      )
    })

    test('rapid model type changes coalesce to final debounced mutation set', async () => {
      const initial = tagCalls.getCalls().length

      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /checkpoints/i }).click()
      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /vae/i }).click()
      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /lora/i }).click()

      await modal.modelTypeSelect.click()
      await modal.page.getByRole('option', { name: /checkpoints/i }).click()

      await expect
        .poll(() => tagCalls.getCalls().length)
        .toBe(initial + 2)
    })
  })
})
