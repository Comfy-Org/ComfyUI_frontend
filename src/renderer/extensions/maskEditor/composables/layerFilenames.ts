interface ImageLayerFilenames {
  maskedImage: string
  paint: string
  paintedImage: string
  paintedMaskedImage: string
}

const paintedMaskedImagePrefix = 'clipspace-painted-masked-'

export function imageLayerFilenamesByTimestamp(
  timestamp: number
): ImageLayerFilenames {
  return {
    maskedImage: `clipspace-mask-${timestamp}.png`,
    paint: `clipspace-paint-${timestamp}.png`,
    paintedImage: `clipspace-painted-${timestamp}.png`,
    paintedMaskedImage: `${paintedMaskedImagePrefix}${timestamp}.png`
  }
}

export function imageLayerFilenamesIfApplicable(
  inputImageFilename: string
): ImageLayerFilenames | undefined {
  if (!inputImageFilename.startsWith(paintedMaskedImagePrefix)) return undefined
  const suffix = inputImageFilename.slice(paintedMaskedImagePrefix.length)
  const timestamp = parseInt(suffix.split('.')[0], 10)
  return imageLayerFilenamesByTimestamp(timestamp)
}
