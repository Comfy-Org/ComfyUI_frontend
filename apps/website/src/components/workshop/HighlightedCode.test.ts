// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import HighlightedCode from './HighlightedCode.vue'

describe('HighlightedCode', () => {
  it('server-renders highlighted tokens before hydration', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(HighlightedCode, {
            code: 'const answer: number = 42',
            language: 'typescript'
          })
      })
    )

    expect(html).toContain('<span style="color:')
    expect(html).toContain('const')
    expect(html).toContain('answer')
  })

  it('renders highlighted tokens on its first browser render', () => {
    render(HighlightedCode, {
      props: {
        code: 'const answer: number = 42',
        language: 'typescript'
      }
    })

    expect(screen.getByText('const').getAttribute('style')).toContain('color:')
  })

  it('renders an empty source without placeholder content', () => {
    render(HighlightedCode, {
      props: { code: '', language: 'typescript' }
    })

    expect(screen.getByTestId('highlighted-code').textContent).toBe('')
  })

  it('updates highlighted tokens with the source', async () => {
    const { rerender } = render(HighlightedCode, {
      props: { code: 'print("first")', language: 'python' }
    })

    await rerender({ code: 'print("second")', language: 'python' })

    expect(screen.getByTestId('highlighted-code').textContent).toBe(
      'print("second")'
    )
  })
})
