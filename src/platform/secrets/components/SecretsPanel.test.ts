import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import SecretsPanel from '@/platform/secrets/components/SecretsPanel.vue'
import type { SecretMetadata } from '@/platform/secrets/types'

const DIALOG_HANDLE = { key: 'confirm-delete-secret' }
const mockDeleteSecret = vi.fn().mockResolvedValue(undefined)
const mockFetchSecrets = vi.fn().mockResolvedValue(undefined)
const mockFetchProviders = vi.fn().mockResolvedValue(undefined)
const mockCloseDialog = vi.fn()

const mockSecret: SecretMetadata = {
  id: 'secret-1',
  name: 'My API Key',
  provider: 'huggingface',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z'
}

vi.mock('@/platform/secrets/composables/useSecrets', () => ({
  useSecrets: () => ({
    loading: ref(false),
    secrets: ref<SecretMetadata[]>([mockSecret]),
    availableProviders: ref<string[]>([]),
    operatingSecretId: ref(null),
    existingProviders: ref([]),
    fetchSecrets: mockFetchSecrets,
    fetchProviders: mockFetchProviders,
    deleteSecret: mockDeleteSecret
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

vi.mock('@/components/dialog/confirm/confirmDialog')

vi.mock('@/platform/secrets/components/SecretFormDialog.vue', () => ({
  default: { name: 'SecretFormDialog', template: '<div />' }
}))

const mockShowConfirmDialog = vi.mocked(showConfirmDialog)

interface CapturedConfirmOptions {
  headerProps: { title: string }
  props: { promptText: string }
  footerProps: {
    confirmText: string
    confirmVariant: string
    onCancel: () => void
    onConfirm: () => Promise<void>
  }
}

function capturedOptions(): CapturedConfirmOptions {
  return mockShowConfirmDialog.mock
    .calls[0][0] as unknown as CapturedConfirmOptions
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { delete: 'Delete' },
      secrets: {
        title: 'Secrets',
        description: 'Manage secrets',
        descriptionUsage: 'Used in nodes',
        modelProviders: 'Model Providers',
        addSecret: 'Add Secret',
        noSecrets: 'No secrets',
        deleteConfirmTitle: 'Delete secret',
        deleteConfirmMessage: 'Delete {name}?'
      }
    }
  }
})

function renderPanel() {
  setActivePinia(createPinia())
  return render(SecretsPanel, {
    global: {
      plugins: [i18n],
      stubs: {
        TabPanel: { template: '<div><slot /></div>' },
        Divider: true,
        ProgressSpinner: true,
        Button: {
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          props: ['disabled']
        },
        SecretListItem: {
          template:
            '<button data-testid="delete-trigger" @click="$emit(\'delete\')">delete</button>',
          props: ['secret', 'loading', 'disabled'],
          emits: ['edit', 'delete']
        }
      }
    }
  })
}

describe('SecretsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShowConfirmDialog.mockReturnValue(
      DIALOG_HANDLE as ReturnType<typeof showConfirmDialog>
    )
  })

  it('routes delete confirmation through showConfirmDialog with destructive variant', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('delete-trigger'))

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    const opts = capturedOptions()
    expect(opts.headerProps.title).toBe('Delete secret')
    expect(opts.props.promptText).toBe('Delete My API Key?')
    expect(opts.footerProps.confirmText).toBe('Delete')
    expect(opts.footerProps.confirmVariant).toBe('destructive')
  })

  it('onConfirm closes the dialog with the helper handle and deletes the secret', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('delete-trigger'))

    await capturedOptions().footerProps.onConfirm()

    expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
    expect(mockDeleteSecret).toHaveBeenCalledWith(mockSecret)
  })

  it('onCancel closes the dialog with the helper handle without deleting', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('delete-trigger'))

    capturedOptions().footerProps.onCancel()

    expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
    expect(mockDeleteSecret).not.toHaveBeenCalled()
  })
})
