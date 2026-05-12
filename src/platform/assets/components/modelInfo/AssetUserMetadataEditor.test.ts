import { describe, expect, it } from 'vitest'
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
          customMetadataInvalidBucket: 'Invalid custom bucket',
          customMetadataReadOnlyValue: 'Read-only',
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
        mergedMetadata: { custom: { seed: 1 } },
        isImmutable: false
      },
      global: { plugins: [i18n] }
    })
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
  })

  it('emits delete for a custom primitive row', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { custom: { seed: 1 }, name: 'M' },
        isImmutable: false,
        saveFailed: false
      },
      global: { plugins: [i18n] }
    })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(emitted().queueCustomChange?.at(-1)).toEqual([{}, ['seed']])
  })

  it('does not offer delete when immutable', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { custom: { seed: 1 } },
        isImmutable: true
      },
      global: { plugins: [i18n] }
    })
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  it('shows unsupported custom values as read-only without delete', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { custom: { blob: { a: 1 } } },
        isImmutable: false
      },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('blob')).toBeInTheDocument()
    expect(screen.getAllByText('Read-only').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  it('shows invalid custom bucket message and disables delete', () => {
    render(AssetUserMetadataEditor, {
      props: {
        mergedMetadata: { custom: 'broken' },
        isImmutable: false
      },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('Invalid custom bucket')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Add field')).not.toBeInTheDocument()
  })

  it('shows no custom metadata when immutable and custom bucket is empty', () => {
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
