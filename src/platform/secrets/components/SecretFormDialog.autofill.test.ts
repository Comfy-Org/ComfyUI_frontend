import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'
import type { SecretInputType } from '../types'

const mockState = vi.hoisted(() => ({
  inputType: 'text' as SecretInputType
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
    credentialOptions: computed(() => []),
    credentialType: ref<string | null>(null),
    fileName: ref(''),
    loadSecretFromFile: vi.fn(),
    handleSubmit: vi.fn()
  })
}))

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
  default: { name: 'DialogContent', template: '<div><slot /></div>' }
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

function renderDialog() {
  render(SecretFormDialog, {
    global: { plugins: [PrimeVue, i18n] },
    props: { visible: true }
  })
}

describe('SecretFormDialog password-manager autofill opt-out', () => {
  beforeEach(() => {
    mockState.inputType = 'text'
  })

  it('disables autocomplete on the name input so a saved email is not offered', () => {
    renderDialog()

    expect(
      screen.getByPlaceholderText('secrets.namePlaceholder')
    ).toHaveAttribute('autocomplete', 'off')
  })

  it('marks the secret value input as new-password to suppress saved credentials', () => {
    renderDialog()

    expect(
      screen.getByPlaceholderText('secrets.secretValuePlaceholder')
    ).toHaveAttribute('autocomplete', 'new-password')
  })
})
