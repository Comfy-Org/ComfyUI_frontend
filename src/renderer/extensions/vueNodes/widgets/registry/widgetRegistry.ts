/**
 * Widget type registry and component mapping for Vue-based widgets
 */
import type { Component } from 'vue'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'

import WidgetAudioUI from '../components/WidgetAudioUI.vue'
import WidgetButton from '../components/WidgetButton.vue'
import WidgetChart from '../components/WidgetChart.vue'
import WidgetColorPicker from '../components/WidgetColorPicker.vue'
import WidgetFileUpload from '../components/WidgetFileUpload.vue'
import WidgetGalleria from '../components/WidgetGalleria.vue'
import WidgetImageCompare from '../components/WidgetImageCompare.vue'
import WidgetInputNumber from '../components/WidgetInputNumber.vue'
import WidgetInputText from '../components/WidgetInputText.vue'
import WidgetLegacy from '../components/WidgetLegacy.vue'
import WidgetMarkdown from '../components/WidgetMarkdown.vue'
import WidgetMultiSelect from '../components/WidgetMultiSelect.vue'
import WidgetRecordAudio from '../components/WidgetRecordAudio.vue'
import WidgetSelect from '../components/WidgetSelect.vue'
import WidgetSelectButton from '../components/WidgetSelectButton.vue'
import WidgetTextarea from '../components/WidgetTextarea.vue'
import WidgetToggleSwitch from '../components/WidgetToggleSwitch.vue'
import WidgetTreeSelect from '../components/WidgetTreeSelect.vue'
import AudioPreviewPlayer from '../components/audio/AudioPreviewPlayer.vue'

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
  ]
]

const getComboWidgetAdditions = (): Map<string, Component> => {
  return new Map([['audio', WidgetAudioUI]])
}

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

export const getComponent = (type: string, name: string): Component | null => {
  if (type == 'combo') {
    const comboAdditions = getComboWidgetAdditions()
    if (comboAdditions.has(name)) {
      return comboAdditions.get(name) || null
    }
  }
  const canonicalType = getCanonicalType(type)
  return widgets.get(canonicalType)?.component || null
}

export const isEssential = (type: string): boolean => {
  const canonicalType = getCanonicalType(type)
  return widgets.get(canonicalType)?.essential || false
}

export const shouldRenderAsVue = (widget: Partial<SafeWidgetData>): boolean => {
  return !widget.options?.canvasOnly && !!widget.type
}
