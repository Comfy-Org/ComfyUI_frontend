import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useToastStore } from '@/stores/toastStore'

useExtensionService().registerExtension({
  name: 'Comfy.FetchApi',

  async nodeCreated(node) {
    if (node.constructor.comfyClass !== 'FetchApi') return

    const onExecuted = node.onExecuted
    const msg = t('toastMessages.unableToFetchFile')

    const downloadFile = async (
      typeValue: string,
      subfolderValue: string,
      filenameValue: string
    ) => {
      try {
        const params = [
          'filename=' + encodeURIComponent(filenameValue),
          'type=' + encodeURIComponent(typeValue),
          'subfolder=' + encodeURIComponent(subfolderValue),
          app.getRandParam().substring(1)
        ].join('&')

        const fetchURL = `/view?${params}`
        const response = await api.fetchApi(fetchURL)

        if (!response.ok) {
          console.error(response)
          useToastStore().addAlert(msg)
          return false
        }

        const blob = await response.blob()
        const downloadFilename = filenameValue

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = downloadFilename

        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        window.URL.revokeObjectURL(url)

        return true
      } catch (error) {
        console.error(error)
        useToastStore().addAlert(msg)
        return false
      }
    }

    const type = node.widgets?.find((w) => w.name === 'type')
    const subfolder = node.widgets?.find((w) => w.name === 'subfolder')
    const filename = node.widgets?.find((w) => w.name === 'filename')

    node.onExecuted = function (message: any) {
      onExecuted?.apply(this, arguments as any)

      const typeInput = message.result[0]
      const subfolderInput = message.result[1]
      const filenameInput = message.result[2]
      const autoDownload = node.widgets?.find((w) => w.name === 'auto_download')

      if (type && subfolder && filename) {
        type.value = typeInput
        subfolder.value = subfolderInput
        filename.value = filenameInput

        if (autoDownload && autoDownload.value) {
          downloadFile(typeInput, subfolderInput, filenameInput)
        }
      }
    }

    node.addWidget('button', 'download', 'download', async () => {
      if (type && subfolder && filename) {
        await downloadFile(
          type.value as string,
          subfolder.value as string,
          filename.value as string
        )
      } else {
        console.error(msg)
        useToastStore().addAlert(msg)
      }
    })
  }
})
