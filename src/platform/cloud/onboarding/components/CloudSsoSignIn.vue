<template>
  <form
    class="flex flex-col gap-4"
    novalidate
    @submit.prevent="emit('submit', email)"
  >
    <label :for="emailInputId" :class="CLOUD_AUTH_LABEL_CLASS">
      {{ t('auth.sso.emailLabel') }}
    </label>
    <Input
      :id="emailInputId"
      v-model="email"
      type="email"
      autocomplete="email"
      :placeholder="t('auth.sso.emailPlaceholder')"
      :class="CLOUD_AUTH_FIELD_CLASS"
    />

    <Message v-if="feedback" :severity="feedback.severity">
      {{ t(feedback.key) }}
    </Message>

    <Button
      type="submit"
      variant="brand-solid"
      size="brand"
      class="w-full"
      :loading="busy"
      :disabled="!email.trim()"
    >
      {{ t('auth.sso.submit') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Message from '@/components/ui/message/Message.vue'
import { readSsoHint } from '@/platform/auth/session/ssoReentryStorage'
import {
  CLOUD_AUTH_FIELD_CLASS,
  CLOUD_AUTH_LABEL_CLASS
} from '@/platform/cloud/onboarding/constants/authClasses'
import type { SsoSignInState } from '@/platform/cloud/onboarding/sso/ssoSignInState'
import { isSsoBusy } from '@/platform/cloud/onboarding/sso/ssoSignInState'

const FEEDBACK: Partial<
  Record<SsoSignInState['phase'], { key: string; severity: 'info' | 'error' }>
> = {
  'not-sso': { key: 'auth.sso.notSso', severity: 'info' },
  'invalid-email': { key: 'auth.sso.invalidEmail', severity: 'error' },
  unavailable: { key: 'auth.sso.unavailable', severity: 'error' }
}

const { state } = defineProps<{ state: SsoSignInState }>()
const emit = defineEmits<{ submit: [email: string] }>()

const { t } = useI18n()
const busy = computed(() => isSsoBusy(state))

const emailInputId = 'cloud-sso-email'
const email = ref(readSsoHint()?.email ?? '')
const feedback = computed(() => FEEDBACK[state.phase])
</script>
