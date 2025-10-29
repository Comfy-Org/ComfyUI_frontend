<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="max-w-[100vw] text-center lg:w-[500px]">
      <h2 class="mb-4 text-xl">
        {{ $t('cloudOnboarding.authTimeout.title') }}
      </h2>
      <p class="mb-6 text-gray-600">
        {{ $t('cloudOnboarding.authTimeout.message') }}
      </p>

      <!-- Troubleshooting Section -->
      <div class="mb-6 rounded-md bg-gray-800/50 p-4 text-left">
        <h3 class="mb-3 text-sm font-semibold text-gray-300">
          {{ $t('cloudOnboarding.authTimeout.troubleshooting') }}
        </h3>
        <ul class="space-y-2 text-sm text-gray-400">
          <li
            v-for="(cause, index) in $tm('cloudOnboarding.authTimeout.causes')"
            :key="index"
            class="flex gap-2"
          >
            <span class="text-gray-500">•</span>
            <span>{{ cause }}</span>
          </li>
        </ul>
      </div>

      <!-- Technical Details (Collapsible) -->
      <div v-if="errorMessage" class="mb-6 text-left">
        <button
          class="flex w-full items-center justify-between rounded-md bg-gray-800/30 px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800/50"
          @click="showTechnicalDetails = !showTechnicalDetails"
        >
          <span>{{ $t('cloudOnboarding.authTimeout.technicalDetails') }}</span>
          <i
            :class="[
              'pi',
              showTechnicalDetails ? 'pi-chevron-up' : 'pi-chevron-down'
            ]"
          ></i>
        </button>
        <div
          v-if="showTechnicalDetails"
          class="mt-2 rounded-md bg-gray-900/50 p-4 font-mono text-xs text-gray-400 break-all"
        >
          {{ errorMessage }}
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <Button
          :label="$t('cloudOnboarding.authTimeout.restart')"
          class="w-full"
          @click="handleRestart"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'

interface Props {
  errorMessage?: string
}

defineProps<Props>()

const router = useRouter()
const { logout } = useFirebaseAuthActions()
const showTechnicalDetails = ref(false)

const handleRestart = async () => {
  await logout()
  await router.replace({ name: 'cloud-login' })
}
</script>
