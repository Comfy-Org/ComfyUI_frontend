<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-row items-center gap-2">
      <div class="form-label flex w-28 shrink-0 items-center">
        <span id="tpl-title-label" class="text-muted">
          {{ t('templatePublishing.steps.metadata.titleLabel') }}
        </span>
      </div>
      <input
        id="tpl-title"
        v-model="ctx.template.value.title"
        type="text"
        class="h-8 w-[100em] rounded border border-border-default bg-secondary-background px-2 text-sm focus:outline-none"
        aria-labelledby="tpl-title-label"
      />
    </div>

    <div class="flex flex-row items-center gap-2">
      <div class="form-label flex w-28 shrink-0 items-center">
        <span id="tpl-difficulty-label" class="text-muted">
          {{ t('templatePublishing.steps.metadata.difficultyLabel') }}
        </span>
      </div>
      <div
        class="flex flex-row gap-4"
        role="radiogroup"
        aria-labelledby="tpl-difficulty-label"
      >
        <label
          v-for="option in DIFFICULTY_OPTIONS"
          :key="option.value"
          :for="`tpl-difficulty-${option.value}`"
          class="flex cursor-pointer items-center gap-1.5 text-sm"
        >
          <input
            :id="`tpl-difficulty-${option.value}`"
            type="radio"
            name="tpl-difficulty"
            :value="option.value"
            :checked="ctx.template.value.difficulty === option.value"
            :class="
              cn(
                'h-5 w-5 appearance-none rounded-full border-2 checked:bg-current checked:shadow-[inset_0_0_0_1px_white]',
                option.borderClass
              )
            "
            @change="ctx.template.value.difficulty = option.value"
          />
          {{ option.text }}
        </label>
      </div>
    </div>

    <FormItem
      id="tpl-license"
      v-model:form-value="ctx.template.value.license"
      :item="licenseField"
    />

    <div class="flex flex-col gap-2">
      <span id="tpl-required-nodes-label" class="text-sm text-muted">
        {{ t('templatePublishing.steps.metadata.requiredNodesLabel') }}
      </span>

      <div
        v-if="detectedCustomNodes.length > 0"
        aria-labelledby="tpl-required-nodes-label"
      >
        <span class="text-xs text-muted-foreground">
          {{ t('templatePublishing.steps.metadata.requiredNodesDetected') }}
        </span>
        <ul class="mt-1 flex flex-col gap-1">
          <li
            v-for="nodeName in detectedCustomNodes"
            :key="nodeName"
            class="flex items-center gap-2 rounded bg-secondary-background px-2 py-1 text-sm"
          >
            <i
              class="icon-[lucide--puzzle] h-3.5 w-3.5 text-muted-foreground"
            />
            {{ nodeName }}
          </li>
        </ul>
      </div>

      <div>
        <span class="text-xs text-muted-foreground">
          {{ t('templatePublishing.steps.metadata.requiredNodesManualLabel') }}
        </span>
        <div class="relative mt-1">
          <input
            v-model="manualNodeQuery"
            type="text"
            class="h-8 w-56 rounded border border-border-default bg-secondary-background px-2 text-sm focus:outline-none"
            :placeholder="
              t(
                'templatePublishing.steps.metadata.requiredNodesManualPlaceholder'
              )
            "
            @focus="showNodeSuggestions = true"
            @keydown.enter.prevent="addManualNode(manualNodeQuery)"
          />
          <ul
            v-if="showNodeSuggestions && filteredNodeSuggestions.length > 0"
            class="absolute z-10 mt-1 max-h-40 w-56 overflow-auto rounded border border-border-default bg-secondary-background shadow-md"
          >
            <li
              v-for="suggestion in filteredNodeSuggestions"
              :key="suggestion"
              class="cursor-pointer px-2 py-1 text-sm hover:bg-comfy-input-background"
              @mousedown.prevent="addManualNode(suggestion)"
            >
              {{ suggestion }}
            </li>
          </ul>
        </div>
        <div
          v-if="manualNodes.length > 0"
          class="mt-1 flex flex-wrap items-center gap-1"
        >
          <span
            v-for="node in manualNodes"
            :key="node"
            class="inline-flex items-center gap-1 rounded-full bg-comfy-input-background px-2 py-0.5 text-xs"
          >
            {{ node }}
            <button
              type="button"
              class="hover:text-danger"
              :aria-label="`Remove ${node}`"
              @click="removeManualNode(node)"
            >
              <i class="icon-[lucide--x] h-3 w-3" />
            </button>
          </span>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span id="tpl-vram-label" class="text-sm text-muted">
        {{ t('templatePublishing.steps.metadata.vramLabel') }}
      </span>
      <div class="flex items-center gap-3">
        <i class="icon-[lucide--cpu] h-3.5 w-3.5 text-muted-foreground" />
        <span class="text-xs text-muted-foreground">
          {{ t('templatePublishing.steps.metadata.vramAutoDetected') }}
        </span>
        <span class="text-sm font-medium">
          {{ formatSize(autoDetectedVram) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <input
          id="tpl-vram-override"
          v-model.number="manualVramGb"
          type="number"
          min="0"
          step="0.5"
          class="h-8 w-24 rounded border border-border-default bg-secondary-background px-2 text-sm focus:outline-none"
          aria-labelledby="tpl-vram-label"
        />
        <span class="text-xs text-muted-foreground">
          {{ t('templatePublishing.steps.metadata.vramManualOverride') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { formatSize } from '@/utils/formatUtil'
import { useI18n } from 'vue-i18n'

import FormItem from '@/components/common/FormItem.vue'
import { estimateWorkflowVram } from '@/composables/useVramEstimation'
import type { FormItem as FormItemType } from '@/platform/settings/types'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import { mapAllNodes } from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import { PublishingStepperKey } from '../types'

const { t } = useI18n()
const ctx = inject(PublishingStepperKey)!
const nodeDefStore = useNodeDefStore()

const DIFFICULTY_OPTIONS = [
  {
    text: t('templatePublishing.steps.metadata.difficulty.beginner'),
    value: 'beginner' as const,
    borderClass: 'border-green-400'
  },
  {
    text: t('templatePublishing.steps.metadata.difficulty.intermediate'),
    value: 'intermediate' as const,
    borderClass: 'border-amber-400'
  },
  {
    text: t('templatePublishing.steps.metadata.difficulty.advanced'),
    value: 'advanced' as const,
    borderClass: 'border-red-400'
  }
]

const licenseField: FormItemType = {
  name: t('templatePublishing.steps.metadata.licenseLabel'),
  type: 'combo',
  options: [
    { text: t('templatePublishing.steps.metadata.license.mit'), value: 'mit' },
    {
      text: t('templatePublishing.steps.metadata.license.ccBy'),
      value: 'cc-by'
    },
    {
      text: t('templatePublishing.steps.metadata.license.ccBySa'),
      value: 'cc-by-sa'
    },
    {
      text: t('templatePublishing.steps.metadata.license.ccByNc'),
      value: 'cc-by-nc'
    },
    {
      text: t('templatePublishing.steps.metadata.license.apache'),
      value: 'apache'
    },
    {
      text: t('templatePublishing.steps.metadata.license.custom'),
      value: 'custom'
    }
  ],
  attrs: { filter: true }
}

/**
 * Collects unique custom node type names from the current workflow graph.
 * Excludes core, essentials, and blueprint nodes.
 */
function detectCustomNodes(): string[] {
  if (!app.rootGraph) return []

  const nodeTypes = mapAllNodes(app.rootGraph, (node) => node.type)
  const unique = new Set(nodeTypes)

  return [...unique]
    .filter((type) => {
      const def = nodeDefStore.nodeDefsByName[type]
      if (!def) return false
      return def.nodeSource.type === NodeSourceType.CustomNodes
    })
    .sort()
}

/**
 * Extracts the custom node package ID from a `python_module` string.
 *
 * Custom node modules follow the pattern
 * `custom_nodes.PackageName@version.submodule`, so the package ID is the
 * second dot-segment with the `@version` suffix stripped.
 *
 * @returns The package folder name, or `undefined` when the module does not
 *          match the expected pattern.
 */
function extractPackageId(pythonModule: string): string | undefined {
  const segments = pythonModule.split('.')
  if (segments[0] !== 'custom_nodes' || !segments[1]) return undefined
  return segments[1].split('@')[0]
}

/**
 * Collects unique custom node package IDs from the current workflow graph.
 */
function detectCustomNodePackages(): string[] {
  if (!app.rootGraph) return []

  const nodeTypes = mapAllNodes(app.rootGraph, (node) => node.type)
  const packages = new Set<string>()

  for (const type of nodeTypes) {
    const def = nodeDefStore.nodeDefsByName[type]
    if (!def || def.nodeSource.type !== NodeSourceType.CustomNodes) continue
    const pkgId = extractPackageId(def.python_module)
    if (pkgId) packages.add(pkgId)
  }

  return [...packages].sort()
}

const detectedCustomNodes = ref<string[]>([])
const autoDetectedVram = ref(0)

const GB = 1_073_741_824

/**
 * Manual VRAM override in GB. When set to a positive number, this
 * value (converted to bytes) takes precedence over the auto-detected
 * estimate for `vramRequirement`.
 */
const manualVramGb = computed({
  get: () => {
    const stored = ctx.template.value.vramRequirement
    if (!stored || stored === autoDetectedVram.value) return undefined
    return Math.round((stored / GB) * 10) / 10
  },
  set: (gb: number | undefined) => {
    if (gb && gb > 0) {
      ctx.template.value.vramRequirement = Math.round(gb * GB)
    } else {
      ctx.template.value.vramRequirement = autoDetectedVram.value
    }
  }
})

onMounted(() => {
  detectedCustomNodes.value = detectCustomNodes()

  const existing = ctx.template.value.requiredNodes ?? []
  if (existing.length === 0) {
    ctx.template.value.requiredNodes = [...detectedCustomNodes.value]
  }

  const existingPackages = ctx.template.value.requiresCustomNodes ?? []
  if (existingPackages.length === 0) {
    ctx.template.value.requiresCustomNodes = detectCustomNodePackages()
  }

  autoDetectedVram.value = estimateWorkflowVram(app.rootGraph)
  if (!ctx.template.value.vramRequirement) {
    ctx.template.value.vramRequirement = autoDetectedVram.value
  }
})

const manualNodes = computed(() => {
  const all = ctx.template.value.requiredNodes ?? []
  const detected = new Set(detectedCustomNodes.value)
  return all.filter((n) => !detected.has(n))
})

const manualNodeQuery = ref('')
const showNodeSuggestions = ref(false)

/** All installed custom node type names for searchable suggestions. */
const allCustomNodeNames = computed(() =>
  Object.values(nodeDefStore.nodeDefsByName)
    .filter((def) => def.nodeSource.type === NodeSourceType.CustomNodes)
    .map((def) => def.name)
    .sort()
)

const filteredNodeSuggestions = computed(() => {
  const query = manualNodeQuery.value.toLowerCase().trim()
  if (!query) return []
  const existing = new Set(ctx.template.value.requiredNodes ?? [])
  return allCustomNodeNames.value.filter(
    (name) => name.toLowerCase().includes(query) && !existing.has(name)
  )
})

function addManualNode(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const nodes = ctx.template.value.requiredNodes ?? []
  if (!nodes.includes(trimmed)) {
    ctx.template.value.requiredNodes = [...nodes, trimmed]
  }
  manualNodeQuery.value = ''
  showNodeSuggestions.value = false
}

function removeManualNode(name: string) {
  const nodes = ctx.template.value.requiredNodes ?? []
  ctx.template.value.requiredNodes = nodes.filter((n) => n !== name)
}

watchDebounced(
  () => ctx.template.value,
  () => ctx.saveDraft(),
  { deep: true, debounce: 500 }
)
</script>
