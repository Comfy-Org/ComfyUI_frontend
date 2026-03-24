import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { TopbarBadge as TopbarBadgeType } from '@/types/comfy'

import TopbarBadge from './TopbarBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {}
  }
})

describe('TopbarBadge', () => {
  const exampleBadge: TopbarBadgeType = {
    text: 'Test Badge',
    label: 'BETA',
    variant: 'info'
  }

  function renderTopbarBadge(
    badge: Partial<TopbarBadgeType> = {},
    displayMode: 'full' | 'compact' | 'icon-only' = 'full'
  ) {
    const user = userEvent.setup()
    const result = render(TopbarBadge, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: { tooltip: Tooltip }
      },
      props: {
        badge: { ...exampleBadge, ...badge },
        displayMode
      }
    })
    return { ...result, user }
  }

  describe('full display mode', () => {
    it('renders all badge elements (icon, label, text)', () => {
      renderTopbarBadge(
        {
          text: 'Comfy Cloud',
          label: 'BETA',
          icon: 'pi pi-cloud'
        },
        'full'
      )
      expect(screen.getByTestId('badge-icon')).toHaveClass('pi-cloud')
      expect(screen.getByText('BETA')).toBeInTheDocument()
      expect(screen.getByText('Comfy Cloud')).toBeInTheDocument()
    })

    it('renders without icon when not provided', () => {
      renderTopbarBadge(
        {
          text: 'Test',
          label: 'NEW'
        },
        'full'
      )
      expect(screen.queryByTestId('badge-icon')).not.toBeInTheDocument()
      expect(screen.getByText('NEW')).toBeInTheDocument()
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  describe('compact display mode', () => {
    it('renders icon and label but not text', () => {
      renderTopbarBadge(
        {
          text: 'Hidden Text',
          label: 'BETA',
          icon: 'pi pi-cloud'
        },
        'compact'
      )
      expect(screen.getByTestId('badge-icon')).toHaveClass('pi-cloud')
      expect(screen.getByText('BETA')).toBeInTheDocument()
      expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument()
    })

    it('reveals full text when clicked', async () => {
      const { user } = renderTopbarBadge(
        {
          text: 'Full Text',
          label: 'ALERT'
        },
        'compact'
      )
      expect(screen.queryByText('Full Text')).not.toBeInTheDocument()
      await user.click(screen.getByText('ALERT'))
      expect(screen.getByText('Full Text')).toBeInTheDocument()
    })
  })

  describe('icon-only display mode', () => {
    it('renders only icon', () => {
      renderTopbarBadge(
        {
          text: 'Hidden Text',
          label: 'BETA',
          icon: 'pi pi-cloud'
        },
        'icon-only'
      )
      expect(screen.getByTestId('badge-icon')).toHaveClass('pi-cloud')
      expect(screen.queryByText('BETA')).not.toBeInTheDocument()
      expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument()
    })

    it('renders label when no icon provided', () => {
      renderTopbarBadge(
        {
          text: 'Hidden Text',
          label: 'NEW'
        },
        'icon-only'
      )
      expect(screen.getByText('NEW')).toBeInTheDocument()
      expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument()
    })
  })

  describe('badge variants', () => {
    it('applies error variant styles', () => {
      renderTopbarBadge(
        {
          text: 'Error Message',
          label: 'ERROR',
          variant: 'error'
        },
        'full'
      )
      expect(screen.getByText('ERROR')).toHaveClass('bg-danger-100')
      expect(screen.getByText('Error Message')).toHaveClass('text-danger-100')
    })

    it('applies warning variant styles', () => {
      renderTopbarBadge(
        {
          text: 'Warning Message',
          label: 'WARN',
          variant: 'warning'
        },
        'full'
      )
      expect(screen.getByText('WARN')).toHaveClass('bg-gold-600')
      expect(screen.getByText('Warning Message')).toHaveClass(
        'text-warning-background'
      )
    })

    it('uses default error icon for error variant', () => {
      renderTopbarBadge(
        {
          text: 'Error',
          variant: 'error'
        },
        'full'
      )
      expect(screen.getByTestId('badge-icon')).toHaveClass(
        'pi-exclamation-circle'
      )
    })

    it('uses default warning icon for warning variant', () => {
      renderTopbarBadge(
        {
          text: 'Warning',
          variant: 'warning'
        },
        'full'
      )
      expect(screen.getByTestId('badge-icon')).toHaveClass(
        'icon-[lucide--triangle-alert]'
      )
    })
  })

  describe('edge cases', () => {
    it('handles badge with only text', () => {
      renderTopbarBadge(
        {
          text: 'Simple Badge'
        },
        'full'
      )
      expect(screen.getByText('Simple Badge')).toBeInTheDocument()
      expect(screen.queryByTestId('badge-icon')).not.toBeInTheDocument()
    })

    it('handles custom icon override', () => {
      renderTopbarBadge(
        {
          text: 'Custom',
          variant: 'error',
          icon: 'pi pi-custom-icon'
        },
        'full'
      )
      expect(screen.getByTestId('badge-icon')).toHaveClass('pi-custom-icon')
      expect(screen.getByTestId('badge-icon')).not.toHaveClass(
        'pi-exclamation-circle'
      )
    })
  })
})
