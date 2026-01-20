import { t } from '@/i18n'
import { uploadMedia } from '@/platform/assets/services/uploadService'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'

class Load3dUtils {
  static async uploadTempImage(
    imageData: string,
    prefix: string,
    fileType: string = 'png'
  ) {
    const filename = `${prefix}_${Date.now()}.${fileType}`
    const result = await uploadMedia(
      { source: imageData, filename },
      { subfolder: 'threed', type: 'temp' }
    )

    if (!result.success) {
      const err = `Error uploading temp file: ${result.error}`
      useToastStore().addAlert(err)
      throw new Error(err)
    }

    return result.response
  }

  static readonly MAX_UPLOAD_SIZE_MB = 100

  static async uploadFile(file: File, subfolder: string) {
    const result = await uploadMedia(
      { source: file },
      { subfolder, maxSizeMB: this.MAX_UPLOAD_SIZE_MB }
    )

    if (!result.success) {
      if (result.error?.includes('exceeds maximum')) {
        const fileSizeMB = file.size / 1024 / 1024
        const message = t('toastMessages.fileTooLarge', {
          size: fileSizeMB.toFixed(1),
          maxSize: this.MAX_UPLOAD_SIZE_MB
        })
        console.warn(
          '[Load3D] uploadFile: file too large',
          fileSizeMB.toFixed(2),
          'MB'
        )
        useToastStore().addAlert(message)
      } else {
        console.error('[Load3D] uploadFile: exception', result.error)
        useToastStore().addAlert(
          result.error || t('toastMessages.fileUploadFailed')
        )
      }
      return undefined
    }

    return result.path
  }

  static getFilenameExtension(url: string): string | undefined {
    const queryString = url.split('?')[1]
    if (queryString) {
      const filename = new URLSearchParams(queryString).get('filename')
      if (filename) return filename.split('.').pop()?.toLowerCase()
    }
    return url.split('?')[0].split('.').pop()?.toLowerCase()
  }

  static splitFilePath(path: string): [string, string] {
    const folder_separator = path.lastIndexOf('/')
    if (folder_separator === -1) {
      return ['', path]
    }
    return [
      path.substring(0, folder_separator),
      path.substring(folder_separator + 1)
    ]
  }

  static getResourceURL(
    subfolder: string,
    filename: string,
    type: string = 'input'
  ): string {
    const params = [
      'filename=' + encodeURIComponent(filename),
      'type=' + type,
      'subfolder=' + subfolder,
      app.getRandParam().substring(1)
    ].join('&')

    return `/view?${params}`
  }

  static async uploadMultipleFiles(
    files: FileList,
    subfolder: string = '3d'
  ): Promise<string[]> {
    const uploadPromises = Array.from(files).map((file) =>
      this.uploadFile(file, subfolder)
    )

    const results = await Promise.all(uploadPromises)
    return results.filter((path): path is string => path !== undefined)
  }

  static mapSceneLightIntensityToHdri(
    sceneIntensity: number,
    sceneMin: number,
    sceneMax: number
  ): number {
    const span = sceneMax - sceneMin
    const t = span > 0 ? (sceneIntensity - sceneMin) / span : 0
    const clampedT = Math.min(1, Math.max(0, t))
    const mapped = clampedT * 5
    const minHdri = 0.25
    return Math.min(5, Math.max(minHdri, mapped))
  }
}

export default Load3dUtils
