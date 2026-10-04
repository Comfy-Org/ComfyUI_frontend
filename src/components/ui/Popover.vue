<script setup lang="ts">
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import { ref, toValue } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import {
  menuButtonClass,
  menuContentClass
} from '@/components/ui/menu/menuStyles'
import type { MenuItem } from '@/components/ui/menu/types'
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
        :class="
          cn(
            entries
              ? menuContentClass
              : 'z-1700 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm',
            $attrs.class,
            'will-change-[transform,opacity] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
          )
        "
      >
        <slot :close>
          <div class="flex flex-col">
            <template
              v-for="(item, index) in entries ?? []"
              :key="
                item.key ??
                (typeof item.label === 'string' ? item.label : index)
              "
            >
              <div v-if="item.separator" class="my-1 h-px bg-border-subtle" />
              <button
                v-else
                type="button"
                :class="menuButtonClass"
                :disabled="toValue(item.disabled) || !item.command"
                @click="
                  (e) => {
                    if (!item.command || toValue(item.disabled)) return
                    item.command({ originalEvent: e, item })
                    close()
                  }
                "
              >
                <i v-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
                {{ toValue(item.label) }}
              </button>
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
