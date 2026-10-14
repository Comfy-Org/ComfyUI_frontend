import {
  AudioLines,
  Box,
  Clapperboard,
  Columns2,
  Film,
  Gamepad2,
  Image,
  LayoutGrid,
  ScanFace,
  ShoppingBag,
  SlidersHorizontal,
  Type,
  Video
} from '@lucide/vue'
import type { Component } from 'vue'

import { ALL_WORKFLOWS } from './workflow-categories'

const ICONS: Readonly<Record<string, Component | undefined>> = {
  [ALL_WORKFLOWS]: LayoutGrid,
  'text-to-image': Type,
  'image-to-image': Image,
  'image-to-video': Clapperboard,
  'reference-to-video': Video,
  'video-to-video': Film,
  'face-swap': ScanFace,
  upscale: Columns2,
  audio: AudioLines,
  '3d': Box,
  characters: Gamepad2,
  product: ShoppingBag,
  tools: SlidersHorizontal
}

/** The icon a Workflows category shows in the sidebar and on the Hub home. */
export function workflowCategoryIcon(id: string): Component {
  return ICONS[id] ?? LayoutGrid
}
