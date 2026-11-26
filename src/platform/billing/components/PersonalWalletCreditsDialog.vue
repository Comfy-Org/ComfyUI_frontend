<template>
  <AppDialogPanel
    size="compact"
    data-testid="personal-wallet-credits-message"
    @close="onClose"
  >
    <template #title>
      {{ $t('credits.personalWallet.title') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{
        credential === 'api_key'
          ? $t('credits.personalWallet.apiKeyDescription')
          : teamWorkspaces.length > 0
            ? $t('credits.personalWallet.sessionDescription')
            : $t('credits.personalWallet.sessionNoTeamsDescription')
      }}
    </p>

    <ul
      v-if="credential === 'session' && teamWorkspaces.length > 0"
      class="m-0 mt-4 flex list-none flex-col gap-2 p-0"
    >
      <li v-for="workspace in teamWorkspaces" :key="workspace.id">
        <Button
          variant="secondary"
          size="lg"
          class="w-full"
          @click="onSwitchWorkspace(workspace.id)"
        >
          {{
            $t('credits.personalWallet.switchTo', {
              workspaceName: workspace.name
            })
          }}
        </Button>
      </li>
    </ul>

    <template #footer>
      <Button
        v-if="credential === 'api_key'"
        as="a"
        :href="teamApiKeysUrl"
        target="_blank"
        rel="noopener"
        variant="secondary"
        size="lg"
        class="no-underline"
      >
        {{ $t('credits.personalWallet.createTeamApiKey') }}
        <i class="icon-[lucide--external-link]" />
      </Button>
      <Button
        v-if="credential === 'api_key' || teamWorkspaces.length === 0"
        variant="primary"
        size="lg"
        @click="onAddCredits"
      >
        {{ $t('credits.personalWallet.addCredits') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import Button from '@comfyorg/design-system/button/Button'
import type { PersonalWalletCredential } from '@/platform/workflowErrors/errorCatalog/runtimeErrorMatcher'

defineProps<{
  credential: PersonalWalletCredential
  teamWorkspaces: readonly { id: string; name: string }[]
  teamApiKeysUrl: string
  onSwitchWorkspace: (workspaceId: string) => void
  onAddCredits: () => void
  onClose: () => void
}>()
</script>
