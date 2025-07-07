/**
 * Widget type registry and component mapping for Vue-based widgets
 */
import type { Component } from 'vue'

// Component imports
import WidgetButton from './WidgetButton.vue'
import WidgetChart from './WidgetChart.vue'
import WidgetColorPicker from './WidgetColorPicker.vue'
import WidgetFileUpload from './WidgetFileUpload.vue'
import WidgetGalleria from './WidgetGalleria.vue'
import WidgetImage from './WidgetImage.vue'
import WidgetImageCompare from './WidgetImageCompare.vue'
import WidgetInputText from './WidgetInputText.vue'
import WidgetMarkdown from './WidgetMarkdown.vue'
import WidgetMultiSelect from './WidgetMultiSelect.vue'
import WidgetSelect from './WidgetSelect.vue'
import WidgetSelectButton from './WidgetSelectButton.vue'
import WidgetSlider from './WidgetSlider.vue'
import WidgetTextarea from './WidgetTextarea.vue'
import WidgetToggleSwitch from './WidgetToggleSwitch.vue'
import WidgetTreeSelect from './WidgetTreeSelect.vue'

/**
 * Enum of all available widget types
 */
export enum WidgetType {
  BUTTON = 'BUTTON',
  STRING = 'STRING',
  INT = 'INT',
  FLOAT = 'FLOAT',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  COMBO = 'COMBO',
  COLOR = 'COLOR',
  MULTISELECT = 'MULTISELECT',
  SELECTBUTTON = 'SELECTBUTTON',
  SLIDER = 'SLIDER',
  TEXTAREA = 'TEXTAREA',
  TOGGLESWITCH = 'TOGGLESWITCH',
  CHART = 'CHART',
  IMAGE = 'IMAGE',
  IMAGECOMPARE = 'IMAGECOMPARE',
  GALLERIA = 'GALLERIA',
  FILEUPLOAD = 'FILEUPLOAD',
  TREESELECT = 'TREESELECT',
  MARKDOWN = 'MARKDOWN'
}

/**
 * Maps widget types to their corresponding Vue components
 * Components will be added as they are implemented
 */
export const widgetTypeToComponent: Record<string, Component> = {
  // Components will be uncommented as they are implemented
  [WidgetType.BUTTON]: WidgetButton,
  [WidgetType.STRING]: WidgetInputText,
  [WidgetType.INT]: WidgetSlider,
  [WidgetType.FLOAT]: WidgetSlider,
  [WidgetType.NUMBER]: WidgetSlider, // For compatibility
  [WidgetType.BOOLEAN]: WidgetToggleSwitch,
  [WidgetType.COMBO]: WidgetSelect,
  [WidgetType.COLOR]: WidgetColorPicker,
  [WidgetType.MULTISELECT]: WidgetMultiSelect,
  [WidgetType.SELECTBUTTON]: WidgetSelectButton,
  [WidgetType.SLIDER]: WidgetSlider,
  [WidgetType.TEXTAREA]: WidgetTextarea,
  [WidgetType.TOGGLESWITCH]: WidgetToggleSwitch,
  [WidgetType.CHART]: WidgetChart,
  [WidgetType.IMAGE]: WidgetImage,
  [WidgetType.IMAGECOMPARE]: WidgetImageCompare,
  [WidgetType.GALLERIA]: WidgetGalleria,
  [WidgetType.FILEUPLOAD]: WidgetFileUpload,
  [WidgetType.TREESELECT]: WidgetTreeSelect,
  [WidgetType.MARKDOWN]: WidgetMarkdown
}

/**
 * Helper function to get widget component by type
 */
export function getWidgetComponent(type: string): Component | undefined {
  return widgetTypeToComponent[type]
}
