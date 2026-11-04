# ADR-API-SERVER-FACTS-0042: Server Facts Are Rendered, Not Derived

Date: 2026-10-09

## Status

Accepted

## Context

The frontend keeps recombining facts the backend owns into decisions of its
own. The latest case shipped two billing P0s (BE-19903 Invite member,
BE-19904 Manage seats) through three PRs that agents wrote and agents
approved:

- #15675 gated member management on `isCloud ? can_change_seats : role`.
  `can_change_seats` answers "may this workspace change its seat quantity",
  so Enterprise owners lost member management.
- #18662 OR'd `isPlanEnded && canManageSubscription` onto `can_invite_members`.
- #19455 added tier and plan-status checks so that gate survived the backend
  collapsing `max_seats` to 1.

This is not specific to billing. Since April, about 20 fixes moved a
decision back to the server after the client had derived it, including:

- workspace creation (`can_create_workspace`)
- agent gating (server `/features`)
- the free-run offer (`free_tier_offer`)
- asset counts
- release notes keyed by the wrong version
- queue caps

Each derivation is a second copy of backend policy. It drifts silently,
because a wrongly hidden or disabled control emits nothing.

A rule written as prose did not stop it. A reviewer-side "never approve a
frontend-derived server fact" rule was in place before #18662 and #19455,
and both were approved. This guidance also pointed the other way:
`docs/guidance/state-and-effects.md` said "derive everything derivable", and
its first example was a `can*` flag.

## Decision

A **server fact** is anything the backend knows about an account, workspace,
subscription or resource that would stay true with no UI:

- permissions and capabilities
- role, tier, plan status and seats
- readiness and versions
- server timestamps and error codes

1. **The server fact alone decides entitlement.** A gate renders one server
   fact as received. It does not combine that fact with another server fact
   or a value derived from one (role, tier, plan state, seats, `isCloud`)
   through `&&`, `||`, `??`, a ternary, arithmetic, a comparison between
   them, or a helper. Local, transient UI state (loading, an in-flight
   request, form validity) may delay or disable the control, as in
   `canTopUp && !isLoading`. It never grants entitlement or stands in for a
   server field.
2. **"As received" means as the API documents it.** Comparing one field
   with a value its API documentation defines as the answer to this
   question is rendering, not deriving: `deployment.status === 'ready'` for
   "will this deployment take a job", where the spec says a job is taken
   only while the deployment is ready. The comparison lives in the fact
   provider, which mints its result with `receiveServerFact` for that
   field; the gate reads the minted fact. Using a field the API does not
   document as the answer to this question is a proxy, and a proxy is
   derivation even with no operator around it: `role === 'owner'` for "may
   set the default deployment", or `can_change_seats` for member
   management. A field with no such documentation is a proxy too. A field
   typed as an open `string` that is compared with a documented literal
   should get an enum in the spec; that is a request to the backend, not a
   reason to block the frontend change.
