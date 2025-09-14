<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div>
    <h1>Email Verification</h1>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

// import { verifyEmail } from '@/api/auth'
import router from '@/router'

onMounted(async () => {
  // verifyEmail()
  await router.push({ name: 'cloud-invite-check' })
})
</script>
