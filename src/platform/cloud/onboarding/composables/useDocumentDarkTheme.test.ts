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

const root = () => document.documentElement.classList

describe('useDocumentDarkTheme', () => {
  afterEach(() => root().remove('dark-theme'))

  it('darkens the document while the layout is mounted', () => {
    const { unmount } = render(Layout)
    expect(root().contains('dark-theme')).toBe(true)

    unmount()
    expect(root().contains('dark-theme')).toBe(false)
  })

  it('leaves a dark theme the app already set', () => {
    root().add('dark-theme')

    render(Layout).unmount()

    expect(root().contains('dark-theme')).toBe(true)
  })
})
