<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

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
const contentStyle = useModalLiftedZIndex(open)

/**
 * Escape has to be handled here rather than left to Reka's DismissableLayer:
 * the global keybinding handler preventDefaults it first, so the layer skips
 * its own dismiss and the popover would never close from the keyboard.
 *
 * Listening on the document (not the content) means it works wherever focus
 * sits. Nested layers that own Escape — the select/combobox portals via
 * `stopEscapeToDocument`, or a facet list with `@keydown.escape.stop` — stop
 * the event before it gets here, so the innermost thing still closes first.
 */
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) open.value = false
})
</script>

<template>
  <PopoverRoot v-slot="{ close }" v-model:open="open">
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
        :style="contentStyle"
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
