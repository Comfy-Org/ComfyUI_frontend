<template>
  <div class="flex h-[60vh] min-h-80 gap-3 pt-2 text-sm">
    <div class="flex w-60 shrink-0 flex-col gap-2">
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
      <template v-if="selected">
        <div class="flex items-center gap-2">
          <Input
            v-model="nameDraft"
            class="min-w-0 flex-1"
            :placeholder="t('promptNode.namePlaceholder')"
            @keyup.enter="commitRename"
            @blur="commitRename"
          />
          <template v-if="confirmingDelete">
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
          </template>
          <Button
            v-else
            variant="destructive-textonly"
            size="sm"
            @click="confirmingDelete = true"
          >
            {{ t('g.delete') }}
          </Button>
        </div>
        <div
          class="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-default bg-component-node-widget-background p-3 whitespace-pre-wrap"
        >
          {{ previewText }}
        </div>
      </template>
      <div
        v-else
        class="flex flex-1 items-center justify-center text-muted-foreground"
      >
        {{ t('promptNode.managerSelectHint') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import type { PromptTemplate } from '@/platform/prompts/schemas/promptTypes'
import { usePromptStore } from '@/stores/promptStore'

const { t } = useI18n()
const store = usePromptStore()

const search = ref('')
const selectedId = ref<string | null>(null)
const nameDraft = ref('')
const previewText = ref('')
const confirmingDelete = ref(false)
const isDeleting = ref(false)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return store.prompts.filter((prompt) =>
    prompt.name.toLowerCase().includes(query)
  )
})

const selected = computed(() =>
  selectedId.value ? store.getPrompt(selectedId.value) : undefined
)

function toPreviewText(template: PromptTemplate): string {
  return template
    .map((segment) =>
      segment.type === 'text' ? segment.value : `@${segment.name}`
    )
    .join('')
}

function select(id: string) {
  selectedId.value = id
}

watch(selectedId, async (id) => {
  confirmingDelete.value = false
  previewText.value = ''
  nameDraft.value = (id ? store.getPrompt(id) : undefined)?.name ?? ''
  if (!id) return
  try {
    previewText.value = toPreviewText(await store.resolveTemplate(id))
  } catch {
    previewText.value = ''
  }
})

async function commitRename() {
  const id = selectedId.value
  const name = nameDraft.value.trim()
  if (!id || !name || name === selected.value?.name) return
  await store.renamePrompt(id, name)
}

async function remove() {
  const id = selectedId.value
  if (!id) return
  isDeleting.value = true
  try {
    await store.deletePrompt(id)
    selectedId.value = null
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  void store.loadPrompts()
})
</script>
