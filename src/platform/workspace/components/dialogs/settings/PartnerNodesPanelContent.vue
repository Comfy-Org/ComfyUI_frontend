<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <BillingStatusBanner />
    <div class="flex w-full items-center gap-9">
      <span class="min-w-0 flex-1 text-sm text-muted-foreground">
        {{ $t('workspacePanel.partnerNodes.description') }}
      </span>
      <SearchInput
        v-model="searchQuery"
        :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
        size="lg"
        class="w-64"
      />
    </div>

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
                v-if="hasSelection"
                :model-value="allFilteredSelected"
                :aria-label="$t('workspacePanel.partnerNodes.selectAll')"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>
            <TableHead>
              <button :class="sortHeaderClass" @click="toggleSort('name')">
                {{ $t('workspacePanel.partnerNodes.columns.name') }}
                <i :class="sortIcon('name')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              <button :class="sortHeaderClass" @click="toggleSort('partner')">
                {{ $t('workspacePanel.partnerNodes.columns.partner') }}
                <i :class="sortIcon('partner')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('lastModified')"
              >
                {{ $t('workspacePanel.partnerNodes.columns.lastModified') }}
                <i :class="sortIcon('lastModified')" />
              </button>
            </TableHead>
            <TableHead class="w-14" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="node in filteredNodes"
            :key="node.id"
            :data-state="selectedIds.has(node.id) ? 'selected' : undefined"
            class="group cursor-pointer hover:bg-transparent data-[state=selected]:bg-transparent [&:hover>td]:bg-secondary-background/50 [&>td]:transition-colors [&>td:first-child]:rounded-l [&>td:last-child]:rounded-r [&[data-state=selected]>td]:bg-secondary-background/50"
            @click="toggleSelection(node.id)"
          >
            <TableCell>
              <Checkbox
                :model-value="selectedIds.has(node.id)"
                :aria-label="node.name"
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
              <span :class="cn(!node.enabled && 'opacity-30')">
                {{ node.name }}
              </span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              <div
                :class="
                  cn('flex items-center gap-2', !node.enabled && 'opacity-30')
                "
              >
                <PartnerBadge :partner="node.partner" />
                <span>{{ node.partner }}</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatLastModified(node.last_modified) }}
            </TableCell>
            <TableCell class="text-right" @click.stop>
              <Switch
                :model-value="node.enabled"
                @update:model-value="(v: boolean) => setEnabled(node, v)"
              />
            </TableCell>
          </TableRow>
          <TableRow
            v-if="filteredNodes.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              :colspan="5"
              class="py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t('workspacePanel.partnerNodes.empty') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Auto-enable default: outside the card, pinned to the panel bottom. pr-6
    lines the toggle up with the in-table row toggles (table px-4 + cell px-2);
    the reserved scrollbar gutter mirrors the table's so the two stay aligned
    whether or not the list is scrolling. -->
    <div
      class="flex h-8 scrollbar-gutter-stable items-center justify-end gap-2 overflow-y-auto pr-6 text-sm text-muted-foreground"
    >
      <span>{{ $t('workspacePanel.partnerNodes.autoEnableLabel') }}</span>
      <!-- Both strings occupy the same grid cell so its width is fixed to the
      longer one; only the active label is visible, so the row never reflows. -->
      <span class="grid justify-items-end text-base-foreground">
        <span
          :class="cn('col-start-1 row-start-1', !autoEnableNew && 'invisible')"
        >
          {{ $t('workspacePanel.partnerNodes.autoEnabled') }}
        </span>
        <span
          :class="cn('col-start-1 row-start-1', autoEnableNew && 'invisible')"
        >
          {{ $t('workspacePanel.partnerNodes.autoDisabled') }}
        </span>
      </span>
      <Switch
        :model-value="autoEnableNew"
        @update:model-value="setAutoEnableNew"
      />
    </div>

    <!-- Bulk selection toolbar -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="selectedCount > 0"
        class="fixed bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-interface-stroke/60 bg-base-background px-4 py-2 shadow-lg"
      >
        <Button
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="$t('workspacePanel.partnerNodes.clearSelection')"
          @click="clearSelection"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
        <span class="text-sm text-base-foreground tabular-nums">
          {{ $t('workspacePanel.partnerNodes.selectedCount', selectedCount) }}
        </span>
        <Switch :model-value="bulkEnabled" @update:model-value="applyBulk" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
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
import PartnerBadge from '@/platform/workspace/components/dialogs/settings/PartnerBadge.vue'
import { usePartnerNodes } from '@/platform/workspace/composables/usePartnerNodes'
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
  filteredNodes,
  fetch,
  toggleSort,
  setEnabled,
  setSelectedEnabled,
  setAutoEnableNew,
  toggleSelection,
  toggleSelectAll,
  clearSelection
} = usePartnerNodes()

const hasSelection = computed(() => selectedCount.value > 0)

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: 'name' | 'partner' | 'lastModified') {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

// When every selected node is enabled the bulk switch reads "on", so a toggle
// disables the whole selection; otherwise it enables them.
const bulkEnabled = computed(() =>
  filteredNodes.value
    .filter((n) => selectedIds.value.has(n.id))
    .every((n) => n.enabled)
)

function applyBulk(value: boolean) {
  void setSelectedEnabled(value)
}

function formatLastModified(iso: string | null): string {
  if (!iso) return t('workspacePanel.partnerNodes.neverModified')
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(fetch)
</script>
