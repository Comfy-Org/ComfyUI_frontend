<template>
  <div>
    <h1>{{ t('cloudVerifyEmail_title') }}</h1>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

// import { verifyEmail } from '@/api/auth'
// import router from '@/router'

const { t } = useI18n()

onMounted(async () => {
  // verifyEmail()
  // await router.push({ name: 'cloud-invite-check' })
})
</script>
