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

defineProps<{
  entries: { label: string; action?: () => void; icon?: string }[][]
  icon?: string
}>()
</script>

<template>
  <PopoverRoot v-slot="{ close }">
    <PopoverTrigger as-child>
      <slot name="button">
        <Button size="icon">
          <i :class="icon" />
        </Button>
      </slot>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="5"
        class="rounded-lg p-2 bg-base-background shadow-sm border border-border-subtle will-change-[transform,opacity] data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade"
      >
        <slot>
          <div class="flex flex-col p-1">
            <entry-group
              v-for="(entryGroup, index) in entries"
              :key="index"
              class="flex flex-col border-b-2 last:border-none border-border-subtle"
            >
              <entry-item
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
              </entry-item>
            </entry-group>
          </div>
        </slot>
        <PopoverArrow class="fill-base-background stroke-border-subtle" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
