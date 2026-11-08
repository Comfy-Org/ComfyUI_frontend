<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'

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
const listId = useId()

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

function describedBy(
  item: WorkflowListItem,
  index: number
): string | undefined {
  const ids = [
    ...(item.folder ? [`${listId}-folder-${index}`] : []),
    ...(item.path === failedPath ? [`${listId}-error-${index}`] : [])
  ]
  return ids.length > 0 ? ids.join(' ') : undefined
}
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
        <li
          v-for="(item, index) in rows"
          :key="item.path"
          class="flex flex-col"
        >
          <Button
            type="button"
            variant="muted-textonly"
            size="unset"
            :aria-label="item.name"
            :aria-describedby="describedBy(item, index)"
            :aria-busy="item.path === openingPath"
            :disabled="item.path === openingPath"
            class="w-full justify-start gap-2 rounded-sm px-2 py-1 text-left text-xs font-normal"
            @click="emit('open', item.path)"
          >
            <i
              aria-hidden="true"
              :class="
                item.path === openingPath
                  ? 'icon-[lucide--loader-circle] animate-spin'
                  : rowIcon
              "
            />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-foreground">{{ item.name }}</span>
              <span
                v-if="item.folder"
                :id="`${listId}-folder-${index}`"
                class="truncate text-muted-foreground"
                >{{ item.folder }}</span
              >
            </span>
          </Button>
          <span
            v-if="item.path === failedPath"
            :id="`${listId}-error-${index}`"
            role="alert"
            class="pr-2 pb-1 pl-8 text-xs text-destructive"
            >{{ t('agent.nav.openFailed', { name: item.name }) }}</span
          >
        </li>
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
