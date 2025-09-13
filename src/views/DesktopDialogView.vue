<template>
  <div class="desktop-dialog">
    <div class="dialog-container">
      <div class="dialog-title">{{ title }}</div>
      <div class="dialog-message">{{ message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Get title and message from query parameters
const title = computed(() => (route.query.title as string) || 'Dialog')
const message = computed(() => (route.query.message as string) || '')
</script>

<style scoped>
.desktop-dialog {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.dialog-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 32px;
  width: 90%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 12px;
}

.dialog-message {
  font-size: 14px;
  color: #4a5568;
  line-height: 1.6;
}
</style>
