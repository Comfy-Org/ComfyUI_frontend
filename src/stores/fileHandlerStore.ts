import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/schemas/comfyWorkflowSchema'

/**
 * Type for the raw file metadata with lazy parsing
 */
export type WorkflowFileMetadata = {
  workflow?: () => ComfyWorkflowJSON | undefined
  prompt?: () => ComfyApiWorkflow | undefined
  parameters?: string
  jsonTemplateData?: () => unknown
}

/**
 * Type for the file handler function
 */
export type WorkflowFileHandler = (file: File) => Promise<WorkflowFileMetadata>

/**
 * Definition for a file handler including metadata
 */
export interface FileHandlerDefinition {
  id: string
  displayName: string
  mimeTypes?: string[]
  extensions?: string[]
  handler: WorkflowFileHandler
  priority?: number
}

/**
 * Store for managing file handlers that can load workflows from various file formats
 */
export const useFileHandlerStore = defineStore('fileHandler', () => {
  // State
  const handlers = ref<FileHandlerDefinition[]>([])
  const mimeTypeMap = ref(new Map<string, FileHandlerDefinition>())
  const extensionMap = ref(new Map<string, FileHandlerDefinition>())

  // Actions
  function registerFileHandler(definition: FileHandlerDefinition) {
    const existing = handlers.value.find((h) => h.id === definition.id)
    if (existing) {
      console.warn(`File handler ${definition.id} already registered`)
      return
    }

    handlers.value.push(definition)

    // Update MIME type mappings
    definition.mimeTypes?.forEach((mimeType) => {
      const current = mimeTypeMap.value.get(mimeType)
      if (!current || (definition.priority ?? 0) > (current.priority ?? 0)) {
        mimeTypeMap.value.set(mimeType, definition)
      }
    })

    // Update extension mappings
    definition.extensions?.forEach((ext) => {
      const current = extensionMap.value.get(ext)
      if (!current || (definition.priority ?? 0) > (current.priority ?? 0)) {
        extensionMap.value.set(ext, definition)
      }
    })
  }

  function getHandlerForFile(file: File): WorkflowFileHandler | null {
    // Try MIME type first
    if (file.type) {
      const definition = mimeTypeMap.value.get(file.type)
      if (definition) return definition.handler
    }

    // Fall back to extension
    if (file.name) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const definition = extensionMap.value.get(ext)
      if (definition) return definition.handler
    }

    return null
  }

  // Getters
  const registeredHandlers = computed(() => handlers.value)
  const supportedMimeTypes = computed(() =>
    Array.from(mimeTypeMap.value.keys())
  )
  const supportedExtensions = computed(() =>
    Array.from(extensionMap.value.keys())
  )

  return {
    // State (read-only)
    handlers: registeredHandlers,
    supportedMimeTypes,
    supportedExtensions,

    // Actions
    registerFileHandler,
    getHandlerForFile
  }
})