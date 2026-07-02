import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { HostCredentialView } from '../types'
import HostCredentialsDialog from './HostCredentialsDialog.vue'

const mockCloseDialog = vi.fn()
const mockToastAdd = vi.fn()

const mockCredentialsStore = reactive({
  credentials: ref<HostCredentialView[]>([]),
  isLoading: ref(false),
  fetchCredentials: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn()
})

vi.mock('../stores/hostCredentialsStore', () => ({
  useHostCredentialsStore: () => mockCredentialsStore
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
}))

vi.mock('@/components/dialog/confirm/confirmDialog')

const mockShowConfirmDialog = vi.mocked(showConfirmDialog)

interface CapturedConfirmOptions {
  footerProps?: {
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
  }
}

function capturedOptions(): CapturedConfirmOptions {
  return mockShowConfirmDialog.mock
    .calls[0][0] as unknown as CapturedConfirmOptions
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const stubs = {
  Dialog: { template: '<div><slot /></div>' },
  DialogPortal: { template: '<div><slot /></div>' },
  DialogOverlay: { template: '<div />' },
  DialogContent: defineComponent({
    emits: ['open-auto-focus'],
    mounted() {
      this.$emit('open-auto-focus')
    },
    template: '<div><slot /></div>'
  }),
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  DialogDescription: { template: '<div><slot /></div>' },
  SingleSelect: {
    props: ['modelValue', 'options', 'label'],
    emits: ['update:modelValue'],
    template: `
      <select
        data-testid="scheme-select"
        :value="modelValue ?? ''"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.name }}
        </option>
      </select>
    `
  }
}

function createCredential(
  overrides: Partial<HostCredentialView> = {}
): HostCredentialView {
  return {
    id: 'c1',
    host: 'huggingface.co',
    auth_scheme: 'bearer',
    header_name: null,
    query_param: null,
    label: null,
    match_subdomains: false,
    enabled: true,
    secret_last4: '1234',
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

function mountDialog(props: { open?: boolean; prefillHost?: string } = {}) {
  return render(HostCredentialsDialog, {
    props: { open: true, ...props },
    global: { plugins: [i18n], stubs }
  })
}

describe('HostCredentialsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCredentialsStore.credentials = []
    mockCredentialsStore.fetchCredentials.mockResolvedValue(undefined)
    mockShowConfirmDialog.mockReturnValue(
      {} as ReturnType<typeof showConfirmDialog>
    )
  })

  it('renders existing credentials with host, scheme, and last 4 of the secret', () => {
    mockCredentialsStore.credentials = [
      createCredential({
        host: 'huggingface.co',
        auth_scheme: 'bearer',
        secret_last4: '9f21'
      })
    ]
    mountDialog()

    expect(
      screen.getByText('huggingface.co · Bearer token · ••••9f21')
    ).toBeInTheDocument()
  })

  it('shows a disabled marker for a disabled credential', () => {
    mockCredentialsStore.credentials = [createCredential({ enabled: false })]
    mountDialog()

    expect(screen.getByText(/Disabled/)).toBeInTheDocument()
  })

  it('prefills the host from the prefillHost prop on open', async () => {
    mountDialog({ prefillHost: 'civitai.com' })
    await nextTick()

    expect(screen.getByLabelText('Host')).toHaveValue('civitai.com')
  })

  it('populates the form when editing an existing credential', async () => {
    mockCredentialsStore.credentials = [
      createCredential({
        id: 'c1',
        host: 'civitai.com',
        auth_scheme: 'header',
        header_name: 'X-Api-Key',
        label: 'My Civitai key'
      })
    ]
    mountDialog()

    await userEvent.click(screen.getByTitle('Edit'))

    expect(screen.getByLabelText('Host')).toHaveValue('civitai.com')
    expect(screen.getByLabelText('Label')).toHaveValue('My Civitai key')
    expect(screen.getByText('Update credential')).toBeInTheDocument()
  })

  it('disables submit until host and secret are filled', async () => {
    mountDialog()
    const submit = screen.getByRole('button', { name: 'Save' })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Host'), 'huggingface.co')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText('API key'), 's3cret')
    expect(submit).toBeEnabled()
  })

  it('requires a query parameter name when the scheme is query', async () => {
    mountDialog()
    await userEvent.type(screen.getByLabelText('Host'), 'huggingface.co')
    await userEvent.type(screen.getByLabelText('API key'), 's3cret')
    await userEvent.selectOptions(screen.getByTestId('scheme-select'), 'query')

    const submit = screen.getByRole('button', { name: 'Save' })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Query parameter'), 'token')
    expect(submit).toBeEnabled()
  })

  it('shows the header name field and a subdomain warning for the header scheme', async () => {
    mountDialog()

    await userEvent.selectOptions(screen.getByTestId('scheme-select'), 'header')
    expect(screen.getByLabelText('Header name')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Match subdomains'))
    expect(
      screen.getByText(
        'Not recommended: hubs redirect to sibling CDN hosts that must not receive your key.'
      )
    ).toBeInTheDocument()
  })

  it('cancels an in-progress edit and resets the form', async () => {
    mockCredentialsStore.credentials = [
      createCredential({ id: 'c1', host: 'civitai.com' })
    ]
    mountDialog()
    await userEvent.click(screen.getByTitle('Edit'))
    expect(screen.getByText('Update credential')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Add credential')).toBeInTheDocument()
    expect(screen.getByLabelText('Host')).toHaveValue('')
  })

  it('submits the form payload and resets on success', async () => {
    mockCredentialsStore.upsert.mockResolvedValue(createCredential())
    mountDialog()

    await userEvent.type(screen.getByLabelText('Host'), 'huggingface.co')
    await userEvent.type(screen.getByLabelText('API key'), 's3cret')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(mockCredentialsStore.upsert).toHaveBeenCalledWith({
      host: 'huggingface.co',
      secret: 's3cret',
      auth_scheme: 'bearer',
      header_name: null,
      query_param: null,
      label: null,
      match_subdomains: false
    })
    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })
    expect(screen.getByLabelText('Host')).toHaveValue('')
  })

  it('shows an inline error message when saving fails', async () => {
    mockCredentialsStore.upsert.mockRejectedValue(new Error('save failed'))
    mountDialog()

    await userEvent.type(screen.getByLabelText('Host'), 'huggingface.co')
    await userEvent.type(screen.getByLabelText('API key'), 's3cret')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(screen.getByText('save failed')).toBeInTheDocument()
    })
  })

  it('shows an inline error when the initial credentials fetch fails', async () => {
    mockCredentialsStore.fetchCredentials.mockRejectedValue(
      new Error('offline')
    )
    mountDialog()

    await vi.waitFor(() => {
      expect(screen.getByText('offline')).toBeInTheDocument()
    })
  })

  it('deletes a credential through a confirm dialog', async () => {
    mockCredentialsStore.remove.mockResolvedValue(undefined)
    mockCredentialsStore.credentials = [createCredential({ id: 'c1' })]
    mountDialog()

    await userEvent.click(screen.getByTitle('Delete'))
    await capturedOptions().footerProps?.onConfirm?.()

    expect(mockCredentialsStore.remove).toHaveBeenCalledWith('c1')
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('shows an error toast when deletion fails', async () => {
    mockCredentialsStore.remove.mockRejectedValue(new Error('boom'))
    mockCredentialsStore.credentials = [createCredential({ id: 'c1' })]
    mountDialog()

    await userEvent.click(screen.getByTitle('Delete'))
    await capturedOptions().footerProps?.onConfirm?.()

    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('does not delete when the confirm dialog is dismissed', async () => {
    mockCredentialsStore.credentials = [createCredential({ id: 'c1' })]
    mountDialog()

    await userEvent.click(screen.getByTitle('Delete'))
    capturedOptions().footerProps?.onCancel?.()

    expect(mockCredentialsStore.remove).not.toHaveBeenCalled()
  })
})
