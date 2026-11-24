<template>
  <TextTooltip :text="tooltipText" side="left">
    <MenuRadioItem
      v-bind="$attrs"
      :value
      as-child
      :disabled
      :aria-describedby="describedBy"
      :aria-keyshortcuts="editLabel ? 'E' : undefined"
      :class="
        cn(
          switcherItemClass,
          'aria-checked:bg-secondary aria-checked:data-highlighted:bg-accent',
          muted && 'data-disabled:opacity-100'
        )
      "
      @select="emit('select', $event)"
      @keydown="editOnKey"
    >
      <div :aria-disabled="disabled || unpickable || undefined">
        <DeploymentStatusIcon
          :tone
          icon-class="size-3.5 text-muted-foreground"
          ring-class="ring-1 ring-background group-data-highlighted:ring-accent group-aria-checked:ring-secondary group-aria-checked:group-data-highlighted:ring-accent"
        />
        <span
          ref="titleText"
          :class="
            cn(
              'min-w-0 flex-1 truncate',
              muted ? 'text-muted-foreground' : 'text-foreground'
            )
          "
        >
          {{ title }}
        </span>
        <span
          ref="deploymentText"
          class="w-16 shrink-0 truncate text-muted-foreground"
        >
          {{ deployment }}
        </span>
        <span v-if="showsAction" class="flex min-w-14 shrink-0">
          <span
            class="flex h-6 items-center rounded-md bg-accent px-2.5 whitespace-nowrap text-foreground group-data-highlighted:bg-muted"
            aria-hidden="true"
          >
            {{ actionLabel }}
            <i
              v-if="actionIcon"
              :class="cn(actionIcon, 'ml-1 size-3')"
              aria-hidden="true"
            />
          </span>
        </span>
        <span v-else ref="detailCell" :class="detailClass">
          {{ switching ? $t('deploymentSwitcher.switching') : detail }}
        </span>
        <span :class="switcherTrailingSlotClass">
          <DeploymentSwitcherRowTrailing
            :switching
            :building
            :edit-label="editLabel"
            @edit="emit('edit')"
          />
        </span>
        <span v-if="note" :id="noteId" hidden>{{ note }}</span>
        <span v-if="editLabel" :id="editHintId" hidden>
          {{ $t('platformFrame.updateShortcut') }}
        </span>
      </div>
    </MenuRadioItem>
  </TextTooltip>
  <div
    v-if="problem"
    :id="problemId"
    role="status"
    class="w-0 min-w-full pr-2 pb-2 pl-7.5 text-xs text-pretty"
    data-testid="deployment-row-problem"
  >
    <p class="m-0 text-warning">
      {{ problem.summary }}
      <template v-if="problem.message">{{ problem.message }}</template>
    </p>
    <p class="m-0 mt-0.5 text-muted-foreground">{{ problem.fix }}</p>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { computed, onMounted, onUpdated, ref, useId, useTemplateRef } from 'vue'

import MenuRadioItem from '@comfyorg/design-system/menu/MenuRadioItem'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import DeploymentSwitcherRowTrailing from '@/platform/workspace/components/DeploymentSwitcherRowTrailing.vue'
import {
  switcherItemClass,
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'

defineOptions({ inheritAttrs: false })

const {
  value,
  title,
  deployment = null,
  detail = null,
  tooltip,
  tone,
  note = null,
  actionLabel = null,
  actionIcon = null,
  problem = null,
  muted = false,
  switching = false,
  building = false,
  disabled = false,
  unpickable = false,
  editLabel = null
} = defineProps<{
  value: string
  title: string
  deployment?: string | null
  detail?: string | null
  tooltip: string
  /** The deployment's status; leave it out for Comfy Cloud. */
  tone?: DeploymentStatusTone
  note?: string | null
  actionLabel?: string | null
  actionIcon?: string | null
  problem?: { summary: string; message: string | null; fix: string } | null
  muted?: boolean
  switching?: boolean
  building?: boolean
  disabled?: boolean
  unpickable?: boolean
  editLabel?: string | null
}>()

const emit = defineEmits<{
  select: [event: Event]
  edit: []
}>()

const noteId = useId()
const problemId = useId()
const editHintId = useId()
const describedBy = computed(
  () =>
    [note && noteId, problem && problemId, editLabel && editHintId]
      .filter(Boolean)
      .join(' ') || undefined
)

function editOnKey(event: KeyboardEvent) {
  if (!editLabel || event.key.toLowerCase() !== 'e') return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  event.preventDefault()
  event.stopPropagation()
  emit('edit')
}

const showsAction = computed(() => actionLabel !== null && !switching)
const detailClass = computed(() =>
  cn(
    'w-14 shrink-0 truncate tabular-nums',
    tone === 'failed' && !switching ? 'text-warning' : 'text-muted-foreground'
  )
)

const titleText = useTemplateRef<HTMLElement>('titleText')
const deploymentText = useTemplateRef<HTMLElement>('deploymentText')
const detailCell = useTemplateRef<HTMLElement>('detailCell')
const isTruncated = ref(false)

const tooltipText = computed(() => {
  if (note) return note
  return isTruncated.value ? tooltip : ''
})

function overflows(element: HTMLElement | null): boolean {
  return element !== null && element.scrollWidth > element.clientWidth
}

function measureTruncation() {
  isTruncated.value = [titleText, deploymentText, detailCell].some((cell) =>
    overflows(cell.value)
  )
}

onMounted(measureTruncation)
onUpdated(measureTruncation)
useResizeObserver([titleText, deploymentText, detailCell], measureTruncation)
</script>
