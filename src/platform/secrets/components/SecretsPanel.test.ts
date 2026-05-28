import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretsPanel from '@/platform/secrets/components/SecretsPanel.vue'
import type { SecretMetadata } from '@/platform/secrets/types'

const mockDeleteSecret = vi.fn().mockResolvedValue(undefined)
const mockFetchSecrets = vi.fn().mockResolvedValue(undefined)
const mockCloseDialog = vi.fn()
const mockShowConfirmDialog = vi.fn()

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
    operatingSecretId: ref(null),
    existingProviders: ref([]),
    fetchSecrets: mockFetchSecrets,
    deleteSecret: mockDeleteSecret
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

vi.mock('@/components/dialog/confirm/confirmDialog', () => ({
  showConfirmDialog: (...args: unknown[]) => mockShowConfirmDialog(...args)
}))

vi.mock('@/platform/secrets/components/SecretFormDialog.vue', () => ({
  default: { name: 'SecretFormDialog', template: '<div />' }
}))

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
  })

  it('routes delete confirmation through showConfirmDialog with destructive variant', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('delete-trigger'))

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    const opts = mockShowConfirmDialog.mock.calls[0][0]
    expect(opts.headerProps.title).toBe('Delete secret')
    expect(opts.props.promptText).toBe('Delete My API Key?')
    expect(opts.footerProps.confirmText).toBe('Delete')
    expect(opts.footerProps.confirmVariant).toBe('destructive')
  })

  it('onConfirm closes the dialog and deletes the secret', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('delete-trigger'))

    const opts = mockShowConfirmDialog.mock.calls[0][0]
    await opts.footerProps.onConfirm()

    expect(mockCloseDialog).toHaveBeenCalledOnce()
    expect(mockDeleteSecret).toHaveBeenCalledWith(mockSecret)
  })

  it('onCancel closes the dialog without deleting', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('delete-trigger'))

    const opts = mockShowConfirmDialog.mock.calls[0][0]
    opts.footerProps.onCancel()

    expect(mockCloseDialog).toHaveBeenCalledOnce()
    expect(mockDeleteSecret).not.toHaveBeenCalled()
  })
})
