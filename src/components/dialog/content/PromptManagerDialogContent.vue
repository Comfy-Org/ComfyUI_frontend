<template>
  <div class="flex h-[60vh] min-h-80 gap-3 pt-2 text-sm">
    <div class="flex w-60 shrink-0 flex-col gap-2">
      <Button
        variant="secondary"
        size="sm"
        class="justify-start gap-2"
        @click="startNew"
      >
        <i class="icon-[lucide--plus] size-4" />
        {{ t('promptNode.newPrompt') }}
      </Button>
      <Input
        v-model="search"
        :placeholder="t('promptNode.searchPlaceholder')"
      />
      <div
        class="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-default p-1"
      >
        <Button
          v-for="prompt in filtered"
          :key="prompt.id"
          variant="textonly"
          size="sm"
          :class="
            cn(
              'w-full justify-start',
              prompt.id === selectedId && 'bg-secondary-background-hover'
            )
          "
          @click="select(prompt.id)"
        >
          <span class="truncate">{{ prompt.name }}</span>
        </Button>
        <p v-if="!filtered.length" class="px-2 py-1.5 text-muted-foreground">
          {{
            store.prompts.length
              ? t('promptNode.managerNoMatches')
              : t('promptNode.managerEmpty')
          }}
        </p>
      </div>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <template v-if="isEditing">
        <Input
          v-model="nameDraft"
          :placeholder="t('promptNode.namePlaceholder')"
        />
        <div class="min-h-0 flex-1">
          <PromptEditor
            v-model="editorTemplate"
            :placeholder="t('promptNode.editorPlaceholder')"
          />
        </div>
        <div class="flex items-center justify-between gap-2">
          <Button
            size="sm"
            :disabled="!canSave"
            :loading="isSaving"
            @click="save"
          >
            {{ t('g.save') }}
          </Button>
          <template v-if="selectedId">
            <template v-if="confirmingDelete">
              <div class="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  :loading="isDeleting"
                  @click="remove"
                >
                  {{ t('promptNode.confirmDelete') }}
                </Button>
                <Button
                  variant="textonly"
                  size="sm"
                  @click="confirmingDelete = false"
                >
                  {{ t('g.cancel') }}
                </Button>
              </div>
            </template>
            <Button
              v-else
              variant="destructive-textonly"
              size="sm"
              @click="confirmingDelete = true"
            >
              {{ t('g.delete') }}
            </Button>
          </template>
        </div>
      </template>
      <div
        v-else
        class="flex flex-1 items-center justify-center text-muted-foreground"
      >
        {{ t('promptNode.managerSelectHint') }}
      </div>
    </div>

    <div v-if="selectedId" class="flex w-48 shrink-0 flex-col gap-2">
      <span
        class="text-2xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {{ t('promptNode.historyTitle') }}
      </span>
      <div
        class="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-default p-1"
      >
        <div
          v-for="(version, index) in versions"
          :key="version.assetId"
          class="flex items-center justify-between gap-1 px-2 py-1"
        >
          <span class="truncate text-xs text-muted-foreground">
            {{ formatDate(version.createdAt) }}
          </span>
          <Button
            v-if="index !== 0"
            variant="textonly"
            size="sm"
            @click="restore(version)"
          >
            {{ t('promptNode.restore') }}
          </Button>
          <span v-else class="text-2xs text-muted-foreground">
            {{ t('promptNode.currentVersion') }}
          </span>
        </div>
        <p
          v-if="!versions.length"
          class="px-2 py-1.5 text-xs text-muted-foreground"
        >
          {{ t('promptNode.historyEmpty') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PromptEditor from '@/components/prompts/PromptEditor.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import type {
  PromptTemplate,
  PromptVersion
} from '@/platform/prompts/schemas/promptTypes'
import { usePromptStore } from '@/stores/promptStore'

const { t } = useI18n()
const store = usePromptStore()

const search = ref('')
const selectedId = ref<string | null>(null)
const creating = ref(false)
const nameDraft = ref('')
const editorTemplate = ref<PromptTemplate>([])
const snapshot = ref('')
const versions = ref<PromptVersion[]>([])
const isSaving = ref(false)
const isDeleting = ref(false)
const confirmingDelete = ref(false)

const isEditing = computed(() => creating.value || selectedId.value !== null)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return store.prompts.filter((prompt) =>
    prompt.name.toLowerCase().includes(query)
  )
})

function snapshotOf(name: string, template: PromptTemplate): string {
  return JSON.stringify({ name, template })
}

const canSave = computed(
  () =>
    nameDraft.value.trim().length > 0 &&
    !isSaving.value &&
    snapshotOf(nameDraft.value.trim(), editorTemplate.value) !== snapshot.value
)

function startNew() {
  creating.value = true
  selectedId.value = null
  confirmingDelete.value = false
  nameDraft.value = ''
  editorTemplate.value = []
  snapshot.value = snapshotOf('', [])
  versions.value = []
}

async function refreshVersions() {
  versions.value = selectedId.value
    ? await store.getVersions(selectedId.value)
    : []
}

function formatDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

async function select(id: string) {
  creating.value = false
  confirmingDelete.value = false
  selectedId.value = id
  nameDraft.value = store.getPrompt(id)?.name ?? ''
  editorTemplate.value = []
  try {
    const template = await store.resolveTemplate(id)
    editorTemplate.value = JSON.parse(JSON.stringify(template))
  } catch (error) {
    console.error('[PromptManager] Failed to load prompt content', error)
  }
  snapshot.value = snapshotOf(nameDraft.value, editorTemplate.value)
  await refreshVersions()
}

async function restore(version: PromptVersion) {
  const id = selectedId.value
  if (!id) return
  const template = await store.loadVersion(version.assetId)
  await store.savePromptVersion(id, { name: nameDraft.value.trim(), template })
  editorTemplate.value = JSON.parse(JSON.stringify(template))
  snapshot.value = snapshotOf(nameDraft.value.trim(), template)
  await refreshVersions()
}

async function save() {
  if (!canSave.value) return
  const name = nameDraft.value.trim()
  const template = editorTemplate.value
  isSaving.value = true
  try {
    if (creating.value) {
      const created = await store.savePrompt({ name, template })
      creating.value = false
      selectedId.value = created.id
    } else if (selectedId.value) {
      const original = JSON.parse(snapshot.value) as {
        template: PromptTemplate
      }
      const contentChanged =
        JSON.stringify(template) !== JSON.stringify(original.template)
      if (contentChanged) {
        await store.savePromptVersion(selectedId.value, { name, template })
      } else {
        await store.renamePrompt(selectedId.value, name)
      }
    }
    nameDraft.value = name
    snapshot.value = snapshotOf(name, template)
    await refreshVersions()
  } finally {
    isSaving.value = false
  }
}

async function remove() {
  const id = selectedId.value
  if (!id) return
  isDeleting.value = true
  try {
    await store.deletePrompt(id)
    selectedId.value = null
    confirmingDelete.value = false
    versions.value = []
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  void store.loadPrompts()
})
</script>
