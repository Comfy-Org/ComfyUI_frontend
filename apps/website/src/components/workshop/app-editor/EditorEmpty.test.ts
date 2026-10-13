import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorEmpty from './EditorEmpty.vue'

const props = {
  title: 'Your photo appears here',
  hint: 'upload one in the panel or try an example',
  examples: [
    { id: 'pier', image: '/pier.jpg', label: 'Pier' },
    { id: 'cafe', image: '/cafe.jpg', label: 'Cafe' }
  ]
}

describe('EditorEmpty', () => {
  it('offers the examples and hands back the one picked', async () => {
    const { emitted } = render(EditorEmpty, { props })

    await userEvent.click(screen.getByRole('button', { name: 'Cafe' }))

    expect(emitted('example')).toEqual([['cafe']])
    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull()
  })

  it('holds every example while one is loading', () => {
    render(EditorEmpty, { props: { ...props, loading: 'pier' } })

    expect(screen.getByRole('button', { name: 'Pier' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Cafe' })).toBeDisabled()
  })
})
