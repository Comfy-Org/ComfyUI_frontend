import { tryOnScopeDispose } from '@vueuse/core'
import { shallowRef } from 'vue'

import { imageSize } from '../lib/workshop/image-size'

export interface EditorImage {
  readonly url: string
  readonly name: string
  readonly width: number
  readonly height: number
}

/**
 * The photo an app editor works on: the worked example or a picked file,
 * whose object URL it releases once replaced. `onPick` runs before the old
 * one is released, so the page can reset around the new photo first.
 */
export function useEditorImage(onPick: (next: EditorImage) => void) {
  const image = shallowRef<EditorImage>()
  let ownUrl: string | undefined
  let pendingUrl: string | undefined

  function show(next: EditorImage, own?: string) {
    image.value = next
    onPick(next)
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = own
  }

  function useExample(example: EditorImage) {
    pendingUrl = undefined
    show(example)
  }

  async function useFile(file: File) {
    const url = URL.createObjectURL(file)
    pendingUrl = url
    const size = await imageSize(url)
    if (pendingUrl !== url || !size) {
      URL.revokeObjectURL(url)
      return
    }
    pendingUrl = undefined
    show({ url, name: file.name, ...size }, url)
  }

  tryOnScopeDispose(() => {
    pendingUrl = undefined
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  })

  return { image, useExample, useFile }
}
