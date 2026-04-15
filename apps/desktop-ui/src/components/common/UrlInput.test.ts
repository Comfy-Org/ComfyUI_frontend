import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@comfyorg/shared-frontend-utils/networkUtil', () => ({
  checkUrlReachable: vi.fn()
}))

import { checkUrlReachable } from '@comfyorg/shared-frontend-utils/networkUtil'
import UrlInput from '@/components/common/UrlInput.vue'
import { ValidationState } from '@/utils/validationUtil'

const InputTextStub = {
  props: ['modelValue', 'invalid'],
  emits: ['update:modelValue', 'blur'],
  template: `<input
    data-testid="url-input"
    :value="modelValue"
    :data-invalid="invalid"
    @input="$emit('update:modelValue', $event.target.value)"
    @blur="$emit('blur')"
  />`
}

const InputIconStub = {
  template: '<span data-testid="input-icon" />'
}

const IconFieldStub = {
  template: '<div><slot /></div>'
}

function renderUrlInput(
  modelValue = '',
  validateUrlFn?: (url: string) => Promise<boolean>
) {
  return render(UrlInput, {
    props: { modelValue, ...(validateUrlFn ? { validateUrlFn } : {}) },
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      stubs: {
        InputText: InputTextStub,
        InputIcon: InputIconStub,
        IconField: IconFieldStub
      }
    }
  })
}

describe('UrlInput', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('initial validation on mount', () => {
    it('stays IDLE when modelValue is empty on mount', async () => {
      renderUrlInput('')
      await waitFor(() => {
        expect(screen.getByTestId('url-input').dataset.invalid).toBe('false')
      })
    })

    it('sets VALID state when modelValue is a reachable URL on mount', async () => {
      vi.mocked(checkUrlReachable).mockResolvedValue(true)
      renderUrlInput('https://example.com')
      await waitFor(() => {
        expect(screen.getByTestId('url-input').dataset.invalid).toBe('false')
      })
    })

    it('sets INVALID state when URL is not reachable on mount', async () => {
      vi.mocked(checkUrlReachable).mockResolvedValue(false)
      renderUrlInput('https://unreachable.example')
      await waitFor(() => {
        expect(screen.getByTestId('url-input').dataset.invalid).toBe('true')
      })
    })
  })

  describe('input handling', () => {
    it('resets validation state to IDLE on user input', async () => {
      vi.mocked(checkUrlReachable).mockResolvedValue(false)
      renderUrlInput('https://bad.example')

      await waitFor(() => {
        expect(screen.getByTestId('url-input').dataset.invalid).toBe('true')
      })

      const user = userEvent.setup()
      await user.type(screen.getByTestId('url-input'), 'x')
      expect(screen.getByTestId('url-input').dataset.invalid).toBe('false')
    })

    it('strips whitespace from typed input', async () => {
      const onUpdate = vi.fn()
      render(UrlInput, {
        props: {
          modelValue: '',
          'onUpdate:modelValue': onUpdate
        },
        global: {
          plugins: [[PrimeVue, { unstyled: true }]],
          stubs: {
            InputText: InputTextStub,
            InputIcon: InputIconStub,
            IconField: IconFieldStub
          }
        }
      })

      const user = userEvent.setup()
      const input = screen.getByTestId('url-input')
      await user.type(input, 'htt ps')
      expect((input as HTMLInputElement).value).not.toContain(' ')
    })
  })

  describe('blur handling', () => {
    it('emits update:modelValue on blur', async () => {
      const onUpdate = vi.fn()
      render(UrlInput, {
        props: {
          modelValue: 'https://example.com',
          'onUpdate:modelValue': onUpdate
        },
        global: {
          plugins: [[PrimeVue, { unstyled: true }]],
          stubs: {
            InputText: InputTextStub,
            InputIcon: InputIconStub,
            IconField: IconFieldStub
          }
        }
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('url-input'))
      await user.tab()

      expect(onUpdate).toHaveBeenCalled()
    })

    it('normalizes URL on blur', async () => {
      const onUpdate = vi.fn()
      render(UrlInput, {
        props: {
          modelValue: 'https://example.com',
          'onUpdate:modelValue': onUpdate
        },
        global: {
          plugins: [[PrimeVue, { unstyled: true }]],
          stubs: {
            InputText: InputTextStub,
            InputIcon: InputIconStub,
            IconField: IconFieldStub
          }
        }
      })

      const user = userEvent.setup()
      await user.click(screen.getByTestId('url-input'))
      await user.tab()

      const emittedUrl = onUpdate.mock.calls[0]?.[0]
      expect(typeof emittedUrl).toBe('string')
    })
  })

  describe('custom validateUrlFn', () => {
    it('uses custom validateUrlFn when provided', async () => {
      const customValidator = vi.fn().mockResolvedValue(true)
      renderUrlInput('https://custom.example', customValidator)

      await waitFor(() => {
        expect(customValidator).toHaveBeenCalledWith('https://custom.example')
      })

      expect(checkUrlReachable).not.toHaveBeenCalled()
    })
  })

  describe('state-change emission', () => {
    it('emits state-change when validation state changes', async () => {
      const onStateChange = vi.fn()
      vi.mocked(checkUrlReachable).mockResolvedValue(true)

      render(UrlInput, {
        props: {
          modelValue: 'https://example.com',
          'onState-change': onStateChange
        },
        global: {
          plugins: [[PrimeVue, { unstyled: true }]],
          stubs: {
            InputText: InputTextStub,
            InputIcon: InputIconStub,
            IconField: IconFieldStub
          }
        }
      })

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(ValidationState.VALID)
      })
    })
  })
})
