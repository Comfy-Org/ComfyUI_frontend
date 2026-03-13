<template>
  <div class="flex flex-col gap-3 rounded-lg">
    <CollapsibleRoot
      v-model:open="isWarningExpanded"
      class="overflow-hidden rounded-lg bg-secondary-background"
    >
      <CollapsibleTrigger as-child>
        <Button
          variant="secondary"
          class="w-full justify-between px-4 py-1 text-sm"
        >
          <i
            class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
            aria-hidden="true"
          />
          <span class="m-0 flex-1 text-left text-sm text-muted-foreground">
            {{ $t('shareWorkflow.privateAssetsDescription') }}
          </span>

          <i
            :class="
              cn(
                'icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground transition-transform',
                isWarningExpanded && 'rotate-90'
              )
            "
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent
        class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
      >
        <AssetSectionList :items />
      </CollapsibleContent>
    </CollapsibleRoot>

    <label class="mt-3 flex cursor-pointer items-center gap-2">
      <input
        v-model="acknowledged"
        type="checkbox"
        class="size-3.5 shrink-0 cursor-pointer accent-primary-background"
      />
      <span class="text-sm text-muted-foreground">
        {{ $t('shareWorkflow.acknowledgeCheckbox') }}
      </span>
    </label>
  </div>
</template>

<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { ref } from 'vue'

import type { AssetInfo } from '@/schemas/apiSchema'
import AssetSectionList from '@/platform/workflow/sharing/components/AssetSectionList.vue'
import { cn } from '@/utils/tailwindUtil'
import Button from '@/components/ui/button/Button.vue'

const { items } = defineProps<{
  items: AssetInfo[]
}>()

const acknowledged = defineModel<boolean>('acknowledged')

const isWarningExpanded = ref(true)
</script>
