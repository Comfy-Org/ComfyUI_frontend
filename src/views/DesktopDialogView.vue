<template>
  <div class="desktop-dialog">
    <div class="dialog-title">{{ title }}</div>
    <div class="dialog-message">{{ message }}</div>
    <div class="dialog-actions">
      <button class="dialog-button">{{ t('g.close') }}</button>
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
@reference '../assets/css/style.css';

.desktop-dialog {
  @apply flex flex-col p-6 rounded-lg gap-6;
  width: 100%;
  height: 100%;
  background: #2d2d2d;
}

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

.dialog-message {
  @apply font-sans text-sm m-0;
  color: #b0b0b0;
  line-height: 1.6;
}

.dialog-actions {
  @apply flex w-full justify-end mt-auto;
}

.dialog-button {
  @apply px-6 py-2.5 border-none rounded-md text-sm font-medium font-sans cursor-pointer;
  @apply transition-all duration-200 ease-in-out;
  background: #f0ff41;
  color: #1a1a1a;
}

.dialog-button:hover {
  @apply -translate-y-px;
  background: #d9e639;
}

.dialog-button:active {
  @apply translate-y-0;
}
</style>
