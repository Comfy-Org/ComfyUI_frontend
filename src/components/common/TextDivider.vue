<template>
  <div class="flex items-center" :class="props.class">
    <span v-if="position === 'left'" class="mr-2 shrink-0">{{ text }}</span>
    <Divider :align="align" :type="type" :layout="layout" class="flex-grow" />
    <span v-if="position === 'right'" class="ml-2 shrink-0">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'

interface Props {
  text: string
  class?: string
  position?: 'left' | 'right'
  align?: 'left' | 'center' | 'right' | 'top' | 'bottom'
  type?: 'solid' | 'dashed' | 'dotted'
  layout?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<Props>(), {
  position: 'left',
  align: 'center',
  type: 'solid',
  layout: 'horizontal'
})
</script>
