import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import TagOverflow from './TagOverflow.vue'

const tags = [
  { label: 'Upscale', href: '/models/?capability=Upscale' },
  { label: 'Inpainting', href: '/models/?capability=Inpainting' }
]

describe('TagOverflow', () => {
  it('opens on focus and links every overflow tag', async () => {
    render(TagOverflow, { props: { tags } })

    const trigger = screen.getByTestId('model-tags-rest')
    expect(trigger.textContent.trim()).toBe('+2')
    expect(trigger.getAttribute('title')).toBe('Upscale, Inpainting')
    expect(screen.queryByTestId('model-tags-rest-list')).toBeNull()

    // The hover card opens on pointer or focus; happy-dom cannot drive Reka's
    // full pointer sequence, so this drives the keyboard path and owns the
    // rendered link contract.

    await fireEvent.focus(trigger)

    const links = await screen.findAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      tags.map((tag) => tag.href)
    )
  })

  it('is a button that opens on click for touch input', async () => {
    const user = userEvent.setup()
    render(TagOverflow, { props: { tags } })

    const trigger = screen.getByRole('button', {
      name: 'Upscale, Inpainting'
    })
    await user.click(trigger)

    expect(await screen.findByTestId('model-tags-rest-list')).toBeTruthy()
  })

  it('closes again on Escape', async () => {
    render(TagOverflow, { props: { tags } })

    // See the happy-dom limitation above.

    await fireEvent.focus(screen.getByTestId('model-tags-rest'))
    const list = await screen.findByTestId('model-tags-rest-list')

    // Reka listens on the portalled content; userEvent cannot target it here.
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(list, { key: 'Escape' })
    await waitFor(() => expect(list.getAttribute('data-state')).toBe('closed'))
  })
})
