// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { codeToHtml } from 'shiki'

import { i18n } from '@/i18n'

import CodeBlock from './CodeBlock.vue'

vi.mock('shiki', () => ({
  codeToHtml: vi.fn(async (code: string, options?: { lang: string }) => {
    if (options?.lang === 'nope') throw new Error('unknown language')
    return `<pre class="shiki"><code><span>HL:${code}</span></code></pre>`
  })
}))

describe('CodeBlock', () => {
  beforeEach(() => vi.mocked(codeToHtml).mockClear())

  it('renders plain code first and swaps to highlighted markup', async () => {
    render(CodeBlock, {
      props: { code: 'print("hi")', lang: 'python' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('print("hi")')).toBeInTheDocument()

    expect(await screen.findByText('HL:print("hi")')).toBeInTheDocument()
    expect(screen.queryByText('print("hi")')).not.toBeInTheDocument()
  })

  it('stays on the plain fallback when highlighting fails', async () => {
    render(CodeBlock, {
      props: { code: 'mystery', lang: 'nope' },
      global: { plugins: [i18n] }
    })

    await waitFor(() =>
      expect(codeToHtml).toHaveBeenCalledWith(
        'mystery',
        expect.objectContaining({ lang: 'nope' })
      )
    )
    expect(screen.queryByText('HL:mystery')).not.toBeInTheDocument()
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })

  // Slice #16210 10-T5, reproduced on main@00b9c69ad; remove `.fails` when oversized blocks bypass Shiki.
  it.fails('leaves oversized blocks plain without invoking Shiki', async () => {
    vi.useFakeTimers()
    const code = 'x'.repeat(50_001)
    try {
      render(CodeBlock, {
        props: { code, lang: 'text' },
        global: { plugins: [i18n] }
      })

      expect(screen.getByText(code)).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(120)
      expect(codeToHtml).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  // Slice #16210 10-T6, reproduced on main@00b9c69ad; remove `.fails` when rerenders clear stale highlights.
  it.fails('never displays a highlight for a stale code snapshot', async () => {
    const { rerender } = render(CodeBlock, {
      props: { code: 'old', lang: 'text' },
      global: { plugins: [i18n] }
    })

    expect(await screen.findByText('HL:old')).toBeInTheDocument()
    await rerender({ code: 'new', lang: 'text' })
    expect(screen.queryByText('HL:old')).not.toBeInTheDocument()
    expect(screen.getByText('new')).toBeInTheDocument()
    expect(await screen.findByText('HL:new')).toBeInTheDocument()
  })
})
