<template>
  <div class="w-screen h-screen flex items-center justify-center bg-[#1a1a1a]">
    <div
      class="flex w-[448px] flex-col items-start gap-6 rounded-lg p-6 bg-[#2d2d2d] shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-slideIn"
    >
      <div class="dialog-title">{{ title }}</div>
      <div class="font-sans text-sm text-[#b0b0b0] leading-[1.6] m-0">
        {{ message }}
      </div>
      <div class="flex w-full justify-end mt-2">
        <button
          class="px-6 py-2.5 border-none rounded-md text-sm font-medium font-sans cursor-pointer transition-all duration-200 ease-in-out bg-[#f0ff41] text-[#1a1a1a] hover:bg-[#d9e639] hover:-translate-y-px active:translate-y-0"
        >
          {{ t('g.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const route = useRoute()
const { t } = useI18n()

// Get title and message from query parameters
const title = computed(() => (route.query.title as string) || 'Quick Setup')
const message = computed(() => (route.query.message as string) || '')
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=ABC+ROM:ital@1&display=swap');

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out;
}

/* Custom styles that can't be precisely replicated with Tailwind */
.dialog-title {
  font-family:
    'ABC ROM',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-style: italic;
  font-size: 20px;
  font-weight: 500;
  color: #ffffff;
  margin: 0;
}
</style>
