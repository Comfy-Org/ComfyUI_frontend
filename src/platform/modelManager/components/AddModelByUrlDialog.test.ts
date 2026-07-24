import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { DownloadApiError } from '../types'
import AddModelByUrlDialog from './AddModelByUrlDialog.vue'

const mockEnqueue = vi.fn()
const mockToastAdd = vi.fn()
const mockFetchModelTypes = vi.fn()
const mockModelTypes = ref([
  { name: 'Checkpoints', value: 'checkpoints' },
  { name: 'LoRA', value: 'loras' }
])

vi.mock('../stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => ({ enqueue: mockEnqueue })
}))

vi.mock('@/platform/assets/composables/useModelTypes', () => ({
  useModelTypes: () => ({
    modelTypes: mockModelTypes,
    isLoading: ref(false),
    fetchModelTypes: mockFetchModelTypes
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
}))

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
  DialogFooter: { template: '<div><slot /></div>' },
  SingleSelect: {
    props: ['modelValue', 'options', 'label', 'loading'],
    emits: ['update:modelValue'],
    template: `
      <select
        data-testid="folder-select"
        :value="modelValue ?? ''"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option value="" disabled>{{ label }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.name }}
        </option>
      </select>
    `
  }
}

function mountDialog(open = true) {
  return render(AddModelByUrlDialog, {
    props: { open },
    global: { plugins: [i18n], stubs }
  })
}

async function fillValidForm() {
  await userEvent.type(
    screen.getByLabelText('URL'),
    'https://huggingface.co/org/model/resolve/main/model.safetensors'
  )
  await userEvent.selectOptions(
    screen.getByTestId('folder-select'),
    'checkpoints'
  )
}

describe('AddModelByUrlDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-fills the filename from the url until edited manually', async () => {
    mountDialog()
    const urlInput = screen.getByLabelText('URL')
    const filenameInput = screen.getByLabelText('Filename')

    await userEvent.type(
      urlInput,
      'https://huggingface.co/org/model/resolve/main/model.safetensors'
    )
    expect(filenameInput).toHaveValue('model.safetensors')

    await userEvent.clear(filenameInput)
    await userEvent.type(filenameInput, 'custom.safetensors')
    await userEvent.type(urlInput, '?download=true')

    expect(filenameInput).toHaveValue('custom.safetensors')
  })

  it('shows a hint for a url on a non-allowlisted host', async () => {
    mountDialog()

    await userEvent.type(
      screen.getByLabelText('URL'),
      'https://example.com/model.safetensors'
    )

    expect(
      screen.getByText('This host may not be on the download allowlist.')
    ).toBeInTheDocument()
  })

  it('disables submit until url, folder, and a valid filename are set', async () => {
    mountDialog()
    const submit = screen.getByRole('button', { name: 'Download' })
    expect(submit).toBeDisabled()

    await userEvent.type(
      screen.getByLabelText('URL'),
      'https://huggingface.co/org/model/resolve/main/model.safetensors'
    )
    expect(submit).toBeDisabled()

    await userEvent.selectOptions(
      screen.getByTestId('folder-select'),
      'checkpoints'
    )
    expect(submit).toBeEnabled()
  })

  it('requires a known model extension', async () => {
    mountDialog()
    await userEvent.type(
      screen.getByLabelText('URL'),
      'https://huggingface.co/org/model/resolve/main/readme.txt'
    )
    await userEvent.selectOptions(
      screen.getByTestId('folder-select'),
      'checkpoints'
    )
    const submit = screen.getByRole('button', { name: 'Download' })
    expect(submit).toBeDisabled()
  })

  it('closes without submitting when cancel is clicked', async () => {
    const { emitted } = mountDialog()
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('enqueues the download and closes on success', async () => {
    mockEnqueue.mockResolvedValue({ download_id: 'd1', accepted: true })
    const { emitted } = mountDialog()
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    expect(mockEnqueue).toHaveBeenCalledWith({
      url: 'https://huggingface.co/org/model/resolve/main/model.safetensors',
      model_id: 'checkpoints/model.safetensors',
      allow_any_extension: false
    })
    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })
    expect(emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('shows an info toast and closes when the model is already downloading', async () => {
    mockEnqueue.mockRejectedValue(
      new DownloadApiError('exists', 'ALREADY_DOWNLOADING', 409)
    )
    const { emitted } = mountDialog()
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
    })
    expect(emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('shows an info toast and closes when the model is already installed', async () => {
    mockEnqueue.mockRejectedValue(
      new DownloadApiError('already there', 'ALREADY_AVAILABLE', 409)
    )
    const { emitted } = mountDialog()
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    await vi.waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
    })
    expect(emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('shows an inline error for other API failures and stays open', async () => {
    mockEnqueue.mockRejectedValue(
      new DownloadApiError('url not allowed', 'URL_NOT_ALLOWED', 400)
    )
    const { emitted } = mountDialog()
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    await vi.waitFor(() => {
      expect(screen.getByText('url not allowed')).toBeInTheDocument()
    })
    expect(emitted('update:open')).toBeUndefined()
  })

  it('shows a generic error message for a non-api error', async () => {
    mockEnqueue.mockRejectedValue(new Error('network down'))
    mountDialog()
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Download' }))

    await vi.waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })
  })
})
