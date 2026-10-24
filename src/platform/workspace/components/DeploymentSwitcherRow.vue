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
        {{ detailText }}
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
    'w-14 shrink-0 truncate tabular-nums',
    tone === 'failed' && !switching ? 'text-warning' : 'text-muted-foreground'
  )
)
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
