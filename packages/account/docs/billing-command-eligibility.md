# Billing command eligibility

`createBillingCommands` reads `GET /billing/status` before it issues a
subscription command, and uses it to pick a route. It never uses it to refuse
one: pricing a change, rejecting a duplicate and confirming a reactivation are
all server decisions, and a client that second-guesses them denies transitions
the server would have allowed.

`eligibilityOf` collapses the status into three cases:

| Eligibility | Status fields                                              |
| ----------- | ---------------------------------------------------------- |
| `free`      | `is_active` false, or `subscription_tier` absent or `FREE` |
| `canceled`  | paid, and `subscription_status === 'canceled'`             |
| `active`    | paid, and any other `subscription_status`                  |

## Routes

| Command       | `free`                    | `active`                  | `canceled`             |
| ------------- | ------------------------- | ------------------------- | ---------------------- |
| `subscribe`   | `POST /billing/subscribe` | `POST /billing/subscribe` | `resubscribe()`        |
| `resubscribe` | `POST .../resubscribe`    | `POST .../resubscribe`    | `POST .../resubscribe` |
| `cancel`      | `POST .../cancel`         | `POST .../cancel`         | `POST .../cancel`      |

`subscribe` on `active` is a plan change: an upgrade, a downgrade, or a
duration change, priced and prorated by the server. `subscribe` on `canceled`
is a reactivation, which the backend exposes as its own route rather than as a
subscribe.

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

The subscribe route documents no already-held code, so `subscribe` reaches one
only through the `canceled` route's `resubscribe()`. A repeat subscribe against
a live subscription surfaces whatever the server answers, exactly as the host's
own `POST /billing/subscribe` call does.

## Codes the command maps itself

- `REACTIVATION_CONFIRMATION_REQUIRED` — the server wants the host to
  re-preview and resend with `confirm_reactivation`.
- `NO_ACTIVE_SUBSCRIPTION` — resubscribe or cancel with nothing to act on.

Every other server code reaches the caller as the transport's coded failure,
with `serverCode` intact.
