<template>
  <GettingStartedScreen v-if="gettingStartedVisible" />
</template>

<script setup lang="ts">
import GettingStartedScreen from './gettingStarted/GettingStartedScreen.vue'
import { useFirstRunEntry } from './gettingStarted/firstRunEntry'

const { gettingStartedVisible } = useFirstRunEntry()
</script>
