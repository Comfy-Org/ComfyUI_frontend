import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'

vi.mock('../composables/useSecretForm', () => ({
  useSecretForm: () => ({
    form: { provider: '', name: '', secretValue: '' },
    errors: {},
    loading: false,
    apiError: '',
    providerOptions: [],
    providerHelp: '',
    selectedInputType: ref('text'),
    credentialOptions: ref([]),
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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('SecretFormDialog z-index stacking', () => {
  let openModalZIndex: number

  beforeEach(() => {
    const openModal = document.createElement('div')
    ZIndex.set('modal', openModal, 1700)
    openModalZIndex = Number(openModal.style.zIndex)
  })

  it('renders above a modal that is already open', async () => {
    render(SecretFormDialog, {
      global: { plugins: [PrimeVue, i18n] },
      props: { visible: true }
    })

    const content = await screen.findByRole('dialog')

    expect(Number(content.style.zIndex)).toBeGreaterThan(openModalZIndex)
  })
})
