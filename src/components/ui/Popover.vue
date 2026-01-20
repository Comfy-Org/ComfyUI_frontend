<script setup lang="ts">
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

defineProps<{
  entries?: { label: string; action?: () => void; icon?: string }[][]
  icon?: string
  to?: string | HTMLElement
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
        class="data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[transform,opacity]"
      >
        <slot>
          <div class="flex flex-col p-1">
            <section
              v-for="(entryGroup, index) in entries ?? []"
              :key="index"
              class="flex flex-col border-b-2 border-border-subtle last:border-none"
            >
              <div
                v-for="{ label, action, icon } in entryGroup"
                :key="label"
                :class="
                  cn(
                    'my-1 flex flex-row gap-4 rounded-sm p-2',
                    action &&
                      'cursor-pointer hover:bg-secondary-background-hover'
                  )
                "
                @click="
                  () => {
                    if (!action) return
                    action()
                    close()
                  }
                "
              >
                <i
                  v-if="icon"
                  :class="icon"
                />
                {{ label }}
              </div>
            </section>
          </div>
        </slot>
        <PopoverArrow class="fill-base-background stroke-border-subtle" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
