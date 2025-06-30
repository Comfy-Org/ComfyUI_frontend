<template>
  <PanelTemplate value="Widget Test" class="widget-test-container">
    <h2 class="text-2xl font-bold mb-4">{{ $t('g.widgetTesting') }}</h2>

    <div class="mb-4 flex gap-4">
      <label class="flex items-center gap-2">
        <input v-model="readonly" type="checkbox" />
        <span>{{ $t('g.readonlyMode') }}</span>
      </label>
    </div>

    <ScrollPanel class="h-[60vh]">
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pr-4">
        <!-- Text Input Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Text Input (STRING)</h3>
          <WidgetInputText
            v-model="widgets.string.value"
            :widget="widgets.string"
            :readonly="readonly"
            @update:model-value="onValueChange('string', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.string.value }}
          </div>
        </div>

        <!-- Textarea Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Textarea</h3>
          <WidgetTextarea
            v-model="widgets.textarea.value"
            :widget="widgets.textarea"
            :readonly="readonly"
            @update:model-value="onValueChange('textarea', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.textarea.value }}
          </div>
        </div>

        <!-- Number Slider Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Number Slider (INT)</h3>
          <WidgetSlider
            v-model="widgets.int.value"
            :widget="widgets.int"
            :readonly="readonly"
            @update:model-value="onValueChange('int', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.int.value }}
          </div>
        </div>

        <!-- Float Slider Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Float Slider</h3>
          <WidgetSlider
            v-model="widgets.float.value"
            :widget="widgets.float"
            :readonly="readonly"
            @update:model-value="onValueChange('float', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.float.value }}
          </div>
        </div>

        <!-- Toggle Switch Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Toggle Switch (BOOLEAN)</h3>
          <WidgetToggleSwitch
            v-model="widgets.boolean.value"
            :widget="widgets.boolean"
            :readonly="readonly"
            @update:model-value="onValueChange('boolean', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.boolean.value }}
          </div>
        </div>

        <!-- Select Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Select (COMBO)</h3>
          <WidgetSelect
            v-model="widgets.combo.value"
            :widget="widgets.combo"
            :readonly="readonly"
            @update:model-value="onValueChange('combo', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.combo.value }}
          </div>
        </div>

        <!-- Multi Select Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Multi Select</h3>
          <WidgetMultiSelect
            v-model="widgets.multiselect.value"
            :widget="widgets.multiselect"
            :readonly="readonly"
            @update:model-value="onValueChange('multiselect', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ JSON.stringify(widgets.multiselect.value) }}
          </div>
        </div>

        <!-- Select Button Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Select Button</h3>
          <WidgetSelectButton
            v-model="widgets.selectbutton.value"
            :widget="widgets.selectbutton"
            :readonly="readonly"
            @update:model-value="onValueChange('selectbutton', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.selectbutton.value }}
          </div>
        </div>

        <!-- Color Picker Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Color Picker</h3>
          <WidgetColorPicker
            v-model="widgets.color.value"
            :widget="widgets.color"
            :readonly="readonly"
            @update:model-value="onValueChange('color', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ widgets.color.value }}
          </div>
        </div>

        <!-- Button Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Button</h3>
          <WidgetButton
            :widget="widgets.button"
            :readonly="readonly"
            @click="onButtonClick"
          />
          <div class="mt-2 text-sm text-gray-600">
            Clicks: {{ buttonClicks }}
          </div>
        </div>

        <!-- File Upload Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">File Upload</h3>
          <WidgetFileUpload
            v-model="widgets.fileupload.value"
            :widget="widgets.fileupload"
            :readonly="readonly"
            @update:model-value="onValueChange('fileupload', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Files: {{ widgets.fileupload.value?.length || 0 }}
          </div>
        </div>

        <!-- Tree Select Widget -->
        <div class="border rounded-lg p-4">
          <h3 class="font-semibold mb-2">Tree Select</h3>
          <WidgetTreeSelect
            v-model="widgets.treeselect.value"
            :widget="widgets.treeselect"
            :readonly="readonly"
            @update:model-value="onValueChange('treeselect', $event)"
          />
          <div class="mt-2 text-sm text-gray-600">
            Value: {{ JSON.stringify(widgets.treeselect.value) }}
          </div>
        </div>
      </div>

      <!-- Callback Log -->
      <div class="mt-6 border rounded-lg p-4">
        <h3 class="font-semibold mb-2">Callback Log</h3>
        <div class="font-mono text-sm max-h-40 overflow-auto">
          <div v-for="(log, index) in callbackLog" :key="index" class="py-1">
            {{ log }}
          </div>
          <div v-if="callbackLog.length === 0" class="text-gray-500">
            {{ $t('g.noCallbacksTriggered') }}
          </div>
        </div>
      </div>
    </ScrollPanel>
  </PanelTemplate>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import { reactive, ref } from 'vue'

