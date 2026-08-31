<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue'

import {
  isDownloadLinkRequestEnabled,
  joinAgentBetaWaitlist,
  preloadDownloadLinkAnalytics
} from '../../scripts/customerio'

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
    await joinAgentBetaWaitlist(submittedEmail.value)
    await showSuccess()
  } catch {
    status.value = 'error'
  }
}
</script>

<template>
  <div v-if="isDownloadLinkRequestEnabled">
    <form
      v-if="status !== 'success'"
      novalidate
      class="waitlist-form"
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
      />
      <button
        type="submit"
        :disabled="status === 'pending'"
        :aria-busy="status === 'pending'"
      >
        {{ status === 'pending' ? 'Joining…' : 'Join the waitlist' }}
      </button>
      <p
        v-if="errorMessage"
        :id="errorMessageId"
        role="alert"
        class="form-error"
      >
        {{ errorMessage }}
      </p>
    </form>
    <p
      v-else
      ref="successRegion"
      role="status"
      tabindex="-1"
      class="form-success"
    >
      You're on the waitlist! We'll email {{ submittedEmail }} when it's ready.
      A few questions just opened in a new tab —
      <a
        :href="APPLICATION_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="form-success-link"
        >open them here</a
      >
      if your browser blocked it.
    </p>
  </div>
</template>

<style scoped>
.waitlist-form {
  display: flex;
  align-items: center;
  max-width: 520px;
  margin: 0 auto;
  padding: 8px;
  border: 1px solid rgb(245 245 245 / 25%);
  border-radius: 24px;
  background: #2a2230;
}

.waitlist-form input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  padding: 14px 20px;
  color: var(--color-primary-comfy-canvas);
  font-family: inherit;
  font-size: 14px;
}

.waitlist-form input:focus-visible {
  border-radius: 16px;
  box-shadow: inset 0 0 0 2px var(--color-primary-comfy-yellow);
}

.waitlist-form input::placeholder {
  color: rgb(194 191 185 / 70%);
}

.waitlist-form button {
  flex: 0 0 auto;
  border: 0;
  border-radius: 16px;
  background: var(--color-primary-comfy-yellow);
  padding: 15px 28px;
  color: var(--color-primary-comfy-ink);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.waitlist-form button:disabled {
  cursor: wait;
  opacity: 0.75;
}

.form-error {
  flex-basis: 100%;
  margin: 0;
  padding: 0 12px 8px;
  color: #ffb4a8;
  font-size: 13px;
}

.form-success {
  max-width: 520px;
  margin: 0 auto;
  border: 1px solid rgb(214 242 78 / 55%);
  border-radius: 24px;
  background: #2a2230;
  padding: 20px 24px;
  color: var(--color-primary-comfy-canvas);
  font-size: 16px;
}

.form-success:focus {
  outline: 2px solid var(--color-primary-comfy-yellow);
  outline-offset: 3px;
}

.form-success-link {
  color: var(--color-primary-comfy-yellow);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.form-success-link:hover {
  opacity: 0.7;
}

@media (max-width: 560px) {
  .waitlist-form {
    flex-wrap: wrap;
    background: transparent;
    border: 0;
    padding: 0;
    gap: 12px;
  }

  .waitlist-form input,
  .waitlist-form button {
    width: 100%;
  }

  .waitlist-form input {
    flex-basis: 100%;
    border: 1px solid rgb(245 245 245 / 25%);
    border-radius: 24px;
    background: #2a2230;
    padding: 16px 22px;
  }

  .waitlist-form button {
    padding: 17px 26px;
  }
}
</style>
