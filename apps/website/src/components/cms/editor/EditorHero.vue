<script setup lang="ts">
import MediaUpload from './MediaUpload.vue'
import { objectValue } from '@/lib/cms/editor-document'
import type { Document } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale, uid, draft, csrf } = defineProps<{
  locale: Locale
  uid?: string
  draft: number
  csrf: string
}>()
const document = defineModel<Document>({ required: true })
const emit = defineEmits<{ busy: [active: boolean] }>()
const t = translationsFor(locale).t
function media(name: string, reference: Document | undefined) {
  const next = { ...document.value }
  if (reference) next[name] = reference
  else delete next[name]
  document.value = next
}
</script>
<template>
  <section
    class="grid content-start gap-3 rounded-xl border border-admin-line bg-admin-card p-5"
  >
    <h2 class="text-lg font-medium">{{ t('cmsEditor.hero') }}</h2>
    <MediaUpload
      :reference="document.hero ? objectValue(document.hero) : undefined"
      :entity-u-i-d="uid"
      :draft
      :csrf
      :locale
      media-role="hero"
      @update="media('hero', $event)"
      @busy="emit('busy', $event)"
    />
    <h3 class="mt-3 text-sm">{{ t('cmsEditor.thumbnail') }}</h3>
    <MediaUpload
      :reference="
        document.thumbnail ? objectValue(document.thumbnail) : undefined
      "
      :entity-u-i-d="uid"
      :draft
      :csrf
      :locale
      media-role="thumbnail"
      @update="media('thumbnail', $event)"
      @busy="emit('busy', $event)"
    />
    <h3 class="mt-3 text-sm">{{ t('cmsEditor.staticThumb') }}</h3>
    <MediaUpload
      :reference="
        document.static_thumb ? objectValue(document.static_thumb) : undefined
      "
      :entity-u-i-d="uid"
      :draft
      :csrf
      :locale
      media-role="static_thumb"
      :accept="['image/webp']"
      :max-bytes="160 << 10"
      :hint="t('cmsEditor.staticThumbHelp')"
      @update="media('static_thumb', $event)"
      @busy="emit('busy', $event)"
    />
  </section>
</template>
