<template>
  <div
    class="flex flex-col gap-3 rounded-lg border border-border-default bg-secondary-background p-3"
  >
    <div class="flex items-center gap-3">
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-medium text-base-foreground">
          {{ config.label }}
        </span>
        <span
          v-if="isAuthenticated"
          class="flex items-center gap-1 text-xs text-green-400"
        >
          <i class="icon-[lucide--check] size-3.5" />
          {{
            envKeyPresent
              ? $t('modelManager.downloadAuth.envKeyOnServer')
              : $t('modelManager.downloadAuth.connected')
          }}
        </span>
        <span v-else class="text-xs text-muted-foreground">
          {{ $t('modelManager.downloadAuth.notConnected') }}
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <template v-if="isAuthenticated">
          <Button
            v-if="loggedInViaOAuth"
            variant="secondary"
            size="sm"
            @click="onLogout"
          >
            {{ $t('modelManager.downloadAuth.signOut') }}
          </Button>
        </template>
        <template v-else-if="isLocal">
          <Button
            variant="primary"
            size="sm"
            :loading="isLoggingIn"
            @click="onLogin"
          >
            {{ $t('modelManager.downloadAuth.logIn') }}
          </Button>
        </template>
        <Button
          v-if="!isAuthenticated"
          variant="secondary"
          size="sm"
          @click="showInstructions = !showInstructions"
        >
          {{ $t('modelManager.downloadAuth.howToAddKey') }}
        </Button>
      </div>
    </div>

    <p v-if="loginFailed" class="text-xs text-amber-400">
      {{ $t('modelManager.downloadAuth.loginFailed') }}
    </p>

    <div
      v-if="showInstructions"
      class="flex flex-col gap-2 border-t border-border-default pt-3 text-xs text-muted-foreground"
    >
      <p v-if="!isLocal">
        {{ $t('modelManager.downloadAuth.instructions.remoteNotice') }}
      </p>

      <p>
        <a
          :href="config.tokenUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
        >
          {{ $t('modelManager.downloadAuth.instructions.createToken') }}
        </a>
      </p>

      <p>
        {{
          $t('modelManager.downloadAuth.instructions.setEnvVar', {
            envVar: primaryEnvVar
          })
        }}
      </p>

      <div class="flex items-center gap-2">
        <code
          class="flex-1 rounded-md bg-base-background px-2 py-1 font-mono text-base-foreground"
        >
          {{ snippet }}
        </code>
        <Button
          variant="textonly"
          size="icon"
          :title="$t('modelManager.downloadAuth.instructions.copy')"
          @click="copyToClipboard(snippet)"
        >
          <i class="icon-[lucide--copy] size-4" />
        </Button>
      </div>

      <p v-if="altEnvVar">
        {{
          $t('modelManager.downloadAuth.instructions.altEnvVar', {
            envVar: altEnvVar
          })
        }}
      </p>

      <p>{{ $t('modelManager.downloadAuth.instructions.restartNote') }}</p>

      <p v-if="config.canBeGated">
        {{ $t('modelManager.downloadAuth.instructions.gatedNote') }}
      </p>

      <div class="flex justify-end">
        <Button variant="link" size="sm" :loading="isLoading" @click="recheck">
          {{ $t('modelManager.downloadAuth.instructions.recheck') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

import { envExportSnippet, getProviderConfig } from '../downloadAuthProviders'
import { useDownloadAuthStore } from '../stores/downloadAuthStore'
import type { DownloadProvider } from '../types'
import { isLocalDeployment } from '../utils/deployment'

const { provider, initiallyExpanded = false } = defineProps<{
  provider: DownloadProvider
  initiallyExpanded?: boolean
}>()

const store = useDownloadAuthStore()
const { copyToClipboard } = useCopyToClipboard()

const config = computed(() => getProviderConfig(provider))
const snippet = computed(() => envExportSnippet(provider))
const primaryEnvVar = computed(() => config.value.envVars[0])
const altEnvVar = computed(() => config.value.envVars[1])
const isLocal = isLocalDeployment()

const status = computed(() => store.statusFor(provider))
const isAuthenticated = computed(() => store.isAuthenticated(provider))
const loggedInViaOAuth = computed(() => !!status.value?.logged_in)
const envKeyPresent = computed(() => !!status.value?.env_key_present)
const isLoading = computed(() => store.isLoading)

const showInstructions = ref(initiallyExpanded && !isAuthenticated.value)
const isLoggingIn = ref(false)
const loginFailed = ref(false)

async function onLogin() {
  isLoggingIn.value = true
  loginFailed.value = false
  try {
    const outcome = await store.login(provider)
    if (outcome === 'needs_env_key') showInstructions.value = true
    if (outcome === 'failed') {
      loginFailed.value = true
      showInstructions.value = true
    }
  } finally {
    isLoggingIn.value = false
  }
}

async function onLogout() {
  await store.logout(provider)
}

async function recheck() {
  await store.fetchStatus()
}
</script>
