<script setup lang="ts">
import CreditBadge from '@comfyorg/design-system/badge/CreditBadge'
import Button from '@comfyorg/design-system/button/Button'
import TransitionCollapse from '@comfyorg/design-system/transition/TransitionCollapse'
import { cn } from '@comfyorg/tailwind-utils'

const { open, title, summary, icon, credits } = defineProps<{
  open: boolean
  title: string
  summary: string
  icon: string
  credits?: string
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div
    class="mx-3 overflow-hidden rounded-xl border border-node-border bg-node"
  >
    <Button
      variant="textonly"
      size="unset"
      class="flex h-7 w-full justify-start gap-2 rounded-none px-2 text-xs font-normal text-node-foreground"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <i :class="cn('size-3.5', icon)" />
      <span class="min-w-0 truncate text-foreground">{{ title }}</span>
      <span class="ml-auto min-w-0 truncate text-muted-foreground">
        {{ summary }}
      </span>
      <CreditBadge v-if="credits" :text="credits" />
      <i
        :class="
          cn(
            'icon-[lucide--chevron-down] size-3.5 transition-transform',
            open && 'rotate-180'
          )
        "
      />
    </Button>
    <TransitionCollapse>
      <div v-if="open" class="border-t border-node-border p-2" data-no-drag>
        <slot />
      </div>
    </TransitionCollapse>
  </div>
</template>
