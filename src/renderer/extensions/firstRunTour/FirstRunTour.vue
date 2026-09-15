<template>
  <GettingStartedScreen v-if="gettingStartedVisible" />
  <FirstRunTourNudge />
</template>

<script setup lang="ts">
import { useFirstRunEntry } from './gettingStarted/firstRunEntry'
import GettingStartedScreen from './gettingStarted/GettingStartedScreen.vue'
import FirstRunTourNudge from './nudge/FirstRunTourNudge.vue'
import { useFirstRunTourController } from './tour/useFirstRunTourController'

const { gettingStartedVisible } = useFirstRunEntry()

useFirstRunTourController()
</script>
