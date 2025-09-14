<template>
  <CloudTemplate>
    <!-- This will render the nested route components -->
    <RouterView />
  </CloudTemplate>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'

import CloudTemplate from './CloudTemplate.vue'
</script>
