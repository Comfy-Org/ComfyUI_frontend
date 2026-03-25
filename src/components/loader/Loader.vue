<template>
  <span role="status" class="inline-flex">
    <i
      v-if="variant === 'loader'"
      aria-hidden="true"
      :class="cn('icon-[lucide--loader]', sizeClass)"
    >
      <div
        class="size-full animate-spin bg-conic from-base-foreground from-10% to-muted-foreground to-10%"
      />
    </i>
    <i
      v-else
      aria-hidden="true"
      :class="cn('icon-[lucide--loader-circle] animate-spin', sizeClass)"
    />
    <span class="sr-only">{{ t('g.loading') }}</span>
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

const { size } = defineProps<{
  size?: 'sm' | 'md' | 'lg'
  variant?: 'loader-circle' | 'loader'
}>()

const { t } = useI18n()

const sizeMap = {
  sm: 'size-4',
  md: 'size-8',
  lg: 'size-12'
} as const

const sizeClass = size ? sizeMap[size] : ''
</script>
