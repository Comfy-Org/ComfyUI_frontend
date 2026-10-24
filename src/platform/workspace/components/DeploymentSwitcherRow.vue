<template>
  <MenuRadioItem
    :value
    :disabled
    :aria-describedby="missingNodeNames ? missingNodesId : undefined"
    :class="
      cn(
        switcherItemClass,
        'data-[state=checked]:bg-secondary data-[state=checked]:data-highlighted:bg-accent'
      )
    "
    @select="emit('select', $event)"
  >
    <DeploymentStatusIcon
      :tone
      icon-class="size-3.5 text-muted-foreground"
      ring-class="ring-1 ring-background group-data-highlighted:ring-accent group-data-[state=checked]:ring-secondary group-data-[state=checked]:group-data-highlighted:ring-accent"
    />
    <span class="max-w-3/5 shrink-0 truncate text-foreground" :title>
      {{ title }}
    </span>
    <span
      v-if="subtitle"
      class="min-w-0 truncate text-muted-foreground"
      :title="subtitle"
    >
      {{ subtitle }}
    </span>
    <span
      class="ml-auto flex shrink-0 items-center gap-1.5 pl-4 text-muted-foreground tabular-nums"
    >
      <template v-if="switching">
        <i
          class="icon-[lucide--loader-circle] size-3.5 animate-spin"
          aria-hidden="true"
        />
        {{ $t('deploymentSwitcher.switching') }}
      </template>
      <template v-else>
        <span
          v-if="markView"
          :class="cn('flex items-center gap-1', markView.class)"
          :title="missingNodeNames"
          data-testid="deployment-row-mark"
        >
          <i
            v-if="markView.icon"
            aria-hidden="true"
            :class="cn(markView.icon, 'size-3 shrink-0')"
          />
          {{ markView.text }}
        </span>
        <span v-if="meta">{{ meta }}</span>
        <span :class="switcherTrailingSlotClass">
          <DropdownMenuItemIndicator class="flex">
            <i
              class="icon-[lucide--check] size-3.5 text-foreground"
              aria-hidden="true"
            />
          </DropdownMenuItemIndicator>
        </span>
      </template>
    </span>
    <span v-if="missingNodeNames" :id="missingNodesId" hidden>
      {{ missingNodeNames }}
    </span>
  </MenuRadioItem>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { DropdownMenuItemIndicator } from 'reka-ui'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuRadioItem from '@/components/ui/menu/MenuRadioItem.vue'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import {
  switcherItemClass,
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'

const {
  value,
  title,
  subtitle = null,
  tone,
  meta = null,
  switching = false,
  disabled = false,
  mark = null
} = defineProps<{
  value: string
  title: string
  subtitle?: string | null
  /** The deployment's status; leave it out for Comfy Cloud. */
  tone?: DeploymentStatusTone
  meta?: string | null
  switching?: boolean
  disabled?: boolean
  /** Whether the deployment can run the open workflow; null says nothing. */
  mark?: DeploymentCompatibilityMark | null
}>()

const emit = defineEmits<{
  select: [event: Event]
}>()

const { t } = useI18n()

const missingNodesId = useId()

const missingNodeNames = computed(() =>
  mark?.kind === 'missing' ? mark.nodeTypes.join(', ') : undefined
)

const markView = computed(() => {
  if (mark === null) return null
  if (mark.kind === 'runs') {
    return {
      class: 'text-success',
      icon: 'icon-[lucide--circle-check]',
      text: t('deploymentSwitcher.runsThisWorkflow')
    }
  }
  if (mark.kind === 'missing') {
    return {
      class: 'text-warning',
      icon: 'icon-[lucide--triangle-alert]',
      text: t('deploymentSwitcher.missingNodes', mark.nodeTypes.length)
    }
  }
  return {
    class: 'text-muted-foreground',
    icon: null,
    text: t('deploymentSwitcher.notChecked')
  }
})
</script>
