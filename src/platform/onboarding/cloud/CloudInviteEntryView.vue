<template>
  <BaseViewTemplate dark />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const inviteCode = route.params.code
  await router.push({
    name: 'cloud-login',
    query: {
      inviteCode
    }
  })
})
</script>
