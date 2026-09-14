// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CodeLang, HighlightToken } from '../../lib/highlight'
import HighlightedCode from './HighlightedCode.vue'

const { highlightTokens } = vi.hoisted(() => ({
  highlightTokens:
    vi.fn<
      (
        code: string,
        language: CodeLang
      ) => Promise<readonly HighlightToken[] | null>
    >()
}))

vi.mock(import('../../lib/highlight'), () => ({ highlightTokens }))

beforeEach(() => {
  highlightTokens.mockReset()
})

describe('HighlightedCode', () => {
  it('keeps plain text when highlighting is unavailable', async () => {
    const pending = Promise.withResolvers<readonly HighlightToken[] | null>()
    highlightTokens.mockReturnValue(pending.promise)
    const code = 'print("plain text")'
    render(HighlightedCode, {
      props: { code, language: 'python' }
    })

    expect(screen.getByTestId('highlighted-code').textContent).toBe(code)

    pending.resolve(null)
    await pending.promise

    expect(screen.getByTestId('highlighted-code').textContent).toBe(code)
  })

  it('renders an empty source without placeholder content', async () => {
    highlightTokens.mockResolvedValue([])
    render(HighlightedCode, {
      props: { code: '', language: 'typescript' }
    })

    await waitFor(() =>
      expect(screen.getByTestId('highlighted-code').textContent).toBe('')
    )
  })

  it('discards a stale highlight result after the source changes', async () => {
    const first = Promise.withResolvers<readonly HighlightToken[] | null>()
    const second = Promise.withResolvers<readonly HighlightToken[] | null>()
    highlightTokens
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { rerender } = render(HighlightedCode, {
      props: { code: 'first', language: 'python' }
    })

    await rerender({ code: 'second' })
    expect(screen.getByTestId('highlighted-code').textContent).toBe('second')

    second.resolve([{ content: 'highlighted second', color: '#fff' }])
    await waitFor(() =>
      expect(screen.getByTestId('highlighted-code').textContent).toBe(
        'highlighted second'
      )
    )

    first.resolve([{ content: 'stale first', color: '#fff' }])
    await first.promise

    expect(screen.getByTestId('highlighted-code').textContent).toBe(
      'highlighted second'
    )
  })
})
