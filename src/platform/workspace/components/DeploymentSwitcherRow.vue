<template>
  <TextTooltip :text="tooltipText" side="left">
    <MenuRadioItem
      v-bind="$attrs"
      :value
      :disabled
      :aria-describedby="note ? noteId : undefined"
      :class="itemClass"
      @select="emit('select', $event)"
    >
      <DeploymentStatusIcon
        :tone
        icon-class="size-3.5 text-muted-foreground"
        ring-class="ring-1 ring-background group-data-highlighted:ring-accent group-aria-checked:ring-secondary group-aria-checked:group-data-highlighted:ring-accent"
      />
      <span ref="titleText" :class="titleClass">{{ title }}</span>
      <span
        v-if="tone"
        ref="deploymentText"
        class="w-16 shrink-0 truncate text-muted-foreground"
        data-testid="deployment-row-name"
      >
        {{ deployment }}
      </span>
      <span :class="detailClass" data-testid="deployment-row-detail">
        <span
          v-if="showsAction"
          class="flex h-6 items-center rounded-md bg-accent px-2.5 text-foreground group-data-highlighted:bg-muted"
          aria-hidden="true"
        >
          {{ actionLabel }}
        </span>
        <template v-else>{{ detailText }}</template>
      </span>
      <span :class="switcherTrailingSlotClass">
        <i
          v-if="switching"
          class="icon-[lucide--loader-circle] size-3.5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <DropdownMenuItemIndicator v-else class="flex">
          <i
            class="icon-[lucide--check] size-3.5 text-foreground"
            aria-hidden="true"
          />
        </DropdownMenuItemIndicator>
      </span>
      <span v-if="note" :id="noteId" hidden>{{ note }}</span>
    </MenuRadioItem>
  </TextTooltip>
  <div
    v-if="problem"
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
import { DropdownMenuItemIndicator } from 'reka-ui'
import { computed, onMounted, onUpdated, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuRadioItem from '@/components/ui/menu/MenuRadioItem.vue'
import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
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
  problem = null,
  muted = false,
  switching = false,
  disabled = false
} = defineProps<{
  value: string
  title: string
  /** The deployment's own name, in the column after the Build. */
  deployment?: string | null
  /** The Release version when ready, else the status. */
  detail?: string | null
  /** The row's full label, shown beside it when a name is cut off. */
  tooltip?: string
  /** The deployment's status; leave it out for Comfy Cloud. */
  tone?: DeploymentStatusTone
  /** Why the row cannot be picked or run the workflow, on hover and as its description. */
  note?: string | null
  /** The action choosing the row takes, such as Start, shown as its button. */
  actionLabel?: string | null
  /** Why a Start did not happen, said under the row. */
  problem?: { summary: string; message: string | null; fix: string } | null
  /** Dims the names of a row that cannot be picked, in place of fading it. */
  muted?: boolean
  switching?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [event: Event]
}>()

const { t } = useI18n()

const noteId = useId()

const itemClass = computed(() =>
  cn(
    switcherItemClass,
    'aria-checked:bg-secondary aria-checked:data-highlighted:bg-accent',
    muted && !switching && 'data-disabled:opacity-100'
  )
)
const titleClass = computed(() =>
  cn(
    'min-w-0 flex-1 truncate',
    muted ? 'text-muted-foreground' : 'text-foreground'
  )
)
const detailClass = computed(() =>
  cn(
    'flex w-14 shrink-0 truncate tabular-nums',
    tone === 'failed' && !switching ? 'text-warning' : 'text-muted-foreground'
  )
)
const showsAction = computed(() => actionLabel !== null && !switching)
const detailText = computed(() =>
  switching ? t('deploymentSwitcher.switching') : detail
)

const titleText = useTemplateRef<HTMLElement>('titleText')
const deploymentText = useTemplateRef<HTMLElement>('deploymentText')
const isTruncated = ref(false)

const tooltipText = computed(() => {
  if (note) return note
  return isTruncated.value ? (tooltip ?? title) : ''
})

function overflows(element: HTMLElement | null): boolean {
  return element !== null && element.scrollWidth > element.clientWidth
}

function measureTruncation() {
  isTruncated.value =
    overflows(titleText.value) || overflows(deploymentText.value)
}

onMounted(measureTruncation)
onUpdated(measureTruncation)
</script>
