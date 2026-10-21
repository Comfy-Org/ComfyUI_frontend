import { getFromAvifFile } from '@/scripts/metadata/avif'
import { getFromWebmFile } from '@/scripts/metadata/ebml'
import { getFromFlacFile } from '@/scripts/metadata/flac'
import { getGltfBinaryMetadata } from '@/scripts/metadata/gltf'
import { getFromIsobmffFile } from '@/scripts/metadata/isobmff'
import { getDataFromJSON } from '@/scripts/metadata/json'
import { getFromLatentFile } from '@/scripts/metadata/latent'
import { getMp3Metadata } from '@/scripts/metadata/mp3'
import { getOggMetadata } from '@/scripts/metadata/ogg'
import { getFromPngFile } from '@/scripts/metadata/png'
import { getSvgMetadata } from '@/scripts/metadata/svg'
import { getFromWebpFile } from '@/scripts/metadata/webp'
import type { ComfyMetadata } from '@/types/metadataTypes'

export async function getWorkflowDataFromFile(
  file: File
): Promise<ComfyMetadata | Record<string, string | object> | undefined> {
  if (file.type === 'image/png') {
    return await getFromPngFile(file)
  }
  if (file.type === 'image/avif') {
    return await getFromAvifFile(file)
  }
  if (file.type === 'image/webp') {
    const pngInfo = await getFromWebpFile(file)
    const workflow = pngInfo.workflow || pngInfo.Workflow
    const prompt = pngInfo.prompt || pngInfo.Prompt
    return { workflow, prompt }
  }
  if (file.type === 'audio/mpeg') {
    return await getMp3Metadata(file)
  }
  if (file.type === 'audio/ogg') {
    return await getOggMetadata(file)
  }
  if (file.type === 'audio/flac' || file.type === 'audio/x-flac') {
    const pngInfo = await getFromFlacFile(file)
    const workflow = pngInfo.workflow || pngInfo.Workflow
    const prompt = pngInfo.prompt || pngInfo.Prompt

    return { workflow, prompt }
  }
  if (file.type === 'video/webm') {
    return await getFromWebmFile(file)
  }
  if (
    file.name.endsWith('.mp4') ||
    file.name.endsWith('.mov') ||
    file.name.endsWith('.m4v') ||
    file.type === 'video/mp4' ||
    file.type === 'video/quicktime' ||
    file.type === 'video/x-m4v'
  ) {
    return await getFromIsobmffFile(file)
  }
  if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
    return await getSvgMetadata(file)
  }
  if (file.type === 'model/gltf-binary' || file.name.endsWith('.glb')) {
    return await getGltfBinaryMetadata(file)
  }
  if (file.name.endsWith('.latent') || file.name.endsWith('.safetensors')) {
    return await getFromLatentFile(file)
  }

  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    return getDataFromJSON(file)
  }
  return
}
