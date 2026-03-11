<template>
  <TabsRoot v-model="modelValue">
    <TabsList as-child>
      <div role="tablist" class="flex w-full items-center gap-2">
        <slot />
      </div>
    </TabsList>
  </TabsRoot>
</template>

<script setup lang="ts" generic="T extends string = string">
import { TabsList, TabsRoot } from 'reka-ui'

const modelValue = defineModel<T>({ required: true })
</script>
