import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import MarkdownText from './MarkdownText.vue'

describe('MarkdownText', () => {
  it.for([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)'
  ])('does not make %s clickable', (url) => {
    render(MarkdownText, { props: { text: `[click me](${url})` } })

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('click me')).toBeInTheDocument()
  })

  it('keeps an http(s) link clickable', () => {
    render(MarkdownText, {
      props: { text: '[docs](https://docs.comfy.org/)' }
    })

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://docs.comfy.org/'
    )
  })

  it('renders plain text with no markdown unchanged', () => {
    render(MarkdownText, { props: { text: 'A plain description.' } })

    expect(screen.getByText('A plain description.')).toBeInTheDocument()
  })
})
