<template>
  <div class="@container relative flex min-h-0 flex-1 flex-col gap-4 pb-6">
    <div class="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-6">
      <span class="min-w-0 flex-1 text-sm text-muted-foreground">
        {{ $t('workspacePanel.models.descriptionLead') }}
        <span class="font-semibold text-base-foreground">
          {{ $t('workspacePanel.models.descriptionImport') }}
        </span>
        {{ $t('workspacePanel.models.descriptionWorkflows') }}
      </span>
      <div class="flex shrink-0 items-center gap-2">
        <Button
          variant="textonly"
          size="md"
          @click="setAllFilteredEnabled(true)"
        >
          {{ $t('workspacePanel.allowlist.enableAll') }}
        </Button>
        <Button
          variant="textonly"
          size="md"
          @click="setAllFilteredEnabled(false)"
        >
          {{ $t('workspacePanel.allowlist.disableAll') }}
        </Button>
      </div>
    </div>

    <BillingStatusBanner />

    <div
      ref="tableContainer"
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table class="min-h-0 flex-1 scrollbar-gutter-stable px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead class="w-6">
              <Checkbox
                :model-value="allPageSelected"
                :aria-label="$t('workspacePanel.models.selectAll')"
                @update:model-value="toggleSelectAllPage"
              />
            </TableHead>
            <TableHead :aria-sort="ariaSort('name')">
              <button :class="sortHeaderClass" @click="toggleSort('name')">
                {{ $t('workspacePanel.models.columns.name') }}
                <i :class="sortIcon('name')" />
              </button>
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('type')">
              <button :class="sortHeaderClass" @click="toggleSort('type')">
                {{ $t('workspacePanel.models.columns.type') }}
                <i :class="sortIcon('type')" />
              </button>
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('lastModified')">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('lastModified')"
              >
                {{ $t('workspacePanel.models.columns.lastModified') }}
                <i :class="sortIcon('lastModified')" />
              </button>
            </TableHead>
            <TableHead class="w-14" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="model in pagedModels"
            :key="model.id"
            :data-state="selectedIds.has(model.id) ? 'selected' : undefined"
            class="group cursor-pointer hover:bg-transparent data-[state=selected]:bg-transparent [&:hover>td]:bg-secondary-background/50 [&:last-child>td]:border-b-0 [&>td]:border-b [&>td]:border-interface-stroke/20 [&>td]:transition-colors [&[data-state=selected]>td]:bg-secondary-background/50"
            @click="toggleSelection(model.id)"
          >
            <TableCell>
              <Checkbox
                :model-value="selectedIds.has(model.id)"
                :aria-label="model.displayName"
                :class="
                  cn(
                    'pointer-events-none',
                    !hasSelection &&
                      'opacity-0 transition-opacity group-hover:opacity-100'
                  )
                "
              />
            </TableCell>
            <!-- Middle truncation: the distinctive parts of a display_name sit
            at both ends (owner at the start, file at the end), so the head
            truncates and the tail stays pinned. -->
            <TableCell class="text-muted-foreground">
              <span
                :class="cn('flex max-w-lg', !model.enabled && 'opacity-30')"
                :title="model.displayName"
              >
                <span class="min-w-0 truncate whitespace-pre">
                  {{ splitName(model.displayName).head }}
                </span>
                <span class="shrink-0 whitespace-pre">
                  {{ splitName(model.displayName).tail }}
                </span>
              </span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              <span :class="cn(!model.enabled && 'opacity-30')">
                {{ model.type }}
              </span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatLastModified(model.lastModified) }}
            </TableCell>
            <TableCell class="text-right" @click.stop>
              <Switch
                :model-value="model.enabled"
                @update:model-value="(v: boolean) => setEnabled(model, v)"
              />
            </TableCell>
          </TableRow>
          <TableRow
            v-if="filteredModels.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              :colspan="5"
              class="py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t('workspacePanel.models.empty') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination owns the bottom-right slot on every table (matching
    Activity); the set-once auto-enable default takes the quieter left. -->
    <div
      class="flex flex-col gap-3 text-sm text-muted-foreground @2xl:h-8 @2xl:flex-row @2xl:items-center"
    >
      <div class="flex items-center gap-3">
        <Switch
          :model-value="autoEnableNew"
          @update:model-value="setAutoEnableNew"
        />
        <!-- The sentence lights up with the toggle: foreground when the default
        is on, muted when off. -->
        <span
          :class="
            cn(
              'transition-colors',
              autoEnableNew ? 'text-base-foreground' : 'text-muted-foreground'
            )
          "
        >
          {{ $t('workspacePanel.models.autoEnableVerb') }}
          {{ $t('workspacePanel.models.autoEnableSubject') }}
        </span>
      </div>
      <Pagination
        v-model:page="page"
        :total="total"
        :items-per-page="itemsPerPage"
        class="@2xl:ml-auto"
      />
    </div>

    <div class="absolute inset-x-0 bottom-0">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <SelectionBar
          v-if="selectedCount > 0"
          :label="$t('workspacePanel.models.selectedCount', selectedCount)"
          :deselect-label="$t('workspacePanel.models.clearSelection')"
          @deselect="clearSelection"
        >
          <Switch :model-value="bulkEnabled" @update:model-value="applyBulk" />
        </SelectionBar>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectionBar from '@/components/common/SelectionBar.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import { useAutoPageSize } from '@/platform/workspace/composables/useAutoPageSize'
import { useModelAllowlist } from '@/platform/workspace/composables/useModelAllowlist'
import { cn } from '@comfyorg/tailwind-utils'

const { search } = defineProps<{ search: string }>()

const { t } = useI18n()

const tableContainer = ref<HTMLElement | null>(null)
const { pageSize } = useAutoPageSize(tableContainer, 1)

const {
  autoEnableNew,
  searchQuery,
  sortField,
  sortDirection,
  selectedIds,
  selectedCount,
  allPageSelected,
  filteredModels,
  page,
  total,
  itemsPerPage,
  pagedModels,
  toggleSort,
  setEnabled,
  setSelectedEnabled,
  setAllFilteredEnabled,
  setAutoEnableNew,
  toggleSelection,
  toggleSelectAllPage,
  clearSelection
} = useModelAllowlist(pageSize)

// Search lives in the Allowlist tab row (shared with Partner nodes).
watch(
  () => search,
  (value) => {
    searchQuery.value = value
  }
)

// Head truncates, tail stays whole. HF-style names split at their " - "
// separator so the filename survives; other long names keep their final
// characters (version, author) instead of losing them to an end ellipsis.
function splitName(displayName: string): { head: string; tail: string } {
  const sep = displayName.lastIndexOf(' - ')
  if (sep > 0) {
    return { head: displayName.slice(0, sep), tail: displayName.slice(sep) }
  }
  if (displayName.length > 48) {
    return { head: displayName.slice(0, -16), tail: displayName.slice(-16) }
  }
  return { head: displayName, tail: '' }
}

const hasSelection = computed(() => selectedCount.value > 0)

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: 'name' | 'type' | 'lastModified') {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function ariaSort(
  field: 'name' | 'type' | 'lastModified'
): 'ascending' | 'descending' | 'none' {
  if (sortField.value !== field) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

const bulkEnabled = computed(() =>
  filteredModels.value
    .filter((m) => selectedIds.value.has(m.id))
    .every((m) => m.enabled)
)

function applyBulk(value: boolean) {
  setSelectedEnabled(value)
}

function formatLastModified(iso: string | null): string {
  if (!iso) return t('workspacePanel.models.neverModified')
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
