# ADR-AUTH-WORKSPACE-0036: Workspace Deep-Link Contract

Date: 2026-09-21

## Status

Proposed

## Context

A billing or account link that names a workspace has always had a place to
carry that id: `@comfyorg/billing-contract`'s entry URL already accepted an
optional `workspace_id` query parameter (`OPTIONAL_ENTRY_FIELDS` in
`packages/billing-contract/src/entryFields.ts`). What it did not have was
company: the auth SDK, the cloud app, and comfy.org each named or ignored the
workspace on a link in whatever way their own surface needed, with no shared
definition and no shared parameter name. ShihChi's survey of the candidate
approaches
(https://app.notion.com/p/3e36d73d365081b794bbf431953c1f11) lays out the
divergence directly: a path-segment scheme (`/w/<id>/...`), a query
parameter, and doing nothing and leaving each surface to keep guessing.
Platform's own `middleware/workspace-link.ts` is the precedent for reading a
workspace off a link at the edge, in a sibling repository this one does not
share code with.

Milestone 2 (moving cloud checkout to `billing-web`, tracked alongside
FE-2617 through FE-2621) forced the question: billing-web binds its session
to "the workspace the entry link named," the cloud app needs to open in that
same workspace when a link sends it there, and comfy.org needs to write a
link that survives the trip. Three surfaces, one id, and no contract that
said whose spelling wins.

## Decision

1. **One subpath owns the contract: `@comfyorg/account-core/workspaceLink`.**
   It lives in the auth SDK because minting a token for a workspace and
   reading the workspace off a link are the same concern — the SDK that
   already owns `session` and `redirect` is where a destination reads the id
   before it mints. It exports `WORKSPACE_LINK_PARAM`, `isWorkspaceId`,
   `readWorkspaceLink`, `withWorkspaceLink`, and `withoutWorkspaceLink`
   (`packages/account-core/src/workspaceLink.ts`).
2. **The parameter is `workspace`, not `workspace_id`.** Nothing in
   production ever emitted `workspace_id` as a URL parameter — the billing
   entry URL was pre-launch — so this is a rename with no alias and no
   deprecation window. The token API's request body field,
   `POST /api/auth/token { workspace_id }`, is a separate name for a
   separate thing (a request body field, not a URL parameter) and is
   unchanged by this decision.
3. **`@comfyorg/billing-contract` reads its `workspaceId` entry field under
   the same parameter name** (`OPTIONAL_ENTRY_FIELDS` in
   `packages/billing-contract/src/entryFields.ts`) and stays a
   zero-dependency package: it takes `account-core` as a `devDependency`
   only, to run one parity test asserting `WORKSPACE_LINK_PARAM` and the
   entry field's `param` are the same string, so the two names cannot drift
   apart silently. The billing entry code (`INVALID_WORKSPACE_ID`) and key
   (`workspaceId`) are unchanged.
4. **A destination applies the link before it loads workspace-scoped
   content**, minting a token for the named id and leaving membership to the
   server — the same trust boundary every other mint already has. A payment
   or billing destination fails closed on a link it cannot honor and never
   silently acts on a different workspace; a navigation destination may fall
   back to its own active workspace but must show which one it landed on
   rather than switch without telling the visitor. The link survives a
   sign-in redirect the same way any other query parameter on the return
   path does (`safeInternalPath` in `packages/account-core/src/redirect.ts`
   passes it through unmodified).
5. **No standalone package.** A `@comfyorg/workspace-link` package was
   considered so the contract would owe nothing to either SDK, but it would
   be a second zero-dependency package with one export doing the same job
   `@comfyorg/account-core/redirect` already does for the other half of a
   sign-in trip. The auth SDK subpath was chosen instead: one less package to
   publish, version, and depend on.
6. **Every signed-in link that crosses surfaces carries the workspace, in
   both directions.** This covers the trip out and the trip back: an entry
   link into billing-web, billing-web's return link to the host, a cloud link
   to a platform page, and a comfy.org link to either. A link built on a
   signed-out page has no active workspace and carries none; the destination
   falls back per decision 4. A builder that produces cross-surface links
   takes the workspace as a required input, so a new link that forgets it is
   a type error rather than a review comment. `buildReturnUrl` in
   `@comfyorg/billing-contract` is the first such builder.

## Consequences

### Positive

- Every surface that reads or writes a workspace on a link — the auth SDK,
  the billing SDK, and their hosts — reads the same four sentences about what
  the parameter means and what a destination owes it, instead of each
  surface inventing its own reading of "the workspace on the link."
- The billing entry URL's `workspace_id` → `workspace` rename and the
  account-core contract land in the same PR, so there is never a commit where
  the two names disagree.
- The parity test makes a future rename of either side a compile-time
  question rather than a runtime one: `WORKSPACE_LINK_PARAM` and
  `OPTIONAL_ENTRY_FIELDS`'s `workspaceId.param` fail together or not at all.

### Negative

- `@comfyorg/billing-contract`'s "zero dependency" claim now has a footnote:
  a `devDependency` on `account-core`, present only to run the parity test
  and absent from the published tarball. A reader of the package's own
  description has to know to look at the test suite to find it.
- The rename touches every fixture in the repo that asserted the literal
  `workspace_id=` query string in an entry URL. None of them were exercising
  production traffic — the hosted billing app is still behind a flag — but
  the diff is wider than the two SDK files that define the contract.
- This ADR fixes the parameter name and the four function signatures before
  either consumer (FE-2647, FE-2648) exists. If a consumer's real usage
  argues for a fifth function or a different failure shape, that is a reason
  to amend this record, not to route around it.
- The link only moves the workspace between surfaces. Once a destination
  applies it and strips the parameter, a reload falls back to that surface's
  own memory. In the cloud app that memory is the browser-wide
  `Comfy.Workspace.LastWorkspaceId`, so two tabs on two workspaces converge
  on whichever switched last after a reload. Per-tab persistence is a
  separate decision this record does not make.

## Coverage

Each hop needs both halves: the sender writes the parameter and the receiver
applies it. A hop with only one half does not keep the workspace.

| From → To                                   | Sender                                                           | Receiver                                     |
| ------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| comfy.org → cloud                           | #18344 (Workshop links)                                          | #18345                                       |
| comfy.org → platform                        | #18344 (API keys link)                                           | Platform repo: API-key route not yet read    |
| cloud → billing-web                         | #18318                                                           | #18316                                       |
| cloud → platform                            | #18444                                                           | Platform repo: usage route not yet read      |
| billing-web → cloud / platform (return)     | #18443                                                           | #18345 for cloud; platform repo for platform |
| billing-web → billing-web (result, sign-in) | #18316 tab binding; #18443 adds the parameter to the result link | #18316                                       |
| platform → cloud                            | Platform repo                                                    | #18345                                       |
| platform → billing-web                      | Platform repo                                                    | #18316                                       |

## Notes

- Consumers: FE-2647 (the cloud app reads `?workspace=` on arrival) and
  FE-2648 (comfy.org writes it onto cloud/platform links) both depend on this
  contract and are the next PRs in the stack. Platform is expected to adopt
  `readWorkspaceLink` on its own billing and API-key routes once it takes the
  package from npm, replacing its private `middleware/workspace-link.ts`
  equivalent.
- Test plan: https://app.notion.com/p/3e26d73d3650815fb78ec0d273278d3b
