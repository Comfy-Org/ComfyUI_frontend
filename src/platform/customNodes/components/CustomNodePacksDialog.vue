<template>
  <div class="flex flex-col gap-4 p-6">
    <header class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="m-0 text-lg font-medium">
          {{ $t('customNodePacks.title') }}
        </h2>
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('customNodePacks.description') }}
        </p>
      </div>
      <Button
        variant="secondary"
        size="icon"
        :aria-label="$t('customNodePacks.close')"
        @click="onClose?.()"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="primary"
        :loading="isStartingEditor"
        :disabled="isBusy"
        @click="onCreate"
      >
        <i class="icon-[lucide--plus] size-4" />
        {{ $t('customNodePacks.create') }}
      </Button>
      <Button
        variant="secondary"
        :loading="isUploading"
        :disabled="isBusy"
        @click="pickFile"
      >
        <i class="icon-[lucide--upload] size-4" />
        {{
          isUploading
            ? $t('customNodePacks.uploading')
            : $t('customNodePacks.upload')
        }}
      </Button>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept=".zip"
      class="sr-only"
      @change="onFileChange"
    />

    <div
      v-if="isUploading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="flex items-start gap-3 rounded-lg border border-border-default px-4 py-3"
    >
      <i
        class="icon-[lucide--loader-circle] size-5 shrink-0 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <div class="flex min-w-0 flex-col gap-1">
        <span class="text-sm font-medium">
          {{ $t('customNodePacks.installing') }}
        </span>
        <span class="text-sm text-muted-foreground">
          {{ $t('customNodePacks.installingWait') }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <h3
        class="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {{ $t('customNodePacks.yourPacks') }}
      </h3>
      <div
        v-if="isLoading"
        role="status"
        class="flex items-center justify-center gap-2 rounded-lg border border-border-default px-3 py-8 text-sm text-muted-foreground"
      >
        <i class="icon-[lucide--loader-circle] size-4 animate-spin" />
        {{ $t('customNodePacks.loading') }}
      </div>
      <div
        v-else-if="!packs.length"
        class="flex items-center justify-center rounded-lg border border-dashed border-border-default px-3 py-8 text-sm text-muted-foreground"
      >
        {{ $t('customNodePacks.empty') }}
      </div>
      <ul
        v-else
        class="m-0 flex max-h-64 list-none flex-col gap-2 overflow-y-auto p-0"
      >
        <li
          v-for="pack in packs"
          :key="pack.revisionId"
          class="flex flex-col gap-2 rounded-lg border border-border-default px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-medium">{{ pack.name }}</span>
            <span class="text-xs text-muted-foreground">{{
              pack.uploadedAt
            }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="secondary"
                  size="icon"
                  :disabled="isBusy"
                  :aria-label="
                    $t('customNodePacks.packActions', { name: pack.name })
                  "
                >
                  <i class="icon-[lucide--ellipsis] size-4" />
                </Button>
              </PopoverTrigger>
              <!-- Popovers portal to <body> at z-50, which the modal stack
                   (z-1700 and up) paints over; lift this one above it. -->
              <PopoverContent
                align="end"
                :side-offset="4"
                class="z-1800 w-52 p-1"
              >
                <div class="flex flex-col" role="menu">
                  <!-- PopoverClose dismisses the menu as the action runs, so
                       it cannot linger over the dialog the action opens. -->
                  <PopoverClose
                    v-for="action in packActions(pack)"
                    :key="action.label"
                    as-child
                  >
                    <button
                      type="button"
                      role="menuitem"
                      class="flex cursor-pointer appearance-none items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-left font-inter text-sm text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
                      @click="action.run()"
                    >
                      <i :class="action.icon" class="size-4 shrink-0" />
                      {{ action.label }}
                    </button>
                  </PopoverClose>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PopoverClose, PopoverTrigger } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useCustomNodeEditor } from '@/platform/customNodes/composables/useCustomNodeEditor'
