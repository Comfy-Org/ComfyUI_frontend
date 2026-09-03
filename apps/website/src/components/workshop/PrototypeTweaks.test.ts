// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { LOW_CREDITS, useMockSession } from '../../composables/useMockSession'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import PrototypeTweaks from './PrototypeTweaks.vue'

const { showStatuses, outputCount, outcome, version } = usePrototypeTweaks()

afterEach(() => {
  showStatuses.value = false
  outputCount.value = 1
  outcome.value = 'success'
  version.value = 'v1'
  window.history.replaceState(null, '', '/workshop/')
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

  it('applies a shared link on load and offers one back for the current setup', async () => {
    window.history.replaceState(
      null,
      '',
      '/workshop/models/demo/?session=existing&balance=low&outputs=4'
    )
    const user = userEvent.setup()
    render(PrototypeTweaks, { props: { showRunControls: true } })
    const { session } = useMockSession()
    expect(outputCount.value).toBe(4)
    expect(
      session.value.status === 'signedIn' && session.value.account.credits
    ).toBe(LOW_CREDITS)

    await user.click(screen.getByTestId('prototype-tweaks'))
    await user.selectOptions(
      await screen.findByTestId('tweak-outcome'),
      'timeout'
    )
    await user.selectOptions(screen.getByTestId('tweak-version'), 'v1.1')
    expect(version.value).toBe('v1.1')
    const url = screen.getByTestId('tweak-share-url') as HTMLInputElement
    expect(url.value).toContain('/workshop/models/demo/?')
    expect(url.value).toContain('session=existing')
    expect(url.value).toContain('balance=low')
    expect(url.value).toContain('outcome=timeout')
    expect(url.value).toContain('outputs=4')
    expect(url.value).toContain('version=v1.1')

    await user.click(screen.getByTestId('tweak-share-copy'))
    expect(
      screen.getByTestId('tweak-share-copy').getAttribute('aria-label')
    ).toBe('Copied')
    expect(await navigator.clipboard.readText()).toBe(url.value)
  })

  it('hides the run controls on catalog pages', async () => {
    const user = userEvent.setup()
    render(PrototypeTweaks)
    await user.click(screen.getByTestId('prototype-tweaks'))
    await screen.findByTestId('tweak-statuses')
    expect(screen.queryByTestId('tweak-outputs')).toBeNull()
  })
})
