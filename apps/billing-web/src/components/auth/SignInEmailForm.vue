<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { createAuthSchemas } from '@comfyorg/account-core/signInSchemas'

import { CLOUD_FORGOT_PASSWORD_URL } from '@/config/env'

const { loading = false } = defineProps<{ loading?: boolean }>()

const emit = defineEmits<{
  submit: [credentials: { email: string; password: string }]
}>()

const { t } = useI18n()
const emailField = ref<HTMLInputElement>()
const email = ref('')
const password = ref('')
const revealed = ref(false)
/** An untouched field never shows its error, as the shared auth forms behave. */
const emailTouched = ref(false)
const passwordTouched = ref(false)

const { signInSchema } = createAuthSchemas((key, params) =>
  t(key, params ?? {})
)

type SignInField = 'email' | 'password'

const issues = computed<Partial<Record<SignInField, string>>>(() => {
  const parsed = signInSchema.safeParse({
    email: email.value,
    password: password.value
  })
  if (parsed.success) return {}
  const collected: Partial<Record<SignInField, string>> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    if (field === 'email' || field === 'password')
      collected[field] ??= issue.message
  }
  return collected
})

const emailError = computed(() =>
  emailTouched.value ? issues.value.email : undefined
)
const passwordError = computed(() =>
  passwordTouched.value ? issues.value.password : undefined
)

const fieldClass =
  'h-11 w-full rounded-lg border border-interface-stroke bg-input-surface px-3 text-base-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none aria-invalid:border-destructive-background'

defineExpose({ focus: () => emailField.value?.focus() })

function submit(): void {
  emailTouched.value = true
  passwordTouched.value = true
  if (Object.keys(issues.value).length > 0) return
  emit('submit', { email: email.value, password: password.value })
}
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <div class="flex flex-col gap-2">
      <label for="sign-in-email" class="text-sm text-muted-foreground">
        {{ t('auth.email.label') }}
      </label>
      <input
        id="sign-in-email"
        ref="emailField"
        v-model="email"
        type="text"
        name="email"
        autocomplete="email"
        :placeholder="t('auth.email.placeholder')"
        :class="fieldClass"
        :aria-invalid="Boolean(emailError)"
        @input="emailTouched = true"
      />
      <small v-if="emailError" role="alert" class="text-destructive-background">
        {{ emailError }}
      </small>
    </div>

    <div class="flex flex-col gap-2">
      <label for="sign-in-password" class="text-sm text-muted-foreground">
        {{ t('auth.password.label') }}
      </label>
      <div class="relative flex items-center">
        <input
          id="sign-in-password"
          v-model="password"
          :type="revealed ? 'text' : 'password'"
          name="password"
          autocomplete="current-password"
          :placeholder="t('auth.password.placeholder')"
          :class="cn(fieldClass, 'pr-12')"
          :aria-invalid="Boolean(passwordError)"
          @input="passwordTouched = true"
        />
        <button
          type="button"
          :aria-label="
            revealed ? t('auth.password.hide') : t('auth.password.show')
          "
          class="absolute right-2 flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
          @click="revealed = !revealed"
        >
          <i
            :class="
              cn(
                'size-4',
                revealed ? 'icon-[lucide--eye-off]' : 'icon-[lucide--eye]'
              )
            "
            aria-hidden="true"
          />
        </button>
      </div>
      <small
        v-if="passwordError"
        role="alert"
        class="text-destructive-background"
      >
        {{ passwordError }}
      </small>
      <a
        :href="CLOUD_FORGOT_PASSWORD_URL"
        class="mt-1 self-start text-sm text-muted-foreground underline"
      >
        {{ t('auth.signIn.forgotPassword') }}
      </a>
    </div>

    <button
      type="submit"
      :disabled="loading"
      :aria-busy="loading || undefined"
      class="mt-1 h-12 w-full cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      {{ t('auth.signIn.submit') }}
    </button>
  </form>
</template>
