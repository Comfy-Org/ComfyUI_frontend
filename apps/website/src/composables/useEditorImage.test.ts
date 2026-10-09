import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { imageSize } from '@/lib/workshop/image-size'
import { useEditorImage } from './useEditorImage'

vi.mock(import('@/lib/workshop/image-size'), () => ({
  imageSize: vi.fn()
}))

const EXAMPLE = {
  url: '/example.jpg',
  name: 'example.jpg',
  width: 4,
  height: 3
}

function setup() {
  let urls = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++urls}`)
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const onPick = vi.fn()
  const scope = effectScope()
  const editor = scope.run(() => useEditorImage(onPick))
  if (!editor) throw new Error('no scope')
  return { editor, onPick, revoke, scope }
}

describe('useEditorImage', () => {
  it('shows the last picked file and releases the one it replaced', async () => {
    vi.mocked(imageSize).mockResolvedValue({ width: 10, height: 5 })
    const { editor, onPick, revoke } = setup()

    await editor.useFile(new File([''], 'first.png'))
    await editor.useFile(new File([''], 'second.png'))

    expect(editor.image.value).toEqual({
      url: 'blob:2',
      name: 'second.png',
      width: 10,
      height: 5
    })
    expect(onPick).toHaveBeenCalledTimes(2)
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })

  it('drops a file that finishes decoding after the example was picked', async () => {
    let decode: (size: { width: number; height: number }) => void = () => {}
    vi.mocked(imageSize).mockReturnValue(
      new Promise((resolve) => (decode = resolve))
    )
    const { editor, revoke } = setup()

    const picking = editor.useFile(new File([''], 'slow.png'))
    editor.useExample(EXAMPLE)
    decode({ width: 1, height: 1 })
    await picking

    expect(editor.image.value).toBe(EXAMPLE)
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })

  it('keeps the current photo when a file does not decode, and releases it on dispose', async () => {
    vi.mocked(imageSize).mockResolvedValueOnce({ width: 2, height: 2 })
    vi.mocked(imageSize).mockResolvedValueOnce(undefined)
    const { editor, revoke, scope } = setup()

    await editor.useFile(new File([''], 'good.png'))
    await editor.useFile(new File([''], 'broken.png'))
    expect(editor.image.value?.name).toBe('good.png')
    expect(revoke).toHaveBeenCalledWith('blob:2')

    scope.stop()
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })
})
