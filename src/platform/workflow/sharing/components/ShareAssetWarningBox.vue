<template>
  <div class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
    <div class="flex items-start gap-2">
      <i
        class="icon-[lucide--triangle-alert] mt-0.5 size-4 shrink-0 text-amber-500"
      />
      <p class="m-0 text-xs text-muted-foreground">
        {{ $t('shareWorkflow.assetWarningTitle') }}
      </p>
    </div>

    <div v-if="assets.length > 0" class="mt-3">
      <CollapsibleRoot v-model:open="assetsOpen">
        <CollapsibleTrigger
          class="flex w-full cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-xs font-medium text-base-foreground"
        >
          <i
            :class="
              cn(
                'icon-[lucide--chevron-right] size-3.5 transition-transform',
                assetsOpen && 'rotate-90'
              )
            "
          />
          {{ $t('shareWorkflow.assetsLabel', { count: assets.length }) }}
        </CollapsibleTrigger>
        <CollapsibleContent class="mt-2 flex flex-col gap-1.5 pl-5">
          <div
            v-for="asset in assets"
            :key="asset.name"
            class="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <i class="icon-[lucide--file] size-3.5 shrink-0" />
            <span class="truncate">{{ asset.name }}</span>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>

    <div v-if="models.length > 0" class="mt-2">
      <CollapsibleRoot v-model:open="modelsOpen">
        <CollapsibleTrigger
          class="flex w-full cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-xs font-medium text-base-foreground"
        >
          <i
            :class="
              cn(
                'icon-[lucide--chevron-right] size-3.5 transition-transform',
                modelsOpen && 'rotate-90'
              )
            "
          />
          {{ $t('shareWorkflow.modelsLabel', { count: models.length }) }}
        </CollapsibleTrigger>
        <CollapsibleContent class="mt-2 flex flex-col gap-1.5 pl-5">
          <div
            v-for="model in models"
            :key="model.name"
            class="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <i class="icon-[lucide--box] size-3.5 shrink-0" />
            <span class="truncate">{{ model.name }}</span>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>

    <label class="mt-3 flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        :checked="acknowledged"
        class="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary-background"
        @change="
          $emit(
            'update:acknowledged',
            ($event.target as HTMLInputElement).checked
          )
        "
      />
      <span class="text-xs text-muted-foreground">
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

import type {
  WorkflowAsset,
  WorkflowModel
} from '@/platform/workflow/sharing/types/shareTypes'
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  assets: WorkflowAsset[]
  models: WorkflowModel[]
  acknowledged: boolean
}>()

defineEmits<{
  'update:acknowledged': [value: boolean]
}>()

const assetsOpen = ref(false)
const modelsOpen = ref(false)
</script>
