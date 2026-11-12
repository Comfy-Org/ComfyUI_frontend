import { render } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { useDocumentDarkTheme } from './useDocumentDarkTheme'

const Layout = defineComponent({
  setup() {
    useDocumentDarkTheme()
    return () => null
  }
})

const rootStyle = () => document.documentElement.style

describe('useDocumentDarkTheme', () => {
  afterEach(() => {
    rootStyle().cssText = ''
  })

  it('applies the dark palette over a light one while mounted and restores it after', () => {
    rootStyle().setProperty('--background', '#ffffff')
    rootStyle().colorScheme = 'light'

    const { unmount } = render(Layout)
    expect([
      rootStyle().getPropertyValue('--background'),
      rootStyle().colorScheme
    ]).toEqual(['#171718', 'dark'])

    unmount()
    expect([
      rootStyle().getPropertyValue('--background'),
      rootStyle().colorScheme
    ]).toEqual(['#ffffff', 'light'])
  })
})
