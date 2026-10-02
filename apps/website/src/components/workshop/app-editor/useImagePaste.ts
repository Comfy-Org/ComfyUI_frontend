import { useEventListener } from '@vueuse/core'

import { imageFileOf } from './image-transfer'

/**
 * Hands an image pasted anywhere on the page to `take`, unless `ready` says
 * the editor cannot take one now (while a run is going, say).
 */
export function useImagePaste(
  take: (file: File) => unknown,
  ready: () => boolean = () => true
) {
  useEventListener(document, 'paste', (event: ClipboardEvent) => {
    const file = imageFileOf(event.clipboardData)
    if (!file || !ready()) return
    event.preventDefault()
    void take(file)
  })
}