// Import all widget components
import WidgetButton from '@/components/graph/vueWidgets/WidgetButton.vue'
import WidgetColorPicker from '@/components/graph/vueWidgets/WidgetColorPicker.vue'
import WidgetFileUpload from '@/components/graph/vueWidgets/WidgetFileUpload.vue'
import WidgetInputText from '@/components/graph/vueWidgets/WidgetInputText.vue'
import WidgetMultiSelect from '@/components/graph/vueWidgets/WidgetMultiSelect.vue'
import WidgetSelect from '@/components/graph/vueWidgets/WidgetSelect.vue'
import WidgetSelectButton from '@/components/graph/vueWidgets/WidgetSelectButton.vue'
import WidgetSlider from '@/components/graph/vueWidgets/WidgetSlider.vue'
import WidgetTextarea from '@/components/graph/vueWidgets/WidgetTextarea.vue'
import WidgetToggleSwitch from '@/components/graph/vueWidgets/WidgetToggleSwitch.vue'
import WidgetTreeSelect from '@/components/graph/vueWidgets/WidgetTreeSelect.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import PanelTemplate from './PanelTemplate.vue'

// Test state
const readonly = ref(false)
const buttonClicks = ref(0)
const callbackLog = ref<string[]>([])

// Mock widget data
const widgets = reactive({
  string: {
    name: 'Text Input',
    type: 'STRING',
    value: 'Hello World',
    options: {
      placeholder: 'Enter text...'
    }
  } as SimplifiedWidget<string>,

  textarea: {
    name: 'Multi-line Text',
    type: 'TEXTAREA',
    value: 'Line 1\nLine 2\nLine 3',
    options: {
      rows: 4,
      placeholder: 'Enter multiple lines...'
    }
  } as SimplifiedWidget<string>,

  int: {
    name: 'Integer Value',
    type: 'INT',
    value: 50,
    options: {
      min: 0,
      max: 100,
      step: 1
    }
  } as SimplifiedWidget<number>,

  float: {
    name: 'Float Value',
    type: 'FLOAT',
    value: 0.5,
    options: {
      min: 0,
      max: 1,
      step: 0.01
    }
  } as SimplifiedWidget<number>,

  boolean: {
    name: 'Enable Feature',
    type: 'BOOLEAN',
    value: true,
    options: {}
  } as SimplifiedWidget<boolean>,

  combo: {
    name: 'Select Option',
    type: 'COMBO',
    value: 'option2',
    options: {
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' }
      ],
      placeholder: 'Choose an option...'
    }
  } as SimplifiedWidget<string>,

  multiselect: {
    name: 'Select Multiple',
    type: 'MULTISELECT',
    value: ['option1', 'option3'],
    options: {
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
        { label: 'Option 4', value: 'option4' }
      ],
      placeholder: 'Choose multiple...'
    }
  } as SimplifiedWidget<string[]>,

  selectbutton: {
    name: 'Choose Size',
    type: 'SELECTBUTTON',
    value: 'medium',
    options: {
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' }
      ]
    }
  } as SimplifiedWidget<string>,

  color: {
    name: 'Pick Color',
    type: 'COLOR',
    value: '#3b82f6',
    options: {
      format: 'hex'
    }
  } as SimplifiedWidget<string>,

  button: {
    name: 'Click Me',
    type: 'BUTTON',
    value: undefined as any,
    options: {
      label: 'Execute Action',
      icon: 'pi pi-play'
    }
  } as SimplifiedWidget<void>,

  fileupload: {
    name: 'Upload Files',
    type: 'FILEUPLOAD',
    value: [],
    options: {
      accept: 'image/*',
      multiple: true
    }
  } as SimplifiedWidget<File[] | null>,

  treeselect: {
    name: 'Select Categories',
    type: 'TREESELECT',
    value: null,
    options: {
      options: [
        {
          key: '0',
          label: 'Documents',
          children: [
            { key: '0-0', label: 'Work' },
            { key: '0-1', label: 'Personal' }
          ]
        },
        {
          key: '1',
          label: 'Images',
          children: [
            { key: '1-0', label: 'Photos' },
            { key: '1-1', label: 'Screenshots' }
          ]
        }
      ],
      placeholder: 'Select category...'
    }
  } as SimplifiedWidget<any>
})

// Add callbacks to widgets
Object.entries(widgets).forEach(([key, widget]) => {
  if (key !== 'button') {
    widget.callback = (value: any) => {
      logCallback(`${key}: ${JSON.stringify(value)}`)
    }
  }
})

function onValueChange(widgetType: string, value: any) {
  console.log(`Widget ${widgetType} changed:`, value)
}

function onButtonClick() {
  buttonClicks.value++
  logCallback(`Button clicked ${buttonClicks.value} times`)
}

function logCallback(message: string) {
  const timestamp = new Date().toLocaleTimeString()
  callbackLog.value.unshift(`[${timestamp}] ${message}`)
  if (callbackLog.value.length > 20) {
    callbackLog.value = callbackLog.value.slice(0, 20)
  }
}
</script>

<style scoped>
.widget-test-container {
  padding: 0;
}
</style>
