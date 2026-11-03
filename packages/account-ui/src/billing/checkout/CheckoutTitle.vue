<script setup lang="ts">
import { injectDialogRootContext } from 'reka-ui'

const dialogRoot = injectDialogRootContext(null)
</script>

<template>
  <h2 :id="dialogRoot?.titleId">
    <slot />
  </h2>
</template>
