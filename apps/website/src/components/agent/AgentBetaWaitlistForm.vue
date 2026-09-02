<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue'

import {
  isDownloadLinkRequestEnabled,
  joinWaitlist,
  preloadDownloadLinkAnalytics
} from '../../scripts/customerio'

const { signupEvent = 'agent_beta_waitlist_joined' } = defineProps<{
  /** Customer.io event tracked on a successful signup. */
  signupEvent?: string
}>()

type FormStatus = 'idle' | 'invalid' | 'pending' | 'error' | 'success'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Longer intake form the waitlist email hands off to. */
const APPLICATION_URL = 'https://form.typeform.com/to/UqL3PpAM'

const email = ref('')
const decoy = ref('')
const submittedEmail = ref('')
const status = ref<FormStatus>('idle')
const errorMessageId = useId()
const successRegion = ref<HTMLParagraphElement | null>(null)
const applicationOpened = ref(false)

const errorMessage = computed(() => {
  if (status.value === 'invalid') return 'Please enter a valid email address.'
  if (status.value === 'error') return 'Something went wrong. Please try again.'
  return ''
})

onMounted(() => {
  if (isDownloadLinkRequestEnabled) preloadDownloadLinkAnalytics()
})

// Removing the form drops keyboard/SR focus, so move it to the success message.
async function showSuccess() {
  status.value = 'success'
  await nextTick()
  successRegion.value?.focus()
}

// Called straight from the submit handler, before any await: the popup
// blocker only honours window.open while the click's user activation is
// still live, and awaiting the capture first spends it. Guarded so a retry
// after a failed capture does not open a second tab.
function openApplication() {
  if (applicationOpened.value) return
  applicationOpened.value = true
  window.open(APPLICATION_URL, '_blank', 'noopener,noreferrer')
}

async function onSubmit() {
  if (status.value === 'pending') return
  if (decoy.value !== '') {
    submittedEmail.value = email.value
    await showSuccess()
    return
  }
  if (!EMAIL_PATTERN.test(email.value)) {
    status.value = 'invalid'
    return
  }
  submittedEmail.value = email.value
  status.value = 'pending'
  openApplication()
  try {
    await joinWaitlist(submittedEmail.value, signupEvent)
    await showSuccess()
  } catch {
    status.value = 'error'
  }
}
</script>

<template>
  <div v-if="isDownloadLinkRequestEnabled">
    <!-- The pill collapses into stacked full-width controls below 560px,
         which is narrower than the `sm` breakpoint the rest of the site
         uses, so the mobile rules are expressed as max-[560px] variants. -->
    <form
      v-if="status !== 'success'"
      novalidate
      class="bg-primary-comfy-ink-light mx-auto flex max-w-130 items-center rounded-3xl border border-primary-warm-white/25 p-2 max-[560px]:flex-wrap max-[560px]:gap-3 max-[560px]:border-0 max-[560px]:bg-transparent max-[560px]:p-0"
      @submit.prevent="onSubmit"
    >
      <label for="agent-beta-email" class="sr-only">Email address</label>
      <input
        v-model="decoy"
        type="text"
        name="company"
        tabindex="-1"
        aria-hidden="true"
        autocomplete="off"
        class="absolute left-[-9999px] size-px"
      />
      <input
        id="agent-beta-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        placeholder="Type your email"
        required
        :aria-invalid="status === 'invalid' || undefined"
        :aria-describedby="errorMessage ? errorMessageId : undefined"
        class="max-[560px]:bg-primary-comfy-ink-light min-w-0 flex-1 border-0 bg-transparent px-5 py-3.5 text-sm text-primary-comfy-canvas outline-none placeholder:text-primary-comfy-canvas/70 focus-visible:rounded-2xl focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary-comfy-yellow)] max-[560px]:w-full max-[560px]:basis-full max-[560px]:rounded-3xl max-[560px]:border max-[560px]:border-primary-warm-white/25 max-[560px]:px-5.5 max-[560px]:py-4"
      />
      <button
        type="submit"
        :disabled="status === 'pending'"
        :aria-busy="status === 'pending'"
        class="bg-primary-comfy-yellow flex-none cursor-pointer rounded-2xl border-0 px-7 py-[15px] text-sm font-bold tracking-[0.06em] text-primary-comfy-ink uppercase disabled:cursor-wait disabled:opacity-75 max-[560px]:w-full max-[560px]:px-6.5 max-[560px]:py-[17px]"
      >
        {{ status === 'pending' ? 'Joining…' : 'Join the waitlist' }}
      </button>
      <p
        v-if="errorMessage"
        :id="errorMessageId"
        role="alert"
        class="text-destructive-light basis-full px-3 pb-2 text-[13px]"
      >
        {{ errorMessage }}
      </p>
    </form>
    <p
      v-else
      ref="successRegion"
      role="status"
      tabindex="-1"
      class="bg-primary-comfy-ink-light focus:outline-primary-comfy-yellow border-primary-comfy-yellow/55 mx-auto max-w-130 rounded-3xl border px-6 py-5 text-base text-primary-comfy-canvas focus:outline-2 focus:outline-offset-[3px]"
    >
      You're on the waitlist! We'll email {{ submittedEmail }} when it's ready.
      A few questions just opened in a new tab —
      <a
        :href="APPLICATION_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-yellow underline underline-offset-2 hover:opacity-70"
        >open them here</a
      >
      if your browser blocked it.
    </p>
  </div>
</template>
