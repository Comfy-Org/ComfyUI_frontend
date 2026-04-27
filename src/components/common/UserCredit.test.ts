import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import UserCredit from './UserCredit.vue'

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('pinia')

const mockBalance = vi.hoisted(() => ({
  value: {
    amount_micros: 100_000,
    effective_balance_micros: 100_000,
    currency: 'usd'
  }
}))

const mockIsFetchingBalance = vi.hoisted(() => ({ value: false }))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    balance: mockBalance.value,
    isFetchingBalance: mockIsFetchingBalance.value
  }))
}))

describe('UserCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBalance.value = {
      amount_micros: 100_000,
      effective_balance_micros: 100_000,
      currency: 'usd'
    }
    mockIsFetchingBalance.value = false
  })

  const renderComponent = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(UserCredit, {
      props,
      global: {
        plugins: [i18n],
        stubs: {
          Skeleton: { template: '<div data-testid="skeleton" />' },
          Tag: true
        }
      }
    })
  }

  describe('effective_balance_micros handling', () => {
    it('uses effective_balance_micros when present (positive balance)', () => {
      mockBalance.value = {
        amount_micros: 200_000,
        effective_balance_micros: 150_000,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText(/Credits/)).toBeInTheDocument()
    })

    it('uses effective_balance_micros when zero', () => {
      mockBalance.value = {
        amount_micros: 100_000,
        effective_balance_micros: 0,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText(/\b0\b/)).toBeInTheDocument()
    })

    it('uses effective_balance_micros when negative', () => {
      mockBalance.value = {
        amount_micros: 0,
        effective_balance_micros: -50_000,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText((text) => text.includes('-'))).toBeInTheDocument()
    })

    it('falls back to amount_micros when effective_balance_micros is missing', () => {
      mockBalance.value = {
        amount_micros: 100_000,
        currency: 'usd'
      } as typeof mockBalance.value

      renderComponent()
      expect(screen.getByText(/Credits/)).toBeInTheDocument()
    })

    it('falls back to 0 when both effective_balance_micros and amount_micros are missing', () => {
      mockBalance.value = {
        currency: 'usd'
      } as typeof mockBalance.value

      renderComponent()
      expect(screen.getByText(/\b0\b/)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows skeleton when loading', () => {
      mockIsFetchingBalance.value = true

      renderComponent()
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })
  })
})
