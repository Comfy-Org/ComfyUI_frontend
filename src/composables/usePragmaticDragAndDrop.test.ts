import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { dropTargetForExternal as DropTargetForExternalFn } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'

import { usePragmaticExternalFileDrop } from '@/composables/usePragmaticDragAndDrop'

const { dropTargetForExternal, containsFiles, getFiles } = vi.hoisted(() => ({
  dropTargetForExternal: vi.fn(),
  containsFiles: vi.fn(),
  getFiles: vi.fn()
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  dropTargetForExternal
}))
vi.mock('@atlaskit/pragmatic-drag-and-drop/external/file', () => ({
  containsFiles,
  getFiles
}))

type DropTargetArgs = Parameters<typeof DropTargetForExternalFn>[0]

const lastArgs = () =>
  dropTargetForExternal.mock.calls.at(-1)![0] as DropTargetArgs

const mountWithDropTarget = (
  onDrop: (files: File[]) => void | Promise<unknown>
) => {
  const captured: { isDraggingOver?: Readonly<Ref<boolean>> } = {}
  const utils = render(
    defineComponent({
      setup() {
        const el = ref<HTMLElement | null>(null)
        const { isDraggingOver } = usePragmaticExternalFileDrop(el, { onDrop })
        captured.isDraggingOver = isDraggingOver
        return () => h('div', { ref: el })
      }
    })
  )
  return { captured, ...utils }
}

describe('usePragmaticExternalFileDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dropTargetForExternal.mockReturnValue(vi.fn())
  })

  it('registers an external drop target gated by containsFiles', () => {
    mountWithDropTarget(vi.fn())

    expect(dropTargetForExternal).toHaveBeenCalledOnce()
    expect(lastArgs().canDrop).toBe(containsFiles)
  })

  it('toggles isDraggingOver on drag enter and leave', async () => {
    const { captured } = mountWithDropTarget(vi.fn())
    const args = lastArgs()

    args.onDragEnter?.({} as never)
    await nextTick()
    expect(captured.isDraggingOver!.value).toBe(true)

    args.onDragLeave?.({} as never)
    await nextTick()
    expect(captured.isDraggingOver!.value).toBe(false)
  })

  it('forwards dropped files to onDrop and clears the flag', async () => {
    const onDrop = vi.fn()
    const files = [new File(['{}'], 'a.json')]
    getFiles.mockReturnValue(files)

    const { captured } = mountWithDropTarget(onDrop)
    const args = lastArgs()
    args.onDragEnter?.({} as never)

    const source = { items: [] }
    args.onDrop?.({ source } as never)
    await nextTick()

    expect(getFiles).toHaveBeenCalledWith({ source })
    expect(onDrop).toHaveBeenCalledWith(files)
    expect(captured.isDraggingOver!.value).toBe(false)
  })

  it('does not call onDrop when no files were dropped', () => {
    const onDrop = vi.fn()
    getFiles.mockReturnValue([])

    mountWithDropTarget(onDrop)
    lastArgs().onDrop?.({ source: {} } as never)

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('logs and swallows errors thrown by the drop handler', async () => {
    const error = new Error('boom')
    getFiles.mockReturnValue([new File(['{}'], 'a.json')])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    mountWithDropTarget(vi.fn().mockRejectedValue(error))
    lastArgs().onDrop?.({ source: {} } as never)
    await new Promise((resolve) => setTimeout(resolve))

    expect(consoleError).toHaveBeenCalledWith(
      'External file drop handler failed',
      error
    )
    consoleError.mockRestore()
  })

  it('cleans up the drop target on unmount', () => {
    const cleanup = vi.fn()
    dropTargetForExternal.mockReturnValue(cleanup)

    const { unmount } = mountWithDropTarget(vi.fn())
    unmount()

    expect(cleanup).toHaveBeenCalledOnce()
  })
})
