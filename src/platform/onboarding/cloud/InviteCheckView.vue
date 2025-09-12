<template>
  <BaseViewTemplate dark />
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { getInviteStatus } from '@/api/auth'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const router = useRouter()
const status = getInviteStatus()

onMounted(async () => {
  await nextTick()

  // TODO: should be deleted when api is ready
  if (!status.emailVerified) {
    await router.push({ name: 'cloud-verify-email' })
    return
  }

  if (status.alreadyClaimed) {
    await router.push({ name: 'cloud-sorry-contact-support' })
    return
  }

  await router.push({ name: 'cloud-claim-invite' })
})
</script>
