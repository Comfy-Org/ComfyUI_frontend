/**
 * Maps MIME types and file extensions to handler functions for extracting
 * workflow data from various file formats. Uses supportedWorkflowFormats.ts
 * as the source of truth for supported formats.
 */
import {
  AUDIO_WORKFLOW_FORMATS,
  DATA_WORKFLOW_FORMATS,
  IMAGE_WORKFLOW_FORMATS,
  MODEL_WORKFLOW_FORMATS,
  VIDEO_WORKFLOW_FORMATS
} from '@/constants/supportedWorkflowFormats'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@/schemas/comfyWorkflowSchema'
import { getFromWebmFile } from '@/scripts/metadata/ebml'
import { getGltfBinaryMetadata } from '@/scripts/metadata/gltf'
import { getFromIsobmffFile } from '@/scripts/metadata/isobmff'
import { getMp3Metadata } from '@/scripts/metadata/mp3'
import { getOggMetadata } from '@/scripts/metadata/ogg'
import { getSvgMetadata } from '@/scripts/metadata/svg'
import {
  getFlacMetadata,
  getLatentMetadata,
  getPngMetadata,
  getWebpMetadata
} from '@/scripts/pnginfo'

/**
 * Type for the file handler function
 */
export type WorkflowFileHandler = (file: File) => Promise<{
  workflow?: ComfyWorkflowJSON
  prompt?: ComfyApiWorkflow
  parameters?: string
  jsonTemplateData?: any // For template JSON data
}>

/**
 * Maps MIME types to file handlers for loading workflows from different file formats
 */
export const mimeTypeHandlers = new Map<string, WorkflowFileHandler>()

/**
 * Maps file extensions to file handlers for loading workflows
 * Used as a fallback when MIME type detection fails
 */
export const extensionHandlers = new Map<string, WorkflowFileHandler>()

/**
 * Handler for PNG files
 */
const handlePngFile: WorkflowFileHandler = async (file) => {
  const pngInfo = await getPngMetadata(file)
  return {
    workflow: pngInfo?.workflow ? JSON.parse(pngInfo.workflow) : undefined,
    prompt: pngInfo?.prompt ? JSON.parse(pngInfo.prompt) : undefined,
    parameters: pngInfo?.parameters
  }
}

/**
 * Handler for WebP files
 */
const handleWebpFile: WorkflowFileHandler = async (file) => {
  const pngInfo = await getWebpMetadata(file)
  // Support loading workflows from that webp custom node.
  const workflow = pngInfo?.workflow || pngInfo?.Workflow
  const prompt = pngInfo?.prompt || pngInfo?.Prompt

  return {
    workflow: workflow ? JSON.parse(workflow) : undefined,
    prompt: prompt ? JSON.parse(prompt) : undefined
  }
}

/**
 * Handler for SVG files
 */
const handleSvgFile: WorkflowFileHandler = async (file) => {
  const svgInfo = await getSvgMetadata(file)
  return {
    workflow: svgInfo.workflow,
    prompt: svgInfo.prompt
  }
}

/**
 * Handler for MP3 files
 */
const handleMp3File: WorkflowFileHandler = async (file) => {
  const { workflow, prompt } = await getMp3Metadata(file)
  return { workflow, prompt }
}

/**
 * Handler for OGG files
 */
const handleOggFile: WorkflowFileHandler = async (file) => {
  const { workflow, prompt } = await getOggMetadata(file)
  return { workflow, prompt }
}

/**
 * Handler for FLAC files
 */
const handleFlacFile: WorkflowFileHandler = async (file) => {
  const pngInfo = await getFlacMetadata(file)
  const workflow = pngInfo?.workflow || pngInfo?.Workflow
  const prompt = pngInfo?.prompt || pngInfo?.Prompt

  return {
    workflow: workflow ? JSON.parse(workflow) : undefined,
    prompt: prompt ? JSON.parse(prompt) : undefined
  }
}

/**
 * Handler for WebM files
 */
const handleWebmFile: WorkflowFileHandler = async (file) => {
  const webmInfo = await getFromWebmFile(file)
  return {
    workflow: webmInfo.workflow,
    prompt: webmInfo.prompt
  }
}

/**
 * Handler for MP4/MOV/M4V files
 */
const handleMp4File: WorkflowFileHandler = async (file) => {
  const mp4Info = await getFromIsobmffFile(file)
  return {
    workflow: mp4Info.workflow,
    prompt: mp4Info.prompt
  }
}

/**
 * Handler for GLB files
 */
const handleGlbFile: WorkflowFileHandler = async (file) => {
  const gltfInfo = await getGltfBinaryMetadata(file)
  return {
    workflow: gltfInfo.workflow,
    prompt: gltfInfo.prompt
  }
}

/**
 * Handler for JSON files
 */
