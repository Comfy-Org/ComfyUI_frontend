<template>
  <GettingStartedScreen v-if="gettingStartedVisible" />
  <FirstRunTourNudge />
</template>

<script setup lang="ts">
import GettingStartedScreen from './gettingStarted/GettingStartedScreen.vue'
import { useFirstRunEntry } from './gettingStarted/firstRunEntry'
import FirstRunTourNudge from './nudge/FirstRunTourNudge.vue'
import { useFirstRunTourController } from './tour/useFirstRunTourController'

const { gettingStartedVisible } = useFirstRunEntry()

useFirstRunTourController()
</script>
