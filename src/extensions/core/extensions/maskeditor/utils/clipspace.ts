import { ComfyApp } from '@/scripts/app'
import type { Ref } from '../types'

/**
 * Note: the images' positions are important here. What the positions mean is hardcoded in `src/scripts/app.ts` in the `copyToClipspace` method.
 * - `newMainOutput` should be the fully composited image: base image + mask (in the alpha channel) + paint.
 * - The first array element of `extraImagesShownButNotOutputted` should be JUST the paint layer, with a transparent background.
 * - It is possible to add more images in the clipspace array, but is not useful currently.
 * With this configuration, the MaskEditor will properly load the paint layer separately from the base image, ensuring it is editable.
 * */
export const replaceClipspaceImages = (
  newMainOutput: Ref,
  otherImagesInClipspace?: Ref[]
) => {
  try {
    if (!ComfyApp?.clipspace?.widgets?.length) return
    const firstImageWidgetIndex = ComfyApp.clipspace.widgets.findIndex(
      (obj) => obj?.name === 'image'
    )
    const firstImageWidget = ComfyApp.clipspace.widgets[firstImageWidgetIndex]
    if (!firstImageWidget) return

    ComfyApp!.clipspace!.widgets![firstImageWidgetIndex].value = newMainOutput

    otherImagesInClipspace?.forEach((extraImage, extraImageIndex) => {
      const extraImageWidgetIndex = firstImageWidgetIndex + extraImageIndex + 1
      ComfyApp!.clipspace!.widgets![extraImageWidgetIndex].value = extraImage
    })
  } catch (err) {
    console.warn('Failed to set widget value:', err)
  }
}
