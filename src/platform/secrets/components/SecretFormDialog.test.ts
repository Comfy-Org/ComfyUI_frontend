import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'

vi.mock('../composables/useSecretForm', () => ({
  useSecretForm: () => ({
    form: { provider: '', name: '', secretValue: '' },
    errors: {},
    loading: false,
    apiError: '',
    providerOptions: [],
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
})
