<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

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
</script>

<template>
  <PopoverRoot v-slot="{ close }">
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
      >
        <slot :close>
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
                    close()
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
