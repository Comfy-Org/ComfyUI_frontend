<template>
  <div
    class="flex flex-col justify-center items-center h-screen font-mono text-black gap-4"
  >
    <h1 class="text-2xl">
      {{ t('cloudClaimInvite_processingTitle') }}
    </h1>
    <button
      class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
      @click="onClaim"
    >
      {{ t('cloudClaimInvite_claimButton') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

const onClaim = () => {
  void router.push({ name: 'cloud-user-check' })
}
</script>
