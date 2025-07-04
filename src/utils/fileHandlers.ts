/**
 * File handlers for extracting workflow data from various file formats.
 * This module contains only the handler implementations.
 * Registration is handled through the fileHandlerStore.
 */
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
import type { WorkflowFileHandler } from '@/stores/fileHandlerStore'

/**
 * Handler for PNG files
 */
export const handlePngFile: WorkflowFileHandler = async (file) => {
  const pngInfo = await getPngMetadata(file)
  return {
    workflow: () =>
      pngInfo?.workflow ? JSON.parse(pngInfo.workflow) : undefined,
    prompt: () => (pngInfo?.prompt ? JSON.parse(pngInfo.prompt) : undefined),
    parameters: pngInfo?.parameters
  }
}

/**
 * Handler for WebP files
 */
export const handleWebpFile: WorkflowFileHandler = async (file) => {
  const pngInfo = await getWebpMetadata(file)
  const workflow = pngInfo?.workflow || pngInfo?.Workflow
  const prompt = pngInfo?.prompt || pngInfo?.Prompt

  return {
    workflow: () => (workflow ? JSON.parse(workflow) : undefined),
    prompt: () => (prompt ? JSON.parse(prompt) : undefined)
  }
}

/**
 * Handler for SVG files
 */
export const handleSvgFile: WorkflowFileHandler = async (file) => {
  const svgInfo = await getSvgMetadata(file)
  return {
    workflow: () => svgInfo.workflow,
    prompt: () => svgInfo.prompt
  }
}

/**
 * Handler for MP3 files
 */
export const handleMp3File: WorkflowFileHandler = async (file) => {
  const { workflow, prompt } = await getMp3Metadata(file)
  return {
    workflow: () => workflow,
    prompt: () => prompt
  }
}

/**
 * Handler for OGG files
 */
export const handleOggFile: WorkflowFileHandler = async (file) => {
  const { workflow, prompt } = await getOggMetadata(file)
  return {
    workflow: () => workflow,
    prompt: () => prompt
  }
}

/**
 * Handler for FLAC files
 */
export const handleFlacFile: WorkflowFileHandler = async (file) => {
  const pngInfo = await getFlacMetadata(file)
  const workflow = pngInfo?.workflow || pngInfo?.Workflow
  const prompt = pngInfo?.prompt || pngInfo?.Prompt

  return {
    workflow: () => (workflow ? JSON.parse(workflow) : undefined),
    prompt: () => (prompt ? JSON.parse(prompt) : undefined)
  }
}

/**
 * Handler for WebM files
 */
export const handleWebmFile: WorkflowFileHandler = async (file) => {
  const webmInfo = await getFromWebmFile(file)
  return {
    workflow: () => webmInfo.workflow,
    prompt: () => webmInfo.prompt
  }
}

/**
 * Handler for MP4/MOV/M4V files
 */
export const handleMp4File: WorkflowFileHandler = async (file) => {
  const mp4Info = await getFromIsobmffFile(file)
  return {
    workflow: () => mp4Info.workflow,
    prompt: () => mp4Info.prompt
  }
}

/**
 * Handler for GLB files
 */
export const handleGlbFile: WorkflowFileHandler = async (file) => {
  const gltfInfo = await getGltfBinaryMetadata(file)
  return {
    workflow: () => gltfInfo.workflow,
    prompt: () => gltfInfo.prompt
  }
}

/**
 * Handler for JSON files
 */
export const handleJsonFile: WorkflowFileHandler = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const readerResult = reader.result as string
        resolve({
          workflow: () => JSON.parse(readerResult),
          prompt: () => JSON.parse(readerResult),
          jsonTemplateData: () => JSON.parse(readerResult)
        })
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
export const handleLatentFile: WorkflowFileHandler = async (file) => {
  const info = await getLatentMetadata(file)

  return {
    workflow: () => {
      if (
        info &&
        typeof info === 'object' &&
        'workflow' in info &&
        info.workflow
      ) {
        return JSON.parse(info.workflow as string)
      }
      return undefined
    },
    prompt: () => {
      if (info && typeof info === 'object' && 'prompt' in info && info.prompt) {
        return JSON.parse(info.prompt as string)
      }
      return undefined
    }
  }
}

