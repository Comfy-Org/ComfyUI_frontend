<template>
  <div class="flex flex-col gap-6">
    <div class="mb-8 flex flex-col gap-4">
      <h1 class="my-0 text-2xl/normal font-medium">
        {{ t('auth.apiKey.title') }}
      </h1>
      <div class="flex flex-col gap-2">
        <p class="my-0 text-base text-muted">
          {{ t('auth.apiKey.description') }}
        </p>
        <a
          href="https://docs.comfy.org/interface/user#logging-in-with-an-api-key"
          target="_blank"
          class="cursor-pointer text-blue-500"
        >
          {{ t('g.learnMore') }}
        </a>
      </div>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
      <Message v-if="apiKeyError" severity="error" class="mb-4">
        <span :id="apiKeyErrorId">{{ apiKeyError }}</span>
      </Message>

      <div class="flex flex-col gap-2">
        <label
          class="mb-2 text-base font-medium opacity-80"
          for="comfy-org-api-key"
        >
          {{ t('auth.apiKey.label') }}
        </label>
        <div class="flex flex-col gap-2">
          <Input
            id="comfy-org-api-key"
            :model-value="apiKey"
            name="apiKey"
            autocomplete="off"
            class="h-10"
            type="password"
            :placeholder="t('auth.apiKey.placeholder')"
            :aria-invalid="Boolean(apiKeyError)"
            :aria-describedby="apiKeyError ? apiKeyErrorId : undefined"
            @update:model-value="updateApiKey"
          />
          <small class="text-muted">
            {{ t('auth.apiKey.helpText') }}
            <a
              :href="`${comfyPlatformBaseUrl}/login`"
              target="_blank"
              class="cursor-pointer text-blue-500"
            >
              {{ t('auth.apiKey.generateKey') }}
            </a>
            <span class="mx-1">•</span>
            <a
              href="https://docs.comfy.org/tutorials/partner-nodes/overview#log-in-with-comfyui-account-api-key-on-non-whitelisted-websites"
              target="_blank"
              class="cursor-pointer text-blue-500"
            >
              {{ t('auth.apiKey.whitelistInfo') }}
            </a>
          </small>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <Button type="button" variant="textonly" @click="$emit('back')">
          {{ t('g.back') }}
        </Button>
        <Button
          type="submit"
          variant="primary"
          :loading="loading"
          :disabled="loading"
        >
          {{ t('g.save') }}
        </Button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Message from '@/components/ui/message/Message.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { apiKeySchema } from '@/schemas/signInSchema'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import { getZodFieldErrors } from '@/utils/zodFieldErrors'

const authStore = useAuthStore()
const apiKeyStore = useApiKeyAuthStore()
const loading = computed(() => authStore.loading)
const comfyPlatformBaseUrl = computed(() =>
  configValueOrDefault(
    remoteConfig.value,
    'comfy_platform_base_url',
    getComfyPlatformBaseUrl()
  )
)

const { t } = useI18n()
const apiKey = ref('')
const apiKeyError = ref<string>()
const apiKeyErrorId = 'comfy-org-api-key-error'

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'success'): void
}>()

function validateApiKey() {
  const result = apiKeySchema.safeParse({ apiKey: apiKey.value })
  apiKeyError.value = result.success
    ? undefined
    : getZodFieldErrors(result.error).apiKey
}

function updateApiKey(value: string | number | undefined) {
  apiKey.value = String(value ?? '')
  validateApiKey()
}

async function onSubmit() {
  const result = apiKeySchema.safeParse({ apiKey: apiKey.value })
  if (!result.success) {
    apiKeyError.value = getZodFieldErrors(result.error).apiKey
    return
  }

  await apiKeyStore.storeApiKey(result.data.apiKey)
  emit('success')
}
</script>
