// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import PrototypeTweaks from './PrototypeTweaks.vue'

const { showStatuses, outputCount, outcome } = usePrototypeTweaks()

afterEach(() => {
  showStatuses.value = false
  outputCount.value = 1
  outcome.value = 'success'
})

describe('PrototypeTweaks', () => {
  it('drives the shared status switch and outputs per run', async () => {
    const user = userEvent.setup()
    render(PrototypeTweaks, { props: { showRunControls: true } })

    await user.click(screen.getByTestId('prototype-tweaks'))
    const statuses = await screen.findByTestId('tweak-statuses')
    expect(statuses.getAttribute('aria-checked')).toBe('false')
    await user.click(statuses)
    expect(showStatuses.value).toBe(true)
    expect(statuses.getAttribute('aria-checked')).toBe('true')

    await user.selectOptions(screen.getByTestId('tweak-outputs'), '4')
    expect(outputCount.value).toBe(4)
    await user.selectOptions(screen.getByTestId('tweak-outputs'), '9')
    expect(outputCount.value).toBe(9)
  })

  it('hides the run controls on catalog pages', async () => {
    const user = userEvent.setup()
    render(PrototypeTweaks)
    await user.click(screen.getByTestId('prototype-tweaks'))
    await screen.findByTestId('tweak-statuses')
    expect(screen.queryByTestId('tweak-outputs')).toBeNull()
  })
})
