import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import type {
  PlannedRun,
  RunPlan
} from '@/renderer/extensions/superComfy/engine/types'

import RunButton from './RunButton.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function plannedRuns(count: number): RunPlan {
  const runs: PlannedRun[] = Array.from({ length: count }, (_, index) => ({
    index,
    repeat: 0,
    key: `run-${index}`,
    inputs: {}
  }))
  return { ok: true, runs }
}

function renderRunButton(
  props: { plan: RunPlan; running?: boolean; disabled?: boolean },
  listeners: { onRun?: () => void; onStop?: () => void } = {}
) {
  return render(RunButton, {
    props: { running: false, disabled: false, ...props, ...listeners },
    global: { plugins: [i18n] }
  })
}

describe('RunButton', () => {
  it.for([
    {
      name: 'the planned count for a batch',
      plan: plannedRuns(9),
      label: 'Run 9'
    },
    {
      name: 'a plain Run for a single run',
      plan: plannedRuns(1),
      label: 'Run'
    },
    {
      name: 'a plain Run when inputs are missing',
      plan: {
        ok: false,
        block: { reason: 'missingInputs', ports: ['prompt'] }
      } satisfies RunPlan,
      label: 'Run'
    }
  ])('shows $name', ({ plan, label }) => {
    renderRunButton({ plan })

    expect(screen.getByRole('button')).toHaveAccessibleName(label)
  })

  it('runs the node when clicked', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    renderRunButton({ plan: plannedRuns(3) }, { onRun })

    await user.click(screen.getByRole('button', { name: 'Run 3' }))

    expect(onRun).toHaveBeenCalledOnce()
  })

  it('turns into Stop while the node runs', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    renderRunButton(
      { plan: plannedRuns(3), running: true, disabled: true },
      { onStop }
    )

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(onStop).toHaveBeenCalledOnce()
  })

  it('cannot be pressed during a graph run', () => {
    renderRunButton({ plan: plannedRuns(3), disabled: true })

    expect(screen.getByRole('button', { name: 'Run 3' })).toBeDisabled()
  })
})
