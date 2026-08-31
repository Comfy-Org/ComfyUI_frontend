<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import {
  joinAgentBetaWaitlist,
  preloadDownloadLinkAnalytics
} from '../../scripts/customerio'

type FormStatus = 'idle' | 'pending' | 'error' | 'success'

const email = ref('')
const submittedEmail = ref('')
const status = ref<FormStatus>('idle')
const successRegion = ref<HTMLParagraphElement | null>(null)

onMounted(preloadDownloadLinkAnalytics)

async function onSubmit() {
  if (status.value === 'pending') return
  submittedEmail.value = email.value
  status.value = 'pending'
  try {
    await joinAgentBetaWaitlist(submittedEmail.value)
    status.value = 'success'
    await nextTick()
    successRegion.value?.focus()
  } catch {
    status.value = 'error'
  }
}
</script>

<template>
  <form
    v-if="status !== 'success'"
    class="waitlist-form"
    @submit.prevent="onSubmit"
  >
    <label for="agent-beta-email" class="sr-only">Email address</label>
    <input
      id="agent-beta-email"
      v-model="email"
      type="email"
      name="email"
      autocomplete="email"
      placeholder="Type your email"
      required
    />
    <button
      type="submit"
      :disabled="status === 'pending'"
      :aria-busy="status === 'pending'"
    >
      {{ status === 'pending' ? 'Joining…' : 'Join the waitlist' }}
    </button>
    <p v-if="status === 'error'" role="alert" class="form-error">
      Something went wrong. Please try again.
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
  </p>
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
