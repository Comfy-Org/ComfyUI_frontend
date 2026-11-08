<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'

import AgentWorkflowListRow from './AgentWorkflowListRow.vue'
import type { WorkflowListItem } from './workflowListItem'

const PAGE_SIZE = 50

const {
  kind,
  items,
  loading = false,
  openingPath = null,
  failedPath = null
} = defineProps<{
  kind: 'apps' | 'workflows'
  items: readonly WorkflowListItem[]
  loading?: boolean
  openingPath?: string | null
  failedPath?: string | null
}>()

const emit = defineEmits<{
  open: [path: string]
  refresh: []
}>()

const { t } = useI18n()

const query = ref('')
const showAll = ref(false)

const searchLabel = computed(() =>
  kind === 'apps' ? t('agent.nav.searchApps') : t('agent.nav.searchWorkflows')
)
const emptyLabel = computed(() =>
  kind === 'apps' ? t('agent.nav.noApps') : t('agent.nav.noWorkflows')
)
const rowIcon = computed(() =>
  kind === 'apps' ? 'icon-[lucide--panels-top-left]' : 'icon-[comfy--workflow]'
)

const matches = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return needle === ''
    ? items
    : items.filter(({ name }) => name.toLocaleLowerCase().includes(needle))
})
const rows = computed(() =>
  showAll.value ? matches.value : matches.value.slice(0, PAGE_SIZE)
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 items-center gap-1 px-2 pb-2">
      <SearchInput
        v-model="query"
        :placeholder="searchLabel"
        :accessible-label="searchLabel"
        :clear-label="t('g.clear')"
        class="min-w-0 flex-1"
      />
      <Button
        :tooltip="t('agent.nav.refresh')"
        tooltip-side="bottom"
        type="button"
        variant="muted-textonly"
        size="icon"
        class="shrink-0"
        :aria-label="t('agent.nav.refresh')"
        :aria-busy="loading"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <i
          aria-hidden="true"
          :class="cn('icon-[lucide--refresh-cw]', loading && 'animate-spin')"
        />
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <p
        v-if="items.length === 0 && loading"
        role="status"
        class="my-0 px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('g.loading') }}
      </p>
      <p
        v-else-if="items.length === 0"
        class="my-0 px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ emptyLabel }}
      </p>
      <p
        v-else-if="matches.length === 0"
        class="my-0 px-2 py-8 text-center text-sm wrap-break-word text-muted-foreground"
      >
        {{ t('agent.nav.noMatches', { query: query.trim() }) }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-0.5 p-0">
        <AgentWorkflowListRow
          v-for="item in rows"
          :key="item.path"
          :item
          :icon="rowIcon"
          :opening="item.path === openingPath"
          :failed="item.path === failedPath"
          @open="emit('open', item.path)"
        />
      </ul>

      <Button
        v-if="matches.length > rows.length"
        type="button"
        variant="muted-textonly"
        size="sm"
        class="mt-1 w-full"
        @click="showAll = true"
      >
        {{ t('agent.showMore') }}
      </Button>
    </div>
  </div>
</template>
