import { render, screen, waitFor } from '@testing-library/vue'
import { codeToHtml } from 'shiki'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import CodeBlock from './CodeBlock.vue'

vi.mock(import('shiki'), () => ({
  codeToHtml: vi.fn(async (code: string, options: { lang: string }) => {
    if (options.lang === 'nope') throw new Error('unknown language')
    return `<pre class="shiki"><code><span style="color:#ff0000">HL:${code}</span></code></pre>`
  })
}))

describe('CodeBlock', () => {
  it('renders plain code first and swaps to highlighted markup', async () => {
    render(CodeBlock, {
      props: { code: 'print("hi")', lang: 'python' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('print("hi")')).toBeInTheDocument()

    expect(await screen.findByText('HL:print("hi")')).toHaveStyle({
      color: '#ff0000'
    })
    expect(screen.queryByText('print("hi")')).not.toBeInTheDocument()
  })

  it('stays on the plain fallback when highlighting fails', async () => {
    render(CodeBlock, {
      props: { code: 'mystery', lang: 'nope' },
      global: { plugins: [i18n] }
    })

    await waitFor(() =>
      expect(codeToHtml).toHaveBeenCalledWith('mystery', expect.anything())
    )
    expect(screen.queryByText('HL:mystery')).not.toBeInTheDocument()
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })
})
