<template>
  <div class="flex flex-col gap-2">
    <div v-if="showDivider" class="flex items-center justify-center py-0.5">
      <span class="text-[10px] font-bold text-muted-foreground">
        {{ t('rightSidePanel.missingModels.or') }}
      </span>
    </div>

    <SelectPlus
      :model-value="modelValue"
      :options="options"
      option-label="name"
      option-value="value"
      :disabled="options.length === 0"
      :filter="options.length > 4"
      auto-filter-focus
      :aria-label="t('rightSidePanel.missingModels.useFromLibrary')"
      :placeholder="t('rightSidePanel.missingModels.useFromLibrary')"
      class="h-8 w-full rounded-lg border border-transparent bg-secondary-background text-xs transition-colors hover:border-interface-stroke"
      size="small"
      :pt="{
        option: 'text-xs',
        dropdown: 'w-8',
        label: 'min-w-[4ch] truncate text-xs',
        overlay: 'w-fit min-w-full'
      }"
      @update:model-value="emit('select', $event)"
    >
      <template #dropdownicon>
        <i class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground" />
      </template>
    </SelectPlus>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SelectPlus from '@/components/primevueOverride/SelectPlus.vue'

const { showDivider = false } = defineProps<{
  modelValue: string | undefined
  options: { name: string; value: string }[]
  showDivider?: boolean
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

const { t } = useI18n()
</script>
