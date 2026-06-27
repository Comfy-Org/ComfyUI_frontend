import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import MediaUploadEmpty from './MediaUploadEmpty.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      loadVideoTrim: {
        dragAndDropVideos: 'Drag and drop videos here to upload',
        uploadFromDevice: 'Upload from device',
        uploading: 'Uploading…'
      },
      g: {
        loading: 'Loading'
      }
    }
  }
})

function renderEmpty(props: Record<string, unknown> = {}) {
  return render(MediaUploadEmpty, {
    props: {
      accept: 'video/*',
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('MediaUploadEmpty', () => {
  it('renders drag-drop prompt and upload button', () => {
    renderEmpty()

    expect(screen.getByText('Drag and drop videos here to upload')).toBeTruthy()
    expect(screen.getByTestId('media-upload-browse-button')).toBeTruthy()
    expect(screen.getByText('Upload from device')).toBeTruthy()
  })

  it('emits browse when upload button is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderEmpty()

    await user.click(screen.getByTestId('media-upload-browse-button'))

    expect(emitted().browse).toHaveLength(1)
  })

  it('emits upload with video files on drop', async () => {
    const { emitted } = renderEmpty()
    const zone = screen.getByTestId('media-upload-empty')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })

    await fireEvent.drop(zone, {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: 'video/mp4',
            getAsFile: () => file
          }
        ]
      }
    })

    expect(emitted().upload).toHaveLength(1)
    expect((emitted().upload[0] as [File[]])[0][0].name).toBe('clip.mp4')
  })

  it('delegates drag events to provided handlers', async () => {
    const onDragOver = vi.fn(() => true)
    const onDragDrop = vi.fn(() => true)
    renderEmpty({ onDragOver, onDragDrop })
    const zone = screen.getByTestId('media-upload-empty')

    await fireEvent.dragOver(zone, {
      dataTransfer: { items: [{ kind: 'file', type: 'video/mp4' }] }
    })
    await fireEvent.drop(zone, {
      dataTransfer: { files: [] }
    })

    expect(onDragOver).toHaveBeenCalled()
    expect(onDragDrop).toHaveBeenCalled()
  })

  it('does not emit browse when disabled', async () => {
    const user = userEvent.setup()
    const { emitted } = renderEmpty({ disabled: true })

    await user.click(screen.getByTestId('media-upload-browse-button'))

    expect(emitted().browse).toBeUndefined()
  })

  it('shows uploading spinner and hides upload controls while processing', () => {
    renderEmpty({
      uploading: true
    })

    expect(screen.getByText('Uploading…')).toBeTruthy()
    expect(screen.queryByText('Drag and drop videos here to upload')).toBeNull()
    expect(screen.queryByTestId('media-upload-browse-button')).toBeNull()
  })

  it('does not emit browse while uploading', () => {
    renderEmpty({ uploading: true })

    expect(screen.queryByTestId('media-upload-browse-button')).toBeNull()
  })
})
