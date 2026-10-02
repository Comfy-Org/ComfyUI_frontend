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
  let picks = 0

  function show(next: EditorImage, own?: string) {
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

  tryOnScopeDispose(() => {
    picks += 1
    if (ownUrl) URL.revokeObjectURL(ownUrl)
    ownUrl = undefined
  })

  return { image, useExample, useFile }
}
