<template>
  <div class="cloud-invite-entry">
    <h1>{{ inviteCode }}</h1>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const inviteCode = computed(
  () => (route.params.inviteCode as string) || 'No code provided'
)
onMounted(() => {
  void router.push({ path: '/login', query: { inviteCode: inviteCode.value } })
})
</script>

<style scoped>
.cloud-invite-entry {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: monospace;
  gap: 1rem;
}

button {
  padding: 0.5rem 1rem;
  margin: 0.25rem;
  cursor: pointer;
}
</style>
