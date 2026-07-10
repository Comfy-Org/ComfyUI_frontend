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

import Button from '@/components/ui/button/Button.vue'

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

const ellipsisClass =
  'inline-flex size-8 items-center justify-center text-sm text-muted-foreground'
</script>
