<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="max-w-[100vw] text-center lg:w-96">
      <h2 class="mb-4 text-xl">
        {{ $t('cloudOnboarding.authTimeout.title') }}
      </h2>
      <p class="mb-6 text-gray-600">
        {{ $t('cloudOnboarding.authTimeout.message') }}
      </p>

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
import { useRouter } from 'vue-router'

import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'

const router = useRouter()
const { logout } = useFirebaseAuthActions()

const handleRestart = async () => {
  await logout()
  await router.replace({ name: 'cloud-login' })
}
</script>
