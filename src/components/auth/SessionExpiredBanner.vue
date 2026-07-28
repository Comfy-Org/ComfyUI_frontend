<template>
  <div
    v-if="sessionSuspended"
    class="pointer-events-none fixed inset-x-0 bottom-4 z-1200 flex justify-center p-2"
    role="alert"
    aria-live="assertive"
    data-testid="session-expired-banner"
  >
    <div
      class="pointer-events-auto flex max-w-2xl items-center gap-3 rounded-lg bg-secondary-background px-4 py-3 shadow-lg"
    >
      <i class="text-danger icon-[lucide--triangle-alert] size-5 shrink-0" />
      <div class="flex flex-col">
        <span class="font-medium">{{ t('auth.sessionExpired.title') }}</span>
        <span class="text-sm opacity-80">
          {{ t('auth.sessionExpired.detail') }}
        </span>
      </div>
      <Button
        class="ml-2 shrink-0"
        :loading="isReauthenticating"
        @click="reauthenticate"
      >
        {{ t('auth.sessionExpired.action') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useI18n } from 'vue-i18n'

import { useSessionReauth } from '@/composables/auth/useSessionReauth'
import { sessionSuspended } from '@/platform/auth/session/sessionExpiry'

const { t } = useI18n()
const { isReauthenticating, reauthenticate } = useSessionReauth()
</script>
