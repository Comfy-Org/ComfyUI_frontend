<template>
  <div
    class="flex w-[490px] flex-col border-t border-border-default"
    :class="isCloud ? 'border-b' : ''"
  >
    <div class="flex h-full w-full flex-col gap-4 p-4">
      <!-- Description -->
      <div>
        <p class="m-0 text-sm leading-5 text-muted-foreground">
          {{
            isCloud
              ? $t('missingNodes.cloud.description')
              : $t('missingNodes.oss.description')
          }}
        </p>
      </div>

      <MissingCoreNodesMessage v-if="!isCloud" :missing-core-nodes />

      <!-- QUICK FIX AVAILABLE Section -->
      <div v-if="replaceableNodes.length > 0" class="flex flex-col gap-2">
        <!-- Section header with Replace button -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase text-primary">
              {{ $t('nodeReplacement.quickFixAvailable') }}
            </span>
            <div class="h-2 w-2 rounded-full bg-primary" />
          </div>
          <Button
            variant="primary"
            size="md"
            :disabled="selectedTypes.size === 0"
            @click="handleReplaceSelected"
          >
            <i class="icon-[lucide--refresh-cw] mr-1.5 h-4 w-4" />
            {{
              $t('nodeReplacement.replaceSelected', {
                count: selectedTypes.size
              })
            }}
          </Button>
        </div>

        <!-- Replaceable nodes list -->
        <div
          class="flex max-h-[200px] flex-col overflow-y-auto rounded-lg bg-secondary-background scrollbar-custom"
        >
          <!-- Select All row (sticky header) -->
          <div
            class="sticky top-0 z-10 flex cursor-pointer items-center gap-3 border-b border-border-default bg-secondary-background px-3 py-2 hover:bg-secondary-background-hover"
            tabindex="0"
            role="checkbox"
            :aria-checked="
              isAllSelected ? 'true' : isSomeSelected ? 'mixed' : 'false'
            "
            @click="toggleSelectAll"
            @keydown.enter.prevent="toggleSelectAll"
            @keydown.space.prevent="toggleSelectAll"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded p-0.5 transition-all duration-200"
              :class="
                isAllSelected || isSomeSelected
                  ? 'bg-primary-background'
                  : 'bg-secondary-background'
              "
            >
              <i
                v-if="isAllSelected"
                class="icon-[lucide--check] text-bold text-xs text-base-foreground"
              />
              <i
                v-else-if="isSomeSelected"
                class="icon-[lucide--minus] text-bold text-xs text-base-foreground"
              />
            </div>
            <span class="text-xs font-medium uppercase text-muted-foreground">
              {{ $t('nodeReplacement.compatibleAlternatives') }}
            </span>
          </div>

          <!-- Replaceable node items -->
          <div
            v-for="node in replaceableNodes"
            :key="node.label"
            class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-secondary-background-hover"
            tabindex="0"
            role="checkbox"
            :aria-checked="selectedTypes.has(node.label)"
            @click="toggleNode(node.label)"
            @keydown.enter.prevent="toggleNode(node.label)"
            @keydown.space.prevent="toggleNode(node.label)"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded p-0.5 transition-all duration-200"
              :class="
                selectedTypes.has(node.label)
                  ? 'bg-primary-background'
                  : 'bg-secondary-background'
              "
            >
              <i
                v-if="selectedTypes.has(node.label)"
                class="icon-[lucide--check] text-bold text-xs text-base-foreground"
              />
            </div>
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex h-4 items-center rounded-full border border-primary bg-primary/10 px-1.5 text-xxxs font-semibold uppercase text-primary"
                >
                  {{ $t('nodeReplacement.replaceable') }}
                </span>
                <span class="text-sm font-medium text-foreground">
                  {{ node.label }}
                </span>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ node.replacement?.new_node_id ?? node.hint ?? '' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- MANUAL INSTALLATION REQUIRED Section -->
      <div v-if="nonReplaceableNodes.length > 0" class="flex flex-col gap-2">
        <!-- Section header -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold uppercase text-error">
            {{ $t('nodeReplacement.installationRequired') }}
          </span>
          <i class="icon-[lucide--info] text-xs text-error" />
        </div>

        <!-- Non-replaceable nodes list -->
        <div
          class="flex flex-col rounded-lg bg-secondary-background scrollbar-custom"
        >
          <div
            v-for="node in nonReplaceableNodes"
            :key="node.label"
            class="flex items-center justify-between px-4 py-3"
          >
            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex h-4 items-center rounded-full border border-error bg-error/10 px-1.5 text-xxxs font-semibold uppercase text-error"
                  >
                    {{ $t('nodeReplacement.notReplaceable') }}
                  </span>
                  <span class="text-sm font-medium text-foreground">
                    {{ node.label }}
                  </span>
                </div>
                <span v-if="node.hint" class="text-xs text-muted-foreground">
                  {{ node.hint }}
                </span>
              </div>
            </div>
            <Button
              v-if="node.action"
              variant="destructive-textonly"
              size="sm"
              @click="node.action.callback"
            >
              {{ node.action.text }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Bottom instruction box -->
      <div
        class="flex gap-3 rounded-lg border border-warning-background bg-warning-background/10 p-3"
      >
        <i
          class="icon-[lucide--triangle-alert] mt-0.5 h-4 w-4 shrink-0 text-warning-background"
        />
        <p class="m-0 text-xs leading-5 text-neutral-foreground">
          <i18n-t keypath="nodeReplacement.instructionMessage">
            <template #red>
              <span class="text-error">{{
                $t('nodeReplacement.redHighlight')
              }}</span>
            </template>
          </i18n-t>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import Button from '@/components/ui/button/Button.vue'
import { isCloud } from '@/platform/distribution/types'
import type { NodeReplacement } from '@/platform/nodeReplacement/types'
import type { MissingNodeType } from '@/types/comfy'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

const emit = defineEmits<{
  (e: 'replaceSelected', selectedTypes: MissingNodeType[]): void
}>()

const { missingCoreNodes } = useMissingNodes()

interface ProcessedNode {
  label: string
  hint?: string
  action?: { text: string; callback: () => void }
  isReplaceable: boolean
  replacement?: NodeReplacement
}

const uniqueNodes = computed<ProcessedNode[]>(() => {
  const seenTypes = new Set<string>()
  return props.missingNodeTypes
    .filter((node) => {
      const type = typeof node === 'object' ? node.type : node
      if (seenTypes.has(type)) return false
      seenTypes.add(type)
      return true
    })
    .map((node) => {
      if (typeof node === 'object') {
        return {
          label: node.type,
          hint: node.hint,
          action: node.action,
          isReplaceable: node.isReplaceable ?? false,
          replacement: node.replacement
        }
      }
      return { label: node, isReplaceable: false }
    })
})

const replaceableNodes = computed(() =>
  uniqueNodes.value.filter((n) => n.isReplaceable)
)

const nonReplaceableNodes = computed(() =>
  uniqueNodes.value.filter((n) => !n.isReplaceable)
)

// Selection state - all replaceable nodes selected by default
const selectedTypes = ref<Set<string>>(new Set<string>())

// Initialize selection when replaceableNodes changes
watch(
  replaceableNodes,
  (nodes) => {
    selectedTypes.value = new Set(nodes.map((n) => n.label))
  },
  { immediate: true }
)

const isAllSelected = computed(
  () =>
    replaceableNodes.value.length > 0 &&
    selectedTypes.value.size === replaceableNodes.value.length
)

const isSomeSelected = computed(
  () => selectedTypes.value.size > 0 && !isAllSelected.value
)

function toggleNode(label: string) {
  const next = new Set(selectedTypes.value)
  if (next.has(label)) {
    next.delete(label)
  } else {
    next.add(label)
  }
  selectedTypes.value = next
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedTypes.value = new Set()
  } else {
    selectedTypes.value = new Set(replaceableNodes.value.map((n) => n.label))
  }
}

function handleReplaceSelected() {
  const selected = props.missingNodeTypes.filter((node) => {
    const type = typeof node === 'object' ? node.type : node
    return selectedTypes.value.has(type)
  })
  emit('replaceSelected', selected)
}
</script>
