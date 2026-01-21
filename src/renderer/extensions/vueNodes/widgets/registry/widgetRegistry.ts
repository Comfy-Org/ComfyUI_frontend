/**
 * Widget type registry and component mapping for Vue-based widgets
 */
import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import type { VueWidgetDefinition } from '@/types/comfy'

const WidgetButton = defineAsyncComponent(
  () => import('../components/WidgetButton.vue')
)
const WidgetInputText = defineAsyncComponent(
  () => import('../components/WidgetInputText.vue')
)
const WidgetInputNumber = defineAsyncComponent(
  () => import('../components/WidgetInputNumber.vue')
)
const WidgetToggleSwitch = defineAsyncComponent(
  () => import('../components/WidgetToggleSwitch.vue')
)
const WidgetSelect = defineAsyncComponent(
  () => import('../components/WidgetSelect.vue')
)
const WidgetColorPicker = defineAsyncComponent(
  () => import('../components/WidgetColorPicker.vue')
)
const WidgetTextarea = defineAsyncComponent(
  () => import('../components/WidgetTextarea.vue')
)
const WidgetChart = defineAsyncComponent(
  () => import('../components/WidgetChart.vue')
)
const WidgetImageCompare = defineAsyncComponent(
  () => import('../components/WidgetImageCompare.vue')
)
const WidgetGalleria = defineAsyncComponent(
  () => import('../components/WidgetGalleria.vue')
)
const WidgetMarkdown = defineAsyncComponent(
  () => import('../components/WidgetMarkdown.vue')
)
const WidgetLegacy = defineAsyncComponent(
  () => import('../components/WidgetLegacy.vue')
)
const WidgetRecordAudio = defineAsyncComponent(
  () => import('../components/WidgetRecordAudio.vue')
)
const AudioPreviewPlayer = defineAsyncComponent(
  () => import('../components/audio/AudioPreviewPlayer.vue')
)
const WidgetAudioUI = defineAsyncComponent(
  () => import('../components/WidgetAudioUI.vue')
)
const Load3D = defineAsyncComponent(
  () => import('@/components/load3d/Load3D.vue')
)
const WidgetImageCrop = defineAsyncComponent(
  () => import('@/components/imagecrop/WidgetImageCrop.vue')
)
const WidgetBoundingBox = defineAsyncComponent(
  () => import('@/components/boundingbox/WidgetBoundingBox.vue')
)

export const FOR_TESTING = {
  WidgetAudioUI,
  WidgetButton,
  WidgetColorPicker,
  WidgetInputNumber,
  WidgetInputText,
  WidgetMarkdown,
  WidgetSelect,
  WidgetTextarea,
  WidgetToggleSwitch
} as const

interface WidgetDefinition {
  component: Component
  aliases: string[]
  essential: boolean
}

const coreWidgetDefinitions: Array<[string, WidgetDefinition]> = [
  [
    'button',
    { component: WidgetButton, aliases: ['BUTTON'], essential: false }
  ],
  [
    'string',
    {
      component: WidgetInputText,
      aliases: ['STRING', 'text'],
      essential: false
    }
  ],
  ['int', { component: WidgetInputNumber, aliases: ['INT'], essential: true }],
  [
    'float',
    {
      component: WidgetInputNumber,
      aliases: ['FLOAT', 'number', 'slider'],
      essential: true
    }
  ],
  [
    'boolean',
    {
      component: WidgetToggleSwitch,
      aliases: ['BOOLEAN', 'toggle'],
      essential: true
    }
  ],
  [
    'combo',
    { component: WidgetSelect, aliases: ['COMBO', 'asset'], essential: true }
  ],
  [
    'color',
    { component: WidgetColorPicker, aliases: ['COLOR'], essential: false }
  ],
  [
    'textarea',
    {
      component: WidgetTextarea,
      aliases: ['TEXTAREA', 'multiline', 'customtext'],
      essential: false
    }
  ],
  ['chart', { component: WidgetChart, aliases: ['CHART'], essential: false }],
  [
    'imagecompare',
    {
      component: WidgetImageCompare,
      aliases: ['IMAGECOMPARE'],
      essential: false
    }
  ],
  [
    'galleria',
    { component: WidgetGalleria, aliases: ['GALLERIA'], essential: false }
  ],
  [
    'markdown',
    {
      component: WidgetMarkdown,
      aliases: ['MARKDOWN', 'progressText'],
      essential: false
    }
  ],
  ['legacy', { component: WidgetLegacy, aliases: [], essential: true }],
  [
    'audiorecord',
    {
      component: WidgetRecordAudio,
      aliases: ['AUDIO_RECORD', 'AUDIORECORD'],
      essential: false
    }
  ],
  [
    'audioUI',
    {
      component: AudioPreviewPlayer,
      aliases: ['AUDIOUI', 'AUDIO_UI'],
      essential: false
    }
  ],
  ['load3D', { component: Load3D, aliases: ['LOAD_3D'], essential: false }],
  [
    'imagecrop',
    {
      component: WidgetImageCrop,
      aliases: ['IMAGECROP'],
      essential: false
    }
  ],
  [
    'boundingbox',
    {
      component: WidgetBoundingBox,
      aliases: ['BOUNDINGBOX'],
      essential: false
    }
  ]
]

