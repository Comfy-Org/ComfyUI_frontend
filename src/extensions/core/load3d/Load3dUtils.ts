import { t } from '@/i18n'
import { uploadMedia } from '@/platform/assets/services/uploadService'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
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

    if (!result.success || !result.response) {
      const err = t('toastMessages.tempUploadFailed', {
        error: result.error || ''
      })
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
}

export default Load3dUtils
