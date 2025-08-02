import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useToastStore } from '@/stores/toastStore'

class Load3dUtils {
  static async uploadTempImage(
    imageData: string,
    prefix: string,
    fileType: string = 'png'
  ) {
    const blob = await fetch(imageData).then((r) => r.blob())
    const name = `${prefix}_${Date.now()}.${fileType}`
    const file = new File([blob], name, {
      type: fileType === 'mp4' ? 'video/mp4' : 'image/png'
    })

    const body = new FormData()
    body.append('image', file)
    body.append('subfolder', 'threed')
    body.append('type', 'temp')

    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    if (resp.status !== 200) {
      const err = `Error uploading temp file: ${resp.status} - ${resp.statusText}`
      useToastStore().addAlert(err)
      throw new Error(err)
    }

    return await resp.json()
  }

  static async uploadFile(file: File) {
    let uploadPath

    try {
      const body = new FormData()
      body.append('image', file)
      body.append('subfolder', '3d')

      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })

      if (resp.status === 200) {
        const data = await resp.json()
        let path = data.name

        if (data.subfolder) {
          path = data.subfolder + '/' + path
        }

        uploadPath = path
      } else {
        useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
      }
    } catch (error) {
      console.error('Upload error:', error)
      useToastStore().addAlert(
        error instanceof Error
          ? error.message
          : t('toastMessages.fileUploadFailed')
      )
    }

    return uploadPath
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
}

export default Load3dUtils
