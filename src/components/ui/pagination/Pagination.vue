<template>
  <PaginationRoot
    v-model:page="page"
    :total="total"
    :items-per-page="itemsPerPage"
    :sibling-count="1"
    show-edges
  >
    <div class="flex flex-wrap items-center justify-center gap-2">
      <div
        v-if="itemsPerPageOptions?.length"
        class="mr-2 flex items-center gap-2"
      >
        <span class="text-sm text-muted-foreground">
          {{ $t('g.itemsPerPage') }}
        </span>
        <Select
          :model-value="itemsPerPage"
          @update:model-value="updateItemsPerPage"
        >
          <SelectTrigger
            size="md"
            class="w-20"
            :aria-label="$t('g.itemsPerPage')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in itemsPerPageOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PaginationFirst v-if="withEdgeButtons" as-child>
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('g.firstPage')"
        >
          <i class="icon-[lucide--chevrons-left] size-4" />
        </Button>
      </PaginationFirst>
      <PaginationPrev as-child>
        <Button
          variant="muted-textonly"
          size="md"
          class="text-sm"
          :aria-label="$t('g.previous')"
        >
          <i class="icon-[lucide--chevron-left] size-4" />
          {{ $t('g.previous') }}
        </Button>
      </PaginationPrev>
      <PaginationList v-slot="{ items }" class="flex items-center gap-1">
        <template v-for="(item, index) in items" :key="index">
          <PaginationListItem
            v-if="item.type === 'page'"
            :value="item.value"
            as-child
          >
            <Button
              :variant="item.value === page ? 'secondary' : 'muted-textonly'"
              size="icon"
              :aria-label="$t('g.pageNumber', { page: item.value })"
            >
              {{ item.value }}
            </Button>
          </PaginationListItem>
          <PaginationEllipsis v-else :index="index" :class="ellipsisClass">
            …
          </PaginationEllipsis>
        </template>
      </PaginationList>
      <PaginationNext as-child>
        <Button
          variant="muted-textonly"
          size="md"
          class="text-sm"
          :aria-label="$t('g.next')"
        >
          {{ $t('g.next') }}
          <i class="icon-[lucide--chevron-right] size-4" />
        </Button>
      </PaginationNext>
      <PaginationLast v-if="withEdgeButtons" as-child>
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('g.lastPage')"
        >
          <i class="icon-[lucide--chevrons-right] size-4" />
        </Button>
      </PaginationLast>
    </div>
  </PaginationRoot>
</template>

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import {
  PaginationEllipsis,
  PaginationFirst,
  PaginationLast,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot
} from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

const {
  total,
  itemsPerPageOptions,
  withEdgeButtons = false
} = defineProps<{
  total: number
  itemsPerPageOptions?: number[]
  withEdgeButtons?: boolean
}>()

const page = defineModel<number>('page', { default: 1 })
const itemsPerPage = defineModel<number>('itemsPerPage', { default: 10 })

function updateItemsPerPage(value: AcceptableValue) {
  if (typeof value === 'number') itemsPerPage.value = value
}

const ellipsisClass =
  'inline-flex size-8 items-center justify-center text-sm text-muted-foreground'
</script>
