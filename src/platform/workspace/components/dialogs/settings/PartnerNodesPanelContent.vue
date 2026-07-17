<template>
  <div class="@container relative flex min-h-0 flex-1 flex-col gap-4 pb-6">
    <BillingStatusBanner />

    <div
      class="flex min-h-16 flex-col items-start gap-4 rounded-xl bg-secondary-background/20 px-4 py-3 @2xl:flex-row @2xl:items-center @2xl:justify-between"
    >
      <div class="min-w-0">
        <div
          id="partner-node-restrictions-label"
          class="font-medium text-base-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.restrictions.label') }}
        </div>
        <div
          id="partner-node-restrictions-description"
          class="mt-1 text-sm text-muted-foreground"
        >
          {{
            $t(
              restrictionsEnabled
                ? 'workspacePanel.partnerNodes.restrictions.descriptions.restricted'
                : 'workspacePanel.partnerNodes.restrictions.descriptions.allowAll'
            )
          }}
        </div>
      </div>
      <ToggleGroup
        type="single"
        :model-value="restrictionsEnabled ? 'restricted' : 'allowAll'"
        class="w-full shrink-0 rounded-lg bg-secondary-background p-0.5 @2xl:w-auto"
        aria-labelledby="partner-node-restrictions-label"
        aria-describedby="partner-node-restrictions-description"
        @update:model-value="requestRestrictionsChange"
      >
        <ToggleGroupItem value="allowAll" size="lg">
          {{ $t('workspacePanel.partnerNodes.restrictions.modes.allowAll') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="restricted" size="lg">
          {{ $t('workspacePanel.partnerNodes.restrictions.modes.restricted') }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <fieldset
      :disabled="!restrictionsEnabled"
      :aria-disabled="!restrictionsEnabled"
      :class="
        cn(
          'm-0 flex min-h-0 min-w-0 flex-1 flex-col gap-4 border-0 p-0 transition-opacity',
          !restrictionsEnabled && 'pointer-events-none opacity-60'
        )
      "
      :aria-label="$t('workspacePanel.partnerNodes.controlsLabel')"
    >
      <div class="flex w-full justify-end">
        <SearchInput
          v-model="searchQuery"
          :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
          size="lg"
          class="w-full @2xl:w-64"
        />
      </div>

      <div
        class="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-6"
      >
        <span class="min-w-0 flex-1 text-sm text-muted-foreground">
          {{ $t('workspacePanel.partnerNodes.description') }}
        </span>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            variant="muted-textonly"
            size="lg"
            :disabled="filteredNodes.length === 0"
            @click="setAllFilteredEnabled(true)"
          >
            {{
              $t(
                hasSearch
                  ? 'workspacePanel.partnerNodes.enableResults'
                  : 'workspacePanel.partnerNodes.enableAll'
              )
            }}
          </Button>
          <Button
            variant="muted-textonly"
            size="lg"
            :disabled="filteredNodes.length === 0"
            @click="requestDisableAll"
          >
            {{
              $t(
                hasSearch
                  ? 'workspacePanel.partnerNodes.disableResults'
                  : 'workspacePanel.partnerNodes.disableAll'
              )
            }}
          </Button>
        </div>
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
              <TableHead class="w-24 text-center">
                {{ $t('workspacePanel.partnerNodes.columns.enabled') }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="group in groups" :key="group.partner">
              <TableRow
                class="cursor-pointer hover:bg-transparent [&:hover>td]:bg-secondary-background/50 [&>td]:border-b [&>td]:border-interface-stroke/20 [&>td]:transition-colors"
                @click="togglePartnerCollapsed(group.partner)"
              >
                <TableCell />
                <TableCell>
                  <button
                    type="button"
                    :aria-expanded="group.expanded"
                    :aria-label="
                      $t(
                        group.expanded
                          ? 'workspacePanel.partnerNodes.collapseProvider'
                          : 'workspacePanel.partnerNodes.expandProvider',
                        { partner: group.partner }
                      )
                    "
                    class="flex w-full items-center gap-2 border-none bg-transparent p-0 text-left"
                    @click.stop="togglePartnerCollapsed(group.partner)"
                  >
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
                  </button>
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
                <TableCell @click.stop>
                  <div
                    class="flex h-8 cursor-pointer items-center justify-center"
                    @click="
                      setGroupEnabled(
                        group,
                        group.enabledCount < group.totalCount
                      )
                    "
                  >
                    <Switch
                      :model-value="group.enabledCount === group.totalCount"
                      :aria-label="
                        $t('workspacePanel.partnerNodes.groupToggle', {
                          partner: group.partner
                        })
                      "
                      @click.stop
                      @update:model-value="
                        (value: boolean) => setGroupEnabled(group, value)
                      "
                    />
                  </div>
                </TableCell>
              </TableRow>

              <template v-if="group.expanded">
                <TableRow
                  v-for="node in group.nodes"
                  :key="node.id"
                  :data-state="
                    selectedIds.has(node.id) ? 'selected' : undefined
                  "
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
                            'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'
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
                  <TableCell @click.stop>
                    <div
                      class="flex h-8 cursor-pointer items-center justify-center"
                      @click="setEnabled(node, !node.enabled)"
                    >
                      <Switch
                        :model-value="node.enabled"
                        :aria-label="
                          $t('workspacePanel.partnerNodes.nodeToggle', {
                            name: node.name
                          })
                        "
                        @click.stop
                        @update:model-value="
                          (value: boolean) => setEnabled(node, value)
                        "
                      />
                    </div>
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
    </fieldset>

    <div class="absolute inset-x-0 bottom-0">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <SelectionBar
          v-if="restrictionsEnabled && selectedCount > 0"
          :label="
            $t('workspacePanel.partnerNodes.selectedCount', selectedCount)
          "
          :deselect-label="$t('workspacePanel.partnerNodes.clearSelection')"
          @deselect="clearSelection"
        >
          <Switch
            :model-value="selectedEnabled"
            :aria-label="$t('workspacePanel.partnerNodes.bulkToggle')"
            @update:model-value="applyBulk"
          />
        </SelectionBar>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectionBar from '@/components/common/SelectionBar.vue'
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
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import PartnerBadge from '@/platform/workspace/components/dialogs/settings/PartnerBadge.vue'
import { usePartnerNodes } from '@/platform/workspace/composables/usePartnerNodes'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const { confirm } = useDialogService()
const {
  nodes,
  restrictionsEnabled,
  searchQuery,
  sortField,
  sortDirection,
  selectedIds,
  selectedCount,
  selectedEnabled,
  allFilteredSelected,
  filteredNodes,
  groups,
  fetch,
  toggleSort,
  setEnabled,
  setSelectedEnabled,
  setAllFilteredEnabled,
  setGroupEnabled,
  setRestrictionsEnabled,
  toggleSelection,
  toggleSelectAll,
  togglePartnerCollapsed,
  clearSelection
} = usePartnerNodes()

const hasSelection = computed(() => selectedCount.value > 0)
const hasSearch = computed(() => searchQuery.value.trim().length > 0)

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

function applyBulk(value: boolean) {
  void setSelectedEnabled(value)
}

async function requestRestrictionsChange(mode: unknown) {
  if (mode === 'allowAll' && restrictionsEnabled.value) {
    if (nodes.value.some((node) => !node.enabled)) {
      const confirmed = await confirm({
        title: t(
          'workspacePanel.partnerNodes.restrictions.allowAllConfirm.title'
        ),
        message: t(
          'workspacePanel.partnerNodes.restrictions.allowAllConfirm.message'
        ),
        hint: t('workspacePanel.partnerNodes.restrictions.allowAllConfirm.hint')
      })
      if (!confirmed) return
    }

    await setRestrictionsEnabled(false)
    return
  }
  if (mode !== 'restricted' || restrictionsEnabled.value) return

  const confirmed = await confirm({
    title: t('workspacePanel.partnerNodes.restrictions.confirm.title'),
    message: t('workspacePanel.partnerNodes.restrictions.confirm.message'),
    hint: t('workspacePanel.partnerNodes.restrictions.confirm.hint')
  })
  if (confirmed) await setRestrictionsEnabled(true)
}

async function requestDisableAll() {
  if (hasSearch.value) {
    await setAllFilteredEnabled(false)
    return
  }

  const confirmed = await confirm({
    title: t('workspacePanel.partnerNodes.disableAllConfirm.title'),
    message: t('workspacePanel.partnerNodes.disableAllConfirm.message'),
    hint: t('workspacePanel.partnerNodes.disableAllConfirm.hint')
  })
  if (confirmed) await setAllFilteredEnabled(false)
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
