<template>
  <div class="inline-flex items-center">
    <DropdownMenuRoot v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <Button
          variant="secondary"
          size="icon"
          :aria-label="$t('assetBrowser.filterBy')"
        >
          <i class="icon-[lucide--list-filter]" />
          <span
            v-if="active"
            data-testid="active-filter-indicator"
            aria-hidden="true"
            class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-base-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="bottom"
          :side-offset="5"
          :collision-padding="10"
          :style="contentStyle"
          class="data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-1700 min-w-55 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[transform,opacity]"
        >
          <slot />
          <DropdownMenuArrow
            class="fill-base-background stroke-border-subtle"
          />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<script setup lang="ts">
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

const { active = false } = defineProps<{
  active?: boolean
}>()

const open = ref(false)
const contentStyle = useModalLiftedZIndex(open)
</script>
