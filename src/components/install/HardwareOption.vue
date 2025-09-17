<template>
  <div class="relative">
    <!-- Recommended Badge -->
    <button
      class="hardware-option w-[170px] h-[190px] p-5 flex flex-col items-center rounded-3xl transition-all duration-200 bg-neutral-900/70"
      :class="{
        'border-solid border-4 border-brand-yellow': selected,
        'border-4 border-transparent': !selected
      }"
      @click="$emit('click')"
    >
      <!-- Icon/Logo Area - Rounded square container -->
      <div
        class="icon-container w-[110px] h-[110px] shrink-0 rounded-2xl bg-neutral-800 flex items-center justify-center overflow-hidden"
      >
        <img
          v-if="imagePath"
          :src="imagePath"
          :alt="placeholderText"
          class="w-full h-full object-cover"
          style="object-position: 57% center"
        />
        <span v-else class="text-xl font-medium text-neutral-400">
          {{ placeholderText }}
        </span>
      </div>

      <!-- Text Content -->
      <div v-if="subtitle" class="text-center mt-4">
        <div class="text-sm text-neutral-500">{{ subtitle }}</div>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { TorchDeviceType } from '@comfyorg/comfyui-electron-types'

interface Props {
  imagePath?: string
  placeholderText: string
  subtitle?: string
  value: TorchDeviceType
  selected?: boolean
  recommended?: boolean
}

defineProps<Props>()

defineEmits<{ click: [] }>()
</script>
