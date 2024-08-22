<template>
  <Button
    @click="openGitHubIssues"
    :label="buttonLabel"
    severity="secondary"
    icon="pi pi-github"
  >
    <template #badge>
      <Badge :value="issueCount.toString()" severity="danger" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncState } from '@vueuse/core'
import axios from 'axios'
import Button from 'primevue/button'
import Badge from 'primevue/badge'

const props = defineProps<{
  errorMessage: string
  repoOwner: string
  repoName: string
}>()

const GITHUB_API_URL = 'https://api.github.com/search/issues'

const getIssueCount = async () => {
  const query = `${props.errorMessage} is:issue repo:${props.repoOwner}/${props.repoName}`
  const response = await axios.get(GITHUB_API_URL, {
    params: {
      q: query,
      per_page: 1
    }
  })
  return response.data.total_count
}

const {
  state: issueCount,
  isLoading,
  execute
} = useAsyncState(getIssueCount, 0)

const buttonLabel = computed(() => {
  if (isLoading.value) return 'Loading...'
  return `Find Issues (${issueCount.value})`
})

const openGitHubIssues = () => {
  const query = encodeURIComponent(props.errorMessage)
  const url = `https://github.com/${props.repoOwner}/${props.repoName}/issues?q=${query}`
  window.open(url, '_blank')
}
</script>
