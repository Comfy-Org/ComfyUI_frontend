<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

const { active = false } = defineProps<{
  active?: boolean
}>()

const emit = defineEmits<{
  select: []
  delete: []
  copy: []
}>()
</script>

<template>
  <li
    class="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary-background-hover"
    :class="{ 'bg-secondary-background': active }"
  >
    <button
      type="button"
      class="flex flex-1 cursor-pointer items-center gap-2 overflow-hidden border-0 bg-transparent text-left text-xs text-base-foreground"
      @click="emit('select')"
    >
      <i
        class="icon-[lucide--circle-check] size-3.5 shrink-0 text-muted-foreground"
      />
      <slot />
    </button>
    <div class="hidden shrink-0 items-center gap-0.5 group-hover:flex">
      <Tooltip :delay-duration="300">
        <TooltipTrigger>
          <button
            type="button"
            class="flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
            :aria-label="$t('g.copy')"
            @click.stop="emit('copy')"
          >
            <i class="icon-[lucide--copy] size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ $t('g.copy') }}</TooltipContent>
      </Tooltip>
      <Tooltip :delay-duration="300">
        <TooltipTrigger>
          <button
            type="button"
            class="hover:text-danger flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-muted-foreground hover:bg-destructive-background/10"
            :aria-label="$t('g.delete')"
            @click.stop="emit('delete')"
          >
            <i class="icon-[lucide--trash-2] size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ $t('g.delete') }}</TooltipContent>
      </Tooltip>
    </div>
  </li>
</template>
