import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import UserMessage from './UserMessage.vue'

describe('UserMessage', () => {
  it('renders a caption-only placeholder tile for a preview-less attachment', () => {
    render(UserMessage, {
      props: { text: '', attachments: [{ name: 'clip.bin' }] }
    })

    expect(screen.getByText('clip.bin')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders thumbnails for previewable attachments above the text pill', () => {
    render(UserMessage, {
      props: {
        text: 'use these',
        attachments: [
          { name: 'a.png', previewUrl: 'blob:a' },
          { name: 'b.png', previewUrl: 'blob:b' }
        ]
      }
    })

    expect(screen.getByAltText('a.png')).toBeInTheDocument()
    expect(screen.getByAltText('b.png')).toBeInTheDocument()
    expect(screen.getByText('use these')).toBeInTheDocument()
  })
})
