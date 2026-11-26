<template>
  <i
    v-if="switching || building"
    :class="
      cn(
        'icon-[lucide--loader-circle] size-3.5 animate-spin text-muted-foreground',
        !switching && editLabel && 'group-data-highlighted:hidden'
      )
    "
    aria-hidden="true"
    data-testid="deployment-row-spinner"
  />
  <DropdownMenuItemIndicator v-else :class="indicatorClass">
    <i
      class="icon-[lucide--check] size-3.5 text-foreground"
      aria-hidden="true"
    />
  </DropdownMenuItemIndicator>
  <button
    v-if="editLabel && !switching"
    type="button"
    tabindex="-1"
    :aria-label="editLabel"
    class="hidden size-5 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground group-data-highlighted:flex hover:text-foreground"
    data-testid="deployment-row-edit"
    @pointerdown.stop
    @pointerup.stop
    @click.stop.prevent="emit('edit')"
  >
    <i class="icon-[lucide--pencil] size-3.5" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { DropdownMenuItemIndicator } from 'reka-ui'
import { computed } from 'vue'

const { switching, building, editLabel } = defineProps<{
  switching: boolean
  building: boolean
  editLabel: string | null
}>()

const emit = defineEmits<{
  edit: []
}>()

const indicatorClass = computed(() =>
  cn('flex', editLabel && 'group-data-highlighted:hidden')
)
</script>
