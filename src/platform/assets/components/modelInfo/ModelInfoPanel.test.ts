import { getActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { fireEvent, render, screen } from '@testing-library/vue'

import { useAssetsStore } from '@/stores/assetsStore'

import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { assetService } from '@/platform/assets/services/assetService'
import type * as DistributionTypes from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import ModelInfoPanel from './ModelInfoPanel.vue'

vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

const mockDistribution = vi.hoisted(
  (): { isCloud: typeof DistributionTypes.isCloud } => ({ isCloud: false })
)
vi.mock(import('@/platform/distribution/types'), () => mockDistribution)

vi.mock(import('@/platform/assets/composables/useModelTypes'), async () => {
  const { ref } = await import('vue')
  return {
    useModelTypes: () => ({
      modelTypes: ref([{ name: 'Checkpoint', value: 'checkpoints' }]),
      isLoading: ref(false),
      error: ref(null),
      fetchModelTypes: vi.fn()
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('ModelInfoPanel', () => {
  const createMockAsset = (
    overrides: Partial<AssetDisplayItem> = {}
  ): AssetDisplayItem => ({
    id: 'test-id',
    name: 'test-model.safetensors',
    hash: 'hash123',
    size: 1024,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z',
    secondaryText: 'A test model description',
    badges: [],
    stats: {},
    ...overrides
  })

  afterEach(() => {
    mockDistribution.isCloud = false
  })

  function renderPanel(asset: AssetDisplayItem) {
    return render(ModelInfoPanel, {
      props: { asset },
      global: {
        plugins: [getActivePinia()!, i18n]
      }
    })
  }

  it('preserves description edits made while an earlier save is pending', async () => {
    vi.useFakeTimers()
    const asset = createMockAsset({
      is_immutable: false,
      user_metadata: { user_description: 'Original description' }
    })
    let resolveSave!: (saved: boolean) => void
    const save = vi
      .spyOn(useAssetsStore(), 'updateAssetMetadata')
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve
        })
      )
      .mockResolvedValue(true)
    const { rerender } = renderPanel(asset)
    const description = screen.getByPlaceholderText(
      'assetBrowser.modelInfo.descriptionPlaceholder'
    )
    await fireEvent.update(description, 'First edit')
    await vi.advanceTimersByTimeAsync(500)
    const savedAsset = {
      ...asset,
      user_metadata: { user_description: 'First edit' }
    }
    await rerender({ asset: savedAsset })
    await fireEvent.update(description, 'Newer edit')
    resolveSave(true)
    await rerender({
      asset: { ...savedAsset, user_metadata: { ...savedAsset.user_metadata } }
    })
    expect(description).toHaveValue('Newer edit')
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: asset.id }),
      { user_description: 'Newer edit' },
      undefined
    )
  })

  it('retains a failed description save for the next edit to retry', async () => {
    vi.useFakeTimers()
    const asset = createMockAsset({
      is_immutable: false,
      user_metadata: { user_description: 'Original description' }
    })
    const save = vi
      .spyOn(useAssetsStore(), 'updateAssetMetadata')
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    const { rerender, unmount } = renderPanel(asset)
    const description = screen.getByPlaceholderText(
      'assetBrowser.modelInfo.descriptionPlaceholder'
    )
    await fireEvent.update(description, 'Unsaved edit')
    await vi.advanceTimersByTimeAsync(500)
    expect(description).toHaveValue('Unsaved edit')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    await rerender({ asset: createMockAsset({ id: 'other-model' }) })
    await rerender({ asset })
    expect(description).toHaveValue('Unsaved edit')
    unmount()
    renderPanel(asset)
    const reopenedDescription = screen.getByPlaceholderText(
      'assetBrowser.modelInfo.descriptionPlaceholder'
    )
    expect(reopenedDescription).toHaveValue('Unsaved edit')
    await fireEvent.update(reopenedDescription, 'Retry edit')
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenLastCalledWith(
      asset,
      { user_description: 'Retry edit' },
      undefined
    )
  })

  it('keeps the newest persisted description when details reopen before an old response arrives', async () => {
    vi.useFakeTimers()
    const asset = createMockAsset({
      is_immutable: false,
      user_metadata: { user_description: 'Original description' }
    })
    let persisted = asset
    let deliverFirstResponse!: () => void
    vi.spyOn(assetService, 'updateAsset')
      .mockImplementationOnce((_id, payload) => {
        persisted = { ...persisted, ...payload }
        const response = persisted
        return new Promise((resolve) => {
          deliverFirstResponse = () => resolve(response)
        })
      })
      .mockImplementation(async (_id, payload) => {
        persisted = { ...persisted, ...payload }
        return persisted
      })
    const panel = renderPanel(asset)
    await fireEvent.update(
      screen.getByPlaceholderText(
        'assetBrowser.modelInfo.descriptionPlaceholder'
      ),
      'First edit'
    )
    await vi.advanceTimersByTimeAsync(500)
    await fireEvent.update(
      screen.getByPlaceholderText(
        'assetBrowser.modelInfo.descriptionPlaceholder'
      ),
      'Older queued edit'
    )
    await vi.advanceTimersByTimeAsync(500)
    await panel.rerender({ asset: createMockAsset({ id: 'other-model' }) })
    panel.unmount()
    const reopened = renderPanel(persisted)
    const description = screen.getByPlaceholderText(
      'assetBrowser.modelInfo.descriptionPlaceholder'
    )
    await fireEvent.update(description, 'Newest edit after reopening')
    await vi.advanceTimersByTimeAsync(500)
    deliverFirstResponse()
    await vi.advanceTimersByTimeAsync(1000)
    await reopened.rerender({ asset: persisted })

    expect(persisted.user_metadata?.user_description).toBe(
      'Newest edit after reopening'
    )
    expect(description).toHaveValue('Newest edit after reopening')
  })

  it.for([
    { transition: 'workspace', nextWorkspace: 'workspace-2', nextIdentity: 1 },
    { transition: 'identity', nextWorkspace: 'workspace-1', nextIdentity: 2 }
  ])(
    'drops old drafts and late follow-up writes after a $transition change',
    async ({ nextWorkspace, nextIdentity }) => {
      vi.useFakeTimers()
      const workspace = ref('workspace-1')
      const identity = ref(1)
      const workspaceStore = useTeamWorkspaceStore()
      vi.spyOn(workspaceStore, 'workspaceId', 'get').mockImplementation(
        () => workspace.value
      )
      vi.spyOn(workspaceStore, 'identityGeneration', 'get').mockImplementation(
        () => identity.value
      )
      const asset = createMockAsset({
        is_immutable: false,
        user_metadata: { user_description: 'Saved description' }
      })
      let resolveSave!: (saved: boolean) => void
      const save = vi
        .spyOn(useAssetsStore(), 'updateAssetMetadata')
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveSave = resolve
          })
        )
        .mockResolvedValue(true)
      renderPanel(asset)
      const description = screen.getByPlaceholderText(
        'assetBrowser.modelInfo.descriptionPlaceholder'
      )
      await fireEvent.update(description, 'First edit')
      await vi.advanceTimersByTimeAsync(500)
      await fireEvent.update(description, 'Old queued edit')
      await vi.advanceTimersByTimeAsync(500)

      workspace.value = nextWorkspace
      identity.value = nextIdentity
      resolveSave(true)
      await vi.advanceTimersByTimeAsync(1000)

      expect(description).toHaveValue('Saved description')
      expect(save).toHaveBeenCalledTimes(1)
    }
  )

  it.for([true, false])(
    'serializes newer edits while the earlier save completes with %s',
    async (saved) => {
      vi.useFakeTimers()
      const asset = createMockAsset({
        is_immutable: false,
        user_metadata: { user_description: 'Original description' }
      })
      let resolveSave!: (saved: boolean) => void
      const save = vi
        .spyOn(useAssetsStore(), 'updateAssetMetadata')
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveSave = resolve
          })
        )
        .mockResolvedValue(true)
      const { rerender } = renderPanel(asset)
      const description = screen.getByPlaceholderText(
        'assetBrowser.modelInfo.descriptionPlaceholder'
      )
      await fireEvent.update(description, 'First edit')
      await vi.advanceTimersByTimeAsync(500)
      await fireEvent.update(description, 'Newer edit')
      await vi.advanceTimersByTimeAsync(500)
      expect(save).toHaveBeenCalledTimes(1)
      resolveSave(saved)
      await rerender({
        asset: {
          ...asset,
          user_metadata: { user_description: 'First edit' }
        }
      })
      expect(description).toHaveValue('Newer edit')
      await vi.advanceTimersByTimeAsync(500)
      expect(save).toHaveBeenCalledTimes(2)
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: asset.id }),
        { user_description: 'Newer edit' },
        undefined
      )
    }
  )

  it.for([true, false])(
    'saves queued edits to their original model after selection changes and the first save returns %s',
    async (saved) => {
      vi.useFakeTimers()
      const asset = createMockAsset({
        is_immutable: false,
        user_metadata: { user_description: 'Original description' }
      })
      const otherAsset = createMockAsset({
        id: 'other-model',
        is_immutable: false,
        user_metadata: { user_description: 'Other description' }
      })
      let resolveSave!: (saved: boolean) => void
      const save = vi
        .spyOn(useAssetsStore(), 'updateAssetMetadata')
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveSave = resolve
          })
        )
        .mockResolvedValue(true)
      const { rerender } = renderPanel(asset)
      const description = screen.getByPlaceholderText(
        'assetBrowser.modelInfo.descriptionPlaceholder'
      )
      await fireEvent.update(description, 'First edit')
      await vi.advanceTimersByTimeAsync(500)
      await fireEvent.update(description, 'Queued edit')
      await vi.advanceTimersByTimeAsync(500)
      await rerender({ asset: otherAsset })
      expect(description).toHaveValue('Other description')
      await fireEvent.update(description, 'Other model edit')
      await vi.advanceTimersByTimeAsync(500)
      expect(save).toHaveBeenLastCalledWith(
        otherAsset,
        { user_description: 'Other model edit' },
        undefined
      )
      resolveSave(saved)
      await vi.advanceTimersByTimeAsync(500)
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: asset.id }),
        { user_description: 'Queued edit' },
        undefined
      )
      await rerender({
        asset: {
          ...otherAsset,
          user_metadata: { user_description: 'Refreshed description' }
        }
      })
      expect(description).toHaveValue('Refreshed description')
    }
  )

  describe('Basic Info Section', () => {
    it('renders basic info section', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.basicInfo')
      ).toBeInTheDocument()
    })

    it('displays asset filename', () => {
      const asset = createMockAsset({ name: 'my-model.safetensors' })
      renderPanel(asset)
      expect(
        screen.getAllByText('my-model.safetensors').length
      ).toBeGreaterThanOrEqual(1)
    })

    it('prefers user_metadata.filename over asset.name for filename field', () => {
      const asset = createMockAsset({
        name: 'registry-display-name',
        user_metadata: { filename: 'checkpoints/real-file.safetensors' }
      })
      renderPanel(asset)
      expect(
        screen.getByText('checkpoints/real-file.safetensors')
      ).toBeInTheDocument()
    })

    it('displays name from user_metadata when present', () => {
      const asset = createMockAsset({
        user_metadata: { name: 'My Custom Model' }
      })
      renderPanel(asset)
      expect(screen.getByText('My Custom Model')).toBeInTheDocument()
    })

    it('falls back to asset name when user_metadata.name not present', () => {
      const asset = createMockAsset({ name: 'fallback-model.safetensors' })
      renderPanel(asset)
      expect(
        screen.getAllByText('fallback-model.safetensors').length
      ).toBeGreaterThanOrEqual(1)
    })

    it('renders source link when source_arn is present', () => {
      const asset = createMockAsset({
        user_metadata: { source_arn: 'civitai:model:123:version:456' }
      })
      renderPanel(asset)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute(
        'href',
        'https://civitai.com/models/123?modelVersionId=456'
      )
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('displays Civitai icon for Civitai source', () => {
      const asset = createMockAsset({
        user_metadata: { source_arn: 'civitai:model:123:version:456' }
      })
      renderPanel(asset)
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        '/assets/images/civitai.svg'
      )
    })

    it('does not render source field when source_arn is absent', () => {
      renderPanel(createMockAsset())
      expect(screen.queryAllByRole('link')).toHaveLength(0)
    })
  })

  describe('Model Tagging Section', () => {
    it('renders model tagging section', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.modelTagging')
      ).toBeInTheDocument()
    })

    it('renders model type field', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.modelType')
      ).toBeInTheDocument()
    })

    it('shows an editable model type dropdown for a mutable asset on cloud', () => {
      mockDistribution.isCloud = true
      renderPanel(createMockAsset({ is_immutable: false }))
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('keeps the model type read-only on core even for a mutable asset', () => {
      mockDistribution.isCloud = false
      renderPanel(createMockAsset({ is_immutable: false }))
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.getByText('Checkpoint')).toBeInTheDocument()
    })

    it('keeps the model type read-only for an immutable asset on cloud', () => {
      mockDistribution.isCloud = true
      renderPanel(createMockAsset({ is_immutable: true }))
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      const field = screen.getByText('Checkpoint')
      expect(field).toHaveAttribute('aria-disabled', 'true')
      expect(field).toHaveAccessibleDescription(
        'assetBrowser.modelInfo.modelTypeImmutableReadonly'
      )
    })

    it('blames immutability, not core, for a read-only immutable asset on cloud', () => {
      mockDistribution.isCloud = true
      renderPanel(createMockAsset({ is_immutable: true }))
      expect(
        screen.getByText('assetBrowser.modelInfo.modelTypeImmutableReadonly')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('assetBrowser.modelInfo.modelTypeCoreReadonly')
      ).not.toBeInTheDocument()
    })

    it('blames core for a read-only model type off-cloud', () => {
      mockDistribution.isCloud = false
      renderPanel(createMockAsset({ is_immutable: false }))
      const field = screen.getByText('Checkpoint')
      expect(field).toHaveAttribute('aria-disabled', 'true')
      expect(field).toHaveAccessibleDescription(
        'assetBrowser.modelInfo.modelTypeCoreReadonly'
      )
    })

    it('renders base models field', () => {
      const asset = createMockAsset({
        user_metadata: { base_model: ['SDXL'] }
      })
      renderPanel(asset)
      expect(
        screen.getByText('assetBrowser.modelInfo.compatibleBaseModels')
      ).toBeInTheDocument()
    })

    it('renders additional tags field', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.additionalTags')
      ).toBeInTheDocument()
    })
  })

  describe('Model Description Section', () => {
    it('renders trigger phrases when present', () => {
      const asset = createMockAsset({
        user_metadata: { trained_words: ['trigger1', 'trigger2'] }
      })
      renderPanel(asset)
      expect(screen.getByText('trigger1')).toBeInTheDocument()
      expect(screen.getByText('trigger2')).toBeInTheDocument()
    })

    it('renders description section', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.modelDescription')
      ).toBeInTheDocument()
    })

    it('does not render trigger phrases field when empty', () => {
      renderPanel(createMockAsset())
      expect(
        screen.queryByText('assetBrowser.modelInfo.triggerPhrases')
      ).not.toBeInTheDocument()
    })
  })

  describe('Accordion Structure', () => {
    it('renders all three section labels', () => {
      renderPanel(createMockAsset())
      expect(
        screen.getByText('assetBrowser.modelInfo.basicInfo')
      ).toBeInTheDocument()
      expect(
        screen.getByText('assetBrowser.modelInfo.modelTagging')
      ).toBeInTheDocument()
      expect(
        screen.getByText('assetBrowser.modelInfo.modelDescription')
      ).toBeInTheDocument()
    })
  })
})
