<template>
  <Dialog v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="bg-black/70" />
      <DialogContent
        size="md"
        class="flex flex-col gap-4 p-6"
        @open-auto-focus="onOpen"
      >
        <DialogHeader>
          <DialogTitle>{{ $t('modelManager.credentials.title') }}</DialogTitle>
          <DialogDescription>
            {{ $t('modelManager.credentials.description') }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="credentials.length" class="flex flex-col gap-2">
          <div
            v-for="credential in credentials"
            :key="credential.id"
            class="flex items-center gap-2 rounded-lg border border-border-default bg-secondary-background px-3 py-2"
          >
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium text-base-foreground">
                {{ credential.label || credential.host }}
              </span>
              <span class="truncate text-xs text-muted-foreground">
                {{ credential.host }} ·
                {{
                  $t(
                    `modelManager.credentials.scheme.${credential.auth_scheme}`
                  )
                }}
                <template v-if="credential.secret_last4">
                  · ••••{{ credential.secret_last4 }}
                </template>
                <template v-if="!credential.enabled">
                  · {{ $t('modelManager.credentials.disabled') }}
                </template>
              </span>
            </div>
            <Button
              variant="textonly"
              size="icon"
              :title="$t('modelManager.credentials.edit')"
              @click="editCredential(credential)"
            >
              <i class="icon-[lucide--pencil] size-4" />
            </Button>
            <Button
              variant="textonly"
              size="icon"
              :title="$t('g.delete')"
              @click="confirmDelete(credential)"
            >
              <i class="icon-[lucide--trash-2] size-4 text-red-400" />
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-3 border-t border-border-default pt-3">
          <span class="text-sm font-medium text-base-foreground">
            {{
              form.id
                ? $t('modelManager.credentials.update')
                : $t('modelManager.credentials.add')
            }}
          </span>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground" for="cred-host">
              {{ $t('modelManager.credentials.host') }}
            </label>
            <Input
              id="cred-host"
              v-model="form.host"
              :placeholder="HOST_EXAMPLE"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground" for="cred-secret">
              {{ $t('modelManager.credentials.secret') }}
            </label>
            <Input
              id="cred-secret"
              v-model="form.secret"
              type="password"
              :placeholder="$t('modelManager.credentials.secretPlaceholder')"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">
              {{ $t('modelManager.credentials.authScheme') }}
            </label>
            <SingleSelect v-model="form.auth_scheme" :options="schemeOptions" />
          </div>

          <div v-if="form.auth_scheme === 'header'" class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground" for="cred-header">
              {{ $t('modelManager.credentials.headerName') }}
            </label>
            <Input
              id="cred-header"
              v-model="form.header_name"
              :placeholder="HEADER_NAME_EXAMPLE"
            />
          </div>

          <div v-if="form.auth_scheme === 'query'" class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground" for="cred-query">
              {{ $t('modelManager.credentials.queryParam') }}
            </label>
            <Input
              id="cred-query"
              v-model="form.query_param"
              :placeholder="QUERY_PARAM_EXAMPLE"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground" for="cred-label">
              {{ $t('modelManager.credentials.label') }}
            </label>
            <Input id="cred-label" v-model="form.label" />
          </div>

          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              v-model="form.match_subdomains"
              type="checkbox"
              class="size-4"
            />
            {{ $t('modelManager.credentials.matchSubdomains') }}
          </label>
          <p v-if="form.match_subdomains" class="text-xs text-amber-400">
            {{ $t('modelManager.credentials.matchSubdomainsWarning') }}
          </p>

          <p v-if="errorMessage" class="text-xs text-red-400">
            {{ errorMessage }}
          </p>

          <div class="flex justify-end gap-2">
            <Button v-if="form.id" variant="secondary" @click="resetForm">
              {{ $t('g.cancel') }}
            </Button>
            <Button
              variant="primary"
              :disabled="!canSubmit"
              :loading="isSubmitting"
              @click="submit"
            >
              {{ $t('modelManager.credentials.save') }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { storeToRefs } from 'pinia'
import { useDialogStore } from '@/stores/dialogStore'

import { useHostCredentialsStore } from '../stores/hostCredentialsStore'
import { AUTH_SCHEMES } from '../types'
import type { AuthScheme, HostCredentialView } from '../types'

const HOST_EXAMPLE = 'huggingface.co'
const HEADER_NAME_EXAMPLE = 'Authorization'
const QUERY_PARAM_EXAMPLE = 'token'

const { prefillHost = '' } = defineProps<{ prefillHost?: string }>()

const isOpen = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const store = useHostCredentialsStore()
const { credentials } = storeToRefs(store)
const dialogStore = useDialogStore()

const isSubmitting = ref(false)
const errorMessage = ref('')

interface CredentialForm {
  id: string | null
  host: string
  secret: string
  auth_scheme: AuthScheme
  header_name: string
  query_param: string
  label: string
  match_subdomains: boolean
}

function emptyForm(): CredentialForm {
  return {
    id: null,
    host: '',
    secret: '',
    auth_scheme: 'bearer',
    header_name: '',
    query_param: '',
    label: '',
    match_subdomains: false
  }
}

const form = reactive<CredentialForm>(emptyForm())

const schemeOptions = computed(() =>
  AUTH_SCHEMES.map((scheme) => ({
    value: scheme,
    name: t(`modelManager.credentials.scheme.${scheme}`)
  }))
)

const canSubmit = computed(
  () =>
    !!form.host.trim() &&
    !!form.secret &&
    (form.auth_scheme !== 'query' || !!form.query_param.trim()) &&
    (form.auth_scheme !== 'header' || !!form.header_name.trim())
)

async function onOpen() {
  resetForm()
  if (prefillHost) {
    form.host = prefillHost
  }
  try {
    await store.fetchCredentials()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t('modelManager.actionFailed')
  }
}

function resetForm() {
  Object.assign(form, emptyForm())
  errorMessage.value = ''
}

function editCredential(credential: HostCredentialView) {
  Object.assign(form, {
    id: credential.id,
    host: credential.host,
    secret: '',
    auth_scheme: credential.auth_scheme,
    header_name: credential.header_name ?? '',
    query_param: credential.query_param ?? '',
    label: credential.label ?? '',
    match_subdomains: credential.match_subdomains
  })
  errorMessage.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await store.upsert({
      host: form.host,
      secret: form.secret,
      auth_scheme: form.auth_scheme,
      header_name: form.auth_scheme === 'header' ? form.header_name : null,
      query_param: form.auth_scheme === 'query' ? form.query_param : null,
      label: form.label || null,
      match_subdomains: form.match_subdomains
    })
    useToastStore().add({
      severity: 'success',
      summary: t('modelManager.credentials.saved'),
      detail: form.host,
      life: 4000
    })
    resetForm()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t('modelManager.actionFailed')
  } finally {
    isSubmitting.value = false
  }
}

function confirmDelete(credential: HostCredentialView) {
  const dialog = showConfirmDialog({
    headerProps: { title: t('modelManager.credentials.deleteTitle') },
    props: {
      promptText: t('modelManager.credentials.deleteMessage', {
        host: credential.host
      })
    },
    footerProps: {
      confirmText: t('g.delete'),
      confirmVariant: 'destructive' as const,
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        dialogStore.closeDialog(dialog)
        try {
          await store.remove(credential.id)
        } catch (error) {
          useToastStore().add({
            severity: 'error',
            summary: t('modelManager.actionFailed'),
            detail: error instanceof Error ? error.message : String(error),
            life: 5000
          })
        }
      }
    }
  })
}
</script>
