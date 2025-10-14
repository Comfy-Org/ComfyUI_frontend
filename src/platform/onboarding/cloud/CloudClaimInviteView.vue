<template>
  <div class="flex items-center bg-neutral-900 text-neutral-100">
    <main class="w-full max-w-md px-6 py-12 text-center" role="main">
      <!-- Title -->
      <h1
        class="font-abcrom my-0 text-3xl font-black text-white uppercase italic"
      >
        {{ t('cloudInvite_title') }}
      </h1>

      <!-- Subtitle -->
      <p v-if="inviteCodeClaimed" class="mt-6 leading-relaxed text-amber-500">
        {{ t('cloudInvite_alreadyClaimed_prefix') }}
        <strong>{{ userEmail }}</strong>
      </p>
      <p
        v-else-if="inviteCodeExpired"
        class="mt-6 leading-relaxed text-amber-500"
      >
        {{ t('cloudInvite_expired_prefix') }}
      </p>
      <p v-else class="mt-6 leading-relaxed text-neutral-300">
        {{ t('cloudInvite_subtitle') }}
      </p>

      <div v-if="inviteCodeClaimed || inviteCodeExpired" class="mb-2">
        <span
          class="cursor-pointer text-blue-400 no-underline"
          @click="onClickSupport"
        >
          {{ t('cloudInvite_contactLink') }}</span
        >
        <span class="ml-2 text-neutral-400">
          {{ t('cloudInvite_contactLink_suffix') }}</span
        >
      </div>
      <div>
        <span
          class="cursor-pointer text-blue-400 no-underline"
          @click="onSwitchAccounts"
        >
          {{ t('cloudInvite_switchAccounts') }}</span
        >
      </div>

      <!-- Signed in as -->
      <section class="mt-10">
        <p class="text-sm">
          {{ t('cloudInvite_signedInAs') }}
        </p>

        <div class="mt-4 flex flex-col items-center justify-center gap-4">
          <!-- Avatar box -->
          <div
            class="relative grid h-28 w-28 place-items-center rounded-2xl border border-neutral-700 bg-neutral-800 shadow-inner"
          >
            <span class="text-5xl font-semibold select-none">{{
              userInitial
            }}</span>
            <!-- subtle ring to mimic screenshot gradient border -->
            <span
              class="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-neutral-600/40 ring-inset"
            ></span>
          </div>

          <div class="text-left">
            <div class="text-sm break-all">
              {{ userEmail }}
            </div>
          </div>
        </div>
      </section>

      <Button
        type="button"
        :label="
          processing
            ? t('cloudInvite_processing')
            : t('cloudInvite_acceptButton')
        "
        class="mt-12 h-12 w-full font-medium text-white"
        :disabled="processing || inviteCodeClaimed || inviteCodeExpired"
        @click="onClaim"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { claimInvite, getInviteCodeStatus } from '@/api/auth'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const processing = ref(false)
const inviteCodeExpired = ref(false)
const inviteCodeClaimed = ref(false)

const { userEmail } = useFirebaseAuthStore()

const inviteCode = computed(() => route.query.inviteCode as string)
const userInitial = computed(() => (userEmail?.[0] || 'U').toUpperCase())

const onSwitchAccounts = () => {
  void router.push({
    name: 'cloud-login',
    query: { inviteCode: inviteCode.value }
  })
}
const onClickSupport = () => {
  window.open('https://support.comfy.org', '_blank', 'noopener')
}

const onClaim = async () => {
  try {
    try {
      if (inviteCode.value) {
        processing.value = true
        const response = await claimInvite(inviteCode.value)
        if (response.success) {
          await router.push({ name: 'cloud-user-check' })
        }
      } else {
        await router.push({ name: 'cloud-login' })
      }
    } catch (err) {
      console.error('Failed to claim invite:', err)
    } finally {
      processing.value = false
    }
  } catch (e) {
    console.error('Unexpected error in onClaim:', e)
  }
}

onMounted(async () => {
  try {
    try {
      const response = await getInviteCodeStatus(inviteCode.value)
      inviteCodeExpired.value = response.expired
      inviteCodeClaimed.value = response.claimed
    } catch (err) {
      console.error('Failed to fetch invite code status:', err)
      await router.push({ name: 'cloud-login' })
      return
    }
  } catch (e) {
    console.error('Unexpected error in onMounted:', e)
    await router.push({ name: 'cloud-login' })
  }
})
</script>
