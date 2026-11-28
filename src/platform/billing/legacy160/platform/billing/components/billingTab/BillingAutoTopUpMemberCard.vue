<template>
  <div
    class="flex flex-col gap-1 rounded-xl border border-card px-5 py-4"
    data-testid="billing-auto-top-up-member-card"
  >
    <h3 class="m-0 text-sm font-medium text-foreground">
      {{ $t('workspacePanel.billingTab.autoTopUp.title') }}
    </h3>
    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.billingTab.autoTopUp.member') }}
    </p>
  </div>
</template>
