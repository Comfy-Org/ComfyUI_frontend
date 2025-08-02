<template>
  <Card
    class="w-64 template-card rounded-2xl overflow-hidden shadow-elevation-2 dark-theme:bg-dark-elevation-1.5 h-full"
    :pt="{
      body: { class: 'p-0 h-full flex flex-col' }
    }"
  >
    <template #header>
      <div class="flex items-center justify-center">
        <div class="relative overflow-hidden rounded-t-lg">
          <Skeleton width="16rem" height="12rem" />
        </div>
      </div>
    </template>
    <template #content>
      <div class="flex items-center px-4 py-3">
        <div class="flex-1 flex flex-col">
          <Skeleton width="80%" height="1.25rem" class="mb-2" />
          <Skeleton width="100%" height="0.875rem" class="mb-1" />
          <Skeleton width="90%" height="0.875rem" />
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import Skeleton from 'primevue/skeleton'
</script>
