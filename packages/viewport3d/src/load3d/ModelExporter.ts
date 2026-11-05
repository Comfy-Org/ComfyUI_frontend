import { FBXExporter } from '@comfyorg/fbx-exporter-three'
import type * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter'

import { downloadBlob } from './downloadBlob'

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
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download file (HTTP ${response.status})`)
    }
    const blob = await response.blob()
    downloadBlob(desiredFilename, blob)
  }

  static async exportGLB(
    model: THREE.Object3D,
    filename: string = 'model.glb',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'glb')) {
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new GLTFExporter()

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
  }

  static async exportOBJ(
    model: THREE.Object3D,
    filename: string = 'model.obj',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'obj')) {
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new OBJExporter()

    await new Promise((resolve) => setTimeout(resolve, 50))

    const result = exporter.parse(model)

    await new Promise((resolve) => setTimeout(resolve, 50))

    ModelExporter.saveString(result, filename)
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

    await new Promise((resolve) => setTimeout(resolve, 50))

    const bytes = await exporter.parseAsync(model)

    await new Promise((resolve) => setTimeout(resolve, 50))

    ModelExporter.saveArrayBuffer(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      filename
    )
  }

  static async exportSTL(
    model: THREE.Object3D,
    filename: string = 'model.stl',
    originalURL?: string | null
  ): Promise<void> {
    if (originalURL && ModelExporter.canUseDirectURL(originalURL, 'stl')) {
      return ModelExporter.downloadFromURL(originalURL, filename)
    }

    const exporter = new STLExporter()

    await new Promise((resolve) => setTimeout(resolve, 50))

    const result = exporter.parse(model)

    await new Promise((resolve) => setTimeout(resolve, 50))

    ModelExporter.saveString(result, filename)
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
