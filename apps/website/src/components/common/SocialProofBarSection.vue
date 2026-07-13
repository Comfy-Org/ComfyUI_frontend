<script setup lang="ts">
import { clientLogos } from '../../data/clientLogos'
import LogosAll01 from '../blocks/LogosAll01.vue'
</script>

<template>
  <LogosAll01 :logos="clientLogos" test-id="social-proof" />
</template>
