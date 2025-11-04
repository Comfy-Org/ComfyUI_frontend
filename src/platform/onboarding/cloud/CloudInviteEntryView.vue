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
    // User is logged in - no email verification check needed
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
