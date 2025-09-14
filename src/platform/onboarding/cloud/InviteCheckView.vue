<template>
  <BaseViewTemplate dark />
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getInviteCodeStatus } from '@/api/auth'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  await nextTick()

  const inviteCode = route.query.inviteCode as string
  const inviteCodeStatus = await getInviteCodeStatus(inviteCode)

  // TODO: should be deleted when api is ready
  // if (!status.emailVerified) {
  //   await router.push({ name: 'cloud-verify-email' })
  //   return
  // }

  if (inviteCodeStatus.expired) {
    await router.push({ name: 'cloud-sorry-contact-support' })
    return
  }

  await router.push({ name: 'cloud-claim-invite' })
})
</script>
