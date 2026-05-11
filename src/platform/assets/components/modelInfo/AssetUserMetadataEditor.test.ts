import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import AssetUserMetadataEditor from './AssetUserMetadataEditor.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      assetBrowser: {
        modelInfo: {
          customMetadataHint: 'Hint',
          noCustomMetadata: 'No custom metadata',
          saveMetadataFailed: 'Save failed',
          addCustomMetadataField: 'Add field',
          deleteMetadataField: 'Delete',
          removeDraftField: 'Remove draft',
          metadataKeyPlaceholder: 'key',
          metadataTypeString: 'Text',
          metadataTypeNumber: 'Number',
          metadataTypeBoolean: 'Bool',
          customMetadataKeyError: {
            empty: 'Empty key',
            reserved: 'Reserved',
            invalid_format: 'Bad format',
            max_length: 'Too long',
            duplicate: 'Duplicate'
          }
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

describe('AssetUserMetadataEditor', () => {
  it('shows add hint when mutable and there are no custom fields yet', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { name: 'N' },
        isImmutable: false
      },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('Hint')).toBeInTheDocument()
  })

  it('does not show add hint when mutable and custom fields exist', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { seed: 1 },
        isImmutable: false
      },
      global: { plugins: [i18n] }
    })
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
  })

  it('emits delete for a custom primitive row', async () => {
    const user = userEvent.setup()
    const onQueue = vi.fn()
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { seed: 1, name: 'M' },
        isImmutable: false,
        saveFailed: false,
        onQueueCustomChange: onQueue
      },
      global: { plugins: [i18n] }
    })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onQueue).toHaveBeenCalledWith({}, ['seed'])
  })

  it('does not offer delete when immutable', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { seed: 1 },
        isImmutable: true
      },
      global: { plugins: [i18n] }
    })
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  it('shows no custom metadata when immutable and there are no custom rows', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { name: 'Reserved only' },
        isImmutable: true
      },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('No custom metadata')).toBeInTheDocument()
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
  })

  it('shows save failed alert when saveFailed is true', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: {},
        isImmutable: false,
        saveFailed: true
      },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
  })
})
