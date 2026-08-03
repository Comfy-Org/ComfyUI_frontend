# Toasts / Notifications

Two entry points to the same toast system — pick based on where you're calling from.

## From inside a Vue component

```ts
import { useToast } from 'primevue/usetoast'

const toast = useToast()
toast.add({
  severity: 'error',
  summary: t('errors.saveFailedSummary'),
  detail: t('errors.saveFailedDetail')
})
```

`severity`: `success | info | warn | error` (PrimeVue `ToastMessageOptions`).

## From outside component context (a store, a composable, a service)

```ts
import { useToastStore } from '@/platform/updates/common/toastStore'

const toastStore = useToastStore()
toastStore.add({
  severity: 'warn',
  summary: t('serverConfig.restartRequiredToastSummary'),
  detail: t('serverConfig.restartRequiredToastDetail'),
  life: 10_000
})
```

Same `ToastMessageOptions` shape; the store exists purely because `useToast()` requires a component context.

## Do

- Use a toast (not inline dialog/page text) for the result of a background or destructive action — e.g. "delete failed", "settings saved".
- Use `useToast()` directly whenever you're already inside `<script setup>`; reach for `useToastStore()` only from non-component code.

## Don't

- Don't build a second toast mechanism — everything routes through PrimeVue's toast service either way.
