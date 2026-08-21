// @vitest-environment happy-dom

import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import SafeRichText from './SafeRichTextContent'

it('renders sanitized content through the selected root element', async () => {
  const onClick = vi.fn()
  const user = userEvent.setup()

  render(SafeRichText, {
    props: {
      as: 'p',
      html: '<strong>Read <a href="/docs" class="underline">Docs</a></strong>'
    },
    attrs: {
      'aria-label': 'Summary',
      onClick
    }
  })

  const root = screen.getByLabelText('Summary')
  const link = within(root).getByRole('link', { name: 'Docs' })

  expect(root.tagName).toBe('P')
  expect(link.getAttribute('href')).toBe('/docs')
  expect(link.classList.contains('underline')).toBe(true)
  expect(link.parentElement?.tagName).toBe('STRONG')

  await user.click(root)
  expect(onClick).toHaveBeenCalledOnce()
})
