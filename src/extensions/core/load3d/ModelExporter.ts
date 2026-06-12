import { FBXExporter } from '@comfyorg/fbx-exporter-three'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter'

import { downloadBlob } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

export class ModelExporter {
  static detectFormatFromURL(url: string): string | null {
    try {
      const filenameParam = new URLSearchParams(url.split('?')[1]).get(
        'filename'
      )
      if (filenameParam) {
        const extension = filenameParam.split('.').pop()?.toLowerCase()
        return extension || null
      }
    } catch (e) {
      console.error('Error parsing URL:', e)
    }
    return null
  }

  static canUseDirectURL(url: string | null, format: string): boolean {
    if (!url) return false

    const urlFormat = ModelExporter.detectFormatFromURL(url)
    if (!urlFormat) return false

    return urlFormat.toLowerCase() === format.toLowerCase()
  }

  static async downloadFromURL(
    url: string,
    desiredFilename: string
  ): Promise<void> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download file (HTTP ${response.status})`)
      }
      const blob = await response.blob()
      downloadBlob(desiredFilename, blob)
    } catch (error) {
      console.error('Error downloading from URL:', error)
      useToastStore().addAlert(t('toastMessages.failedToDownloadFile'))
      throw error
    }
  }

  static async exportGLB(
    model: THREE.Object3D,
    filename: string = 'model.glb',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'glb')) {
      console.log('Using direct URL download for GLB')
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new GLTFExporter()

    try {
      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          model,
          (gltf) => {
            resolve(gltf as ArrayBuffer)
          },
          (error) => {
            reject(error)
          },
          { binary: true }
        )
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      ModelExporter.saveArrayBuffer(result, filename)
    } catch (error) {
      console.error('Error exporting GLB:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToExportModel', { format: 'GLB' })
      )
      throw error
    }
  }

  static async exportOBJ(
    model: THREE.Object3D,
    filename: string = 'model.obj',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'obj')) {
      console.log('Using direct URL download for OBJ')
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new OBJExporter()

    try {
      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = exporter.parse(model)

      await new Promise((resolve) => setTimeout(resolve, 50))

      ModelExporter.saveString(result, filename)
    } catch (error) {
      console.error('Error exporting OBJ:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToExportModel', { format: 'OBJ' })
      )
      throw error
    }
  }

  static async exportFBX(
    model: THREE.Object3D,
    filename: string = 'model.fbx',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'fbx')) {
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new FBXExporter()

    try {
      await new Promise((resolve) => setTimeout(resolve, 50))

      const bytes = await exporter.parseAsync(model)

      await new Promise((resolve) => setTimeout(resolve, 50))

      // FBXExporter returns Uint8Array — wrap into ArrayBuffer for download.
      ModelExporter.saveArrayBuffer(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer,
        filename
      )
    } catch (error) {
      console.error('Error exporting FBX:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToExportModel', { format: 'FBX' })
      )
      throw error
    }
  }

  static async exportSTL(
    model: THREE.Object3D,
    filename: string = 'model.stl',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'stl')) {
      console.log('Using direct URL download for STL')
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new STLExporter()

    try {
      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = exporter.parse(model)

      await new Promise((resolve) => setTimeout(resolve, 50))

      ModelExporter.saveString(result, filename)
    } catch (error) {
      console.error('Error exporting STL:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToExportModel', { format: 'STL' })
      )
      throw error
    }
  }

  static async exportDirect(
    originalURL: string | null | undefined,
    filename: string,
    format: string
  ): Promise<void> {
    if (!originalURL) {
      throw new Error(`No source file available to export as ${format}`)
    }

    return ModelExporter.downloadFromURL(originalURL, filename)
  }

  private static saveArrayBuffer(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    downloadBlob(filename, blob)
  }

  private static saveString(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'text/plain' })
    downloadBlob(filename, blob)
  }
}
