import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'

const mockState = vi.hoisted(() => ({
  inputType: 'text' as string,
  credentialOptions: [] as {
    credentialType: string
    inputType: string
    label: string
  }[]
}))

vi.mock('../composables/useSecretForm', () => ({
  useSecretForm: () => ({
    form: { provider: '', name: '', secretValue: '' },
    errors: {},
    loading: false,
    apiError: '',
    providerOptions: [],
    providerHelp: '',
    selectedInputType: computed(() => mockState.inputType),
    credentialType: ref('api_key'),
    credentialOptions: computed(() => mockState.credentialOptions),
    fileName: ref(''),
    loadSecretFromFile: vi.fn(),
    handleSubmit: vi.fn()
  })
}))

vi.mock('primevue/inputtext', () => ({
  default: { name: 'InputText', template: '<input />' }
}))
vi.mock('primevue/password', () => ({
  default: { name: 'Password', template: '<input type="password" />' }
}))

let capturedPointerDownOutside: ((event: Event) => void) | null = null

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: { name: 'Button', template: '<button><slot /></button>' }
}))

vi.mock('@/components/ui/select/Select.vue', () => ({
  default: { name: 'Select', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/select/SelectContent.vue', () => ({
  default: { name: 'SelectContent', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/select/SelectItem.vue', () => ({
  default: { name: 'SelectItem', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/select/SelectTrigger.vue', () => ({
  default: { name: 'SelectTrigger', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/select/SelectValue.vue', () => ({
  default: { name: 'SelectValue', template: '<span />' }
}))

vi.mock('@/components/ui/dialog/Dialog.vue', () => ({
  default: { name: 'Dialog', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/dialog/DialogPortal.vue', () => ({
  default: { name: 'DialogPortal', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/dialog/DialogOverlay.vue', () => ({
  default: { name: 'DialogOverlay', template: '<div />' }
}))
vi.mock('@/components/ui/dialog/DialogContent.vue', () => ({
  default: defineComponent({
    name: 'DialogContent',
    inheritAttrs: false,
    setup(_, { attrs }) {
      const onPointerDownOutside = (attrs as Record<string, unknown>)[
        'onPointerDownOutside'
      ] as ((event: Event) => void) | undefined
      capturedPointerDownOutside = onPointerDownOutside ?? null
    },
    template: '<div data-testid="dialog-content"><slot /></div>'
  })
}))
vi.mock('@/components/ui/dialog/DialogHeader.vue', () => ({
  default: { name: 'DialogHeader', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/dialog/DialogTitle.vue', () => ({
  default: { name: 'DialogTitle', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/dialog/DialogClose.vue', () => ({
  default: { name: 'DialogClose', template: '<button />' }
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('SecretFormDialog', () => {
  beforeEach(() => {
    capturedPointerDownOutside = null
    mockState.inputType = 'text'
    mockState.credentialOptions = []
  })

  it('prevents backdrop pointer-down-outside from closing the dialog', () => {
    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(capturedPointerDownOutside).not.toBeNull()
    const event = new CustomEvent('pointerDownOutside', { cancelable: true })
    capturedPointerDownOutside!(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not render the JSON upload control for a text provider', () => {
    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(screen.queryByText('secrets.uploadJsonFile')).toBeNull()
    expect(
      screen.queryByPlaceholderText('secrets.jsonFilePlaceholder')
    ).toBeNull()
  })

  it('renders a file upload and textarea for a json_file provider', () => {
    mockState.inputType = 'json_file'

    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(screen.getByText('secrets.uploadJsonFile')).toBeTruthy()
    expect(
      screen.getByPlaceholderText('secrets.jsonFilePlaceholder')
    ).toBeTruthy()
  })

  it('opens the file dialog when the JSON upload button is activated by keyboard', async () => {
    mockState.inputType = 'json_file'

    const fileClickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})

    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    const uploadButton = screen.getByRole('button', {
      name: 'secrets.uploadJsonFile'
    })
    expect(uploadButton.tabIndex).not.toBe(-1)

    uploadButton.focus()
    await userEvent.keyboard('{Enter}')

    expect(fileClickSpy).toHaveBeenCalledOnce()
  })

  it('renders the credential-type selector when the provider offers multiple options', () => {
    mockState.credentialOptions = [
      {
        credentialType: 'api_key',
        inputType: 'text',
        label: 'API key (Google AI Studio)'
      },
      {
        credentialType: 'gcp_service_account',
        inputType: 'json_file',
        label: 'Service account (Vertex AI)'
      }
    ]

    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(screen.getByText('Credential type')).toBeTruthy()
    expect(screen.getByText('API key (Google AI Studio)')).toBeTruthy()
    expect(screen.getByText('Service account (Vertex AI)')).toBeTruthy()
  })

  it('hides the credential-type selector when the provider offers a single option', () => {
    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    expect(screen.queryByText('Credential type')).toBeNull()
  })
})
