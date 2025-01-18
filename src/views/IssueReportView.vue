<template>
  <BaseViewTemplate dark> </BaseViewTemplate>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ReportIssuePanel from '@/components/dialog/content/error/ReportIssuePanel.vue'
import { useDialogStore } from '@/stores/dialogStore'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const router = useRouter()
const dialogStore = useDialogStore()

onMounted(() => {
  dialogStore.showDialog({
    key: 'issue-report',
    component: ReportIssuePanel,
    title: 'Report an issue',
    dialogComponentProps: {
      onClose: () => router.push('/')
    },
    props: {
      errorType: 'desktop',
      extraFields: [
        {
          label: 'Desktop Version',
          value: 'desktopVersion',
          data: { desktopVersion: '1.4.2' } // electronAPI().getVersion()
        }
      ]
    }
  })
})
</script>
