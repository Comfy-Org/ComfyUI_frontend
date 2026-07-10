<template>
  <div class="@container relative flex min-h-0 flex-1 flex-col gap-4 pb-6">
    <div
      class="flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-9"
    >
      <span class="min-w-0 flex-1 text-sm text-muted-foreground">
        {{ $t('workspacePanel.models.descriptionLead') }}
        <span class="font-semibold text-base-foreground">
          {{ $t('workspacePanel.models.descriptionImport') }}
        </span>
        {{ $t('workspacePanel.models.descriptionWorkflows') }}
      </span>
      <SearchInput
        v-model="searchQuery"
        :placeholder="$t('workspacePanel.models.searchPlaceholder')"
        size="lg"
        class="w-full @2xl:w-64"
      />
    </div>

    <BillingStatusBanner />

    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table class="min-h-0 flex-1 scrollbar-gutter-stable px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead class="w-6">
              <Checkbox
                :model-value="allFilteredSelected"
                :aria-label="$t('workspacePanel.models.selectAll')"
                @update:model-value="toggleSelectAll"
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
            v-for="model in filteredModels"
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
            <TableCell class="text-muted-foreground">
              <span
                :class="
                  cn('block max-w-lg truncate', !model.enabled && 'opacity-30')
                "
                :title="model.displayName"
              >
                {{ model.displayName }}
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

    <div
      class="flex h-8 scrollbar-gutter-stable items-center justify-end gap-2 overflow-y-auto pr-6 text-sm text-muted-foreground"
    >
      <span>{{ $t('workspacePanel.models.autoEnableLabel') }}</span>
      <span class="grid justify-items-end text-base-foreground">
        <span
          :class="cn('col-start-1 row-start-1', !autoEnableNew && 'invisible')"
        >
          {{ $t('workspacePanel.models.autoEnabled') }}
        </span>
        <span
          :class="cn('col-start-1 row-start-1', autoEnableNew && 'invisible')"
        >
          {{ $t('workspacePanel.models.autoDisabled') }}
        </span>
      </span>
      <Switch
        :model-value="autoEnableNew"
        @update:model-value="setAutoEnableNew"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectionBar from '@/components/common/SelectionBar.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import { useModelAllowlist } from '@/platform/workspace/composables/useModelAllowlist'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const {
  autoEnableNew,
  searchQuery,
  sortField,
  sortDirection,
  selectedIds,
  selectedCount,
  allFilteredSelected,
  filteredModels,
  toggleSort,
  setEnabled,
  setSelectedEnabled,
  setAutoEnableNew,
  toggleSelection,
  toggleSelectAll,
  clearSelection
} = useModelAllowlist()

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
