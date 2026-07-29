<template>
  <GettingStartedScreen v-if="gettingStartedVisible" />
</template>

<script setup lang="ts">
import GettingStartedScreen from './gettingStarted/GettingStartedScreen.vue'
import { useFirstRunEntry } from './gettingStarted/firstRunEntry'
import { useFirstRunTourController } from './tour/useFirstRunTourController'

const { gettingStartedVisible } = useFirstRunEntry()

useFirstRunTourController()
</script>