import { useCustomNodeCreateFlow } from '@/platform/customNodes/composables/useCustomNodeCreateFlow'
import { useCustomNodeEditorDialog } from '@/platform/customNodes/composables/useCustomNodeEditorDialog'
import { useCustomNodePacks } from '@/platform/customNodes/composables/useCustomNodePacks'
import type { UploadedNodePack } from '@/platform/customNodes/composables/useCustomNodePacks'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

const { onClose } = defineProps<{ onClose?: () => void }>()

const { t } = useI18n()
const toast = useToastStore()
const editorDialog = useCustomNodeEditorDialog()
const { startCreateFlow } = useCustomNodeCreateFlow()
const { createSession } = useCustomNodeEditor()
const {
  packs,
  isLoading,
  isUploading,
  isDeleting,
  downloadingRevisionId,
  refresh,
  uploadPack,
  deletePack,
  downloadPack
} = useCustomNodePacks()
const isStartingEditor = ref(false)
const isBusy = computed(
  () =>
    isUploading.value ||
    isLoading.value ||
    isDeleting.value ||
    downloadingRevisionId.value !== null ||
    isStartingEditor.value
)

const fileInput = ref<HTMLInputElement | null>(null)
const replaceName = ref<string | null>(null)

onMounted(() => {
  void refresh().catch((error) => {
    reportError(error, { errorType: 'custom_node_list_failed' })
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.loadFailed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 8000
    })
  })
})

const pickFile = () => {
  replaceName.value = null
  fileInput.value?.click()
}

const replacePack = (name: string) => {
  replaceName.value = name
  fileInput.value?.click()
}

const openEditor = async (
  mode: 'create' | 'edit',
  name: string,
  revisionId?: string
) => {
  isStartingEditor.value = true
  try {
    const session = await createSession({ mode, name, revisionId })
    editorDialog.show(session, refresh)
  } catch (error) {
    reportError(error, { errorType: 'custom_node_editor_start_failed' })
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.editor.openFailed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 8000
    })
  } finally {
    isStartingEditor.value = false
  }
}

const onCreate = async () => {
  isStartingEditor.value = true
  try {
    await startCreateFlow()
  } finally {
    isStartingEditor.value = false
  }
}

/** Row actions, shown in the pack's overflow menu. */
const packActions = (pack: UploadedNodePack) => [
  {
    label: t('customNodePacks.createNode'),
    icon: 'icon-[lucide--file-plus-2]',
    run: () => void startCreateFlow(pack)
  },
  {
    label: t('customNodePacks.edit'),
    icon: 'icon-[lucide--code-2]',
    run: () => void onEdit(pack)
  },
  {
    label: t('customNodePacks.download'),
    icon: 'icon-[lucide--download]',
    run: () => void onDownload(pack)
  },
  {
    label: t('customNodePacks.replace'),
    icon: 'icon-[lucide--upload]',
    run: () => replacePack(pack.name)
  },
  {
    label: t('customNodePacks.delete'),
    icon: 'icon-[lucide--trash-2]',
    run: () => void onDelete(pack.name)
  }
]

const onEdit = async (pack: UploadedNodePack) => {
  await openEditor('edit', pack.name, pack.revisionId)
}

const onDownload = async (pack: UploadedNodePack) => {
  try {
    await downloadPack(pack)
  } catch (error) {
    reportError(error, { errorType: 'custom_node_download_failed' })
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.downloadFailed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 8000
    })
  }
}

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const name = replaceName.value
  replaceName.value = null
  try {
    await uploadPack(file, name ?? undefined)
    toast.add({
      severity: 'success',
      summary: t('customNodePacks.uploaded'),
      detail: t('customNodePacks.installingDetail'),
      life: 5000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.failed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 8000
    })
  }
}

const onDelete = async (name: string) => {
  try {
    await deletePack(name)
    toast.add({
      severity: 'success',
      summary: t('customNodePacks.deleted'),
      life: 4000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.deleteFailed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 8000
    })
  }
}
</script>
