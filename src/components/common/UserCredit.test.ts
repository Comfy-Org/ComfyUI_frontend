import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useAuthStore } from '@/stores/authStore'

import UserCredit from './UserCredit.vue'
vi.mock(import('firebase/auth'))

describe('UserCredit', () => {
  beforeEach(() => {
    useAuthStore().balance = {
      amount_micros: 100_000,
      effective_balance_micros: 100_000,
      currency: 'usd'
    }
    useAuthStore().isFetchingBalance = false
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
        plugins: [i18n]
      }
    })
  }

  describe('effective_balance_micros handling', () => {
    it('uses effective_balance_micros when present (positive balance)', () => {
      useAuthStore().balance = {
        amount_micros: 200_000,
        effective_balance_micros: 150_000,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText(/Credits/)).toBeInTheDocument()
    })

    it('uses effective_balance_micros when zero', () => {
      useAuthStore().balance = {
        amount_micros: 100_000,
        effective_balance_micros: 0,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText(/\b0\b/)).toBeInTheDocument()
    })

    it('uses effective_balance_micros when negative', () => {
      useAuthStore().balance = {
        amount_micros: 0,
        effective_balance_micros: -50_000,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText((text) => text.includes('-'))).toBeInTheDocument()
    })

    it('falls back to amount_micros when effective_balance_micros is missing', () => {
      useAuthStore().balance = {
        amount_micros: 100_000,
        currency: 'usd'
      }

      renderComponent()
      expect(screen.getByText(/Credits/)).toBeInTheDocument()
    })

    it('falls back to 0 when both effective_balance_micros and amount_micros are missing', () => {
      useAuthStore().balance = {
        currency: 'usd'
      } as ReturnType<typeof useAuthStore>['balance']

      renderComponent()
      expect(screen.getByText(/\b0\b/)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('hides the balance until loading finishes', async () => {
      useAuthStore().isFetchingBalance = true

      renderComponent()
      expect(screen.queryByText(/Credits/)).not.toBeInTheDocument()

      useAuthStore().isFetchingBalance = false
      await nextTick()

      expect(screen.getByText(/Credits/)).toBeInTheDocument()
    })
  })
})
