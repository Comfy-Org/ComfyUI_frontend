import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import AttachmentChip from './AttachmentChip.vue'

function renderChip(props: {
  name: string
  previewUrl?: string
  uploading?: boolean
}) {
  return render(AttachmentChip, {
    props,
    global: { plugins: [i18n] }
  })
}

function iconMarker(container: Element): string {
  return container.querySelector(
    'span[class*="lucide--"], span[class*="icon-"]'
  )
    ? (container.querySelector('span[class*="lucide--"]')?.className ?? '')
    : ''
}

describe('AttachmentChip', () => {
  it('renders an image preview only for image files', () => {
    renderChip({ name: 'cat.png', previewUrl: 'blob:x' })
    expect(screen.getByAltText('cat.png')).toBeInTheDocument()
  })

  // A server thumbnail for a non-image asset must not resurrect the broken
  // image chip e8d71a32fb removed.
  it('ignores a preview url on a non-image file', () => {
    const { container } = renderChip({
      name: 'song.mp3',
      previewUrl: 'https://x/thumb.png'
    })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(iconMarker(container)).toContain('lucide--music')
  })

  it.for([
    ['clip.mp4', 'lucide--video'],
    ['voice.m4a', 'lucide--music'],
    ['mesh.glb', 'lucide--box'],
    ['notes.md', 'lucide--text'],
    ['data.bin', 'lucide--file']
  ])('shows the %s icon matched to its type', ([name, icon]) => {
    const { container } = renderChip({ name })
    expect(iconMarker(container)).toContain(icon)
  })

  it('shows the spinner while uploading', () => {
    renderChip({ name: 'cat.png', uploading: true })
    expect(
      screen.getByRole('status', { name: 'Uploading' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // What the agent can do with a file is otherwise invisible: an image it reads,
  // a clip it only measures, and a mesh or a text file it cannot open at all.
  // Without this the chips look identical and the user assumes it was read.
  describe('capability affordance', () => {
    it.for([
      ['cat.png', 'can see this image'],
      ['clip.mp4', 'format and length, but not what it contains'],
      ['mesh.glb', "use this file in the graph, but can't read"],
      ['notes.md', "use this file in the graph, but can't read"]
    ])('tells the user what the agent can do with %s', ([name, phrase]) => {
      renderChip({ name })
      const chip = screen.getByTestId('agent-attachment-chip')
      expect(chip).toHaveAttribute('title', expect.stringContaining(phrase))
      expect(chip).toHaveAttribute(
        'aria-description',
        expect.stringContaining(phrase)
      )
    })
  })
})
