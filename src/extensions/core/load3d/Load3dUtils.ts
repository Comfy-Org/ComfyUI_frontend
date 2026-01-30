import type Load3d from '@/extensions/core/load3d/Load3d'
import { t } from '@/i18n'
import { uploadMedia } from '@/platform/assets/services/uploadService'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

class Load3dUtils {
  static async generateThumbnailIfNeeded(
    load3d: Load3d,
    modelPath: string,
    folderType: 'input' | 'output'
  ): Promise<void> {
    const [subfolder, filename] = this.splitFilePath(modelPath)
    const thumbnailFilename = this.getThumbnailFilename(filename)

    const exists = await this.fileExists(
      subfolder,
      thumbnailFilename,
      folderType
    )
    if (exists) return

    const imageData = await load3d.captureThumbnail(256, 256)
    await this.uploadThumbnail(
      imageData,
      subfolder,
      thumbnailFilename,
      folderType
    )
  }

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

  static getThumbnailFilename(modelFilename: string): string {
    return `${modelFilename}.png`
  }

  static async fileExists(
    subfolder: string,
    filename: string,
    type: string = 'input'
  ): Promise<boolean> {
    try {
      const url = api.apiURL(this.getResourceURL(subfolder, filename, type))
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  static async uploadThumbnail(
    imageData: string,
    subfolder: string,
    filename: string,
    type: string = 'input'
  ): Promise<boolean> {
    const blob = await fetch(imageData).then((r) => r.blob())
    const file = new File([blob], filename, { type: 'image/png' })

    const body = new FormData()
    body.append('image', file)
    body.append('subfolder', subfolder)
    body.append('type', type)

    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    return resp.status === 200
  }
}

export default Load3dUtils
