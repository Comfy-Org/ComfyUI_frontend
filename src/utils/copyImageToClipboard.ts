import { getErrorMessage } from '@comfyorg/shared-frontend-utils/errorUtil'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'

import { fullResolutionSrc } from './hdrFormatUtil'

async function decodeImage(
  blob: Blob
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap !== 'undefined') return createImageBitmap(blob)

  const img = new Image()
  const url = URL.createObjectURL(blob)
  img.src = url
  try {
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function fetchClipboardPng(url: URL): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    return Promise.reject(
      new TypeError(`Image request failed (${response.status})`)
    )
  }
  const blob = await response.blob()
  if (blob.type === 'image/png') return blob

  const image = await decodeImage(blob)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  try {
    const context = canvas.getContext('2d')
    if (!context) return Promise.reject(new TypeError('Canvas unavailable'))
    context.drawImage(image, 0, 0)
  } finally {
    if ('close' in image) image.close()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((png) => {
      if (png) resolve(png)
      else reject(new TypeError('PNG conversion failed'))
    }, 'image/png')
  })
}

export async function copyImageToClipboard(
  img: HTMLImageElement
): Promise<void> {
  const toast = useToast()
  if (
    typeof navigator.clipboard === 'undefined' ||
    typeof ClipboardItem === 'undefined'
  ) {
    toast.warning(t('clipboard.errorNotSupported'))
    return
  }

  try {
    const url = new URL(fullResolutionSrc(img), img.baseURI)
    url.searchParams.delete('preview')
    const png = fetchClipboardPng(url)
    const write = async () =>
      navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    await Promise.all([png, write()])
  } catch (error) {
    toast.warning(
      t('toastMessages.errorCopyImage', {
        error: getErrorMessage(error) ?? t('g.unknownError')
      })
    )
  }
}
