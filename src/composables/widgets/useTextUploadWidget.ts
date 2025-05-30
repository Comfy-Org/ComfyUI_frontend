import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { useValueTransform } from '@/composables/useValueTransform'
import { t } from '@/i18n'
import { api } from '@/scripts/api'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useToastStore } from '@/stores/toastStore'
import { addToComboValues } from '@/utils/litegraphUtil'

const isTextFile = (file: File): boolean =>
  file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')

const isPdfFile = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const isSupportedFile = (file: File): boolean =>
  isTextFile(file) || isPdfFile(file)

/**
 * Upload a text file and return the file path
 * @param file - The file to upload
 * @returns The file path or null if the upload fails
 */
async function uploadTextFile(file: File): Promise<string | null> {
  try {
    const body = new FormData()
    body.append('image', file) // Using standard field name for compatibility

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
      return path
    } else {
      useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    }
  } catch (error) {
    useToastStore().addAlert(String(error))
  }

  return null
}

/**
 * Upload multiple text files and return array of file paths
 * @param files - The files to upload
 * @returns The file paths or an empty array if the upload fails
 */
async function uploadTextFiles(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(uploadTextFile)
  const results = await Promise.all(uploadPromises)
  return results.filter((path) => path !== null)
}

/**
 * Create a text upload widget
 * @returns The widget or an empty button if no valid inputs
 */
export const useTextUploadWidget = (): ComfyWidgetConstructor => {
  return (node, inputName, inputData) => {
    // Early return with empty button if no valid inputs
    if (
      !node.widgets ||
      !inputData[1] ||
      typeof inputData[1].textInputName !== 'string'
    ) {
      const emptyButton = node.addWidget('button', inputName, '', () => {})
      return { widget: emptyButton }
    }

    // Get configuration from input spec
    const textInputName = inputData[1].textInputName as string
    const allow_batch = inputData[1].allow_batch === true

    // Find the combo widget that will store the file path(s)
    const textWidget = node.widgets.find((w) => w.name === textInputName) as
      | IComboWidget
      | undefined

    if (!textWidget) {
      console.error(`Text widget with name "${textInputName}" not found`)
      const fallbackButton = node.addWidget('button', inputName, '', () => {})
      return { widget: fallbackButton }
    }

    // Ensure options and values are initialized
    if (!textWidget.options) {
      textWidget.options = { values: [] }
    } else if (!textWidget.options.values) {
      textWidget.options.values = []
    }

    // Types for internal handling
    type InternalValue = string | string[] | null | undefined
    type ExposedValue = string | string[]

    const initialFile = allow_batch ? [] : ''

    // Transform function to handle batch vs single file outputs
    const transform = (internalValue: InternalValue): ExposedValue => {
      if (!internalValue) return initialFile
      if (Array.isArray(internalValue))
        return allow_batch ? internalValue : internalValue[0] || ''
      return internalValue
    }

    // Set up value transform on the widget
    Object.defineProperty(
      textWidget,
      'value',
      useValueTransform(transform, initialFile)
    )

    // Handle the file upload
    const handleFileUpload = async (files: File[]): Promise<File[]> => {
      if (!files.length) return files

      // Filter supported files
      const supportedFiles = files.filter(isSupportedFile)
      if (!supportedFiles.length) {
        useToastStore().addAlert(t('toastMessages.invalidFileType'))
        return files
      }

      if (!allow_batch && supportedFiles.length > 1) {
        useToastStore().addAlert('Only single file upload is allowed')
        return files
      }

      const filesToUpload = allow_batch ? supportedFiles : [supportedFiles[0]]
      const paths = await uploadTextFiles(filesToUpload)

      if (paths.length && textWidget) {
        paths.forEach((path) => addToComboValues(textWidget, path))
        // @ts-expect-error litegraph combo value type does not support arrays yet
        textWidget.value = allow_batch ? paths : paths[0]
        if (textWidget.callback) {
          textWidget.callback(allow_batch ? paths : paths[0])
        }
      }

      return files
    }

    // Set up file input for upload button
    const { openFileSelection } = useNodeFileInput(node, {
      accept: '.txt,.pdf,text/plain,application/pdf',
      allow_batch,
      onSelect: handleFileUpload
    })

    // Set up drag and drop
    useNodeDragAndDrop(node, {
      fileFilter: isSupportedFile,
      onDrop: handleFileUpload
    })

    // Set up paste
    useNodePaste(node, {
      fileFilter: isSupportedFile,
      allow_batch,
      onPaste: handleFileUpload
    })

    // Create upload button widget
    const uploadWidget = node.addWidget(
      'button',
      inputName,
      '',
      openFileSelection,
      { serialize: false }
    )

    uploadWidget.label = allow_batch
      ? t('g.choose_files_to_upload')
      : t('g.choose_file_to_upload')

    return { widget: uploadWidget }
  }
}
