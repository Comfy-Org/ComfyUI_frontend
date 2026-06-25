<template>
  <BaseModalLayout
    :content-title="t('promptNode.managerTitle')"
    size="sm"
    content-padding="none"
    class="text-sm"
  >
    <template #leftPanelHeaderTitle>
      <h2 class="flex-1 truncate text-base font-semibold select-none">
        {{ t('promptNode.managerTitle') }}
      </h2>
    </template>

    <template #leftPanel>
      <div class="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        <SearchInput
          v-model="search"
          size="sm"
          anchor-class="bg-base-background"
          :placeholder="t('promptNode.searchPlaceholder')"
        />
        <div class="border-t border-border-subtle" />
        <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          <div
            v-for="prompt in filtered"
            :key="prompt.id"
            :class="
              cn(
                'group flex items-center gap-1 rounded-sm',
                prompt.id === selectedId
                  ? 'bg-secondary-background-selected'
                  : 'hover:bg-secondary-background-hover'
              )
            "
          >
            <Button
              variant="textonly"
              size="md"
              class="h-7 min-w-0 flex-1 justify-start font-light hover:bg-transparent"
              @click="select(prompt.id)"
            >
              <span class="truncate text-xs">{{ prompt.name }}</span>
            </Button>
            <Button
              :variant="
                confirmingDeleteId === prompt.id
                  ? 'destructive'
                  : 'destructive-textonly'
              "
              size="icon-sm"
              :aria-label="t('g.delete')"
              :loading="isDeleting && confirmingDeleteId === prompt.id"
              :class="
                cn(
                  'mr-0.5 shrink-0',
                  confirmingDeleteId !== prompt.id &&
                    'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
                )
              "
              @click="requestDelete(prompt.id)"
            >
              <i class="icon-[lucide--trash-2] size-3.5" />
            </Button>
          </div>
          <p
            v-if="!filtered.length"
            class="px-2 py-8 text-center text-muted-foreground"
          >
            {{
              store.prompts.length
                ? t('promptNode.managerNoMatches')
                : t('promptNode.managerEmpty')
            }}
          </p>
        </div>
        <Button
          variant="inverted"
          size="sm"
          class="w-full gap-1"
          @click="startNew"
        >
          <i class="icon-[lucide--plus] size-4" />
          {{ t('promptNode.newPrompt') }}
        </Button>
      </div>
    </template>

    <template #header>
      <div v-if="isEditing" class="flex min-w-0 flex-1 items-center gap-1.5">
        <Input
          v-if="editingName"
          ref="nameInputEl"
          v-model="nameDraft"
          class="h-8 flex-1 bg-transparent px-0 text-base font-medium"
          :placeholder="t('promptNode.namePlaceholder')"
          @keydown.enter="stopEditingName"
          @blur="stopEditingName"
        />
        <template v-else>
          <span class="truncate text-base font-medium text-base-foreground">
            {{ nameDraft || t('promptNode.namePlaceholder') }}
          </span>
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('promptNode.editName')"
            @click="startEditingName"
          >
            <i class="icon-[lucide--pencil] size-3.5" />
          </Button>
        </template>
      </div>
    </template>

    <template #header-right-area>
      <div v-if="isEditing" class="flex shrink-0 items-center gap-1">
        <Popover v-if="selectedId">
          <PopoverTrigger as-child>
            <Button variant="link" size="sm" class="gap-1.5">
              <i class="icon-[lucide--history] size-3.5" />
              {{ t('promptNode.historyTitle') }}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            class="z-3000 w-72 rounded-lg border-border-default p-0"
          >
            <div class="max-h-72 overflow-y-auto">
              <div
                v-for="(version, index) in versions"
                :key="version.assetId"
                class="flex items-center gap-1 border-b border-border-default pr-2 last:border-b-0"
              >
                <Button
                  variant="textonly"
                  size="md"
                  :aria-label="t('promptNode.viewVersion')"
                  class="min-w-0 flex-1 justify-start font-normal"
                  @click="viewVersion(version)"
                >
                  <span class="truncate text-xs text-base-foreground">
                    {{ formatDate(version.createdAt) }}
                  </span>
                </Button>
                <span
                  v-if="index === 0"
                  class="shrink-0 rounded-sm bg-secondary-background px-1.5 py-0.5 text-2xs text-muted-foreground"
                >
                  {{ t('promptNode.currentVersion') }}
                </span>
                <Button
                  v-else
                  variant="link"
                  size="md"
                  class="shrink-0"
                  @click="restore(version)"
                >
                  {{ t('promptNode.restore') }}
                </Button>
              </div>
              <p
                v-if="!versions.length"
                class="px-3 py-8 text-center text-xs text-muted-foreground"
              >
                {{ t('promptNode.historyEmpty') }}
              </p>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          :disabled="!canSave"
          :loading="isSaving"
          @click="save"
        >
          {{ t('g.save') }}
        </Button>
      </div>
    </template>

    <template #content>
      <div v-if="isEditing" class="relative min-h-0 flex-1 px-6">
        <PromptEditor
          v-model="editorTemplate"
          :bordered="false"
          class="font-light"
          :placeholder="t('promptNode.editorPlaceholder')"
        />
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-base-background to-transparent"
        />
      </div>
      <div
        v-else
        class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <i class="icon-[lucide--text-cursor-input] size-8 opacity-40" />
        {{ t('promptNode.managerSelectHint') }}
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'
import {
  computed,
  nextTick,
  onMounted,
  provide,
  ref,
  useTemplateRef
} from 'vue'
import { useI18n } from 'vue-i18n'

