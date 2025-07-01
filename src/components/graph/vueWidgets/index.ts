/**
 * Central export file for all Vue widget components and utilities
 */

// Widget Components
export { default as WidgetButton } from './WidgetButton.vue'
export { default as WidgetChart } from './WidgetChart.vue'
export { default as WidgetColorPicker } from './WidgetColorPicker.vue'
export { default as WidgetFileUpload } from './WidgetFileUpload.vue'
export { default as WidgetGalleria } from './WidgetGalleria.vue'
export { default as WidgetImage } from './WidgetImage.vue'
export { default as WidgetImageCompare } from './WidgetImageCompare.vue'
export { default as WidgetInputText } from './WidgetInputText.vue'
export { default as WidgetMultiSelect } from './WidgetMultiSelect.vue'
export { default as WidgetSelect } from './WidgetSelect.vue'
export { default as WidgetSelectButton } from './WidgetSelectButton.vue'
export { default as WidgetSlider } from './WidgetSlider.vue'
export { default as WidgetTextarea } from './WidgetTextarea.vue'
export { default as WidgetToggleSwitch } from './WidgetToggleSwitch.vue'
export { default as WidgetTreeSelect } from './WidgetTreeSelect.vue'

// Registry and Utilities
export {
  WidgetType,
  widgetTypeToComponent,
  getWidgetComponent
} from './widgetRegistry'
