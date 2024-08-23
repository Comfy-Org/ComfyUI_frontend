<template>
  <Button
    @click="openGitHubIssues"
    :label="buttonLabel"
    severity="secondary"
    icon="pi pi-github"
    :badge="issueCount.toString()"
  >
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncState } from '@vueuse/core'
import axios from 'axios'
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  errorMessage: string
  repoOwner: string
  repoName: string
}>()

const GITHUB_API_URL = 'https://api.github.com/search/issues'

const queryString = computed(() => props.errorMessage + ' is:issue')
const getIssueCount = async () => {
  const query = `${queryString.value} repo:${props.repoOwner}/${props.repoName}`
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

const { t } = useI18n()
const buttonLabel = computed(() => {
  return isLoading.value ? 'Loading...' : t('findIssues')
})

const openGitHubIssues = () => {
  const query = encodeURIComponent(queryString.value)
  const url = `https://github.com/${props.repoOwner}/${props.repoName}/issues?q=${query}`
  window.open(url, '_blank')
}
</script>
