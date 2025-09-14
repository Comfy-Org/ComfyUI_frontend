/**
 * Widget type registry and component mapping for Vue-based widgets
 */
import type { Component } from 'vue'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import {
  type InputSpec,
  isComboInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'

import WidgetButton from '../components/WidgetButton.vue'
import WidgetChart from '../components/WidgetChart.vue'
import WidgetColorPicker from '../components/WidgetColorPicker.vue'
import WidgetFileUpload from '../components/WidgetFileUpload.vue'
import WidgetGalleria from '../components/WidgetGalleria.vue'
import WidgetImageCompare from '../components/WidgetImageCompare.vue'
import WidgetImageUpload from '../components/WidgetImageUpload.vue'
import WidgetInputNumber from '../components/WidgetInputNumber.vue'
import WidgetInputText from '../components/WidgetInputText.vue'
import WidgetMarkdown from '../components/WidgetMarkdown.vue'
import WidgetMultiSelect from '../components/WidgetMultiSelect.vue'
import WidgetSelect from '../components/WidgetSelect.vue'
import WidgetSelectButton from '../components/WidgetSelectButton.vue'
import WidgetTextarea from '../components/WidgetTextarea.vue'
import WidgetToggleSwitch from '../components/WidgetToggleSwitch.vue'
import WidgetTreeSelect from '../components/WidgetTreeSelect.vue'

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
  ['combo', { component: WidgetSelect, aliases: ['COMBO'], essential: true }],
  [
    'color',
    { component: WidgetColorPicker, aliases: ['COLOR'], essential: false }
  ],
  [
    'multiselect',
    { component: WidgetMultiSelect, aliases: ['MULTISELECT'], essential: false }
  ],
  [
    'selectbutton',
    {
      component: WidgetSelectButton,
      aliases: ['SELECTBUTTON'],
      essential: false
    }
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
    'fileupload',
    {
      component: WidgetFileUpload,
      aliases: ['FILEUPLOAD', 'file'],
      essential: false
    }
  ],
  [
    'treeselect',
    { component: WidgetTreeSelect, aliases: ['TREESELECT'], essential: false }
  ],
  [
    'markdown',
    { component: WidgetMarkdown, aliases: ['MARKDOWN'], essential: false }
  ]
]

// Build lookup maps
const widgets = new Map<string, WidgetDefinition>()
const aliasMap = new Map<string, string>()

for (const [type, def] of coreWidgetDefinitions) {
  widgets.set(type, def)
  for (const alias of def.aliases) {
    aliasMap.set(alias, type)
  }
}

// Utility functions
const getCanonicalType = (type: string): string => aliasMap.get(type) || type

export const getComponent = (type: string): Component | null => {
  const canonicalType = getCanonicalType(type)
  return widgets.get(canonicalType)?.component || null
}

const isSupported = (type: string): boolean => {
  const canonicalType = getCanonicalType(type)
  return widgets.has(canonicalType)
}

export const isEssential = (type: string): boolean => {
  const canonicalType = getCanonicalType(type)
  return widgets.get(canonicalType)?.essential || false
}

export const shouldRenderAsVue = (widget: {
  type?: string
  options?: Record<string, unknown>
  spec?: InputSpec
}): boolean => {
  // Check canvasOnly in both widget options (legacy) and input spec (new system)
  const specCanvasOnly =
    widget.spec && 'canvasOnly' in widget.spec ? widget.spec.canvasOnly : false
  if (widget.options?.canvasOnly || specCanvasOnly) {
    return false
  }
  if (!widget.type) return false
  return isSupported(widget.type)
}

/**
 * Returns the Vue component for a given widget, with special handling for
 * image-capable combo inputs in Vue Nodes.
 */
export const getComponentForWidget = (
  widget: SafeWidgetData
): Component | null => {
  const type = widget.type?.toUpperCase()
  const isImageCombo =
    type === 'COMBO' &&
    widget.spec &&
    isComboInputSpec(widget.spec) &&
    (widget.spec.image_upload ||
      widget.spec.animated_image_upload ||
      widget.spec.video_upload)

  if (isImageCombo) {
    return WidgetImageUpload
  }
  return getComponent(widget.type)
}
