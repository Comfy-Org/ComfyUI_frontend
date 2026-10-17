<template>
  <div
    v-if="reconnecting"
    role="status"
    class="fixed inset-0 z-10000 flex flex-col items-center justify-center gap-4 bg-base-background p-8 text-center"
  >
    <h1 class="m-0 text-lg font-semibold text-base-foreground">
      {{ $t('auth.webSession.reconnecting.title') }}
    </h1>
    <p class="m-0 max-w-md text-muted-foreground">
      {{ $t('auth.webSession.reconnecting.detail') }}
    </p>
    <Button @click="retry">
      {{ $t('auth.webSession.reconnecting.retry') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import Button from '@/components/ui/button/Button.vue'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'

const { reconnecting } = storeToRefs(useCloudWebSessionStore())

function retry() {
  window.location.reload()
}
</script>
