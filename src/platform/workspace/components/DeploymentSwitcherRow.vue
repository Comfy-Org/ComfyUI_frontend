<template>
  <TextTooltip :text="tooltipText" side="left">
    <MenuRadioItem
      v-bind="$attrs"
      :value
      :disabled
      :aria-describedby="compatibilityNote ? noteId : undefined"
      :class="
        cn(
          switcherItemClass,
          'aria-checked:bg-secondary aria-checked:data-highlighted:bg-accent'
        )
      "
      @select="emit('select', $event)"
    >
      <DeploymentStatusIcon
        :tone
        icon-class="size-3.5 text-muted-foreground"
        ring-class="ring-1 ring-background group-data-highlighted:ring-accent group-aria-checked:ring-secondary group-aria-checked:group-data-highlighted:ring-accent"
      />
      <span ref="titleText" class="min-w-0 flex-1 truncate text-foreground">
        {{ title }}
      </span>
      <span
        ref="deploymentText"
        class="w-16 shrink-0 truncate text-muted-foreground"
      >
        {{ deployment }}
      </span>
      <span
        ref="detailCell"
        :class="
          cn(
            'w-14 shrink-0 truncate tabular-nums',
            tone === 'failed' && !switching
              ? 'text-warning'
              : 'text-muted-foreground'
          )
        "
      >
        {{ switching ? $t('deploymentSwitcher.switching') : detail }}
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
      <span v-if="compatibilityNote" :id="noteId" hidden>
        {{ compatibilityNote }}
      </span>
    </MenuRadioItem>
  </TextTooltip>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { DropdownMenuItemIndicator } from 'reka-ui'
import { computed, onMounted, onUpdated, ref, useId, useTemplateRef } from 'vue'

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
  compatibilityNote = null,
  switching = false,
  disabled = false
} = defineProps<{
  value: string
  title: string
  deployment?: string | null
  detail?: string | null
  tooltip: string
  /** The deployment's status; leave it out for Comfy Cloud. */
  tone?: DeploymentStatusTone
  compatibilityNote?: string | null
  switching?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [event: Event]
}>()

const noteId = useId()

const titleText = useTemplateRef<HTMLElement>('titleText')
const deploymentText = useTemplateRef<HTMLElement>('deploymentText')
const detailCell = useTemplateRef<HTMLElement>('detailCell')
const isTruncated = ref(false)

const tooltipText = computed(() => {
  if (compatibilityNote) return compatibilityNote
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
