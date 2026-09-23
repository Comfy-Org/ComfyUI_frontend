<script setup lang="ts">
import SocialAuthButtons from '@comfyorg/account-ui/auth/SocialAuthButtons'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { safeReturnTo } from '@/auth/returnTo'
import { useSignInController } from '@/auth/useSignInController'
import SignInEmailForm from '@/components/auth/SignInEmailForm.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const {
  state,
  busy,
  leaving,
  errorMessage,
  available,
  signInWith,
  submitEmail,
  retryMint
} = useSignInController(() => {
  void router.replace(safeReturnTo(route.query.returnTo))
})

const showEmailForm = ref(false)
const emailForm = ref<InstanceType<typeof SignInEmailForm>>()
const providerGroup = ref<HTMLDivElement>()

/**
 * The block that held focus unmounts, so focus would fall to the document
 * body and make a keyboard user traverse the page again to reach the form.
 */
async function showEmail(show: boolean): Promise<void> {
  showEmailForm.value = show
  await nextTick()
  if (show) emailForm.value?.focus()
  else providerGroup.value?.querySelector('button')?.focus()
}

// `isSecureContext` is absent in some runtimes; only an explicit false is insecure.
const secureContext = window.isSecureContext ?? true

const noticeKey = computed(() => {
  if (!available) return 'auth.signIn.unavailable'
  return secureContext ? undefined : 'auth.signIn.insecureContextWarning'
})
const progressKey = computed(() =>
  state.value.step === 'pending' && state.value.provider !== 'email'
    ? 'auth.signIn.pending'
    : 'auth.signIn.signingIn'
)
const blocked = computed(() => busy.value || !available)
const sessionFailed = computed(
  () => state.value.step === 'signedIn' && state.value.mintFailed === true
)

const linkButtonClass =
  'cursor-pointer self-center border-none bg-transparent p-0 text-sm text-muted-foreground underline transition-colors hover:text-base-foreground disabled:cursor-not-allowed disabled:opacity-50'
const alertClass = 'rounded-lg bg-base-background p-3 text-sm'
</script>

<template>
  <main
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <section
      v-if="!leaving"
      class="mx-auto flex w-full max-w-md flex-col rounded-2xl border border-border-subtle bg-secondary-background p-8 shadow-2xl shadow-black/35"
      :aria-busy="busy"
    >
      <h1 class="m-0 text-2xl font-semibold text-base-foreground">
        {{ t('auth.signIn.heading') }}
      </h1>
      <p class="mt-2 mb-0 text-sm text-muted-foreground">
        {{ t('auth.signIn.subtitle') }}
      </p>

      <div
        v-if="noticeKey"
        role="alert"
        :class="cn(alertClass, 'mt-6 text-warning-background')"
      >
        {{ t(noticeKey) }}
      </div>

      <div class="mt-8 flex flex-col gap-4">
        <template v-if="!showEmailForm">
          <!-- `contents` keeps both provider buttons as items of this flex column. -->
          <div ref="providerGroup" class="contents">
            <SocialAuthButtons
              :google-label="t('auth.signIn.google')"
              :github-label="t('auth.signIn.github')"
              button-class="flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-border-default bg-base-background font-medium text-base-foreground transition-colors hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="blocked"
              @google="signInWith('google')"
              @github="signInWith('github')"
            />
          </div>
          <button
            type="button"
            :class="linkButtonClass"
            :disabled="blocked"
            @click="showEmail(true)"
          >
            {{ t('auth.signIn.useEmailInstead') }}
          </button>
        </template>

        <template v-else>
          <SignInEmailForm
            ref="emailForm"
            :loading="busy"
            @submit="submitEmail"
          />
          <button
            type="button"
            :class="linkButtonClass"
            :disabled="busy"
            @click="showEmail(false)"
          >
            {{ t('auth.signIn.backToSocial') }}
          </button>
        </template>

        <p
          v-if="busy"
          aria-live="polite"
          class="my-0 text-center text-sm text-muted-foreground"
        >
          {{ t(progressKey) }}
        </p>

        <div
          v-if="errorMessage"
          role="alert"
          :class="cn(alertClass, 'text-destructive-background')"
        >
          {{ errorMessage }}
        </div>

        <template v-if="sessionFailed">
          <div
            role="alert"
            :class="cn(alertClass, 'text-destructive-background')"
          >
            {{ t('auth.signIn.sessionError') }}
          </div>
          <button type="button" :class="linkButtonClass" @click="retryMint">
            {{ t('auth.signIn.retry') }}
          </button>
        </template>
      </div>
    </section>
  </main>
</template>
