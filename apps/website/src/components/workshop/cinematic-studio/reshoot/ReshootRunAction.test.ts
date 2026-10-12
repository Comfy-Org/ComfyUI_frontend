import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { translationsFor } from '@/i18n/translations'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import ReshootRunAction from './ReshootRunAction.vue'

const { t: rc } = translationsFor('en')

describe('ReshootRunAction', () => {
  it.for<{ gate: StudioGate }>([
    { gate: 'ready' },
    { gate: 'signedOut' },
    { gate: 'unavailable' }
  ])(
    'keeps Cancel for a rendering take when the gate is $gate',
    async ({ gate }) => {
      const cancel = vi.fn()
      render({
        setup: () => () =>
          h(ReshootRunAction, {
            gate,
            ready: true,
            rendering: true,
            canGenerate: false,
            onCancel: cancel
          })
      })

      await userEvent.click(
        screen.getByRole('button', { name: rc('reshoot.cancel') })
      )

      expect(cancel).toHaveBeenCalledOnce()
      expect(
        screen.queryByRole('button', { name: rc('reshoot.generate.label') })
      ).toBeNull()
    }
  )
})
