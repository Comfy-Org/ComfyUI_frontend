<!-- A message that displays the current user -->
<template>
  <Message
    v-if="userStore.isMultiUserServer"
    severity="info"
    icon="pi pi-user"
    pt:text="w-full"
  >
    <div class="flex items-center justify-between">
      <div>
        {{ $t('g.currentUser') }}: {{ userStore.currentUser?.username }}
      </div>
      <Button icon="pi pi-sign-out" text @click="logout" />
    </div>
  </Message>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'

import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const logout = async () => {
  await userStore.logout()
  window.location.reload()
}
</script>
