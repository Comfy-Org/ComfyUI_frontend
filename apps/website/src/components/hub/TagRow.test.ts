// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import TagRow from './TagRow.vue'

describe('TagRow', () => {
  it('links its chips to the tag pages by default', () => {
    render(TagRow, { props: { tags: ['upscale'] } })
    expect(screen.getByRole('link', { name: /upscale/i })).toBeTruthy()
  })

  it('renders plain chips when the card around it is already a link', () => {
    render(TagRow, { props: { tags: ['upscale'], linkTags: false } })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('tag-row').textContent).toMatch(/upscale/i)
  })
})
