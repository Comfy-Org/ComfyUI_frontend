<template>
  <div class="flex h-full items-center justify-center p-6">
    <div class="max-w-[100vw] text-center lg:w-[500px]">
      <h2 class="mb-3 text-xl text-text-primary">
        {{ $t('cloudOnboarding.banned.title') }}
      </h2>
      <p class="mb-5 text-muted">
        {{ $t('cloudOnboarding.banned.message') }}
      </p>

      <div class="flex flex-col gap-3">
        <Button as="a" :href="supportUrl" target="_blank" rel="noopener">
          {{ $t('cloudOnboarding.banned.contactSupport') }}
        </Button>
        <Button variant="textonly" @click="handleSignOut">
          {{ $t('cloudOnboarding.banned.signOut') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'

const supportUrl = 'https://support.comfy.org'

const router = useRouter()
const { logout } = useAuthActions()

const handleSignOut = async () => {
  await logout()
  await router.replace({ name: 'cloud-login' })
}
</script>
