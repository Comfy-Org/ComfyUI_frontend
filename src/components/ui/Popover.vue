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
        class="rounded-lg p-2 bg-base-background shadow-sm border border-border-subtle will-change-[transform,opacity] data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade"
      >
        <slot>
          <div class="flex flex-col p-1">
            <section
              v-for="(entryGroup, index) in entries ?? []"
              :key="index"
              class="flex flex-col border-b-2 last:border-none border-border-subtle"
            >
              <div
                v-for="{ label, action, icon } in entryGroup"
                :key="label"
                :class="
                  cn(
                    'flex flex-row gap-4 p-2 rounded-sm my-1',
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
                <i v-if="icon" :class="icon" />
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
