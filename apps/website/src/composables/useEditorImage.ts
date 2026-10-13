import { tryOnScopeDispose } from '@vueuse/core'
import { shallowRef } from 'vue'

import { imageSize } from '@/lib/workshop/image-size'

export interface EditorImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

/**
 * The photo an app editor works on, released once replaced. `onPick` runs
 * first so the page can reset; a removed photo returns until the next pick.
 */
export function useEditorImage(onPick: (next: EditorImage) => void) {
  const image = shallowRef<EditorImage>()
  const removed = shallowRef<EditorImage>()
  let ownUrl: string | undefined
  let picks = 0

  function show(next: EditorImage, own?: string) {
    removed.value = undefined
    image.value = next
    onPick(next)
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = own
  }

  function useExample(example: EditorImage) {
    picks += 1
    show(example)
  }

  async function useFile(file: File) {
    const pick = ++picks
    const url = URL.createObjectURL(file)
    const size = await imageSize(url)
    if (pick === picks && size) show({ url, name: file.name, ...size }, url)
    else URL.revokeObjectURL(url)
  }

  function remove() {
    if (!image.value) return
    removed.value = image.value
    image.value = undefined
  }

  function restore() {
    if (!removed.value) return
    image.value = removed.value
    removed.value = undefined
  }

  tryOnScopeDispose(() => {
    picks += 1
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  })

  return { image, removed, useExample, useFile, remove, restore }
}
