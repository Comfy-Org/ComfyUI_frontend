import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SanitizedHtml from './SanitizedHtml.vue'

describe('SanitizedHtml', () => {
  it('preserves safe markup while removing executable content', () => {
    render(SanitizedHtml, {
      props: {
        as: 'section',
        html: [
          '<strong>Safe content</strong>',
          '<a id="safe-link" href="https://example.com" target="_blank">safe link</a>',
          '<a id="unsafe-link" href="javascript:alert(1)">unsafe link</a>',
          '<img src="x" alt="unsafe image" onerror="alert(1)">',
          '<script>alert(1)</script>'
        ].join('')
      },
      attrs: { 'data-testid': 'sanitized-html' }
    })

    expect(screen.getByTestId('sanitized-html')).toBeInTheDocument()
    expect(
      screen.getByText('Safe content', { selector: 'strong' })
    ).toBeVisible()
    expect(screen.getByText('unsafe link')).not.toHaveAttribute('href')
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
    expect(
      screen.getByRole('img', { name: 'unsafe image' })
    ).not.toHaveAttribute('onerror')
    expect(screen.queryByText('alert(1)')).not.toBeInTheDocument()
  })
})
