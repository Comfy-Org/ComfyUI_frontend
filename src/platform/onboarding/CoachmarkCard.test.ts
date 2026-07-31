import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'

import CoachmarkCard from './CoachmarkCard.vue'

afterEach(cleanup)

describe('CoachmarkCard', () => {
  it('renders the title, message and subtitle', () => {
    render(CoachmarkCard, {
      props: {
        title: 'This is your canvas',
        message: 'Scroll to zoom.',
        subtitle: 'Step 1 of 3'
      }
    })
    expect(screen.getByRole('heading')).toHaveTextContent('This is your canvas')
    expect(screen.getByText('Scroll to zoom.')).toBeTruthy()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
  })

  it('applies titleId to the heading for aria-labelledby wiring', () => {
    render(CoachmarkCard, {
      props: { title: 'Heading', message: 'M', titleId: 'title-1' }
    })
    expect(screen.getByRole('heading').id).toBe('title-1')
  })

  it('applies messageId to the message for aria-describedby wiring', () => {
    render(CoachmarkCard, {
      props: { title: 'T', message: 'Body copy', messageId: 'desc-1' }
    })
    expect(screen.getByText('Body copy').id).toBe('desc-1')
  })

  it('omits the subtitle when not provided', () => {
    render(CoachmarkCard, { props: { title: 'T', message: 'M' } })
    expect(screen.queryByText('Step 1 of 3')).toBeNull()
  })

  it('renders the image when an image src is given', () => {
    render(CoachmarkCard, {
      props: { title: 'T', message: 'M', image: '/foo.png' }
    })
    expect(screen.getByAltText('')).toHaveAttribute('src', '/foo.png')
  })

  it('renders an image slot in place of the default image', () => {
    render(CoachmarkCard, {
      props: { title: 'T', message: 'M' },
      slots: { image: () => h('img', { src: '/slot.png', alt: 'preview' }) }
    })
    expect(screen.getByRole('img', { name: 'preview' })).toHaveAttribute(
      'src',
      '/slot.png'
    )
  })

  it('renders the actions slot', () => {
    render(CoachmarkCard, {
      props: { title: 'T', message: 'M' },
      slots: { actions: () => h('button', 'Next') }
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })
})
