<template>
  <div
    class="flex flex-col justify-center items-center h-screen font-mono gap-4"
  >
    <h1 class="text-2xl">{{ inviteCode }}</h1>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const inviteCode = computed(
  (): string => (route.params.inviteCode as string) || 'No code provided'
)
onMounted(() => {
  void router.push({ path: '/login', query: { inviteCode: inviteCode.value } })
})
</script>
