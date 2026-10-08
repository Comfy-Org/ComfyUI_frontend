<template>
  <FirstRunTourNudge />
</template>

<script setup lang="ts">
import FirstRunTourNudge from './nudge/FirstRunTourNudge.vue'
import { useFirstRunTourController } from './tour/useFirstRunTourController'

useFirstRunTourController()
</script>
