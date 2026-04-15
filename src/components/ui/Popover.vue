<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

defineOptions({
  inheritAttrs: false
})

const {
  entries,
  icon,
  to,
  showArrow = true
} = defineProps<{
  entries?: MenuItem[]
  icon?: string
  to?: string | HTMLElement
  showArrow?: boolean
}>()

const open = ref(false)

// Custom click-outside handler since we disabled reka-ui's interact-outside.
// reka-ui's DismissableLayer cannot distinguish between genuine outside clicks
// and interactions with nested dismiss layers (e.g. ComboboxContent dropdowns).
watch(open, (isOpen) => {
  if (!isOpen) return
  requestAnimationFrame(() => {
    const cleanup = useEventListener(
      document,
      'pointerdown',
      (e: PointerEvent) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-reka-popper-content-wrapper]')) return
        if (target.closest('[role="listbox"]')) return
        if (target.closest('[role="option"]')) return
        open.value = false
        cleanup()
      }
    )
  })
})
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="button">
        <Button size="icon">
          <i :class="icon ?? 'icon-[lucide--ellipsis]'" />
        </Button>
      </slot>
    </PopoverTrigger>
    <PopoverPortal :to>
      <PopoverContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        v-bind="$attrs"
        class="data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-1700 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[transform,opacity]"
        @interact-outside.prevent
      >
        <slot :close="() => (open = false)">
          <div class="flex flex-col p-1">
            <template v-for="item in entries ?? []" :key="item.label">
              <div
                v-if="item.separator"
                class="w-full border-b border-border-subtle"
              />
              <div
                v-else
                :class="
                  cn(
                    'my-1 flex flex-row gap-4 rounded-sm p-2',
                    item.disabled
                      ? 'pointer-events-none opacity-50'
                      : item.command &&
                          'cursor-pointer hover:bg-secondary-background-hover'
                  )
                "
                @click="
                  (e) => {
                    if (!item.command || item.disabled) return
                    item.command({ originalEvent: e, item })
                    open = false
                  }
                "
              >
                <i v-if="item.icon" :class="item.icon" />
                {{ item.label }}
              </div>
            </template>
          </div>
        </slot>
        <PopoverArrow
          v-if="showArrow"
          class="fill-base-background stroke-border-subtle"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
