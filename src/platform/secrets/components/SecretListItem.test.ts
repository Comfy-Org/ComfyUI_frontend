import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { SecretMetadata } from '../types'
import SecretListItem from './SecretListItem.vue'

vi.mock('../providers', () => ({
  getProviderLabel: (provider: string | undefined) => {
    if (provider === 'huggingface') return 'HuggingFace'
    if (provider === 'civitai') return 'Civitai'
    return ''
  },
  getProviderLogo: () => undefined
}))

function createMockSecret(
  overrides: Partial<SecretMetadata> = {}
): SecretMetadata {
  return {
    id: 'secret-1',
    name: 'Test Secret',
    provider: 'huggingface',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides
  }
}

function renderComponent(props: {
  secret: SecretMetadata
  loading?: boolean
  disabled?: boolean
}) {
  return render(SecretListItem, {
    props,
    global: {
      stubs: {
        Button: {
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          props: ['disabled', 'variant', 'size', 'aria-label']
        }
      },
      directives: {
        tooltip: () => {}
      },
      mocks: {
        $t: (key: string, params?: object) =>
          `${key}${params ? JSON.stringify(params) : ''}`
      }
    }
  })
}

describe('SecretListItem', () => {
  describe('rendering', () => {
    it('displays secret name', () => {
      const secret = createMockSecret({ name: 'My API Key' })
      renderComponent({ secret })

      expect(screen.getByText('My API Key')).toBeInTheDocument()
    })

    it('displays provider label when provider exists', () => {
      const secret = createMockSecret({ provider: 'huggingface' })
      renderComponent({ secret })

      expect(screen.getByText('HuggingFace')).toBeInTheDocument()
    })

    it('displays Civitai provider label', () => {
      const secret = createMockSecret({ provider: 'civitai' })
      renderComponent({ secret })

      expect(screen.getByText('Civitai')).toBeInTheDocument()
    })

    it('hides provider badge when no provider', () => {
      const secret = createMockSecret({ provider: undefined })
      renderComponent({ secret })

      expect(screen.queryByText('HuggingFace')).not.toBeInTheDocument()
      expect(screen.queryByText('Civitai')).not.toBeInTheDocument()
    })

    it('displays created date', () => {
      const secret = createMockSecret({ created_at: '2024-01-15T10:00:00Z' })
      renderComponent({ secret })

      expect(screen.getByText(/secrets\.createdAt/)).toBeInTheDocument()
    })

    it('displays last used date when available', () => {
      const secret = createMockSecret({ last_used_at: '2024-01-20T10:00:00Z' })
      renderComponent({ secret })

      expect(screen.getByText(/secrets\.lastUsed/)).toBeInTheDocument()
    })

    it('hides last used when not available', () => {
      const secret = createMockSecret({ last_used_at: undefined })
      renderComponent({ secret })

      expect(screen.queryByText(/secrets\.lastUsed/)).not.toBeInTheDocument()
    })

    it('renders created date for ISO string with 4-digit fractional seconds', () => {
      const secret = createMockSecret({
        created_at: '2026-04-18T10:04:55.6513Z'
      })
      renderComponent({ secret })

      expect(screen.getByText(/secrets\.createdAt/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('hides created line when the timestamp is unparseable', () => {
      const secret = createMockSecret({ created_at: 'not-a-date' })
      renderComponent({ secret })

      expect(screen.queryByText(/secrets\.createdAt/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('hides last used line when the timestamp is unparseable', () => {
      const secret = createMockSecret({ last_used_at: 'not-a-date' })
      renderComponent({ secret })

      expect(screen.queryByText(/secrets\.lastUsed/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders last used date for 4-digit fractional seconds', () => {
      const secret = createMockSecret({
        last_used_at: '2026-04-18T11:00:00.6513Z'
      })
      renderComponent({ secret })

      expect(screen.getByText(/secrets\.lastUsed/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows spinner when loading', () => {
      const secret = createMockSecret()
      const { container } = renderComponent({ secret, loading: true })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeIcon has no ARIA role
      expect(container.querySelector('.pi-spinner')).toBeInTheDocument()
    })

    it('hides action buttons when loading', () => {
      const secret = createMockSecret()
      const { container } = renderComponent({ secret, loading: true })

      expect(
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeIcon has no ARIA role
        container.querySelector('.pi-pen-to-square')
      ).not.toBeInTheDocument()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeIcon has no ARIA role
      expect(container.querySelector('.pi-trash')).not.toBeInTheDocument()
    })

    it('shows action buttons when not loading', () => {
      const secret = createMockSecret()
      const { container } = renderComponent({ secret, loading: false })

      expect(
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeIcon has no ARIA role
        container.querySelector('.pi-pen-to-square')
      ).toBeInTheDocument()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeIcon has no ARIA role
      expect(container.querySelector('.pi-trash')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables buttons when disabled prop is true', () => {
      const secret = createMockSecret()
      renderComponent({ secret, disabled: true })

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    it('enables buttons when disabled prop is false', () => {
      const secret = createMockSecret()
      renderComponent({ secret, disabled: false })

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeEnabled()
      })
    })
  })

  describe('events', () => {
    it('emits edit event when edit button clicked', async () => {
      const user = userEvent.setup()
      const secret = createMockSecret()
      const { emitted } = renderComponent({ secret })

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[0])

      expect(emitted()['edit']).toBeDefined()
      expect(emitted()['edit']!.length).toBeGreaterThanOrEqual(1)
    })

    it('emits delete event when delete button clicked', async () => {
      const user = userEvent.setup()
      const secret = createMockSecret()
      const { emitted } = renderComponent({ secret })

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[1])

      expect(emitted()['delete']).toBeDefined()
      expect(emitted()['delete']!.length).toBeGreaterThanOrEqual(1)
    })
  })
})
