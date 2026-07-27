<template>
  <div class="flex flex-col gap-4 p-4">
    <div>
      <h2 class="text-base font-semibold">{{ t('hfAuthSettings.title') }}</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('hfAuthSettings.description') }}
      </p>
    </div>

    <div
      class="flex flex-col gap-2 rounded-lg border border-interface-stroke p-3"
    >
      <div class="flex items-center gap-2">
        <i
          aria-hidden="true"
          :class="
            status.token_available
              ? 'icon-[lucide--check-circle-2] size-4 shrink-0 text-success-background'
              : 'icon-[lucide--circle] size-4 shrink-0 text-muted-foreground'
          "
        />
        <span class="text-sm font-medium">
          {{
            status.token_available
              ? t('hfAuthSettings.loggedIn')
              : t('hfAuthSettings.notLoggedIn')
          }}
        </span>
        <span
          v-if="status.token_available && status.username"
          class="text-xs text-muted-foreground"
        >
          ({{ status.username }})
        </span>
      </div>

      <div class="flex gap-2 pt-1">
        <Button
          v-if="!status.token_available"
          variant="primary"
          size="sm"
          :disabled="busy"
          @click="onLogin"
        >
          <i aria-hidden="true" class="icon-[lucide--log-in] size-4 shrink-0" />
          {{ t('hfAuthSettings.logIn') }}
        </Button>
        <Button
          v-else
          variant="secondary"
          size="sm"
          :disabled="busy"
          @click="onLogout"
        >
          <i
            aria-hidden="true"
            class="icon-[lucide--log-out] size-4 shrink-0"
          />
          {{ t('hfAuthSettings.logOut') }}
        </Button>
      </div>

      <p v-if="errorMessage" class="text-xs text-destructive-background-hover">
        {{ errorMessage }}
      </p>
    </div>

    <p class="text-xs text-muted-foreground">
      {{ t('hfAuthSettings.tokenStorageNote') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import {
  fetchHfAuthTokenStatus,
  logoutHfAuth,
  startHfAuthLogin
} from '@/platform/missingModel/serverDownloads/serverDownloadsApi'
import type { HfAuthTokenStatusResponse } from '@/platform/missingModel/serverDownloads/serverDownloadsApi'

const { t } = useI18n()

const status = ref<HfAuthTokenStatusResponse>({
  token_available: false,
  username: null
})
const busy = ref(false)
const errorMessage = ref<string | null>(null)

// Re-poll after login so the panel reflects the new state. We don't
// know exactly when the user finishes the OAuth tab so we poll a few
// times after starting; once the token shows up, we stop.
let shouldPoll = false
// Bound the post-login poll so an abandoned/failed login can't poll forever.
const MAX_POLL_ATTEMPTS = 150 // ~2.5 min at 1s
const POLL_INTERVAL_MS = 1000

function stopPolling() {
  shouldPoll = false
}

async function refresh() {
  try {
    status.value = await fetchHfAuthTokenStatus()
  } catch (err) {
    console.warn('[HfAuthSettings] status fetch failed:', err)
  }
}

// Recursive timeout (not setInterval) so the next poll is only scheduled
// after the previous refresh resolves — never overlapping requests. The
// `shouldPoll` flag prevents concurrent loops and lets stopPolling() halt the
// chain; any already-scheduled tick no-ops on the guard.
async function pollForToken(attempts = 0) {
  if (!shouldPoll) return
  await refresh()
  if (!shouldPoll) return
  if (status.value.token_available || attempts + 1 >= MAX_POLL_ATTEMPTS) {
    stopPolling()
    return
  }
  setTimeout(() => void pollForToken(attempts + 1), POLL_INTERVAL_MS)
}

onMounted(() => {
  void refresh()
})

// Never leave polling running once this panel is gone.
onUnmounted(stopPolling)

async function onLogin() {
  errorMessage.value = null
  busy.value = true
  try {
    const { authorize_url } = await startHfAuthLogin()
    window.open(authorize_url, '_blank', 'noopener,noreferrer')
    if (!shouldPoll) {
      shouldPoll = true
      void pollForToken()
    }
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : t('hfAuthSettings.loginFailed')
  } finally {
    busy.value = false
  }
}

async function onLogout() {
  errorMessage.value = null
  busy.value = true
  try {
    await logoutHfAuth()
    await refresh()
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : t('hfAuthSettings.logoutFailed')
  } finally {
    busy.value = false
  }
}
</script>