import PromptEditor from '@/components/prompts/PromptEditor.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import type {
  PromptTemplate,
  PromptVersion
} from '@/platform/prompts/schemas/promptTypes'
import { usePromptStore } from '@/stores/promptStore'
import { OnCloseKey } from '@/types/widgetTypes'

const { onClose } = defineProps<{
  /** Closes the host modal; wired to BaseModalLayout's close affordances. */
  onClose?: () => void
}>()

provide(OnCloseKey, () => onClose?.())

const { t } = useI18n()
const store = usePromptStore()

const search = ref('')
const selectedId = ref<string | null>(null)
const creating = ref(false)
const nameDraft = ref('')
const editingName = ref(false)
const nameInputEl = useTemplateRef<InstanceType<typeof Input>>('nameInputEl')
const editorTemplate = ref<PromptTemplate>([])
const snapshot = ref('')
const versions = ref<PromptVersion[]>([])
const isSaving = ref(false)
const isDeleting = ref(false)
const confirmingDeleteId = ref<string | null>(null)

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

async function startEditingName() {
  editingName.value = true
  await nextTick()
  nameInputEl.value?.focus()
  nameInputEl.value?.selectAll()
}

function stopEditingName() {
  editingName.value = false
}

function startNew() {
  creating.value = true
  selectedId.value = null
  confirmingDeleteId.value = null
  nameDraft.value = ''
  editorTemplate.value = []
  snapshot.value = snapshotOf('', [])
  versions.value = []
  void startEditingName()
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
  confirmingDeleteId.value = null
  editingName.value = false
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

/** Loads a version into the editor for viewing, without changing the canonical
 *  prompt. Use {@link restore} to commit a version as the new latest. */
async function viewVersion(version: PromptVersion) {
  const template = await store.loadVersion(version.assetId)
  editorTemplate.value = JSON.parse(JSON.stringify(template))
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

/** Arms a prompt's delete icon on the first click, deletes on the second. */
function requestDelete(id: string) {
  if (confirmingDeleteId.value === id) {
    void remove(id)
  } else {
    confirmingDeleteId.value = id
  }
}

async function remove(id: string) {
  isDeleting.value = true
  try {
    await store.deletePrompt(id)
    confirmingDeleteId.value = null
    if (selectedId.value === id) {
      selectedId.value = null
      versions.value = []
    }
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  void store.loadPrompts()
})
</script>
