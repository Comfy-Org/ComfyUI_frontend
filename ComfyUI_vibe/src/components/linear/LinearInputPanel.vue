<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'
import type { WidgetDefinition } from '@/types/node'
import WidgetSlider from '@/components/v2/nodes/widgets/WidgetSlider.vue'
import WidgetNumber from '@/components/v2/nodes/widgets/WidgetNumber.vue'
import WidgetText from '@/components/v2/nodes/widgets/WidgetText.vue'
import WidgetSelect from '@/components/v2/nodes/widgets/WidgetSelect.vue'
import WidgetToggle from '@/components/v2/nodes/widgets/WidgetToggle.vue'

const store = useLinearModeStore()

const showAdvanced = ref(false)

const workflow = computed(() => store.currentWorkflow)
const isGenerating = computed(() => store.isGenerating)

// Group widgets into basic (prompt, model) and advanced (everything else)
const basicWidgets = computed(() => {
  if (!workflow.value) return []

  const basic: Array<{
    stepId: string
    stepName: string
    widget: WidgetDefinition
    value: unknown
  }> = []

  for (const step of workflow.value.steps) {
    if (!step.definition) continue

    for (const widgetName of step.exposedWidgets) {
      const widget = step.definition.widgets.find((w) => w.name === widgetName)
      if (!widget) continue

      // Basic: prompt text, model selection
      const isBasic =
        widget.type === 'textarea' ||
        (widget.type === 'select' && widgetName === 'ckpt_name')

      if (isBasic) {
        basic.push({
          stepId: step.id,
          stepName: step.displayName,
          widget,
          value: step.widgetValues[widgetName],
        })
      }
    }
  }

  return basic
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
      if (!widget) continue

      // Advanced: everything except prompt and model
      const isBasic =
        widget.type === 'textarea' ||
        (widget.type === 'select' && widgetName === 'ckpt_name')

      if (!isBasic) {
        advanced.push({
          stepId: step.id,
          stepName: step.displayName,
          widget,
          value: step.widgetValues[widgetName],
        })
      }
    }
  }

  return advanced
})

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
  <main class="flex flex-1 flex-col bg-zinc-950">
    <!-- Empty State -->
    <div
      v-if="!workflow"
      class="flex flex-1 flex-col items-center justify-center text-zinc-500"
    >
      <i class="pi pi-arrow-left mb-3 text-4xl" />
      <p class="text-sm">Select a workflow to get started</p>
    </div>

    <!-- Input Form -->
    <div v-else class="flex flex-1 flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h1 class="text-sm font-semibold text-zinc-100">
            {{ workflow.templateName }}
          </h1>
          <p class="mt-0.5 text-xs text-zinc-500">
            {{ workflow.steps.length }} steps
          </p>
        </div>

        <!-- Generate Button -->
        <div class="flex items-center gap-2">
          <button
            v-if="!isGenerating"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            @click="handleGenerate"
          >
            <i class="pi pi-play text-xs" />
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
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <div class="mx-auto max-w-2xl space-y-6">
          <!-- Basic Inputs -->
          <section>
            <div
              v-for="item in basicWidgets"
              :key="`${item.stepId}-${item.widget.name}`"
              class="mb-4"
            >
              <label class="mb-1.5 block text-xs font-medium text-zinc-400">
                {{ item.widget.label ?? item.widget.name }}
              </label>

              <!-- Textarea for prompts -->
              <textarea
                v-if="item.widget.type === 'textarea'"
                :value="String(item.value ?? '')"
                :placeholder="item.widget.options?.placeholder ?? 'Enter your prompt...'"
                class="min-h-[120px] w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
                @input="updateWidget(item.stepId, item.widget.name, ($event.target as HTMLTextAreaElement).value)"
              />

              <!-- Select for model -->
              <component
                v-else
                :is="getWidgetComponent(item.widget.type)"
                :widget="item.widget"
                :model-value="item.value"
                @update:model-value="updateWidget(item.stepId, item.widget.name, $event)"
              />
            </div>
          </section>

          <!-- Advanced Settings Toggle -->
          <div class="border-t border-zinc-800 pt-4">
            <button
              class="flex w-full items-center justify-between rounded-lg bg-zinc-900 px-3 py-2.5 text-left transition-colors hover:bg-zinc-800"
              @click="showAdvanced = !showAdvanced"
            >
              <div class="flex items-center gap-2">
                <i class="pi pi-sliders-h text-xs text-zinc-500" />
                <span class="text-xs font-medium text-zinc-300">Advanced Settings</span>
                <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
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
              v-if="showAdvanced"
              class="mt-3 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
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

              <!-- Grouped by step -->
              <div
                v-for="(item, index) in advancedWidgets"
                :key="`${item.stepId}-${item.widget.name}`"
                class="space-y-1.5"
              >
                <!-- Step name as group header (only show once per step) -->
                <div
                  v-if="index === 0 || advancedWidgets[index - 1]?.stepId !== item.stepId"
                  class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {{ item.stepName }}
                </div>

                <div class="flex items-center gap-3">
                  <label class="w-24 shrink-0 text-right text-[11px] text-zinc-500">
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

              <div v-if="!advancedWidgets.length" class="py-4 text-center text-xs text-zinc-600">
                No advanced settings available
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Bar (when generating) -->
      <div v-if="isGenerating" class="border-t border-zinc-800 px-4 py-3">
        <div class="flex items-center justify-between text-xs text-zinc-400">
          <span>Generating...</span>
          <span>{{ Math.round(store.executionProgress) }}%</span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            class="h-full rounded-full bg-blue-600 transition-all duration-300"
            :style="{ width: `${store.executionProgress}%` }"
          />
        </div>
      </div>
    </div>
  </main>
</template>
