import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { Ref } from '../types'

export const ensureImageFullyLoaded = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const maskImage = new Image()
    maskImage.src = src
    maskImage.onload = () => resolve()
    maskImage.onerror = reject
  })

const isAlphaValue = (index: number) => index % 4 === 3

export const removeImageRgbValuesAndInvertAlpha = (
  imageData: Uint8ClampedArray
) => imageData.map((val, i) => (isAlphaValue(i) ? 255 - val : 0))

export const toRef = (filename: string): Ref => ({
  filename,
  subfolder: 'clipspace',
  type: 'input'
})

export const mkFileUrl = (props: { ref: Ref; preview?: boolean }) => {
  const pathPlusQueryParams = api.apiURL(
    '/view?' +
      new URLSearchParams(props.ref).toString() +
      app.getPreviewFormatParam() +
      app.getRandParam()
  )
  const imageElement = new Image()
  imageElement.src = pathPlusQueryParams
  return imageElement.src
}

export const requestWithRetries = async (
  mkRequest: () => Promise<Response>,
  maxRetries: number = 3
): Promise<{ success: boolean }> => {
  let attempt = 0
  let success = false
  while (attempt < maxRetries && !success) {
    try {
      const response = await mkRequest()
      if (response.ok) {
        success = true
      } else {
        console.log('Failed to upload mask:', response)
      }
    } catch (error) {
      console.error(`Upload attempt ${attempt + 1} failed:`, error)
      attempt++
      if (attempt < maxRetries) {
        console.log('Retrying upload...')
      } else {
        console.log('Max retries reached. Upload failed.')
      }
    }
  }
  return { success }
}
