<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div
      class="min-h-0 flex-1 overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table class="px-4">
        <TableHeader>
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead class="w-40">
              <button :class="sortHeaderClass" @click="toggleSort('date')">
                {{ $t('workspacePanel.activity.columns.date') }}
                <i :class="sortIcon('date')" />
              </button>
            </TableHead>
            <TableHead>
              <button :class="sortHeaderClass" @click="toggleSort('user')">
                {{ $t('workspacePanel.activity.columns.user') }}
                <i :class="sortIcon('user')" />
              </button>
            </TableHead>
            <TableHead class="w-48">
              <button :class="sortHeaderClass" @click="toggleSort('eventType')">
                {{ $t('workspacePanel.activity.columns.eventType') }}
                <i :class="sortIcon('eventType')" />
              </button>
            </TableHead>
            <TableHead class="w-32">
              <button :class="sortHeaderClass" @click="toggleSort('detail')">
                {{ $t('workspacePanel.activity.columns.eventDetails') }}
                <i :class="sortIcon('detail')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              <button
                :class="cn(sortHeaderClass, 'ml-auto')"
                @click="toggleSort('credits')"
              >
                <i class="icon-[lucide--coins] size-4" />
                {{ $t('workspacePanel.activity.columns.creditsUsed') }}
                <i :class="sortIcon('credits')" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="event in pagedItems"
            :key="event.id"
            class="hover:bg-transparent"
          >
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(event.date) }}
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-3">
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary-background"
                >
                  <span class="text-xs font-bold text-base-foreground">
                    {{ event.userName.charAt(0).toUpperCase() }}
                  </span>
                </span>
                <span class="truncate text-sm text-base-foreground">
                  {{ event.userName }}
                </span>
              </div>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ event.eventType }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground tabular-nums">
              {{ event.detail }}
            </TableCell>
            <TableCell
              class="text-right text-sm text-muted-foreground tabular-nums"
            >
              {{ event.credits.toLocaleString() }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex h-8 items-center justify-between">
      <p class="text-sm text-muted-foreground">
        {{ $t('workspacePanel.activity.perUserHint') }}
      </p>
      <Pagination
        v-model:page="page"
        :total="total"
        :items-per-page="itemsPerPage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Pagination from '@/components/ui/pagination/Pagination.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useWorkspaceActivity } from '@/platform/workspace/composables/useWorkspaceActivity'
import type { ActivitySortField } from '@/platform/workspace/composables/useWorkspaceActivity'
import { cn } from '@comfyorg/tailwind-utils'

const { search } = defineProps<{ search: string }>()

const { d } = useI18n()

const {
  page,
  total,
  itemsPerPage,
  pagedItems,
  sortField,
  sortDirection,
  toggleSort
} = useWorkspaceActivity(() => search)

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: ActivitySortField) {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function formatDate(date: Date): string {
  return d(date, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}
</script>
