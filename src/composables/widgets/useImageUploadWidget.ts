import type { LGraphNode } from '@comfyorg/litegraph'
import { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { useNodeImage } from '@/composables/useNodeImage'
import { useNodeImageUpload } from '@/composables/useNodeImageUpload'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import type { ComfyApp } from '@/types'
import type { InputSpec, ResultItem } from '@/types/apiTypes'
import { createAnnotatedPath } from '@/utils/formatUtil'

const isImageFile = (file: File) => file.type.startsWith('image/')

const findFileComboWidget = (node: LGraphNode, inputData: InputSpec) =>
  node.widgets?.find(
    (w) => w.name === (inputData[1]?.widget ?? 'image') && w.type === 'combo'
  ) as IComboWidget & { value: string }

const addToComboValues = (widget: IComboWidget, path: string) => {
  if (!widget.options) widget.options = { values: [] }
  if (!widget.options.values) widget.options.values = []
  if (!widget.options.values.includes(path)) {
    widget.options.values.push(path)
  }
}

export const useImageUploadWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp
  ) => {
    // TODO: specify upload widget via input spec rather than input name
    const fileComboWidget = findFileComboWidget(node, inputData)
    const { allow_batch, image_folder = 'input' } = inputData[1] ?? {}
    const initialFile = `${fileComboWidget.value}`
    const { showImage } = useNodeImage(node, { allowBatch: allow_batch })

    let internalValue: string | ResultItem = initialFile

    // Setup getter/setter that transforms from `ResultItem` to string and formats paths
    Object.defineProperty(fileComboWidget, 'value', {
      set: function (value: string | ResultItem) {
        internalValue = value
      },
      get: function () {
        if (!internalValue) return initialFile
        if (typeof internalValue === 'string')
          return createAnnotatedPath(internalValue, {
            rootFolder: image_folder
          })
        if (!internalValue.filename) return initialFile
        return createAnnotatedPath(internalValue)
      }
    })

    // Setup file upload handling
    const { fileInput } = useNodeImageUpload(node, {
      fileFilter: isImageFile,
      onUploadComplete: (output) => {
        output.forEach((path) => addToComboValues(fileComboWidget, path))
        fileComboWidget.value = output[0]
        fileComboWidget.callback?.(output)
      }
    })

    // Create the button widget for selecting the files
    const uploadWidget = node.addWidget('button', inputName, 'image', () =>
      fileInput.click()
    )
    uploadWidget.label = 'choose file to upload'
    // @ts-expect-error serialize is not typed
    uploadWidget.serialize = false

    // TODO: Explain this?
    // @ts-expect-error LGraphNode.callback is not typed
    // Add our own callback to the combo widget to render an image when it changes
    const cb = node.callback
    fileComboWidget.callback = function (...args) {
      showImage(fileComboWidget.value)
      if (cb) return cb.apply(this, args)
    }

    // On load if we have a value then render the image
    // The value isnt set immediately so we need to wait a moment
    // No change callbacks seem to be fired on initial setting of the value
    requestAnimationFrame(() => {
      showImage(fileComboWidget.value)
    })

    return { widget: uploadWidget }
  }

  return widgetConstructor
}
