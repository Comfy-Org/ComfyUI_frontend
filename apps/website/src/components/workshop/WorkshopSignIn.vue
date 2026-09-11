<script setup lang="ts">
import { onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { AccountKind } from '../../composables/useMockSession'
import { useMockSession } from '../../composables/useMockSession'
import { RETURN_PARAM, safeReturnPath } from '../../composables/useSignInHref'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { signIn } = useMockSession()
const routes = getRoutes(locale)

type Mode = 'signIn' | 'signUp'
const mode = ref<Mode>('signIn')
const emailForm = ref(false)
const email = ref('')
const password = ref('')
const returnTo = ref<string>(routes.workshop)

onMounted(() => {
  returnTo.value = safeReturnPath(
    new URLSearchParams(location.search).get(RETURN_PARAM),
    routes.workshop
  )
})

function switchMode(next: Mode) {
  mode.value = next
  emailForm.value = false
}

// Any provider completes the mock session; sign-up creates a new account
// with the welcome credits, sign-in restores an existing one.
function complete() {
  const kind: AccountKind = mode.value === 'signUp' ? 'new' : 'existing'
  signIn(kind)
  location.assign(returnTo.value)
}

const socialClass =
  'flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-transparency-white-t8 text-base text-primary-warm-white transition-colors hover:bg-transparency-white-t20 xl:h-12'
const fieldClass =
  'h-11 w-full rounded-2xl bg-transparency-white-t8 px-4 text-base text-primary-warm-white outline-none placeholder:text-transparency-white-t40 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 xl:h-12'
const linkButtonClass =
  'mt-2 cursor-pointer self-center text-base text-primary-comfy-canvas underline transition-colors hover:text-white sm:text-lg'
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-md flex-col lg:max-w-lg"
    data-testid="workshop-sign-in"
    :data-mode="mode"
    :data-return="returnTo"
  >
    <h1
      class="text-3xl/snug font-light tracking-tighter text-primary-comfy-canvas lg:text-4xl/snug xl:text-5xl/snug"
    >
      {{
        mode === 'signUp'
          ? t('workshop.signUp.title', locale)
          : t('workshop.signIn.title', locale)
      }}
    </h1>

    <p
      v-if="mode === 'signIn'"
      class="mt-8 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      {{ t('workshop.signIn.newUser', locale) }}
      <button
        type="button"
        class="text-primary-comfy-yellow cursor-pointer hover:underline"
        data-testid="sign-in-switch-signup"
        @click="switchMode('signUp')"
      >
        {{ t('workshop.signIn.signUpHere', locale) }}
      </button>
      {{ t('workshop.signIn.freeRuns', locale) }}
    </p>
    <p
      v-else
      class="mt-8 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      {{ t('workshop.signUp.haveAccount', locale) }}
      <button
        type="button"
        class="text-primary-comfy-yellow cursor-pointer hover:underline"
        data-testid="sign-in-switch-signin"
        @click="switchMode('signIn')"
      >
        {{ t('workshop.signUp.signIn', locale) }}
      </button>
    </p>

    <div class="mt-12 flex flex-col gap-4 xl:gap-6">
      <template v-if="!emailForm">
        <button
          type="button"
          :class="socialClass"
          data-testid="sign-in-google"
          @click="complete"
        >
          <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
            />
          </svg>
          {{
            mode === 'signUp'
              ? t('workshop.signUp.google', locale)
              : t('workshop.signIn.google', locale)
          }}
        </button>
        <button
          type="button"
          :class="socialClass"
          data-testid="sign-in-github"
          @click="complete"
        >
          <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
          {{
            mode === 'signUp'
              ? t('workshop.signUp.github', locale)
              : t('workshop.signIn.github', locale)
          }}
        </button>
        <button
          type="button"
          :class="linkButtonClass"
          data-testid="sign-in-use-email"
          @click="emailForm = true"
        >
          {{ t('workshop.signIn.useEmail', locale) }}
        </button>
      </template>

      <form v-else class="flex flex-col gap-6" @submit.prevent="complete">
        <label class="flex flex-col gap-2">
          <span class="text-base text-primary-comfy-canvas/70">
            {{ t('workshop.signIn.emailLabel', locale) }}
          </span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :placeholder="t('workshop.signIn.emailPlaceholder', locale)"
            data-testid="sign-in-email"
            :class="fieldClass"
          />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-base text-primary-comfy-canvas/70">
            {{ t('workshop.signIn.passwordLabel', locale) }}
          </span>
          <input
            v-model="password"
            type="password"
            :autocomplete="
              mode === 'signUp' ? 'new-password' : 'current-password'
            "
            required
            :placeholder="t('workshop.signIn.passwordPlaceholder', locale)"
            data-testid="sign-in-password"
            :class="fieldClass"
          />
          <span
            v-if="mode === 'signIn'"
            class="mt-1 self-start text-sm text-primary-comfy-canvas/70 underline"
          >
            {{ t('workshop.signIn.forgotPassword', locale) }}
          </span>
        </label>
        <Button
          type="submit"
          size="lg"
          class="mt-2 w-full"
          :disabled="!email || !password"
          data-testid="sign-in-submit"
        >
          {{
            mode === 'signUp'
              ? t('workshop.signUp.submit', locale)
              : t('workshop.signIn.submit', locale)
          }}
        </Button>
        <button
          type="button"
          :class="linkButtonClass"
          data-testid="sign-in-back-to-social"
          @click="emailForm = false"
        >
          {{ t('workshop.signIn.backToSocial', locale) }}
        </button>
      </form>
    </div>

    <p
      v-if="mode === 'signUp'"
      class="mt-10 text-xs/5 text-primary-comfy-canvas/60"
    >
      {{ t('workshop.signUp.terms', locale) }}
      <a :href="routes.termsOfService" class="underline">
        {{ t('workshop.signUp.termsLink', locale) }}
      </a>
      {{ t('workshop.signUp.and', locale) }}
      <a :href="routes.privacyPolicy" class="underline">
        {{ t('workshop.signUp.privacyLink', locale) }}
      </a>
    </p>

    <p class="mt-10 text-xs/5 text-primary-warm-gray">
      {{ t('workshop.signIn.prototypeNote', locale) }}
      <a
        :href="externalLinks.cloudLogin"
        target="_blank"
        rel="noopener noreferrer"
        class="underline hover:text-primary-warm-white"
      >
        cloud.comfy.org
      </a>
    </p>
  </div>
</template>
