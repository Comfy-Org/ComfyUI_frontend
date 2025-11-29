<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'
import { TEMPLATE_CATEGORIES } from '@/data/linearTemplates'
import type { LinearWorkflowTemplate } from '@/types/linear'
import type { WidgetDefinition } from '@/types/node'
import WidgetSlider from '@/components/v2/nodes/widgets/WidgetSlider.vue'
import WidgetNumber from '@/components/v2/nodes/widgets/WidgetNumber.vue'
import WidgetText from '@/components/v2/nodes/widgets/WidgetText.vue'
import WidgetSelect from '@/components/v2/nodes/widgets/WidgetSelect.vue'
import WidgetToggle from '@/components/v2/nodes/widgets/WidgetToggle.vue'

const store = useLinearModeStore()

// Mode tabs (Image / Video like Runway)
const activeMode = ref<'image' | 'video'>('image')

// Workflow selection
const showWorkflowSelector = ref(false)
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)

// Settings
const showAdvanced = ref(false)

const workflow = computed(() => store.currentWorkflow)
const isGenerating = computed(() => store.isGenerating)

const filteredTemplates = computed(() => {
  let templates = store.templates

  if (selectedCategory.value) {
    templates = templates.filter((t) => t.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    )
  }

  return templates
})

// Group widgets into basic (prompt) and advanced (everything else)
const promptWidget = computed(() => {
  if (!workflow.value) return null

  for (const step of workflow.value.steps) {
    if (!step.definition) continue

    for (const widgetName of step.exposedWidgets) {
      const widget = step.definition.widgets.find((w) => w.name === widgetName)
      if (widget?.type === 'textarea') {
        return {
          stepId: step.id,
          widget,
          value: step.widgetValues[widgetName],
        }
      }
    }
  }
  return null
})

const advancedWidgets = computed(() => {
  if (!workflow.value) return []

  const advanced: Array<{
    stepId: string
    stepName: string
    widget: WidgetDefinition
    value: unknown
  }> = []

  for (const step of workflow.value.steps) {
    if (!step.definition) continue

    for (const widgetName of step.exposedWidgets) {
      const widget = step.definition.widgets.find((w) => w.name === widgetName)
      if (!widget || widget.type === 'textarea') continue

      advanced.push({
        stepId: step.id,
        stepName: step.displayName,
        widget,
        value: step.widgetValues[widgetName],
      })
    }
  }

  return advanced
})

function selectTemplate(template: LinearWorkflowTemplate): void {
  store.selectTemplate(template)
  showWorkflowSelector.value = false
}

function updateWidget(stepId: string, widgetName: string, value: unknown): void {
  store.updateStepWidget(stepId, widgetName, value)
}

function getWidgetComponent(type: WidgetDefinition['type']): unknown {
  switch (type) {
    case 'slider':
      return WidgetSlider
    case 'number':
      return WidgetNumber
    case 'text':
      return WidgetText
    case 'select':
      return WidgetSelect
    case 'toggle':
      return WidgetToggle
    default:
      return WidgetText
  }
}

function handleGenerate(): void {
  store.startGeneration()
}

function handleCancel(): void {
  store.cancelGeneration()
}

function randomizeSeed(): void {
  if (!workflow.value) return

  for (const step of workflow.value.steps) {
    if (step.exposedWidgets.includes('seed')) {
      const randomSeed = Math.floor(Math.random() * 2147483647)
      store.updateStepWidget(step.id, 'seed', randomSeed)
    }
  }
}
</script>

