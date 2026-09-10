// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { LOW_CREDITS, useMockSession } from '../../composables/useMockSession'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import PrototypeTweaks from './PrototypeTweaks.vue'

const { showFeatured, outcome, version } = usePrototypeTweaks()

afterEach(() => {
  showFeatured.value = true
  outcome.value = 'success'
  version.value = 'v1'
  window.history.replaceState(null, '', '/models/')
})

describe('PrototypeTweaks', () => {
  it('drives the shared featured switch', async () => {
    const user = userEvent.setup()
    render(PrototypeTweaks, { props: { showRunControls: true } })

    await user.click(screen.getByTestId('prototype-tweaks'))
    const featured = await screen.findByTestId('tweak-featured')
    expect(featured.getAttribute('aria-checked')).toBe('true')
    await user.click(featured)
    expect(showFeatured.value).toBe(false)
    expect(featured.getAttribute('aria-checked')).toBe('false')
  })

  it('applies a shared link on load and offers one back for the current setup', async () => {
    window.history.replaceState(
      null,
      '',
      '/models/demo/?session=existing&balance=low'
    )
    const user = userEvent.setup()
    render(PrototypeTweaks, { props: { showRunControls: true } })
    const { session } = useMockSession()
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
    expect(url.value).toContain('/models/demo/?')
    expect(url.value).toContain('session=existing')
    expect(url.value).toContain('balance=low')
    expect(url.value).toContain('outcome=timeout')
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
    await screen.findByTestId('tweak-featured')
    expect(screen.queryByTestId('tweak-outputs')).toBeNull()
  })
})
