<template>
  <PaginationRoot
    :page="page"
    :total="total"
    :items-per-page="itemsPerPage"
    :sibling-count="1"
    show-edges
    @update:page="(p: number) => emit('update:page', p)"
  >
    <div class="flex items-center gap-1">
      <PaginationPrev :class="navClass">
        <i class="icon-[lucide--chevron-left] size-4" />
        {{ $t('g.previous') }}
      </PaginationPrev>
      <PaginationList v-slot="{ items }" class="flex items-center gap-1">
        <template v-for="(item, index) in items" :key="index">
          <PaginationListItem
            v-if="item.type === 'page'"
            :value="item.value"
            :class="pageClass"
          >
            {{ item.value }}
          </PaginationListItem>
          <PaginationEllipsis v-else :index="index" :class="ellipsisClass">
            …
          </PaginationEllipsis>
        </template>
      </PaginationList>
      <PaginationNext :class="navClass">
        {{ $t('g.next') }}
        <i class="icon-[lucide--chevron-right] size-4" />
      </PaginationNext>
    </div>
  </PaginationRoot>
</template>

<script setup lang="ts">
import {
  PaginationEllipsis,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot
} from 'reka-ui'

const {
  page = 1,
  total,
  itemsPerPage = 10
} = defineProps<{
  page?: number
  total: number
  itemsPerPage?: number
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const navClass =
  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border-none bg-transparent px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground disabled:pointer-events-none disabled:opacity-40'

const pageClass =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover data-[selected]:bg-secondary-background data-[selected]:text-base-foreground'

const ellipsisClass =
  'inline-flex size-7 items-center justify-center text-sm text-muted-foreground'
</script>
