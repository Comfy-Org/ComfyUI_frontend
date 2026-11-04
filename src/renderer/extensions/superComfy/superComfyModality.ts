import type { Modality } from '@/renderer/extensions/superComfy/engine/documentSchema'

export const MODALITIES: readonly Modality[] = [
  'image',
  'text',
  'video',
  'audio',
  '3d'
]

const LABEL_KEYS: Record<Modality, string> = {
  image: 'superComfy.modality.image',
  text: 'superComfy.modality.text',
  video: 'superComfy.modality.video',
  audio: 'superComfy.modality.audio',
  '3d': 'superComfy.modality.3d'
}

const ICONS: Record<Modality, string> = {
  image: 'icon-[lucide--image]',
  text: 'icon-[lucide--type]',
  video: 'icon-[lucide--video]',
  audio: 'icon-[lucide--audio-lines]',
  '3d': 'icon-[lucide--box]'
}

export function modalityLabelKey(modality: Modality): string {
  return LABEL_KEYS[modality]
}

export function modalityIcon(modality: Modality): string {
  return ICONS[modality]
}
