<template>
  <Dialog v-model:open="visible">
    <DialogPortal>
      <DialogOverlay v-reka-z-index data-reka-nested-dialog-overlay />
      <DialogContent v-reka-z-index size="md" :aria-labelledby="titleId">
        <DialogHeader>
          <DialogTitle :id="titleId">
            {{
              mode === 'create'
                ? $t('secrets.addSecret')
                : $t('secrets.editSecret')
            }}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <form
          class="flex flex-col gap-4 px-4 py-2"
          @submit.prevent="handleSubmit"
        >
          <Field :data-invalid="!!errors.provider">
            <FieldLabel for="secret-provider">
              {{ $t('secrets.provider') }}
            </FieldLabel>
            <Select v-model="form.provider" :disabled="mode === 'edit'">
              <SelectTrigger
                id="secret-provider"
                class="w-full"
                autofocus
                :invalid="!!errors.provider"
              >
                <SelectValue :placeholder="$t('g.none')" />
              </SelectTrigger>
              <SelectContent disable-portal>
                <SelectItem
                  v-for="option in providerOptions"
                  :key="option.value || 'none'"
                  :value="option.value"
                  :disabled="option.disabled"
                >
                  <span class="flex items-center gap-2">
                    <img
                      v-if="option.logo"
                      :src="option.logo"
                      alt=""
                      class="size-4"
                    />
                    {{ option.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError v-if="errors.provider">{{
              errors.provider
            }}</FieldError>
            <FieldDescription v-else>{{ providerHelp }}</FieldDescription>
          </Field>

          <Field v-if="mode === 'create' && credentialOptions.length > 1">
            <FieldLabel for="secret-credential-type">
              {{ $t('secrets.credentialType') }}
            </FieldLabel>
            <Select v-model="credentialType">
              <SelectTrigger id="secret-credential-type" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent disable-portal>
                <SelectItem
                  v-for="option in credentialOptions"
                  :key="option.credential_type"
                  :value="option.credential_type"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {{ $t('secrets.credentialTypeHint') }}
            </FieldDescription>
          </Field>

          <Field :data-invalid="!!errors.name">
            <FieldLabel for="secret-name">
              {{ $t('secrets.name') }}
            </FieldLabel>
            <Input
              id="secret-name"
              v-model="form.name"
              :placeholder="$t('secrets.namePlaceholder')"
              :aria-invalid="!!errors.name"
            />
            <FieldError v-if="errors.name">{{ errors.name }}</FieldError>
          </Field>

          <Field :data-invalid="!!errors.secretValue">
            <FieldLabel for="secret-value">
              {{ $t('secrets.secretValue') }}
            </FieldLabel>
            <template v-if="selectedInputType === 'json_file'">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                class="w-fit"
                @click="fileInput?.click()"
              >
                <i class="icon-[lucide--upload]" />
                {{ $t('secrets.uploadJsonFile') }}
              </Button>
              <input
                ref="fileInput"
                type="file"
                accept="application/json,.json"
                class="hidden"
                @change="onFileChange"
              />
              <span v-if="fileName" class="text-sm text-muted-foreground">
                {{ fileName }}
              </span>
              <Textarea
                id="secret-value"
                v-model="form.secretValue"
                :placeholder="$t('secrets.jsonFilePlaceholder')"
                class="min-h-32 font-mono"
                :aria-invalid="!!errors.secretValue"
              />
            </template>
            <PasswordInput
              v-else
              id="secret-value"
              v-model="form.secretValue"
              :placeholder="
                mode === 'edit'
                  ? $t('secrets.secretValuePlaceholderEdit')
                  : $t('secrets.secretValuePlaceholder')
              "
              :aria-invalid="!!errors.secretValue"
            />
            <FieldError v-if="errors.secretValue">
              {{ errors.secretValue }}
            </FieldError>
            <FieldDescription v-else>{{ secretValueHint }}</FieldDescription>
          </Field>

          <FieldError v-if="apiError">{{ apiError }}</FieldError>

          <div class="flex justify-end gap-2 py-2">
            <Button
              variant="secondary"
              type="button"
              tabindex="0"
              @click="visible = false"
            >
              {{ $t('g.cancel') }}
            </Button>
            <Button type="submit" tabindex="0" :loading="loading">
              {{ $t('g.save') }}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import Field from '@/components/ui/field/Field.vue'
import FieldDescription from '@/components/ui/field/FieldDescription.vue'
import FieldError from '@/components/ui/field/FieldError.vue'
import FieldLabel from '@/components/ui/field/FieldLabel.vue'
import Input from '@/components/ui/input/Input.vue'
import PasswordInput from '@/components/ui/input/PasswordInput.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

import { useSecretForm } from '../composables/useSecretForm'
import type { SecretMetadata, SecretProviderInfo } from '../types'

const {
  secret,
  existingProviders = [],
  availableProviders = null,
  mode = 'create'
} = defineProps<{
  secret?: SecretMetadata
  existingProviders?: string[]
  availableProviders?: SecretProviderInfo[] | null
  mode?: 'create' | 'edit'
}>()

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const titleId = useId()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const {
  form,
  errors,
  loading,
  apiError,
  providerOptions,
  providerHelp,
  selectedInputType,
  credentialOptions,
  credentialType,
  fileName,
  loadSecretFromFile,
  handleSubmit
} = useSecretForm({
  mode,
  secret: () => secret,
  existingProviders: () => existingProviders,
  availableProviders: () => availableProviders,
  visible,
  onSaved: () => emit('saved')
})

const secretValueHint = computed(() => {
  if (selectedInputType.value === 'json_file') {
    return mode === 'edit'
      ? t('secrets.jsonFileHintEdit')
      : t('secrets.jsonFileHint')
  }
  return mode === 'edit'
    ? t('secrets.secretValueHintEdit')
    : t('secrets.secretValueHint')
})

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  await loadSecretFromFile(input.files?.[0] ?? null)
  input.value = ''
}
</script>
