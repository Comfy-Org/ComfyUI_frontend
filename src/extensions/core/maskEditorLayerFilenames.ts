export interface ImageLayerFilenames {
  maskedImage: string
  paint: string
  paintedImage: string
  paintedMaskedImage: string
}

const paintedMaskedImagePrefix = 'clipspace-painted-masked-'

export const imageLayerFilenamesByTimestamp = (
  timestamp: number
): ImageLayerFilenames => ({
  maskedImage: `clipspace-mask-${timestamp}.png`,
  paint: `clipspace-paint-${timestamp}.png`,
  paintedImage: `clipspace-painted-${timestamp}.png`,
  paintedMaskedImage: `${paintedMaskedImagePrefix}${timestamp}.png`
})

export const imageLayerFilenamesIfApplicable = (
  inputImageFilename: string
): ImageLayerFilenames | undefined => {
  const isPaintedMaskedImageFilename = inputImageFilename.startsWith(
    paintedMaskedImagePrefix
  )
  if (!isPaintedMaskedImageFilename) return undefined
  const suffix = inputImageFilename.slice(paintedMaskedImagePrefix.length)
  const timestamp = parseInt(suffix.split('.')[0], 10)
  return imageLayerFilenamesByTimestamp(timestamp)
}
