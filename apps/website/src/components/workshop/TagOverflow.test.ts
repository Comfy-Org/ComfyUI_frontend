// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import TagOverflow from './TagOverflow.vue'

const tags = [
  { label: 'Upscale', href: '/models/?capability=Upscale' },
  { label: 'Inpainting', href: '/models/?capability=Inpainting' }
]

describe('TagOverflow', () => {
  it('opens from the trigger and links every overflow tag', async () => {
    render(TagOverflow, { props: { tags } })

    const trigger = screen.getByTestId('model-tags-rest')
    expect(trigger.textContent.trim()).toBe('+2')
    expect(trigger.getAttribute('title')).toBe('Upscale, Inpainting')
    expect(screen.queryByTestId('model-tags-rest-list')).toBeNull()

    // Reka's full pointer sequence closes in happy-dom; the browser interaction
    // is covered by Playwright, while this test owns the rendered link contract.
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.click(trigger)

    const links = await screen.findAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      tags.map((tag) => tag.href)
    )
  })

  it('closes again on Escape', async () => {
    render(TagOverflow, { props: { tags } })

    // See the happy-dom limitation above.
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.click(screen.getByTestId('model-tags-rest'))
    const list = await screen.findByTestId('model-tags-rest-list')

    // Reka listens on the portalled content; userEvent cannot target it here.
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(list, { key: 'Escape' })
    await waitFor(() => expect(list.getAttribute('data-state')).toBe('closed'))
  })
})