const getComboWidgetAdditions = (): Map<string, Component> => {
  return new Map([['audio', WidgetAudioUI]])
}

// Build lookup maps for core widgets
const coreWidgets = new Map<string, WidgetDefinition>()
const coreAliasMap = new Map<string, string>()

for (const [type, def] of coreWidgetDefinitions) {
  coreWidgets.set(type, def)
  for (const alias of def.aliases) {
    coreAliasMap.set(alias, type)
  }
}

// Extension-registered widgets (mutable, takes precedence over core)
const extensionWidgets = new Map<string, VueWidgetDefinition>()
const extensionAliasMap = new Map<string, string>()

/**
 * Register custom Vue widgets from extensions.
 * Extension widgets take precedence over core widgets for type lookup.
 */
export function registerVueWidgets(
  widgets: Record<string, VueWidgetDefinition>
): void {
  for (const [type, def] of Object.entries(widgets)) {
    extensionWidgets.set(type, def)
    for (const alias of def.aliases ?? []) {
      extensionAliasMap.set(alias, type)
    }
  }
}

/**
 * Clear all extension-registered widgets. Useful for testing.
 */
export function clearExtensionWidgets(): void {
  extensionWidgets.clear()
  extensionAliasMap.clear()
}

// Utility functions - extension aliases take precedence
const getCanonicalType = (type: string): string =>
  extensionAliasMap.get(type) ?? coreAliasMap.get(type) ?? type

export const getComponent = (
  type: string,
  name: string,
  displayHint?: string
): Component | null => {
  // Check display hint first for custom Vue widgets
  // This allows extensions to override widget rendering via the "display" field
  if (displayHint) {
    const displayCanonical = getCanonicalType(displayHint)
    const extDef = extensionWidgets.get(displayCanonical)
    if (extDef) {
      return extDef.component
    }
  }

  // Handle combo additions (existing logic)
  if (type === 'combo') {
    const comboAdditions = getComboWidgetAdditions()
    if (comboAdditions.has(name)) {
      return comboAdditions.get(name) ?? null
    }
  }

  const canonicalType = getCanonicalType(type)

  // Extension widgets take precedence over core widgets
  const extDef = extensionWidgets.get(canonicalType)
  if (extDef) {
    return extDef.component
  }

  // Fall back to core widgets
  return coreWidgets.get(canonicalType)?.component ?? null
}

export const isEssential = (type: string): boolean => {
  const canonicalType = getCanonicalType(type)
  return coreWidgets.get(canonicalType)?.essential ?? false
}

export const shouldRenderAsVue = (widget: Partial<SafeWidgetData>): boolean => {
  return !widget.options?.canvasOnly && !!widget.type
}

const EXPANDING_TYPES = ['textarea', 'markdown', 'load3D'] as const

export function shouldExpand(type: string): boolean {
  const canonicalType = getCanonicalType(type)
  return EXPANDING_TYPES.includes(
    canonicalType as (typeof EXPANDING_TYPES)[number]
  )
}
