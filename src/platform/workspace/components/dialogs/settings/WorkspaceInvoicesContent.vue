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
            <TableHead>
              <button :class="sortHeaderClass" @click="toggleSort('date')">
                {{ $t('workspacePanel.invoices.columns.date') }}
                <i :class="sortIcon('date')" />
              </button>
            </TableHead>
            <TableHead>
              <button :class="sortHeaderClass" @click="toggleSort('eventType')">
                {{ $t('workspacePanel.invoices.columns.eventType') }}
                <i :class="sortIcon('eventType')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
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
            class="hover:bg-transparent"
          >
            <TableCell class="text-sm text-muted-foreground">
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

    <div class="flex h-8 items-center justify-between">
      <button
        class="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-sm text-muted-foreground transition-colors hover:text-base-foreground"
        @click="openHistory"
      >
        <i class="icon-[lucide--external-link] size-4" />
        {{ $t('workspacePanel.invoices.fullHistory') }}
      </button>
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
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceInvoices } from '@/platform/workspace/composables/useWorkspaceInvoices'
import type { InvoiceSortField } from '@/platform/workspace/composables/useWorkspaceInvoices'
import { cn } from '@comfyorg/tailwind-utils'

const { search } = defineProps<{ search: string }>()

const { d } = useI18n()
const { manageSubscription } = useBillingContext()

const {
  page,
  total,
  itemsPerPage,
  pagedItems,
  sortField,
  sortDirection,
  toggleSort
} = useWorkspaceInvoices(() => search)

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: InvoiceSortField) {
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

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  })
}

function openHistory() {
  void manageSubscription()
}
</script>
