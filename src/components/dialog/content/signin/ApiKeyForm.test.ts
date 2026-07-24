import { Form } from '@primevue/forms'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import Button from '@/components/ui/button/Button.vue'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'

import ApiKeyForm from './ApiKeyForm.vue'

const mockStoreApiKey = vi.fn()
const mockLoadingRef = ref(false)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    get loading() {
      return mockLoadingRef.value
    }
  }))
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: vi.fn(() => ({
    storeApiKey: mockStoreApiKey
  }))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      auth: {
        apiKey: {
          title: 'API Key',
          label: 'API Key',
          placeholder: 'Enter your API Key',
          error: 'Invalid API Key',
          helpText: 'Need an API key?',
          generateKey: 'Get one here',
          whitelistInfo: 'About non-whitelisted sites',
          description: 'Use your Comfy API key to enable API Nodes'
        }
      },
      g: {
        back: 'Back',
        save: 'Save',
        learnMore: 'Learn more'
      }
    }
  }
})

describe('ApiKeyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreApiKey.mockReset()
    mockLoadingRef.value = false
  })

  function renderComponent(props: Record<string, unknown> = {}) {
    const user = userEvent.setup()
    const result = render(ApiKeyForm, {
      global: {
        plugins: [PrimeVue, i18n],
        components: { Button, Form, InputText, Message }
      },
      props
    })
    return { ...result, user }
  }

  it('renders correctly with all required elements', () => {
    renderComponent()

    expect(screen.getByRole('heading', { name: 'API Key' })).toBeInTheDocument()
    expect(screen.getByLabelText('API Key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('emits back event when back button is clicked', async () => {
    const onBack = vi.fn()
    const { user } = renderComponent({ onBack })

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalled()
  })

  it('shows loading state when submitting', () => {
    mockLoadingRef.value = true
    const { container } = renderComponent()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const submitButton = container.querySelector('button[type="submit"]')
    expect(submitButton).toBeDisabled()
  })

  it('displays help text and links correctly', () => {
    renderComponent()

    expect(
      screen.getByText('Need an API key?', { exact: false })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get one here' })).toHaveAttribute(
      'href',
      `${getComfyPlatformBaseUrl()}/login`
    )
  })
})
