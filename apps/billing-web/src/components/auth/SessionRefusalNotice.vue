<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'

/** Why the session was refused: the SSO step that fixes it, or the plain reason. */
const { ssoOffered, email, signOutFailed, message } = defineProps<{
  ssoOffered: boolean
  email: string | undefined
  signOutFailed: boolean
  message: string
}>()

const emit = defineEmits<{ continueWithSso: [] }>()

const { t } = useI18n()

const ssoBody = computed(() =>
  email
    ? t('auth.sso.required.bodyWithEmail', { email })
    : t('auth.sso.required.body')
)

const alertClass = 'rounded-lg bg-base-background p-3 text-sm'
</script>

<template>
  <template v-if="ssoOffered">
    <div role="alert" :class="cn(alertClass, 'text-base-foreground')">
      <p class="m-0 font-semibold">{{ t('auth.sso.required.title') }}</p>
      <p class="mt-1 mb-0 text-muted-foreground">{{ ssoBody }}</p>
    </div>
    <button
      type="button"
      :class="cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')"
      @click="emit('continueWithSso')"
    >
      {{ t('auth.sso.continueWithSso') }}
    </button>
    <div
      v-if="signOutFailed"
      role="alert"
      :class="cn(alertClass, 'text-destructive-background')"
    >
      {{ t('auth.errors.generic') }}
    </div>
  </template>
  <div
    v-else
    role="alert"
    :class="cn(alertClass, 'text-destructive-background')"
  >
    {{ message }}
  </div>
</template>
