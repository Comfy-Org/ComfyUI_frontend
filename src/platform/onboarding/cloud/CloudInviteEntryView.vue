<template>
  <BaseViewTemplate dark />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const route = useRoute()
const router = useRouter()
const firebaseAuthStore = useFirebaseAuthStore()

onMounted(async () => {
  const inviteCode = route.params.code as string | undefined

  if (firebaseAuthStore.isAuthenticated) {
    const { isEmailVerified } = firebaseAuthStore

    if (!isEmailVerified) {
      // User is logged in but email not verified
      await router.push({ name: 'cloud-verify-email', query: { inviteCode } })
    } else {
      // User is logged in and verified
      if (inviteCode) {
        // Handle invite code flow - go to invite check
        await router.push({
          name: 'cloud-invite-check',
          query: { inviteCode }
        })
      } else {
        // Normal login flow - go to user check
        await router.push({ name: 'cloud-user-check' })
      }
    }
  } else {
    // User is not logged in - proceed to login page
    await router.push({
      name: 'cloud-login',
      query: {
        inviteCode
      }
    })
  }
})
</script>
