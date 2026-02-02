<template>
  <Dialog
    v-model:visible="visible"
    :header="
      mode === 'create' ? $t('secrets.addSecret') : $t('secrets.editSecret')
    "
    modal
    class="w-full max-w-md"
  >
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1">
        <label for="secret-name" class="text-sm font-medium">
          {{ $t('secrets.name') }}
        </label>
        <InputText
          id="secret-name"
          v-model="form.name"
          :placeholder="$t('secrets.namePlaceholder')"
          :class="{ 'p-invalid': errors.name }"
          autofocus
        />
        <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
      </div>

      <div class="flex flex-col gap-1">
        <label for="secret-provider" class="text-sm font-medium">
          {{ $t('secrets.provider') }}
        </label>
        <Select v-model="form.provider" :disabled="mode === 'edit'">
          <SelectTrigger id="secret-provider" class="w-full">
            <SelectValue :placeholder="$t('g.none')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in providerOptions"
              :key="option.value || 'none'"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <small v-if="errors.provider" class="text-red-500">
          {{ errors.provider }}
        </small>
      </div>

      <div class="flex flex-col gap-1">
        <label for="secret-value" class="text-sm font-medium">
          {{ $t('secrets.secretValue') }}
        </label>
        <Password
          id="secret-value"
          v-model="form.secretValue"
          :placeholder="
            mode === 'edit'
              ? $t('secrets.secretValuePlaceholderEdit')
              : $t('secrets.secretValuePlaceholder')
          "
          :feedback="false"
          toggle-mask
          fluid
          :class="{ 'p-invalid': errors.secretValue }"
        />
        <small v-if="errors.secretValue" class="text-red-500">
          {{ errors.secretValue }}
        </small>
        <small v-else class="text-muted">
          {{
            mode === 'edit'
              ? $t('secrets.secretValueHintEdit')
              : $t('secrets.secretValueHint')
          }}
        </small>
      </div>

      <Message v-if="apiError" severity="error" :closable="false">
        {{ apiError }}
      </Message>

      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" @click="visible = false">
          {{ $t('g.cancel') }}
        </Button>
        <Button type="submit" :loading="loading">
          {{ $t('g.save') }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

import { SecretsApiError, secretsApi } from '../api/secretsApi'
import type { SecretErrorCode, SecretMetadata, SecretProvider } from '../types'

const { t } = useI18n()

const {
  secret,
  existingProviders = [],
  mode = 'create'
} = defineProps<{
  secret?: SecretMetadata
  existingProviders?: SecretProvider[]
  mode?: 'create' | 'edit'
}>()

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  saved: []
}>()

const loading = ref(false)
const apiErrorCode = ref<SecretErrorCode | null>(null)
const apiErrorMessage = ref<string | null>(null)

const PROVIDER_NONE = '__none__' as const

const form = reactive({
  name: '',
  secretValue: '',
  provider: PROVIDER_NONE as SecretProvider | typeof PROVIDER_NONE
})

const errors = reactive({
  name: '',
  secretValue: '',
  provider: ''
})

const providerOptions = computed<
  {
    label: string
    value: SecretProvider | typeof PROVIDER_NONE
    disabled: boolean
  }[]
>(() => {
  const options: {
    label: string
    value: SecretProvider | typeof PROVIDER_NONE
    disabled: boolean
  }[] = [
    {
      label: 'HuggingFace',
      value: 'huggingface' as const,
      disabled: existingProviders.includes('huggingface')
    },
    {
      label: 'Civitai',
      value: 'civitai' as const,
      disabled: existingProviders.includes('civitai')
    }
  ]
  if (mode === 'edit') {
    options.unshift({
      label: t('g.none'),
      value: PROVIDER_NONE,
      disabled: false
    })
  }
  return options
})

const apiError = computed(() => {
  if (!apiErrorCode.value && !apiErrorMessage.value) return null
  switch (apiErrorCode.value) {
    case 'DUPLICATE_NAME':
      return t('secrets.errors.duplicateName')
    case 'DUPLICATE_PROVIDER':
      return t('secrets.errors.duplicateProvider')
    default:
      return apiErrorMessage.value
  }
})

function resetForm() {
  if (mode === 'edit' && secret) {
    form.name = secret.name
    form.provider = secret.provider ?? PROVIDER_NONE
    form.secretValue = ''
  } else {
    form.name = ''
    form.secretValue = ''
    form.provider = PROVIDER_NONE
  }
  errors.name = ''
  errors.secretValue = ''
  errors.provider = ''
  apiErrorCode.value = null
  apiErrorMessage.value = null
}

watch(visible, (isVisible) => {
  if (isVisible) resetForm()
})

function validate(): boolean {
  errors.name = ''
  errors.secretValue = ''
  errors.provider = ''

  if (!form.name.trim()) {
    errors.name = t('secrets.errors.nameRequired')
    return false
  }
  if (form.name.length > 255) {
    errors.name = t('secrets.errors.nameTooLong')
    return false
  }
  if (mode === 'create' && form.provider === PROVIDER_NONE) {
    errors.provider = t('secrets.errors.providerRequired')
    return false
  }
  if (mode === 'create' && !form.secretValue) {
    errors.secretValue = t('secrets.errors.secretValueRequired')
    return false
  }
  return true
}

async function handleSubmit() {
  if (!validate()) return

  loading.value = true
  apiErrorCode.value = null
  apiErrorMessage.value = null

  try {
    if (mode === 'create') {
      const provider =
        form.provider === PROVIDER_NONE
          ? undefined
          : (form.provider as SecretProvider)
      await secretsApi.create({
        name: form.name.trim(),
        secret_value: form.secretValue,
        provider
      })
    } else if (secret) {
      const updatePayload: { name: string; secret_value?: string } = {
        name: form.name.trim()
      }
      if (form.secretValue) {
        updatePayload.secret_value = form.secretValue
      }
      await secretsApi.update(secret.id, updatePayload)
    }
    emit('saved')
    visible.value = false
  } catch (err) {
    if (err instanceof SecretsApiError) {
      apiErrorCode.value = err.code ?? null
      apiErrorMessage.value = err.message
    }
  } finally {
    loading.value = false
  }
}
</script>