3. **Narrowing an action the server permits follows rule 2 for the
   narrower question.** Hiding or disabling an action the server would
   accept needs a field the API documents as the answer to that narrower
   question, and that documentation exists before the change merges. When
   the spec contradicts the narrowing (for example, "any status may be
   picked" while the UI would offer only ready deployments), the spec
   changes first and the frontend change waits for it. A narrowing without
   that documentation is a proxy.
4. **`isCloud` decides which build ships, not what a user may do.** Off
   Cloud, a local provider answers the same fact.
5. **A failed read uses the default its contract names.** Never fall back to
   a role or a tier.
6. **A fact the API does not emit yet is a backend ticket.** Until the ticket
   lands, wrap the interim expression in `pendingServerFact('<ticket>', expr)`.
   Never substitute another field. `can_change_seats` is not member
   management.
7. **Choosing which server field answers a UI question needs review from
   the backend team that owns the field.** Documentation that names this UI
   question itself, such as an enum value described with that meaning, is
   the review. Reading a documentation sentence as the answer to a
   different question still needs the owning team: `can_change_seats`
   documents seat quantity, not member management.

Presentation stays on the client: formatting, translation, sorting, layout,
and local UI state such as loading, open panels and form validation.

### Classifying a gate

The deciding question is: does the API document this field as the answer to
this question?

| Gate                                                                  | Kind                    | Outcome                                                      |
| --------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `can_invite_members`                                                  | Fact as received        | Allowed                                                      |
| `deployment.status === 'ready'`, spec: a job is taken only when ready | Documented value        | Allowed in the provider; ask for an enum if `status` is open |
| `role === 'owner'` for "may set the default deployment"               | Proxy                   | Backend ticket and `pendingServerFact`                       |
| `isPlanEnded && canManageSubscription` OR'd onto `can_invite_members` | Combination             | Blocked                                                      |
| `isCloud ? can_change_seats : role`                                   | Proxy and combination   | Blocked                                                      |
| `canTopUp && !isLoading`                                              | Fact and local UI state | Allowed                                                      |

The author of a gate cites the API documentation that makes its field the
answer. A reviewer may block on a missing citation, on a citation that
answers a different question, or on a rule 1 combination, naming the rule
it breaks.

### Enforcement

The rule is enforced by checks that fail, not by prose. Tracked under
FE-3349 (TDD "Server-fact guardrails"):

- In place: the oxlint rules `comfy/no-server-fact-literals` and
  `comfy/no-capability-recombination`, run on changed lines by
  `pnpm lint:server-facts` in the required lint check and in lint-staged.
  They are the authoritative block (FE-3351).
- In place: the agent write and approve hooks in `.claude/settings.json`,
  an advisory first line that fails open (FE-3352, FE-3353).
- In place: `pendingServerFact` and its expiry check,
  `ci-pending-server-facts.yaml` (FE-3354).
- In place, adopted surface by surface: the `ServerFact<Field>` type,
  branded with the API field that answered it. A gate slot typed as a fact
  rejects `||`, `&&`, `!` and ternaries that mix in other state at compile
  time. The members panel and workspace gates use it (FE-3361); the lint
  gate holds the line on surfaces not yet migrated. Only a fact provider may
  call its constructor, `receiveServerFact`: the module that decodes the API
  response, or an off-Cloud local provider that answers the same fact
  (rule 4). Each provider is listed in `comfy/no-stray-server-fact-constructor`.
- Open: orthogonality tests on every gate a PR touches (FE-3355).

The lint keys on field names, not on documentation, so it is both narrower
and broader than rule 2:

- It flags a tier, billing-status or subscription-status literal used as a
  boolean gate even where the spec documents that value as the answer. The
  lint wins. Ask the backend for the fact, or change the lint in its own PR
  with the spec citation; do not add a disable comment.
- It does not see a proxy on a field outside its lists. Rule 2 still
  forbids it, and review holds it.

### Alternatives considered

- **More Markdown in reviewer skills.** Rejected: it was already in place
  and failed twice.
- **An LLM reviewer prompt for this rule.** Rejected as a gate: that is what
  approved the three PRs. It is not calibrated, and it shares the author's
  framing.
- **Opaque `ServerFact<T>` types on every surface at once.** Rejected: it is
  the strongest guarantee, but about 15 billing surfaces and other domains
  would have to migrate in one change. The type is adopted incrementally
  instead (see above).
- **Server-driven UI.** Rejected for now: out of scope for the capabilities
  API.

## Consequences

### Positive

- One copy of each policy, in the backend, shared by every client (app,
  billing-web, website, platform).
- A missing fact becomes a visible backend ticket instead of a silent client
  proxy.
- Reviewers and agents get a mechanical test: is this gate one server fact,
  read as the API documents it?

### Negative

- Some UI waits on backend fields that the client could approximate today.
  `pendingServerFact` is the escape hatch, and it expires with its ticket.
- Existing derivations need burning down domain by domain. Until then, new
  code is held to the rule on changed lines only.

## Notes

- Capabilities TDD: "an API should emit facts about its own domain, and
  clients should render those facts rather than recombine them into a
  decision."
- Related: ADR-AUTH-SESSION-0037 (the server owns the AND for one flag).
