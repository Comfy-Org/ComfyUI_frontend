import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
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
  it.for([
    { name: 'cat.png', previewUrl: 'blob:cat' },
    { name: 'song.mp3', previewUrl: undefined }
  ])(
    'shows $name only on hover while retaining an accessible tray item',
    async (props) => {
      const user = userEvent.setup()
      renderChip(props)
      expect(screen.queryByText(props.name)).not.toBeInTheDocument()
      await user.hover(screen.getByRole('group', { name: props.name }))
      const preview = await screen.findByRole('tooltip', { name: props.name })
      expect(within(preview).getByText(props.name)).toBeVisible()
    }
  )

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
    expect(screen.queryByAltText('song.mp3')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Audio' })).toBeInTheDocument()
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
})
