<template>
  <Form
    v-slot="$form"
    class="flex flex-col gap-6"
    :resolver="zodResolver(apiKeySchema)"
    @submit="onSubmit"
  >
    <Message v-if="$form.apiKey?.invalid" severity="error" class="mb-4">
      {{ $form.apiKey.error.message }}
    </Message>

    <div class="flex flex-col gap-2">
      <label
        class="opacity-80 text-base font-medium mb-2"
        for="comfy-org-api-key"
      >
        {{ t('auth.apiKey.label') }}
      </label>
      <div class="flex flex-col gap-2">
        <InputText
          pt:root:id="comfy-org-api-key"
          pt:root:autocomplete="off"
          class="h-10"
          name="apiKey"
          type="password"
          :placeholder="t('auth.apiKey.placeholder')"
          :invalid="$form.apiKey?.invalid"
        />
        <small class="text-muted">
          {{ t('auth.apiKey.helpText') }}
          <a
            href="https://platform.comfy.org/login"
            target="_blank"
            class="text-blue-500 cursor-pointer"
          >
            {{ t('auth.apiKey.generateKey') }}
          </a>
        </small>
      </div>
    </div>

    <div class="flex justify-between items-center mt-4">
      <Button type="button" link @click="$emit('back')">
        {{ t('g.back') }}
      </Button>
      <Button type="submit" :loading="loading" :disabled="loading">
        {{ t('g.save') }}
      </Button>
    </div>
  </Form>
</template>

<script setup lang="ts">
import { Form, FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { apiKeySchema } from '@/schemas/signInSchema'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const apiKeyStore = useApiKeyAuthStore()
const loading = computed(() => authStore.loading)

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'success'): void
}>()

const onSubmit = async (event: FormSubmitEvent) => {
  if (event.valid) {
    await apiKeyStore.storeApiKey(event.values.apiKey)
    emit('success')
  }
}
</script>
