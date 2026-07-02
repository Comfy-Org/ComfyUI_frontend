import type { ComponentProps } from 'vue-component-type-helpers'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick, ref, watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import MediaUploadEmpty from './MediaUploadEmpty.vue'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>

  function useDropZone(
    target: { value: HTMLElement | null | undefined },
    options?:
      | {
          onDrop?: (files: File[] | null, event: DragEvent) => void
          onOver?: (files: File[] | null, event: DragEvent) => void
          onLeave?: (files: File[] | null, event: DragEvent) => void
        }
      | ((files: File[] | null, event: DragEvent) => void)
  ) {
    const isOverDropZone = ref(false)
    const resolved =
      typeof options === 'function' ? { onDrop: options } : options

    watch(
      () => target.value,
      (element, _, onCleanup) => {
        if (!element || !resolved) return
        const callbacks = resolved

        function onDragOver(event: DragEvent) {
          event.preventDefault()
          isOverDropZone.value = true
          callbacks.onOver?.(Array.from(event.dataTransfer?.files ?? []), event)
        }

        function onDrop(event: DragEvent) {
          event.preventDefault()
          isOverDropZone.value = false
          callbacks.onDrop?.(Array.from(event.dataTransfer?.files ?? []), event)
        }

        function onDragLeave(event: DragEvent) {
          isOverDropZone.value = false
          callbacks.onLeave?.(null, event)
        }

        element.addEventListener('dragover', onDragOver)
        element.addEventListener('drop', onDrop)
        element.addEventListener('dragleave', onDragLeave)
        onCleanup(() => {
          element.removeEventListener('dragover', onDragOver)
          element.removeEventListener('drop', onDrop)
          element.removeEventListener('dragleave', onDragLeave)
        })
      },
      { immediate: true }
    )

    return { isOverDropZone }
  }

  return { ...actual, useDropZone }
})

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

function dragPayload(files: File[] = []) {
  return {
    dataTransfer: {
      files,
      types: ['Files'],
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file
      }))
    }
  }
}

async function renderEmpty(
  props: Partial<ComponentProps<typeof MediaUploadEmpty>> = {}
) {
  const result = render(MediaUploadEmpty, {
    props: {
      accept: 'video/*',
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
  await nextTick()
  return result
}

async function simulateDrop(
  target: HTMLElement,
  payload: ReturnType<typeof dragPayload>
) {
  await fireEvent.dragOver(target, payload)
  await fireEvent.drop(target, payload)
}

describe('MediaUploadEmpty', () => {
  it('renders drag-drop prompt and upload button', async () => {
    await renderEmpty()

    expect(screen.getByText('Drag and drop videos here to upload')).toBeTruthy()
    expect(screen.getByTestId('media-upload-browse-button')).toBeTruthy()
    expect(screen.getByText('Upload from device')).toBeTruthy()
  })

  it('emits browse when upload button is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = await renderEmpty()

    await user.click(screen.getByTestId('media-upload-browse-button'))

    expect(emitted().browse).toHaveLength(1)
  })

  it('emits upload with video files on drop', async () => {
    const { emitted } = await renderEmpty()
    const zone = screen.getByTestId('media-upload-empty')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })

    await simulateDrop(zone, dragPayload([file]))

    expect(emitted().upload).toHaveLength(1)
    expect((emitted().upload[0] as [File[]])[0][0].name).toBe('clip.mp4')
  })

  it('delegates drag events to provided handlers', async () => {
    const onDragOver = vi.fn(() => true)
    const onDragDrop = vi.fn(() => true)
    await renderEmpty({ onDragOver, onDragDrop })
    const zone = screen.getByTestId('media-upload-empty')

    await simulateDrop(zone, dragPayload([]))

    expect(onDragOver).toHaveBeenCalled()
    expect(onDragDrop).toHaveBeenCalled()
  })

  it('does not emit browse when disabled', async () => {
    const user = userEvent.setup()
    const { emitted } = await renderEmpty({ disabled: true })

    await user.click(screen.getByTestId('media-upload-browse-button'))

    expect(emitted().browse).toBeUndefined()
  })

  it('shows uploading spinner and hides upload controls while processing', async () => {
    await renderEmpty({
      uploading: true
    })

    expect(screen.getByText('Uploading…')).toBeTruthy()
    expect(screen.queryByText('Drag and drop videos here to upload')).toBeNull()
    expect(screen.queryByTestId('media-upload-browse-button')).toBeNull()
  })

  it('does not emit browse while uploading', async () => {
    await renderEmpty({ uploading: true })

    expect(screen.queryByTestId('media-upload-browse-button')).toBeNull()
  })
})
