<template>
  <div class="rounded-lg flex flex-col gap-2">
    <div class="flex items-start gap-2 my-0">
      <i
        class="icon-[lucide--circle-alert] my-auto size-4 shrink-0 text-warning-background"
      />
      <p class="m-0 text-xs text-muted-foreground">
        {{ $t('shareWorkflow.createLinkDescription') }}
      </p>
    </div>

    <div
      v-for="section in sections"
      :key="section.labelKey"
      class="flex flex-col gap-2 my-0"
    >
      <p class="m-0 px-2 pb-1 pt-3 text-sm text-muted-foreground">
        {{ $t(section.labelKey, section.items.length) }}
      </p>
      <div
        class="max-h-[101px] overflow-y-auto rounded-lg border border-border-subtle bg-secondary-background py-2"
      >
        <div
          v-for="item in section.items"
          :key="item.name"
          class="flex items-center gap-2 p-2"
        >
          <span class="truncate text-sm text-base-foreground">
            {{ item.name }}
          </span>
        </div>
      </div>
    </div>

    <label class="mt-3 flex cursor-pointer items-center gap-2">
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
      <span class="text-xs text-base-foreground font-bold">
        {{ $t('shareWorkflow.acknowledgeCheckbox') }}
      </span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type {
  WorkflowAsset,
  WorkflowModel
} from '@/platform/workflow/sharing/types/shareTypes'

const { assets, models } = defineProps<{
  assets: WorkflowAsset[]
  models: WorkflowModel[]
  acknowledged: boolean
}>()

defineEmits<{
  'update:acknowledged': [value: boolean]
}>()

const sections = computed(() =>
  [
    { labelKey: 'shareWorkflow.assetsLabel', items: assets },
    { labelKey: 'shareWorkflow.modelsLabel', items: models }
  ].filter((s) => s.items.length > 0)
)
</script>
