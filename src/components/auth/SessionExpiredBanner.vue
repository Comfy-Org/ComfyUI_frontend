<template>
  <NotificationPopup
    v-if="sessionSuspended && !onPublicRoute"
    icon="text-danger-200 icon-[lucide--triangle-alert]"
    :title="t('auth.sessionExpired.title')"
    :subtitle="t('auth.sessionExpired.detail')"
    position="bottom-right"
    role="alert"
    aria-live="assertive"
    data-testid="session-expired-banner"
  >
    <template #footer-end>
      <Button :loading="isReauthenticating" @click="reauthenticate">
        {{ t('auth.sessionExpired.action') }}
      </Button>
    </template>
  </NotificationPopup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import NotificationPopup from '@/components/common/NotificationPopup.vue'
import Button from '@/components/ui/button/Button.vue'
import { useSessionReauth } from '@/composables/auth/useSessionReauth'
import { isPublicRoute } from '@/platform/auth/session/publicRoutes'
import { sessionSuspended } from '@/platform/auth/session/sessionExpiry'

const { t } = useI18n()
const route = useRoute()
const onPublicRoute = computed(() => isPublicRoute(route))
const { isReauthenticating, reauthenticate } = useSessionReauth()
</script>
