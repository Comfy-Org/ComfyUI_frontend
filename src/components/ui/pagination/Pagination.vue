<template>
  <PaginationRoot
    :page="page"
    :total="total"
    :items-per-page="itemsPerPage"
    :sibling-count="1"
    show-edges
    @update:page="(p: number) => emit('update:page', p)"
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
      <PaginationFirst as-child>
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('g.firstPage')"
        >
          <i class="icon-[lucide--chevrons-left] size-4" />
        </Button>
      </PaginationFirst>
      <PaginationPrev as-child>
        <Button variant="muted-textonly" size="md" class="text-sm">
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
        <Button variant="muted-textonly" size="md" class="text-sm">
          {{ $t('g.next') }}
          <i class="icon-[lucide--chevron-right] size-4" />
        </Button>
      </PaginationNext>
      <PaginationLast as-child>
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
  page = 1,
  total,
  itemsPerPage = 10,
  itemsPerPageOptions
} = defineProps<{
  page?: number
  total: number
  itemsPerPage?: number
  itemsPerPageOptions?: number[]
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:itemsPerPage': [itemsPerPage: number]
}>()

function updateItemsPerPage(value: AcceptableValue) {
  if (typeof value === 'number') emit('update:itemsPerPage', value)
}

const ellipsisClass =
  'inline-flex size-8 items-center justify-center text-sm text-muted-foreground'
</script>
