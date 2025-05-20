import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { t } from '@/i18n'
import { api } from '@/scripts/api'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useToastStore } from '@/stores/toastStore'
import { addToComboValues } from '@/utils/litegraphUtil'

// Support only txt and pdf files
const isTextFile = (file: File): boolean =>
  file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')

const isPdfFile = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const isSupportedFile = (file: File): boolean =>
  isTextFile(file) || isPdfFile(file)

// Upload a text file and return the file path
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

    // Get the name of the text input widget from the spec
    const textInputName = inputData[1].textInputName as string

    // Find the combo widget that will store the file path
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

    // Handle the file upload
    const handleFileUpload = async (files: File[]): Promise<File[]> => {
      if (!files.length) return files

      const file = files[0]
      if (!isSupportedFile(file)) {
        useToastStore().addAlert(t('toastMessages.invalidFileType'))
        return files
      }

      const path = await uploadTextFile(file)
      if (path && textWidget) {
        addToComboValues(textWidget, path)
        textWidget.value = path
        if (textWidget.callback) {
          textWidget.callback(path)
        }
      }

      return files
    }

    // Set up file input for upload button
    const { openFileSelection } = useNodeFileInput(node, {
      accept: '.txt,.pdf,text/plain,application/pdf',
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

    uploadWidget.label = t('g.choose_file_to_upload')

    return { widget: uploadWidget }
  }
}
