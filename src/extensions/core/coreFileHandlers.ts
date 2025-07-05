/**
 * Core file handlers registration for ComfyUI
 * This file registers all built-in file handlers with the fileHandlerStore
 */
import { useFileHandlerStore } from '@/stores/fileHandlerStore'
import {
  handlePngFile,
  handleWebpFile,
  handleSvgFile,
  handleJsonFile,
  handleMp3File,
  handleOggFile,
  handleFlacFile,
  handleWebmFile,
  handleMp4File,
  handleGlbFile,
  handleLatentFile
} from '@/utils/fileHandlers'

/**
 * Register all core file handlers with the store
 */
export function registerCoreFileHandlers() {
  const fileHandlerStore = useFileHandlerStore()

  // Image handlers
  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.png',
    displayName: 'PNG Image',
    mimeTypes: ['image/png'],
    extensions: ['.png'],
    handler: handlePngFile
  })

  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.webp',
    displayName: 'WebP Image',
    mimeTypes: ['image/webp'],
    extensions: ['.webp'],
    handler: handleWebpFile
  })

  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.svg',
    displayName: 'SVG Image',
    mimeTypes: ['image/svg+xml'],
    extensions: ['.svg'],
    handler: handleSvgFile
  })

  // Audio handlers
  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.mp3',
    displayName: 'MP3 Audio',
    mimeTypes: ['audio/mpeg'],
    extensions: ['.mp3'],
    handler: handleMp3File
  })

  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.ogg',
    displayName: 'OGG Audio',
    mimeTypes: ['audio/ogg'],
    extensions: ['.ogg'],
    handler: handleOggFile
  })

  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.flac',
    displayName: 'FLAC Audio',
    mimeTypes: ['audio/flac', 'audio/x-flac'],
    extensions: ['.flac'],
    handler: handleFlacFile
  })

  // Video handlers
  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.webm',
    displayName: 'WebM Video',
    mimeTypes: ['video/webm'],
    extensions: ['.webm'],
    handler: handleWebmFile
  })

  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.mp4',
    displayName: 'MP4 Video',
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-m4v'],
    extensions: ['.mp4', '.mov', '.m4v'],
    handler: handleMp4File
  })

  // Model handlers
  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.glb',
    displayName: 'GLB 3D Model',
    mimeTypes: ['model/gltf-binary'],
    extensions: ['.glb'],
    handler: handleGlbFile
  })

  // Data handlers
  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.json',
    displayName: 'JSON Data',
    mimeTypes: ['application/json'],
    extensions: ['.json'],
    handler: handleJsonFile
  })

  fileHandlerStore.registerFileHandler({
    id: 'comfy.fileHandler.latent',
    displayName: 'Latent/Safetensors',
    mimeTypes: [],
    extensions: ['.latent', '.safetensors'],
    handler: handleLatentFile
  })
}