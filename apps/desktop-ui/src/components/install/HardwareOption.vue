<template>
  <div class="relative">
    <!-- Recommended Badge -->
    <button
      :class="
        cn(
          'hardware-option flex h-[190px] w-[170px] flex-col items-center rounded-3xl border-4 bg-neutral-900/70 p-5 transition-all duration-200',
          selected ? 'border-solid border-brand-yellow' : 'border-transparent'
        )
      "
      @click="$emit('click')"
    >
      <!-- Icon/Logo Area - Rounded square container -->
      <div
        class="icon-container flex h-[110px] w-[110px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800"
      >
        <img
          v-if="imagePath"
          :src="imagePath"
          :alt="placeholderText"
          class="h-full w-full object-cover"
          style="object-position: 57% center"
          draggable="false"
        >
        <span
          v-else
          class="text-xl font-medium text-neutral-400"
        >
          {{ placeholderText }}
        </span>
      </div>

      <!-- Text Content -->
      <div
        v-if="subtitle"
        class="mt-4 text-center"
      >
        <div class="text-sm text-neutral-500">
          {{ subtitle }}
        </div>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

interface Props {
  imagePath?: string
  placeholderText: string
  subtitle?: string
  selected?: boolean
}

defineProps<Props>()

defineEmits<{ click: [] }>()
</script>
