<!-- A message that displays the current user -->
<template>
  <Message
    v-if="userStore.isMultiUserServer"
    severity="info"
    data-testid="current-user-indicator"
  >
    <template #icon>
      <i class="icon-[lucide--user]" />
    </template>
    <div class="flex items-center justify-between">
      <div class="tabular-nums">
        {{ $t('g.currentUser') }}: {{ userStore.currentUser?.username }}
      </div>
      <Button
        class="text-inherit"
        variant="textonly"
        size="icon"
        :aria-label="$t('menuLabels.Sign Out')"
        @click="logout"
      >
        <i class="icon-[lucide--log-out]" />
      </Button>
    </div>
  </Message>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Message from '@comfyorg/design-system/message/Message'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const logout = async () => {
  await userStore.logout()
  window.location.reload()
}
</script>