const handleJsonFile: WorkflowFileHandler = async (file) => {
  // For JSON files, we need to preserve the exact behavior from app.ts
  // This code intentionally mirrors the original implementation
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const readerResult = reader.result as string
        const jsonContent = JSON.parse(readerResult)

        if (jsonContent?.templates) {
          // This case will be handled separately in handleFile
          resolve({
            workflow: undefined,
            prompt: undefined,
            jsonTemplateData: jsonContent
          })
        } else if (isApiJson(jsonContent)) {
          // API JSON format
          resolve({ workflow: undefined, prompt: jsonContent })
        } else {
          // Regular workflow JSON
          resolve({ workflow: JSON.parse(readerResult), prompt: undefined })
        }
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Handler for .latent and .safetensors files
 */
const handleLatentFile: WorkflowFileHandler = async (file) => {
  // Preserve the exact behavior from app.ts for latent files
  const info = await getLatentMetadata(file)

  // Direct port of the original code, preserving behavior for TS compatibility
  if (info && typeof info === 'object' && 'workflow' in info && info.workflow) {
    return {
      workflow: JSON.parse(info.workflow as string),
      prompt: undefined
    }
  } else if (
    info &&
    typeof info === 'object' &&
    'prompt' in info &&
    info.prompt
  ) {
    return {
      workflow: undefined,
      prompt: JSON.parse(info.prompt as string)
    }
  } else {
    return { workflow: undefined, prompt: undefined }
  }
}

/**
 * Helper function to determine if a JSON object is in the API JSON format
 */
function isApiJson(data: unknown) {
  return (
    typeof data === 'object' &&
    data !== null &&
    Object.values(data as Record<string, any>).every((v) => v.class_type)
  )
}

// Register image format handlers
IMAGE_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
  if (mimeType === 'image/png') {
    mimeTypeHandlers.set(mimeType, handlePngFile)
  } else if (mimeType === 'image/webp') {
    mimeTypeHandlers.set(mimeType, handleWebpFile)
  } else if (mimeType === 'image/svg+xml') {
    mimeTypeHandlers.set(mimeType, handleSvgFile)
  }
})

IMAGE_WORKFLOW_FORMATS.extensions.forEach((ext) => {
  if (ext === '.png') {
    extensionHandlers.set(ext, handlePngFile)
  } else if (ext === '.webp') {
    extensionHandlers.set(ext, handleWebpFile)
  } else if (ext === '.svg') {
    extensionHandlers.set(ext, handleSvgFile)
  }
})

// Register audio format handlers
AUDIO_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
  if (mimeType === 'audio/mpeg') {
    mimeTypeHandlers.set(mimeType, handleMp3File)
  } else if (mimeType === 'audio/ogg') {
    mimeTypeHandlers.set(mimeType, handleOggFile)
  } else if (mimeType === 'audio/flac' || mimeType === 'audio/x-flac') {
    mimeTypeHandlers.set(mimeType, handleFlacFile)
  }
})

AUDIO_WORKFLOW_FORMATS.extensions.forEach((ext) => {
  if (ext === '.mp3') {
    extensionHandlers.set(ext, handleMp3File)
  } else if (ext === '.ogg') {
    extensionHandlers.set(ext, handleOggFile)
  } else if (ext === '.flac') {
    extensionHandlers.set(ext, handleFlacFile)
  }
})

// Register video format handlers
VIDEO_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
  if (mimeType === 'video/webm') {
    mimeTypeHandlers.set(mimeType, handleWebmFile)
  } else if (
    mimeType === 'video/mp4' ||
    mimeType === 'video/quicktime' ||
    mimeType === 'video/x-m4v'
  ) {
    mimeTypeHandlers.set(mimeType, handleMp4File)
  }
})

VIDEO_WORKFLOW_FORMATS.extensions.forEach((ext) => {
  if (ext === '.webm') {
    extensionHandlers.set(ext, handleWebmFile)
  } else if (ext === '.mp4' || ext === '.mov' || ext === '.m4v') {
    extensionHandlers.set(ext, handleMp4File)
  }
})

// Register 3D model format handlers
MODEL_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
  if (mimeType === 'model/gltf-binary') {
    mimeTypeHandlers.set(mimeType, handleGlbFile)
  }
})

MODEL_WORKFLOW_FORMATS.extensions.forEach((ext) => {
  if (ext === '.glb') {
    extensionHandlers.set(ext, handleGlbFile)
  }
})

// Register data format handlers
DATA_WORKFLOW_FORMATS.mimeTypes.forEach((mimeType) => {
  if (mimeType === 'application/json') {
    mimeTypeHandlers.set(mimeType, handleJsonFile)
  }
})

DATA_WORKFLOW_FORMATS.extensions.forEach((ext) => {
  if (ext === '.json') {
    extensionHandlers.set(ext, handleJsonFile)
  } else if (ext === '.latent' || ext === '.safetensors') {
    extensionHandlers.set(ext, handleLatentFile)
  }
})

/**
 * Gets the appropriate file handler for a given file based on mime type or extension
 */
export function getFileHandler(file: File): WorkflowFileHandler | null {
  // First try to match by MIME type
  if (file.type && mimeTypeHandlers.has(file.type)) {
    return mimeTypeHandlers.get(file.type) || null
  }

  // If no MIME type match, try to match by file extension
  if (file.name) {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (extension && extensionHandlers.has(extension)) {
      return extensionHandlers.get(extension) || null
    }
  }

  return null
}
