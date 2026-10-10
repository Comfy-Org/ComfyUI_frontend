<script setup lang="ts">
import { FileCheck, Upload, X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useTemplateRef } from 'vue'

import EditorField from '@/components/cms/editor/EditorField.vue'
import EditorMedia from '@/components/cms/editor/EditorMedia.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { MediaKind } from '@/lib/cms/editor'
import type { MediaFileProblem } from '@/lib/cms/media-file'
import { mediaFileProblem, readMediaFile } from '@/lib/cms/media-file'

const {
  canUpload,
  missing,
  previewClass,
  locale = 'en'
} = defineProps<{
  /** Uploads need file storage, which only the demo has so far. */
  canUpload: boolean
  missing?: string
  previewClass?: string
  locale?: Locale
}>()
const url = defineModel<string>('url', { required: true })
const kind = defineModel<MediaKind>('kind', { required: true })
const { t } = translationsFor(locale)

const input = useTemplateRef('input')
const dragging = ref(false)
const problem = ref<MediaFileProblem>()
const fileName = ref('')
const uploaded = computed(() => url.value.startsWith('data:'))
const mediaKinds: ReadonlyArray<{ value: MediaKind; label: string }> = [
  { value: 'image', label: t('cmsAdmin.editor.media.image') },
  { value: 'video', label: t('cmsAdmin.editor.media.video') }
]

async function take(file: File | undefined) {
  dragging.value = false
  if (!file || !canUpload) return
  problem.value = mediaFileProblem(file)
  if (problem.value) return
  const read = await readMediaFile(file)
  url.value = read.url
  kind.value = read.kind
  fileName.value = file.name
}
function clear() {
  url.value = ''
  fileName.value = ''
}
</script>

<template>
  <div class="grid content-start gap-3">
    <div
      :class="
        cn(
          'relative rounded-lg',
          dragging && 'outline-2 outline-offset-2 outline-admin-fg'
        )
      "
      @dragover.prevent="dragging = canUpload"
      @dragleave="dragging = false"
      @drop.prevent="take($event.dataTransfer?.files[0])"
    >
      <EditorMedia :url :kind :class="previewClass" />
      <span
        v-if="dragging"
        class="absolute inset-0 grid place-items-center rounded-lg bg-admin-page/80 text-xs font-medium"
      >
        {{ t('cmsAdmin.editor.media.drop') }}
      </span>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <AdminButton
        size="sm"
        :icon="Upload"
        :disabled="!canUpload"
        @click="input?.click()"
      >
        {{ t('cmsAdmin.editor.media.upload') }}
      </AdminButton>
      <input
        ref="input"
        type="file"
        accept="image/*,video/*"
        class="hidden"
        @change="take(($event.target as HTMLInputElement).files?.[0])"
      />
      <AdminSegmented
        v-if="!uploaded"
        v-model="kind"
        :options="mediaKinds"
        :label="t('cmsAdmin.editor.media.kind')"
        size="sm"
      />
    </div>
    <p v-if="problem" role="alert" class="text-xs text-admin-danger-text">
      {{ t(`cmsAdmin.editor.media.problem.${problem}`) }}
    </p>
    <div
      v-if="uploaded"
      class="flex items-center gap-2 rounded-lg border border-admin-line px-3 py-2 text-xs"
    >
      <FileCheck
        class="size-4 shrink-0 text-admin-success"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 truncate">
        {{ fileName || t('cmsAdmin.editor.media.uploaded') }}
      </span>
      <AdminButton
        variant="ghost"
        size="icon"
        :aria-label="t('cmsAdmin.editor.media.remove')"
        @click="clear"
      >
        <X class="size-4" />
      </AdminButton>
    </div>
    <EditorField
      v-else
      :label="t('cmsAdmin.editor.media.orLink')"
      :error="missing"
      :hint="canUpload ? undefined : t('cmsAdmin.editor.media.noStorage')"
    >
      <input
        v-model="url"
        type="url"
        :placeholder="t('cmsAdmin.editor.media.placeholder')"
        :class="fieldClass"
      />
    </EditorField>
  </div>
</template>
