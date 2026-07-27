<template>
  <div class="inline-flex items-center">
    <DropdownMenuRoot v-model:open="open">
      <DropdownMenuTrigger as-child>
        <Button
          variant="secondary"
          size="icon"
          :aria-label="$t('assetBrowser.filterBy')"
        >
          <i class="icon-[lucide--list-filter]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="bottom"
          :side-offset="5"
          :collision-padding="10"
          :style="contentStyle"
          class="z-1700 min-w-55 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm"
        >
          <slot />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

const open = ref(false)
const contentStyle = useModalLiftedZIndex(open)
</script>
