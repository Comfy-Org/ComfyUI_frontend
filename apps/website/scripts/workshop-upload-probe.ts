import { createWorkshopUrlUploader } from '../src/config/workshop-url-upload'

export async function runWorkshopUploadProbe(file: File, token: string) {
  try {
    const url = await createWorkshopUrlUploader()(
      file,
      token,
      'browser-upload-probe',
      AbortSignal.timeout(30_000)
    )
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = url
    await image.decode()
    return {
      passed: image.naturalWidth === 1 && image.naturalHeight === 1,
      stage: 'decode',
      bytes: file.size
    }
  } catch (error) {
    const stage =
      error &&
      typeof error === 'object' &&
      'stage' in error &&
      typeof error.stage === 'string'
        ? error.stage
        : 'decode'
    return { passed: false, stage, bytes: file.size }
  }
}
