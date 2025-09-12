<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="cloud-verify-email">
    <h1>Email Verification</h1>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { verifyEmail } from '@/api/auth'

const route = useRoute()

onMounted(async () => {
  const token = route.query.token as string
  if (token) {
    verifyEmail()
  }
})
</script>

<style scoped>
.cloud-verify-email {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: monospace;
  gap: 1rem;
}

button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
</style>
