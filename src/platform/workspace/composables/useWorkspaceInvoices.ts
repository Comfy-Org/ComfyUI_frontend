import { computed } from 'vue'

// TODO(billing-history endpoint): the workspace billing API does not expose
// the upcoming invoice amount yet; the Invoices banner stays hidden until it
// does. Invoice history itself lives in the Stripe portal by design.
export function useWorkspaceInvoices() {
  const nextInvoiceCents = computed<number | null>(() => null)
  return { nextInvoiceCents }
}