<template>
  <aside class="flex h-full w-96 flex-col border-r border-zinc-800 bg-zinc-950">
    <!-- Mode Tabs (Image / Video) -->
    <div class="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
      <button
        :class="[
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          activeMode === 'image'
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-300'
        ]"
        @click="activeMode = 'image'"
      >
        <i class="pi pi-image text-xs" />
        Image
      </button>
      <button
        :class="[
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          activeMode === 'video'
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-300'
        ]"
        @click="activeMode = 'video'"
      >
        <i class="pi pi-video text-xs" />
        Video
      </button>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Image Upload Area -->
      <div class="border-b border-zinc-800 p-3">
        <div
          class="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
        >
          <i class="pi pi-cloud-upload mb-2 text-2xl text-zinc-500" />
          <p class="text-xs text-zinc-400">Drop an image or click to upload</p>
          <div class="mt-2 flex gap-2">
            <button class="rounded bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700">
              Select asset
            </button>
            <button class="rounded bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700">
              Create image
            </button>
          </div>
        </div>
      </div>

      <!-- Prompt Input -->
      <div class="border-b border-zinc-800 p-3">
        <textarea
          v-if="promptWidget"
          :value="String(promptWidget.value ?? '')"
          :placeholder="'Drop an image to animate. Or drop a video to use Aleph. View guide'"
          class="min-h-[80px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
          @input="updateWidget(promptWidget.stepId, promptWidget.widget.name, ($event.target as HTMLTextAreaElement).value)"
        />
        <textarea
          v-else
          placeholder="Describe your idea..."
          class="min-h-[80px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
          disabled
        />
      </div>

      <!-- Workflow Selector -->
      <div class="border-b border-zinc-800 p-3">
        <button
          class="flex w-full items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-left transition-colors hover:bg-zinc-800"
          @click="showWorkflowSelector = !showWorkflowSelector"
        >
          <div class="flex items-center gap-2">
            <i class="pi pi-sitemap text-xs text-zinc-500" />
            <span class="text-xs font-medium text-zinc-300">
              {{ store.selectedTemplate?.name ?? 'Select Workflow' }}
            </span>
          </div>
          <i
            :class="[
              'pi text-xs text-zinc-500 transition-transform',
              showWorkflowSelector ? 'pi-chevron-up' : 'pi-chevron-down'
            ]"
          />
        </button>

        <!-- Workflow Dropdown -->
        <div
          v-if="showWorkflowSelector"
          class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900"
        >
          <!-- Search -->
          <div class="border-b border-zinc-800 p-2">
            <div class="flex items-center rounded bg-zinc-800 px-2 py-1.5">
              <i class="pi pi-search text-xs text-zinc-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search workflows..."
                class="ml-2 w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          <!-- Categories -->
          <div class="flex flex-wrap gap-1 border-b border-zinc-800 p-2">
            <button
              :class="[
                'rounded px-2 py-1 text-[10px] font-medium transition-colors',
                !selectedCategory
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              ]"
              @click="selectedCategory = null"
            >
              All
            </button>
            <button
              v-for="cat in TEMPLATE_CATEGORIES.slice(0, 4)"
              :key="cat.id"
              :class="[
                'rounded px-2 py-1 text-[10px] font-medium transition-colors',
                selectedCategory === cat.id
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              ]"
              @click="selectedCategory = cat.id"
            >
              {{ cat.name }}
            </button>
          </div>

          <!-- Template List -->
          <div class="max-h-48 overflow-y-auto p-2">
            <button
              v-for="template in filteredTemplates"
              :key="template.id"
              :class="[
                'flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors',
                store.selectedTemplate?.id === template.id
                  ? 'bg-zinc-800'
                  : 'hover:bg-zinc-800/50'
              ]"
              @click="selectTemplate(template)"
            >
              <div
                :class="[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded',
                  store.selectedTemplate?.id === template.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-400'
                ]"
              >
                <i :class="['pi', template.icon, 'text-xs']" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-medium text-zinc-200">
                  {{ template.name }}
                </div>
                <div class="truncate text-[10px] text-zinc-500">
                  {{ template.steps.length }} steps
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Settings -->
      <div class="border-b border-zinc-800 p-3">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 rounded bg-zinc-900 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <i class="pi pi-pencil text-[10px]" />
            Prompt
          </button>
          <button
            class="flex items-center gap-1.5 rounded bg-zinc-900 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <i class="pi pi-sparkles text-[10px]" />
            Act-Two
          </button>
          <div class="flex-1" />
          <button
            class="flex items-center gap-1 rounded bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <i class="pi pi-desktop text-[10px]" />
            16:9
          </button>
          <button
            class="flex h-7 w-7 items-center justify-center rounded bg-zinc-900 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <i class="pi pi-sliders-h text-[10px]" />
          </button>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="p-3">
        <button
          class="flex w-full items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-left transition-colors hover:bg-zinc-800"
          @click="showAdvanced = !showAdvanced"
        >
          <div class="flex items-center gap-2">
            <i class="pi pi-cog text-xs text-zinc-500" />
            <span class="text-xs font-medium text-zinc-300">Advanced Settings</span>
            <span
              v-if="advancedWidgets.length"
              class="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400"
            >
              {{ advancedWidgets.length }}
            </span>
          </div>
          <i
            :class="[
              'pi text-xs text-zinc-500 transition-transform',
              showAdvanced ? 'pi-chevron-up' : 'pi-chevron-down'
            ]"
          />
        </button>

        <!-- Advanced Widgets -->
        <div
          v-if="showAdvanced && advancedWidgets.length"
          class="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
        >
          <!-- Quick Actions -->
          <div class="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <button
              class="flex items-center gap-1.5 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              @click="randomizeSeed"
            >
              <i class="pi pi-sync text-[10px]" />
              Random Seed
            </button>
          </div>

          <!-- Widgets -->
          <div
            v-for="(item, index) in advancedWidgets"
            :key="`${item.stepId}-${item.widget.name}`"
            class="space-y-1.5"
          >
            <div
              v-if="index === 0 || advancedWidgets[index - 1]?.stepId !== item.stepId"
              class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
            >
              {{ item.stepName }}
            </div>

            <div class="flex items-center gap-3">
              <label class="w-20 shrink-0 text-right text-[11px] text-zinc-500">
                {{ item.widget.label ?? item.widget.name }}
              </label>
              <div class="flex-1">
                <component
                  :is="getWidgetComponent(item.widget.type)"
                  :widget="item.widget"
                  :model-value="item.value"
                  @update:model-value="updateWidget(item.stepId, item.widget.name, $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Bar: Model + Generate -->
    <div class="flex items-center gap-2 border-t border-zinc-800 p-3">
      <!-- Model Selector -->
      <button class="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-left transition-colors hover:bg-zinc-800">
        <div class="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
          <i class="pi pi-star text-[10px] text-white" />
        </div>
        <span class="text-xs font-medium text-zinc-300">Gen-4 Turbo</span>
        <i class="pi pi-chevron-down text-[10px] text-zinc-500" />
      </button>

      <!-- Duration -->
      <button class="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800">
        5s
        <i class="pi pi-chevron-down text-[10px]" />
      </button>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Generate Button -->
      <button
        v-if="!isGenerating"
        :disabled="!store.selectedTemplate"
        :class="[
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          store.selectedTemplate
            ? 'bg-blue-600 text-white hover:bg-blue-500'
            : 'cursor-not-allowed bg-zinc-800 text-zinc-500'
        ]"
        @click="handleGenerate"
      >
        <i class="pi pi-video text-xs" />
        Generate
      </button>
      <button
        v-else
        class="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
        @click="handleCancel"
      >
        <i class="pi pi-times text-xs" />
        Cancel
      </button>
    </div>

    <!-- Progress Bar (when generating) -->
    <div v-if="isGenerating" class="border-t border-zinc-800 px-3 py-2">
      <div class="h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          class="h-full rounded-full bg-blue-600 transition-all duration-300"
          :style="{ width: `${store.executionProgress}%` }"
        />
      </div>
    </div>
  </aside>
</template>
