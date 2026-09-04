# Billing command eligibility

| Current status  | Command behavior                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `FREE`          | Subscribe creates a subscription checkout. Cancel may return `NO_ACTIVE_SUBSCRIPTION`.                               |
| `PRO`, active   | Subscribe is a no-op; the payment portal remains available. Resubscribe may return `NOT_SCHEDULED_FOR_CANCELLATION`. |
| `PRO`, canceled | Subscribe uses the resubscribe endpoint.                                                                             |
