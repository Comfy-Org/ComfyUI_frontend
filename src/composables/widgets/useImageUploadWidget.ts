import type { LGraphNode } from '@comfyorg/litegraph'
import { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { useNodeImage } from '@/composables/useNodeImage'
import { useNodeImageUpload } from '@/composables/useNodeImageUpload'
import { useValueTransform } from '@/composables/useValueTransform'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import type { ComfyApp } from '@/types'
import type { InputSpec, ResultItem } from '@/types/apiTypes'
import { createAnnotatedPath } from '@/utils/formatUtil'
import { addToComboValues } from '@/utils/litegraphUtil'

type InternalFile = string | ResultItem
type InternalValue = InternalFile | InternalFile[]
type ExposedValue = string | string[]

const isImageFile = (file: File) => file.type.startsWith('image/')

const findFileComboWidget = (node: LGraphNode, inputName: string) =>
  node.widgets!.find((w) => w.name === inputName) as IComboWidget & {
    value: ExposedValue
  }

export const useImageUploadWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec,
    app: ComfyApp
  ) => {
    const inputOptions = inputData[1] ?? {}
    const { imageInputName, allow_batch, image_folder = 'input' } = inputOptions

    const { showImage } = useNodeImage(node)

    const fileComboWidget = findFileComboWidget(node, imageInputName)
    const initialFile = `${fileComboWidget.value}`
    const formatPath = (value: InternalFile) =>
      createAnnotatedPath(value, { rootFolder: image_folder })

    const transform = (internalValue: InternalValue): ExposedValue => {
      if (!internalValue) return initialFile
      if (Array.isArray(internalValue))
        return allow_batch
          ? internalValue.map(formatPath)
          : formatPath(internalValue[0])
      return formatPath(internalValue)
    }

    Object.defineProperty(
      fileComboWidget,
      'value',
      useValueTransform(transform, initialFile)
    )

    // Setup file upload handling
    const { openFileSelection } = useNodeImageUpload(node, {
      allow_batch,
      fileFilter: isImageFile,
      onUploadComplete: (output) => {
        output.forEach((path) => addToComboValues(fileComboWidget, path))
        // @ts-expect-error litegraph combo value type does not support arrays yet
        fileComboWidget.value = output
        fileComboWidget.callback?.(output)
      }
    })

    // Create the button widget for selecting the files
    const uploadWidget = node.addWidget('button', inputName, 'image', () =>
      openFileSelection()
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
