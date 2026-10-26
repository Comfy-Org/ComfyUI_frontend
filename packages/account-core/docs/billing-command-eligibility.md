# Billing command eligibility

No subscription command reads the subscription's state to decide whether it
may run. Pricing a change, reactivating a scheduled cancel, rejecting a
duplicate and demanding a confirmation are all server decisions, and a client
that second-guesses them denies transitions the server would have allowed.

## Routes

| Command       | Route                     |
| ------------- | ------------------------- |
| `subscribe`   | `POST /billing/subscribe` |
| `resubscribe` | `POST .../resubscribe`    |
| `cancel`      | `POST .../cancel`         |

The status read decides nothing for `subscribe`: whatever state the
subscription is in, the request goes to the subscribe route carrying the
`plan_slug` that was asked for, and the server prices the change, reactivates a
scheduled cancel, or refuses. Routing a scheduled cancel to `resubscribe()`
would drop that plan and resume the old one instead; `resubscribe` stays the
explicit "resume subscription" action, which carries no plan of its own.

## Already-held answers

A command whose requested state already holds is a success, not a failure: the
caller's intent is satisfied and the request changed nothing. `mapServerCode`
recognises one such code per command, and only from a 4xx — a 5xx that happens
to echo the code is an upstream failure, and the requested state cannot be
assumed to hold.

| Command       | Already-held server code         |
| ------------- | -------------------------------- |
| `resubscribe` | `NOT_SCHEDULED_FOR_CANCELLATION` |
| `cancel`      | `ALREADY_CANCELED`               |
| `subscribe`   | none documented on the route     |

The subscribe route documents no already-held code, so `subscribe` never
settles without an operation. A repeat subscribe against a live subscription
surfaces whatever the server answers, exactly as the host's own
`POST /billing/subscribe` call does.

## Codes the command maps itself

- `REACTIVATION_CONFIRMATION_REQUIRED` — the server wants the host to
  re-preview and resend with `confirm_reactivation`. It exists for exactly the
  subscribe-on-a-scheduled-cancel case.
- `NO_ACTIVE_SUBSCRIPTION` — resubscribe or cancel with nothing to act on.

Every other server code reaches the caller as the transport's coded failure,
with `serverCode` intact.
