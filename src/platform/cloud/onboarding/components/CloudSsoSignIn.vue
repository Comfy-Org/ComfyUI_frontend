<template>
  <form
    class="flex flex-col gap-6"
    novalidate
    @submit.prevent="continueWithSso(email)"
  >
    <Message v-if="notice" severity="warning">
      {{ notice }}
    </Message>

    <div class="flex flex-col gap-2">
      <label
        class="mb-1 text-base text-primary-comfy-canvas/70"
        :for="emailInputId"
      >
        {{ t('auth.sso.emailLabel') }}
      </label>
      <Input
        :id="emailInputId"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        :maxlength="SSO_EMAIL_MAX_LENGTH"
        :placeholder="t('auth.sso.emailPlaceholder')"
        :class="CLOUD_AUTH_FIELD_CLASS"
      />
    </div>

    <Message v-if="feedback" :severity="feedback.severity">
      {{ t(feedback.key) }}
    </Message>

    <Button
      type="submit"
      variant="brand-solid"
      size="brand"
      class="mt-2 w-full"
      :loading="busy"
      :disabled="!email.trim()"
    >
      {{ t('auth.sso.continue') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SSO_EMAIL_MAX_LENGTH } from '@comfyorg/account-core/sso'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Message from '@/components/ui/message/Message.vue'
import { useSsoSignIn } from '@/platform/cloud/onboarding/composables/useSsoSignIn'
import { CLOUD_AUTH_FIELD_CLASS } from '@/platform/cloud/onboarding/constants/authClasses'

const { defaultEmail = '', notice } = defineProps<{
  defaultEmail?: string
  notice?: string
}>()

const { t } = useI18n()
const { state, busy, continueWithSso } = useSsoSignIn()

const emailInputId = 'cloud-sso-email'
const email = ref(defaultEmail)

const feedback = computed(() => {
  switch (state.value.phase) {
    case 'not-sso':
      return { key: 'auth.sso.notSetUp', severity: 'info' } as const
    case 'invalid-email':
      return { key: 'auth.sso.invalidEmail', severity: 'error' } as const
    case 'unavailable':
      return { key: 'auth.sso.unavailable', severity: 'error' } as const
    default:
      return null
  }
})
</script>
