import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SecretFormDialog from './SecretFormDialog.vue'

vi.mock<unknown>(
  import('@/platform/secrets/composables/useSecretForm'),
  () => ({
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
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('SecretFormDialog z-index stacking', () => {
  it('renders above a modal that is already open', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const openModal = screen.getByTestId('existing-overlay')
    render(SecretFormDialog, {
      global: { plugins: [i18n] },
      props: { visible: true }
    })

    const content = await screen.findByRole('dialog')

    expect(openModal.compareDocumentPosition(content)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})
