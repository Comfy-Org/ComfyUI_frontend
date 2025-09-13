<template>
  <div class="desktop-dialog">
    <div class="dialog-container">
      <div class="dialog-title">{{ title }}</div>
      <div class="dialog-message">{{ message }}</div>
      <div class="dialog-actions">
        <button class="dialog-button">{{ t('common.close') }}</button>
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

.desktop-dialog {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
}

.dialog-container {
  display: flex;
  width: 448px;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  border-radius: 8px;
  padding: 24px;
  background: #2d2d2d;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease-out;
}

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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #b0b0b0;
  line-height: 1.6;
  margin: 0;
}

.dialog-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  margin-top: 8px;
}

.dialog-button {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f0ff41;
  color: #1a1a1a;
}

.dialog-button:hover {
  background: #d9e639;
  transform: translateY(-1px);
}

.dialog-button:active {
  transform: translateY(0);
}
</style>
