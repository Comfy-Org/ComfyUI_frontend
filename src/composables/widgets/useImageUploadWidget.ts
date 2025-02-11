import type { LGraphNode } from '@comfyorg/litegraph'
import type { IStringWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { api } from '@/scripts/api'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useToastStore } from '@/stores/toastStore'
import type { ComfyApp } from '@/types'
import type { InputSpec } from '@/types/apiTypes'

export const useImageUploadWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp
  ) => {
    const imageWidget = node.widgets?.find(
      (w) => w.name === (inputData[1]?.widget ?? 'image')
    ) as IStringWidget
    const { image_folder = 'input' } = inputData[1] ?? {}

    function showImage(name: string) {
      const img = new Image()
      img.onload = () => {
        node.imgs = [img]
        app.graph.setDirtyCanvas(true)
      }
      const folder_separator = name.lastIndexOf('/')
      let subfolder = ''
      if (folder_separator > -1) {
        subfolder = name.substring(0, folder_separator)
        name = name.substring(folder_separator + 1)
      }
      img.src = api.apiURL(
        `/view?filename=${encodeURIComponent(name)}&type=${image_folder}&subfolder=${subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`
      )
      node.setSizeForImage?.()
    }

    const default_value = imageWidget.value
    Object.defineProperty(imageWidget, 'value', {
      set: function (value) {
        this._real_value = value
      },

      get: function () {
        if (!this._real_value) {
          return default_value
        }

        let value = this._real_value
        if (value.filename) {
          const real_value = value
          value = ''
          if (real_value.subfolder) {
            value = real_value.subfolder + '/'
          }

          value += real_value.filename

          if (real_value.type && real_value.type !== 'input')
            value += ` [${real_value.type}]`
        }
        return value
      }
    })

    // Add our own callback to the combo widget to render an image when it changes
    // TODO: Explain this?
    // @ts-expect-error LGraphNode.callback is not typed
    const cb = node.callback
    imageWidget.callback = function (...args) {
      showImage(imageWidget.value)
      if (cb) {
        return cb.apply(this, args)
      }
    }

    // On load if we have a value then render the image
    // The value isnt set immediately so we need to wait a moment
    // No change callbacks seem to be fired on initial setting of the value
    requestAnimationFrame(() => {
      if (imageWidget.value) {
        showImage(imageWidget.value)
      }
    })

    // Add types for upload parameters
    async function uploadFile(file: File, updateNode: boolean, pasted = false) {
      try {
        // Wrap file in formdata so it includes filename
        const body = new FormData()
        body.append('image', file)
        if (pasted) body.append('subfolder', 'pasted')
        const resp = await api.fetchApi('/upload/image', {
          method: 'POST',
          body
        })

        if (resp.status === 200) {
          const data = await resp.json()
          // Add the file to the dropdown list and update the widget value
          let path = data.name
          if (data.subfolder) path = data.subfolder + '/' + path

          if (!imageWidget.options) {
            imageWidget.options = { values: [] }
          }
          if (!imageWidget.options.values) {
            imageWidget.options.values = []
          }
          if (!imageWidget.options.values.includes(path)) {
            imageWidget.options.values.push(path)
          }

          if (updateNode) {
            showImage(path)
            imageWidget.value = path
          }
        } else {
          useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
        }
      } catch (error) {
        useToastStore().addAlert(String(error))
      }
    }

    const fileInput = document.createElement('input')
    Object.assign(fileInput, {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      style: 'display: none',
      onchange: async () => {
        // Add null check for files
        if (fileInput.files && fileInput.files.length) {
          await uploadFile(fileInput.files[0], true)
        }
      }
    })
    document.body.append(fileInput)

    // Create the button widget for selecting the files
    const uploadWidget = node.addWidget('button', inputName, 'image', () => {
      fileInput.click()
    })
    uploadWidget.label = 'choose file to upload'
    // @ts-expect-error IWidget.serialize is not typed
    uploadWidget.serialize = false

    // Add handler to check if an image is being dragged over our node
    node.onDragOver = function (e: DragEvent) {
      if (e.dataTransfer && e.dataTransfer.items) {
        const image = [...e.dataTransfer.items].find((f) => f.kind === 'file')
        return !!image
      }

      return false
    }

    // On drop upload files
    node.onDragDrop = function (e: DragEvent) {
      console.log('onDragDrop called')
      let handled = false
      if (e.dataTransfer?.files) {
        for (const file of e.dataTransfer.files) {
          if (file.type.startsWith('image/')) {
            uploadFile(file, !handled)
            handled = true
          }
        }
      }
      return handled
    }

    node.pasteFile = function (file: File) {
      if (file.type.startsWith('image/')) {
        const is_pasted =
          file.name === 'image.png' && file.lastModified - Date.now() < 2000
        uploadFile(file, true, is_pasted)
        return true
      }
      return false
    }

    return { widget: uploadWidget }
  }

  return widgetConstructor
}
