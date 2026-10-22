<template>
  <MenuRadioItem
    :value
    :disabled
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
    <span class="min-w-0 truncate text-foreground">{{ title }}</span>
    <span v-if="subtitle" class="shrink-0 text-muted-foreground">
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
  </MenuRadioItem>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { DropdownMenuItemIndicator } from 'reka-ui'

import MenuRadioItem from '@/components/ui/menu/MenuRadioItem.vue'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import {
  switcherItemClass,
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'

const {
  value,
  title,
  subtitle = null,
  tone,
  meta = null,
  switching = false,
  disabled = false
} = defineProps<{
  value: string
  title: string
  subtitle?: string | null
  /** The deployment's status; leave it out for Comfy Cloud. */
  tone?: DeploymentStatusTone
  meta?: string | null
  switching?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [event: Event]
}>()
</script>
