<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex w-full items-start gap-9">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="text-base font-semibold text-base-foreground">
          {{ $t('workspacePanel.partnerNodes.title') }}
        </span>
        <span class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.partnerNodes.description') }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <SearchInput
          v-model="searchQuery"
          :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
          size="lg"
          class="w-64"
        />
        <DropdownMenu :entries="filterEntries">
          <template #button>
            <Button
              variant="secondary"
              size="icon-lg"
              class="rounded-lg"
              :aria-label="$t('workspacePanel.partnerNodes.filterByPartner')"
            >
              <i class="icon-[lucide--list-filter] size-4" />
            </Button>
          </template>
        </DropdownMenu>
      </div>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <div class="min-h-0 flex-1 overflow-auto px-6">
        <Table>
          <TableHeader class="sticky top-0 z-10 bg-base-background">
            <TableRow class="hover:bg-transparent">
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
              :class="cn('group cursor-pointer', !node.enabled && 'opacity-55')"
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
              <TableCell class="text-base-foreground">
                {{ node.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                <div class="flex items-center gap-2">
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
          </TableBody>
        </Table>

        <p
          v-if="filteredNodes.length === 0"
          class="px-2 py-6 text-center text-sm text-muted-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.empty') }}
        </p>
      </div>
    </div>

    <!-- Auto-enable default: outside the card, pinned to the panel bottom -->
    <div
      class="flex items-center justify-end gap-2 pt-4 text-sm text-muted-foreground"
    >
      <span>{{ $t('workspacePanel.partnerNodes.autoEnableLabel') }}</span>
      <span class="text-base-foreground">
        {{ $t('workspacePanel.partnerNodes.autoEnabled') }}
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
        <span class="text-sm text-base-foreground">
          {{ $t('workspacePanel.partnerNodes.selectedCount', selectedCount) }}
        </span>
        <Switch :model-value="bulkEnabled" @update:model-value="applyBulk" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
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
import PartnerBadge from '@/platform/workspace/components/dialogs/settings/PartnerBadge.vue'
import { usePartnerNodes } from '@/platform/workspace/composables/usePartnerNodes'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const {
  autoEnableNew,
  searchQuery,
  partnerFilter,
  partners,
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
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left text-sm text-muted-foreground'

function sortIcon(field: 'name' | 'partner' | 'lastModified') {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

const filterEntries = computed<MenuItem[]>(() => [
  {
    label: t('workspacePanel.partnerNodes.allPartners'),
    command: () => (partnerFilter.value = null)
  },
  ...partners.value.map((p) => ({
    label: p,
    command: () => (partnerFilter.value = p)
  }))
])

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
