// @vitest-environment jsdom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import TagOverflow from './TagOverflow.vue'

const tags = [
  { label: 'Upscale', href: '/models/?capability=Upscale' },
  { label: 'Inpainting', href: '/models/?capability=Inpainting' }
]

describe('TagOverflow', () => {
  it('opens on click and links every overflow tag', async () => {
    const user = userEvent.setup()
    render(TagOverflow, { props: { tags } })

    const trigger = screen.getByTestId('model-tags-rest')
    expect(trigger.textContent.trim()).toBe('+2')
    expect(screen.queryByTestId('model-tags-rest-list')).toBeNull()

    await user.click(trigger)

    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      tags.map((tag) => tag.href)
    )
  })

  it('closes again on Escape', async () => {
    const user = userEvent.setup()
    render(TagOverflow, { props: { tags } })

    await user.click(screen.getByTestId('model-tags-rest'))
    const list = screen.getByTestId('model-tags-rest-list')

    await user.keyboard('{Escape}')
    expect(list.getAttribute('data-state')).toBe('closed')
  })
})
