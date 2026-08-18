<template>
  <div class="@container relative flex min-h-0 flex-1 flex-col gap-4 pb-6">
    <div class="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-6">
      <span class="min-w-0 flex-1 text-sm text-muted-foreground">
        {{ $t('workspacePanel.partnerNodes.description') }}
      </span>
      <div class="flex shrink-0 items-center gap-2">
        <Button
          variant="muted-textonly"
          size="lg"
          @click="setAllFilteredEnabled(true)"
        >
          {{ $t('workspacePanel.allowlist.enableAll') }}
        </Button>
        <Button
          variant="muted-textonly"
          size="lg"
          @click="setAllFilteredEnabled(false)"
        >
          {{ $t('workspacePanel.allowlist.disableAll') }}
        </Button>
      </div>
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
                :aria-label="$t('workspacePanel.partnerNodes.selectAll')"
                @update:model-value="toggleSelectAll"
              />
            </TableHead>
            <TableHead :aria-sort="ariaSort('name')">
              <button :class="sortHeaderClass" @click="toggleSort('name')">
                {{ $t('workspacePanel.partnerNodes.columns.name') }}
                <i :class="sortIcon('name')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              {{ $t('workspacePanel.partnerNodes.columns.nodes') }}
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('lastModified')">
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
          <template v-for="group in groups" :key="group.partner">
            <!-- Provider row: click to expand/collapse its nodes -->
            <TableRow
              class="cursor-pointer hover:bg-transparent [&:hover>td]:bg-secondary-background/50 [&>td]:border-b [&>td]:border-interface-stroke/20 [&>td]:transition-colors"
              :aria-expanded="group.expanded"
              @click="togglePartnerCollapsed(group.partner)"
            >
              <TableCell @click.stop>
                <Checkbox
                  :model-value="groupSelectionState(group)"
                  :aria-label="group.partner"
                  @update:model-value="toggleGroupSelection(group)"
                />
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <i
                    :class="
                      cn(
                        'icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground transition-transform',
                        group.expanded && 'rotate-90'
                      )
                    "
                  />
                  <div
                    :class="
                      cn(
                        'flex items-center gap-2',
                        group.enabledCount === 0 && 'opacity-30'
                      )
                    "
                  >
                    <PartnerBadge :partner="group.partner" />
                    <span class="font-medium text-base-foreground">
                      {{ group.partner }}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground tabular-nums">
                {{
                  $t('workspacePanel.partnerNodes.groupCount', {
                    enabled: group.enabledCount,
                    total: group.totalCount
                  })
                }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatLastModified(group.lastModified) }}
              </TableCell>
              <TableCell class="text-right" @click.stop>
                <!-- On when any node in the group is enabled; the count column
                carries the partial state. Off disables the whole group. -->
                <Switch
                  :model-value="group.enabledCount > 0"
                  @update:model-value="
                    (v: boolean) => setGroupEnabled(group, v)
                  "
                />
              </TableCell>
            </TableRow>

            <template v-if="group.expanded">
              <TableRow
                v-for="node in group.nodes"
                :key="node.id"
                :data-state="selectedIds.has(node.id) ? 'selected' : undefined"
                class="group cursor-pointer hover:bg-transparent data-[state=selected]:bg-transparent [&:hover>td]:bg-secondary-background/50 [&>td]:border-b [&>td]:border-interface-stroke/20 [&>td]:transition-colors [&[data-state=selected]>td]:bg-secondary-background/50"
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
                  <div :class="cn('pl-7', !node.enabled && 'opacity-30')">
                    {{ node.name }}
                  </div>
                </TableCell>
                <TableCell />
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
            </template>
          </template>
          <TableRow v-if="groups.length === 0" class="hover:bg-transparent">
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

    <!-- Auto-enable default: toggle-first sentence, bottom-left. -->
    <div class="flex h-8 items-center gap-3 text-sm text-muted-foreground">
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
        {{ $t('workspacePanel.partnerNodes.autoEnableVerb') }}
        {{ $t('workspacePanel.partnerNodes.autoEnableSubject') }}
      </span>
    </div>

    <!-- Bulk selection toolbar: overlaid so toggling it doesn't reflow the panel -->
    <div class="absolute inset-x-0 bottom-0">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <SelectionBar
          v-if="selectedCount > 0"
          :label="
            $t('workspacePanel.partnerNodes.selectedCount', selectedCount)
          "
          :deselect-label="$t('workspacePanel.partnerNodes.clearSelection')"
          @deselect="clearSelection"
        >
          <Switch :model-value="bulkEnabled" @update:model-value="applyBulk" />
        </SelectionBar>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectionBar from '@/components/common/SelectionBar.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
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

const { search } = defineProps<{ search: string }>()

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
  groups,
  togglePartnerCollapsed,
  groupSelectionState,
  toggleGroupSelection,
  fetch,
  toggleSort,
  setEnabled,
  setSelectedEnabled,
  setAllFilteredEnabled,
  setGroupEnabled,
  setAutoEnableNew,
  toggleSelection,
  toggleSelectAll,
  clearSelection
} = usePartnerNodes()

// Search lives in the Allowlist tab row (shared with the Models tab).
watch(
  () => search,
  (value) => {
    searchQuery.value = value
  }
)

const hasSelection = computed(() => selectedCount.value > 0)

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: 'name' | 'lastModified') {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function ariaSort(
  field: 'name' | 'lastModified'
): 'ascending' | 'descending' | 'none' {
  if (sortField.value !== field) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
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
