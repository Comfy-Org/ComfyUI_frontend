import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ControlOptions } from '@/types/simplifiedWidget'

import ValueControlButton from './ValueControlButton.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      widgets: {
        valueControl: {
          fixed: 'Fixed Value',
          randomize: 'Randomize Value',
          increment: 'Increment Value',
          decrement: 'Decrement Value'
        }
      }
    }
  }
})

function renderButton(props: {
  mode: ControlOptions
  variant?: 'badge' | 'button'
}) {
  return render(ValueControlButton, {
    global: { plugins: [i18n] },
    props
  })
}

describe('ValueControlButton', () => {
  describe('Mode rendering', () => {
    it.for([
      ['fixed', 'Fixed Value'],
      ['randomize', 'Randomize Value'],
      ['increment', 'Increment Value'],
      ['decrement', 'Decrement Value']
    ] as const)('sets aria-label from i18n for mode %s', ([mode, label]) => {
      renderButton({ mode })
      expect(screen.getByRole('button')).toHaveAccessibleName(label)
    })

    it('renders +1 text for increment mode', () => {
      renderButton({ mode: 'increment' })
      expect(screen.getByRole('button')).toHaveTextContent('+1')
    })

    it('renders -1 text for decrement mode', () => {
      renderButton({ mode: 'decrement' })
      expect(screen.getByRole('button')).toHaveTextContent('-1')
    })

    it('renders no numeric text for fixed mode', () => {
      renderButton({ mode: 'fixed' })
      const button = screen.getByRole('button')
      expect(button).not.toHaveTextContent('+1')
      expect(button).not.toHaveTextContent('-1')
    })

    it('renders no numeric text for randomize mode', () => {
      renderButton({ mode: 'randomize' })
      const button = screen.getByRole('button')
      expect(button).not.toHaveTextContent('+1')
      expect(button).not.toHaveTextContent('-1')
    })
  })

  describe('Interaction', () => {
    it('fires click on pointer activation', async () => {
      const onClick = vi.fn()
      render(ValueControlButton, {
        global: { plugins: [i18n] },
        props: { mode: 'randomize' },
        attrs: { onClick }
      })
      const user = userEvent.setup()
      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})
