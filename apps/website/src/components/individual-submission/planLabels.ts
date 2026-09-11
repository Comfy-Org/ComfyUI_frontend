/**
 * Plan names are product names, identical in every language, so they are slots
 * the page fills rather than words the sentence has to carry. That leaves the
 * translated sentence free to put them wherever its own grammar wants.
 *
 * Exported rather than kept in the page because two things need the same value:
 * the page that fills the slots, and the test asserting the English copy names
 * only plans that exist. That test used to keep its own copy of the list, so
 * renaming a label here would leave it passing while the page rendered an empty
 * `<strong>` where the plan name belonged.
 */
export const PLAN_LABELS: Readonly<Record<string, string>> = {
  standard: 'Standard',
  creator: 'Creator',
  pro: 'Pro',
  teams: 'Teams'
}
