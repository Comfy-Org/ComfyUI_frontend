<script setup lang="ts">
import { computed } from 'vue'
import type { LinearStep } from '@/types/linear'
import type { WidgetDefinition } from '@/types/node'
import WidgetSlider from '@/components/v2/nodes/widgets/WidgetSlider.vue'
import WidgetNumber from '@/components/v2/nodes/widgets/WidgetNumber.vue'
import WidgetText from '@/components/v2/nodes/widgets/WidgetText.vue'
import WidgetSelect from '@/components/v2/nodes/widgets/WidgetSelect.vue'
import WidgetToggle from '@/components/v2/nodes/widgets/WidgetToggle.vue'

interface Props {
  step: LinearStep
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:widget': [widgetName: string, value: unknown]
}>()

// Get only the exposed widgets from the step definition
const exposedWidgets = computed(() => {
  if (!props.step.definition) return []

  return props.step.definition.widgets.filter((widget) =>
    props.step.exposedWidgets.includes(widget.name)
  )
})

function getWidgetValue(widgetName: string): unknown {
  return props.step.widgetValues[widgetName]
}

function updateWidget(widgetName: string, value: unknown): void {
  emit('update:widget', widgetName, value)
}

function getWidgetComponent(type: WidgetDefinition['type']): unknown {
  switch (type) {
    case 'slider':
      return WidgetSlider
    case 'number':
      return WidgetNumber
    case 'text':
    case 'textarea':
      return WidgetText
    case 'select':
      return WidgetSelect
    case 'toggle':
      return WidgetToggle
    default:
      return WidgetText
  }
}
</script>

<template>
  <div class="parameter-panel">
    <!-- Panel header -->
    <div class="panel-header">
      <div class="header-icon">
        <i :class="['pi', step.icon ?? 'pi-cog']" />
      </div>
      <div class="header-content">
        <h3 class="panel-title">{{ step.displayName }}</h3>
        <p v-if="step.description" class="panel-description">
          {{ step.description }}
        </p>
      </div>
    </div>

    <!-- Widget list -->
    <div class="widgets-container">
      <div
        v-for="widget in exposedWidgets"
        :key="widget.name"
        class="widget-row"
      >
        <label class="widget-label">
          {{ widget.label ?? widget.name }}
        </label>

        <!-- Textarea gets special treatment -->
        <div v-if="widget.type === 'textarea'" class="widget-textarea">
          <textarea
            :value="String(getWidgetValue(widget.name) ?? '')"
            :placeholder="widget.options?.placeholder"
            class="textarea-input"
            rows="4"
            @input="updateWidget(widget.name, ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <!-- Other widgets use the component system -->
        <component
          v-else
          :is="getWidgetComponent(widget.type)"
          :widget="widget"
          :model-value="getWidgetValue(widget.name)"
          :multiline="widget.type === 'textarea'"
          @update:model-value="updateWidget(widget.name, $event)"
        />
      </div>

      <!-- Empty state -->
      <div v-if="!exposedWidgets.length" class="empty-state">
        <i class="pi pi-cog text-zinc-600" />
        <span>No parameters to configure</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.parameter-panel {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #1f1f23;
  border-bottom: 1px solid #27272a;
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  flex-shrink: 0;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 4px;
}

.panel-description {
  font-size: 13px;
  color: #71717a;
  margin: 0;
  line-height: 1.4;
}

.widgets-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.widget-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.widget-label {
  font-size: 12px;
  font-weight: 500;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.widget-textarea {
  width: 100%;
}

.textarea-input {
  width: 100%;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  color: #fafafa;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
  outline: none;
  transition: border-color 0.2s;
}

.textarea-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.textarea-input::placeholder {
  color: #52525b;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #52525b;
  font-size: 13px;
}

/* Override widget styles for larger linear mode display */
:deep(.widget-slider) {
  gap: 12px;
}

:deep(.custom-slider) {
  height: 6px;
}

:deep(.custom-slider::-webkit-slider-thumb) {
  width: 18px;
  height: 18px;
}

:deep(.number-input) {
  width: 72px;
  padding: 6px 8px;
  font-size: 13px;
}

:deep(.custom-select) {
  padding: 10px 32px 10px 12px;
  font-size: 13px;
}

:deep(.custom-input) {
  padding: 10px 12px;
  font-size: 13px;
}
</style>
