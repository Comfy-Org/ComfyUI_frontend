<script setup lang="ts">
import { popoverCloseSpy } from './popoverMockState'
</script>

<template>
  <div>
    <slot name="button" />
    <slot :close="popoverCloseSpy" />
  </div>
</template>
