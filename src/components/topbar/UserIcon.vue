<template>
  <Button icon="pi pi-user" @click="(e) => popover?.toggle(e)" />
  <Popover ref="popover"> Hello </Popover>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { ref } from 'vue'

const popover = ref<InstanceType<typeof Popover> | null>(null)
</script>
