import { getFromWebmFile } from '@/scripts/metadata/ebml'
import { getGltfBinaryMetadata } from '@/scripts/metadata/gltf'
import { getFromIsobmffFile } from '@/scripts/metadata/isobmff'
import { getDataFromJSON } from '@/scripts/metadata/json'
import { getMp3Metadata } from '@/scripts/metadata/mp3'
import { getOggMetadata } from '@/scripts/metadata/ogg'
import { getSvgMetadata } from '@/scripts/metadata/svg'
import {
  getAvifMetadata,
  getWebpMetadata,
  getFlacMetadata,
  getLatentMetadata,
  getPngMetadata
} from '@/scripts/pnginfo'

export async function getWorkflowDataFromFile(
  file: File
): Promise<Record<string, string | object> | undefined> {
  if (file.type === 'image/png') {
    return await getPngMetadata(file)
  }
  if (file.type === 'image/avif') {
    return await getAvifMetadata(file)
  }
  if (file.type === 'image/webp') {
    const pngInfo = await getWebpMetadata(file)
    // Support loading workflows from that webp custom node.
    const workflow = pngInfo?.workflow || pngInfo?.Workflow
    const prompt = pngInfo?.prompt || pngInfo?.Prompt
    return { workflow, prompt }
  }
  if (file.type === 'audio/mpeg') {
    return await getMp3Metadata(file)
  }
  if (file.type === 'audio/ogg') {
    return await getOggMetadata(file)
  }
  if (file.type === 'audio/flac' || file.type === 'audio/x-flac') {
    const pngInfo = await getFlacMetadata(file)
    const workflow = pngInfo?.workflow || pngInfo?.Workflow
    const prompt = pngInfo?.prompt || pngInfo?.Prompt

    return { workflow, prompt }
  }
  if (file.type === 'video/webm') {
    return (await getFromWebmFile(file)) as unknown as Record<string, object>
  }
  if (
    file.name?.endsWith('.mp4') ||
    file.name?.endsWith('.mov') ||
    file.name?.endsWith('.m4v') ||
    file.type === 'video/mp4' ||
    file.type === 'video/quicktime' ||
    file.type === 'video/x-m4v'
  ) {
    return (await getFromIsobmffFile(file)) as unknown as Record<string, object>
  }
  if (file.type === 'image/svg+xml' || file.name?.endsWith('.svg')) {
    return (await getSvgMetadata(file)) as unknown as Record<string, object>
  }
  if (file.type === 'model/gltf-binary' || file.name?.endsWith('.glb')) {
    return (await getGltfBinaryMetadata(file)) as unknown as Record<
      string,
      object
    >
  }
  if (file.name?.endsWith('.latent') || file.name?.endsWith('.safetensors')) {
    return await getLatentMetadata(file)
  }

  if (file.type === 'application/json' || file.name?.endsWith('.json')) {
    return getDataFromJSON(file)
  }
  return
}
