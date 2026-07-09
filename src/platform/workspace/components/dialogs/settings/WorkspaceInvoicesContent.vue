<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <!-- When paused there's no upcoming invoice; the parent's "Subscription
         paused" banner covers that state (and hosts the "Full invoice history"
         action there), so we drop this one to avoid stacking two banners. -->
    <div
      v-if="!isPaused"
      class="flex items-center justify-between gap-4 rounded-2xl border border-interface-stroke/60 p-4"
    >
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.overview.nextInvoice') }}
        </span>
        <p class="m-0 text-2xl font-semibold text-base-foreground">
          {{ formatWholeUsd(nextInvoiceCents) }}
          <span class="text-base font-normal text-base-foreground">
            {{ $t('workspacePanel.overview.usd') }}
          </span>
        </p>
      </div>
      <Button variant="secondary" size="lg" @click="openHistory">
        {{ $t('workspacePanel.invoices.fullHistory') }}
        <i class="icon-[lucide--external-link] size-4" />
      </Button>
    </div>

    <div
      ref="tableContainer"
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table class="min-h-0 flex-1 px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead class="w-40" :aria-sort="ariaSort('date')">
              <button :class="sortHeaderClass" @click="toggleSort('date')">
                {{ $t('workspacePanel.invoices.columns.date') }}
                <i :class="sortIcon('date')" />
              </button>
            </TableHead>
            <TableHead :aria-sort="ariaSort('eventType')">
              <button :class="sortHeaderClass" @click="toggleSort('eventType')">
                {{ $t('workspacePanel.invoices.columns.eventType') }}
                <i :class="sortIcon('eventType')" />
              </button>
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('price')">
              <button
                :class="cn(sortHeaderClass, 'ml-auto')"
                @click="toggleSort('price')"
              >
                {{ $t('workspacePanel.invoices.columns.price') }}
                <i :class="sortIcon('price')" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="invoice in pagedItems"
            :key="invoice.id"
            class="hover:bg-transparent [&>td]:border-b [&>td]:border-interface-stroke/20"
          >
            <TableCell class="text-sm text-muted-foreground tabular-nums">
              {{ formatDate(invoice.date) }}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ invoice.eventType }}
            </TableCell>
            <TableCell
              class="text-right text-sm text-muted-foreground tabular-nums"
            >
              {{ formatPrice(invoice.amountCents) }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex h-8 items-center justify-end">
      <Pagination
        v-model:page="page"
        :total="total"
        :items-per-page="itemsPerPage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAutoPageSize } from '@/platform/workspace/composables/useAutoPageSize'
import { useWorkspaceInvoices } from '@/platform/workspace/composables/useWorkspaceInvoices'
import type { InvoiceSortField } from '@/platform/workspace/composables/useWorkspaceInvoices'
import { cn } from '@comfyorg/tailwind-utils'

const { search } = defineProps<{ search: string }>()

const { d, n } = useI18n()
const { isPaused, manageSubscription } = useBillingContext()

const tableContainer = ref<HTMLElement | null>(null)
const { pageSize } = useAutoPageSize(tableContainer, 1)

const {
  page,
  total,
  itemsPerPage,
  pagedItems,
  sortField,
  sortDirection,
  toggleSort,
  nextInvoiceCents
} = useWorkspaceInvoices(() => search, pageSize)

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: InvoiceSortField) {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function ariaSort(
  field: InvoiceSortField
): 'ascending' | 'descending' | 'none' {
  if (sortField.value !== field) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
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

function formatPrice(cents: number): string {
  return n(cents / 100, { style: 'currency', currency: 'USD' })
}

function formatWholeUsd(cents: number): string {
  return n(cents / 100, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

function openHistory() {
  void manageSubscription()
}
</script>
