<template>
  <div role="radiogroup" v-bind="$attrs" :class="cn('flex flex-col', gapClass)">
    <Button
      v-for="option in viewTypeOptions"
      :key="option.value.toString()"
      role="radio"
      :aria-checked="modelValue === option.value"
      :class="
        cn(
          'flex cursor-pointer items-center gap-2 self-stretch rounded-lg border-none bg-transparent py-2 pr-4 pl-2 text-base-foreground transition-colors hover:bg-secondary-background',
          heightClass,
          modelValue === option.value && 'bg-secondary-background'
        )
      "
      variant="textonly"
      @click="
        modelValue !== option.value && emit('update:modelValue', option.value)
      "
    >
      <div
        class="flex size-8 min-h-8 items-center justify-center rounded-lg bg-secondary-background-hover"
      >
        <i :class="cn(option.icon, 'size-4')" aria-hidden="true" />
      </div>
      <div class="mx-2 flex flex-1 flex-col items-start">
        <span class="text-sm font-medium text-base-foreground">
          {{ option.title }}
        </span>
        <span class="text-xs text-muted-foreground">
          {{ option.subtitle }}
        </span>
      </div>
      <i
        v-if="modelValue === option.value"
        class="icon-[lucide--check] size-4 text-base-foreground"
        aria-hidden="true"
      />
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { size = 'md' } = defineProps<{
  modelValue: boolean
  size?: 'sm' | 'md'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const viewTypeOptions = [
  {
    value: true,
    icon: 'icon-[lucide--app-window]',
    title: t('builderToolbar.app'),
    subtitle: t('builderToolbar.appDescription')
  },
  {
    value: false,
    icon: 'icon-[comfy--workflow]',
    title: t('builderToolbar.nodeGraph'),
    subtitle: t('builderToolbar.nodeGraphDescription')
  }
]
const heightClass = size === 'sm' ? 'h-12' : 'h-14'
const gapClass = size === 'sm' ? 'gap-1' : 'gap-2'
</script>
