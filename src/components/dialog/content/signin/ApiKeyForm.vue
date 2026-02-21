<template>
  <div class="flex flex-col gap-6">
    <div class="mb-8 flex flex-col gap-4">
      <h1 class="my-0 text-2xl leading-normal font-medium">
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

    <form class="flex flex-col gap-6" @submit="onSubmit">
      <Message v-if="errors.apiKey" severity="error" class="mb-4">
        {{ errors.apiKey }}
      </Message>

      <div class="flex flex-col gap-2">
        <label
          class="mb-2 text-base font-medium opacity-80"
          for="comfy-org-api-key"
        >
          {{ t('auth.apiKey.label') }}
        </label>
        <div class="flex flex-col gap-2">
          <InputText
            id="comfy-org-api-key"
            v-model="apiKey"
            v-bind="apiKeyAttrs"
            autocomplete="off"
            class="h-10"
            type="password"
            :placeholder="t('auth.apiKey.placeholder')"
            :invalid="Boolean(errors.apiKey)"
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
              href="https://docs.comfy.org/tutorials/api-nodes/overview#log-in-with-api-key-on-non-whitelisted-websites"
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
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useForm } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { apiKeySchema } from '@/schemas/signInSchema'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
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

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'success'): void
}>()

const { defineField, errors, validate } = useForm({
  initialValues: {
    apiKey: ''
  },
  validationSchema: apiKeySchema
})

const [apiKey, apiKeyAttrs] = defineField('apiKey')

const onSubmit = async (event: Event) => {
  event.preventDefault()
  const { valid, values: submittedValues } = await validate()
  if (!valid) {
    return
  }

  if (submittedValues?.apiKey) {
    await apiKeyStore.storeApiKey(submittedValues.apiKey)
    emit('success')
  }
}
</script>
