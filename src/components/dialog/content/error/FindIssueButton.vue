<template>
  <Button
    :label="$t('g.findIssues')"
    severity="secondary"
    icon="pi pi-github"
    @click="openGitHubIssues"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

const props = defineProps<{
  errorMessage: string
  repoOwner: string
  repoName: string
}>()

const queryString = computed(() => props.errorMessage + ' is:issue')

const openGitHubIssues = () => {
  const query = encodeURIComponent(queryString.value)
  const url = `https://github.com/${props.repoOwner}/${props.repoName}/issues?q=${query}`
  window.open(url, '_blank')
}
</script>
