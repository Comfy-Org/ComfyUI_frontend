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
          <DialogTitle>{{ $t('modelManager.addModel') }}</DialogTitle>
          <DialogDescription>
            {{ $t('modelManager.addModelDescription') }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground" for="download-url">
            {{ $t('modelManager.url') }}
          </label>
          <Input
            id="download-url"
            v-model="url"
            :placeholder="$t('modelManager.urlPlaceholder')"
            @update:model-value="onUrlChanged"
          />
          <p v-if="hostHint" class="text-xs text-amber-400">{{ hostHint }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">
            {{ $t('modelManager.folder') }}
          </label>
          <SingleSelect
            v-model="directory"
            :options="folderOptions"
            :label="$t('modelManager.selectFolder')"
            :loading="isLoadingFolders"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground" for="download-filename">
            {{ $t('modelManager.filename') }}
          </label>
          <Input
            id="download-filename"
            v-model="filename"
            :placeholder="$t('modelManager.filenamePlaceholder')"
            @update:model-value="onFilenameEdited"
          />
        </div>

        <!-- TODO: re-enable once we think we'd want to allow any extension
        <label class="flex w-fit items-center gap-2 text-xs text-muted-foreground">
          <input v-model="allowAnyExtension" type="checkbox" class="size-4" />
          {{ $t('modelManager.allowAnyExtension') }}
        </label>
        -->

        <p
          v-if="modelId"
          class="truncate rounded-md bg-secondary-background px-2 py-1 text-xs text-muted-foreground"
        >
          {{ modelId }}
        </p>

        <p v-if="errorMessage" class="text-xs text-red-400">
          {{ errorMessage }}
        </p>

        <DialogFooter>
          <Button variant="secondary" @click="isOpen = false">
            {{ $t('g.cancel') }}
          </Button>
          <Button
            variant="primary"
            :disabled="!canSubmit"
            :loading="isSubmitting"
            @click="submit"
          >
            {{ $t('modelManager.download') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { providerForUrl } from '../downloadAuthProviders'
import { useModelDownloadStore } from '../stores/modelDownloadStore'
import { DownloadApiError } from '../types'
import type { DownloadProvider } from '../types'
import {
  buildModelId,
  filenameFromUrl,
  hasModelExtension,
  isLikelyAllowedHost,
  isValidPathSegment
} from '../utils/modelId'

const isOpen = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  authRequired: [provider: DownloadProvider | undefined]
}>()

const { t } = useI18n()
const store = useModelDownloadStore()
const {
  modelTypes,
  isLoading: isLoadingFolders,
  fetchModelTypes
} = useModelTypes()

const url = ref('')
const directory = ref<string | undefined>(undefined)
const filename = ref('')
const isFilenameUserEdited = ref(false)
const allowAnyExtension = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

const folderOptions = computed(() => modelTypes.value)

const modelId = computed(() =>
  directory.value && filename.value
    ? buildModelId(directory.value, filename.value)
    : ''
)

const hostHint = computed(() =>
  url.value && !isLikelyAllowedHost(url.value)
    ? t('modelManager.hostNotAllowedHint')
    : ''
)

const canSubmit = computed(
  () =>
    !!url.value &&
    !!directory.value &&
    isValidPathSegment(filename.value) &&
    (allowAnyExtension.value || hasModelExtension(filename.value))
)

function onOpen() {
  void fetchModelTypes()
  errorMessage.value = ''
}

function onUrlChanged() {
  if (!isFilenameUserEdited.value) {
    filename.value = filenameFromUrl(url.value)
  }
}

function onFilenameEdited() {
  isFilenameUserEdited.value = true
}

function reset() {
  url.value = ''
  directory.value = undefined
  filename.value = ''
  isFilenameUserEdited.value = false
  allowAnyExtension.value = false
  errorMessage.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await store.enqueue({
      url: url.value,
      model_id: modelId.value,
      allow_any_extension: allowAnyExtension.value
    })
    useToastStore().add({
      severity: 'success',
      summary: t('modelManager.downloadQueued'),
      detail: modelId.value,
      life: 4000
    })
    reset()
    isOpen.value = false
  } catch (error) {
    handleEnqueueError(error)
  } finally {
    isSubmitting.value = false
  }
}

function handleEnqueueError(error: unknown) {
  if (error instanceof DownloadApiError) {
    if (error.is('ALREADY_AVAILABLE')) {
      useToastStore().add({
        severity: 'info',
        summary: t('modelManager.alreadyInstalled'),
        detail: modelId.value,
        life: 4000
      })
      reset()
      isOpen.value = false
      return
    }
    if (error.is('ALREADY_DOWNLOADING')) {
      useToastStore().add({
        severity: 'info',
        summary: t('modelManager.alreadyDownloading'),
        detail: modelId.value,
        life: 4000
      })
      reset()
      isOpen.value = false
      return
    }
    if (error.is('GATED_REPO') || error.is('CREDENTIALS_REQUIRED')) {
      errorMessage.value = error.message
      emit('authRequired', providerForUrl(url.value))
      return
    }
    errorMessage.value = error.message
    return
  }
  errorMessage.value =
    error instanceof Error ? error.message : t('modelManager.actionFailed')
}
</script>
