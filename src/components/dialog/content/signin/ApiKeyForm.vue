<template>
  <div class="flex flex-col gap-6">
    <div class="mb-8 flex flex-col gap-4">
      <h1 class="my-0 text-2xl/normal font-medium">
        {{ t('auth.apiKey.title') }}
      </h1>
      <p class="my-0 text-base text-muted-foreground">
        {{ t('auth.apiKey.description') }}
        <a
          href="https://docs.comfy.org/interface/user#logging-in-with-an-api-key"
          target="_blank"
          class="underline underline-offset-4 hover:text-base-foreground"
        >
          {{ t('g.learnMore') }}
        </a>
      </p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
      <VeeField v-slot="{ componentField, errors }" name="apiKey">
        <Field :data-invalid="!!errors.length">
          <FieldLabel for="comfy-org-api-key">
            {{ t('auth.apiKey.label') }}
          </FieldLabel>
          <Input
            v-bind="componentField"
            id="comfy-org-api-key"
            autocomplete="off"
            type="password"
            :placeholder="t('auth.apiKey.placeholder')"
            :aria-invalid="!!errors.length"
          />
          <FieldDescription>
            {{ t('auth.apiKey.helpText') }}
            <a :href="`${comfyPlatformBaseUrl}/login`" target="_blank">
              {{ t('auth.apiKey.generateKey') }}
            </a>
            <span class="mx-1">•</span>
            <a
              href="https://docs.comfy.org/tutorials/partner-nodes/overview#log-in-with-comfyui-account-api-key-on-non-whitelisted-websites"
              target="_blank"
            >
              {{ t('auth.apiKey.whitelistInfo') }}
            </a>
          </FieldDescription>
          <FieldError v-if="errors.length" :errors />
        </Field>
      </VeeField>

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
import { toTypedSchema } from '@vee-validate/zod'
import { Field as VeeField, useForm } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Field from '@/components/ui/field/Field.vue'
import FieldDescription from '@/components/ui/field/FieldDescription.vue'
import FieldError from '@/components/ui/field/FieldError.vue'
import FieldLabel from '@/components/ui/field/FieldLabel.vue'
import Input from '@/components/ui/input/Input.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { apiKeySchema } from '@/schemas/signInSchema'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

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

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'success'): void
}>()

const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(apiKeySchema),
  initialValues: { apiKey: '' }
})

const onSubmit = handleSubmit(async ({ apiKey }) => {
  await apiKeyStore.storeApiKey(apiKey)
  emit('success')
})
</script>
