<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import EditorMedia from '@/components/cms/editor/EditorMedia.vue'
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import MediaPicker from '@/components/cms/editor/MediaPicker.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminTooltip from '@/components/cms/ui/AdminTooltip.vue'
import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorExample } from '@/lib/cms/editor'

const {
  locale = 'en',
  namePrefix,
  canUpload
} = defineProps<{
  locale?: Locale
  canUpload: boolean
  /** Stems the internal name a new example is saved under. */
  namePrefix: string
}>()
const examples = defineModel<EditorExample[]>({ required: true })
const { t } = translationsFor(locale)
const openIndex = ref<number | undefined>(examples.value.length ? 0 : undefined)

function move(index: number, by: -1 | 1) {
  const next = [...examples.value]
  const [moved] = next.splice(index, 1)
  next.splice(index + by, 0, moved)
  examples.value = next
  openIndex.value = index + by
}
function remove(index: number) {
  examples.value = examples.value.filter((_, at) => at !== index)
  openIndex.value = undefined
}
function add() {
  examples.value = [
    ...examples.value,
    {
      title: '',
      description: '',
      prompt: '',
      media: '',
      mediaKind: 'image',
      raw: {
        name: `${namePrefix}-example-${examples.value.length + 1}`,
        tags: [],
        sampleOnly: false,
        values: {}
      }
    }
  ]
  openIndex.value = examples.value.length - 1
}
</script>

<template>
  <EditorSection
    :title="t('cmsAdmin.editor.examples.title')"
    :description="t('cmsAdmin.editor.examples.help')"
  >
    <template #actions>
      <AdminButton size="sm" :icon="Plus" @click="add">
        {{ t('cmsAdmin.editor.examples.add') }}
      </AdminButton>
    </template>
    <p
      v-if="examples.length === 0"
      class="rounded-lg border border-dashed border-admin-line px-4 py-6 text-center text-xs text-admin-muted"
    >
      {{ t('cmsAdmin.editor.examples.empty') }}
    </p>
    <ol v-else class="grid gap-2">
      <li
        v-for="(example, index) in examples"
        :key="String(example.raw.name ?? index)"
        class="rounded-lg border border-admin-line"
      >
        <div class="flex items-center gap-3 px-3 py-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-admin-fg"
            :aria-expanded="openIndex === index"
            @click="openIndex = openIndex === index ? undefined : index"
          >
            <EditorMedia
              :url="example.media"
              :kind="example.mediaKind"
              class="aspect-4/3 w-14 shrink-0"
            />
            <span class="grid min-w-0 gap-0.5">
              <span class="truncate text-sm">
                {{ example.title || t('cmsAdmin.editor.examples.untitled') }}
              </span>
              <span v-if="index === 0" class="text-xs text-admin-muted">
                {{ t('cmsAdmin.editor.examples.first') }}
              </span>
            </span>
          </button>
          <AdminTooltip :content="t('cmsAdmin.editor.examples.up')">
            <AdminButton
              variant="ghost"
              size="icon"
              :disabled="index === 0"
              :aria-label="t('cmsAdmin.editor.examples.up')"
              @click="move(index, -1)"
            >
              <ArrowUp class="size-4" />
            </AdminButton>
          </AdminTooltip>
          <AdminTooltip :content="t('cmsAdmin.editor.examples.down')">
            <AdminButton
              variant="ghost"
              size="icon"
              :disabled="index === examples.length - 1"
              :aria-label="t('cmsAdmin.editor.examples.down')"
              @click="move(index, 1)"
            >
              <ArrowDown class="size-4" />
            </AdminButton>
          </AdminTooltip>
          <AdminTooltip :content="t('cmsAdmin.editor.examples.remove')">
            <AdminButton
              variant="dangerGhost"
              size="icon"
              :aria-label="t('cmsAdmin.editor.examples.remove')"
              @click="remove(index)"
            >
              <Trash2 class="size-4" />
            </AdminButton>
          </AdminTooltip>
        </div>
        <div
          v-if="openIndex === index"
          class="grid gap-4 border-t border-admin-line p-4 md:grid-cols-[minmax(0,1fr)_14rem]"
        >
          <div class="grid gap-4">
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.examples.exampleTitle') }}
              <input v-model="example.title" :class="fieldClass" />
            </label>
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.examples.prompt') }}
              <textarea v-model="example.prompt" rows="4" :class="fieldClass" />
            </label>
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.examples.description') }}
              <textarea
                v-model="example.description"
                rows="2"
                :class="fieldClass"
              />
            </label>
          </div>
          <MediaPicker
            v-model:url="example.media"
            v-model:kind="example.mediaKind"
            :can-upload="canUpload"
            preview-class="aspect-4/3"
            :locale
          />
        </div>
      </li>
    </ol>
  </EditorSection>
</template>
