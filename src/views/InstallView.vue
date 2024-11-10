<template>
  <div
    class="font-sans flex flex-col justify-center items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <WelcomeScreen v-if="isWelcomeScreen" @start="isWelcomeScreen = false" />
    <InstallStepsScreen v-else />
  </div>
</template>

<script setup lang="ts">
import WelcomeScreen from '@/components/install/WelcomeScreen.vue'
import InstallStepsScreen from '@/components/install/InstallStepsScreen.vue'
import { ref } from 'vue'

const isWelcomeScreen = ref(true)
</script>
