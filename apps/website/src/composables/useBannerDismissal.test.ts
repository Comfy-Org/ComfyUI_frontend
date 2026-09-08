// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { BANNER_STORAGE_KEY } from '../utils/banner'
import { useBannerDismissal } from './useBannerDismissal'

const VERSION = 'announcement_en_v1'

const Harness = defineComponent({
  setup() {
    const { isVisible, close } = useBannerDismissal(VERSION)
    return () =>
      h('button', { onClick: close }, isVisible.value ? 'visible' : 'hidden')
  }
})

const banner = () => screen.getByRole('button')

describe('useBannerDismissal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it.for([
    { label: 'null', raw: 'null' },
    { label: 'an array', raw: '[1,2]' },
    { label: 'a string', raw: '"a string"' },
    { label: 'a number', raw: '123' },
    { label: 'a non-boolean map', raw: '{"x":"notabool"}' },
    { label: 'malformed JSON', raw: '{oops' }
  ])('mounts and stays visible when storage holds $label', ({ raw }) => {
    localStorage.setItem(BANNER_STORAGE_KEY, raw)

    expect(() => render(Harness)).not.toThrow()
    expect(banner().textContent).toBe('visible')
  })

  it('stays dismissible after a stored null that once crashed hydration', async () => {
    localStorage.setItem(BANNER_STORAGE_KEY, 'null')

    render(Harness)
    await userEvent.setup().click(banner())

    expect(banner().textContent).toBe('hidden')
    expect(localStorage.getItem(BANNER_STORAGE_KEY)).toBe(
      JSON.stringify({ [VERSION]: true })
    )
  })

  it('hides a banner already recorded as dismissed', async () => {
    localStorage.setItem(
      BANNER_STORAGE_KEY,
      JSON.stringify({ [VERSION]: true })
    )

    render(Harness)

    expect(await screen.findByText('hidden')).toBeTruthy()
  })
})
