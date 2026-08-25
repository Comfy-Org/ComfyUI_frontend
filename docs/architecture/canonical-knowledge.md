# Canonical Knowledge: How Design Rules Get Into This Repo

A design objection is only actionable if the reviewer and the author can both
read the rule being cited. When the rule lives in a private workspace, a Notion
page, or another repository, the objection cannot be checked — it can only be
deferred to or ignored. This document defines how canonical knowledge enters
this repo so that does not happen.

It applies to any body of design knowledge.

## 1. Where canonical knowledge lives

| Kind                                      | Home                 | Example                              |
| ----------------------------------------- | -------------------- | ------------------------------------ |
| A decision, with context and consequences | `docs/adr/`          | `0008-entity-component-system.md`    |
| An invariant or shared vocabulary         | `docs/architecture/` | `domain-glossary.md`                 |
| A per-file-type convention                | `docs/guidance/`     | `typescript.md` (auto-loads by glob) |
| A review rulebook                         | `.agents/checks/`    | `adr-compliance.md`                  |

Nothing is canonical because it was said in a meeting, a Slack thread, a Notion
page, or another repository. Those are **sources**. A source becomes canonical
by being vendored into one of the four homes above, in a reviewed PR.

## 2. Binding now vs direction of travel

Most imported design material is a mix of rules that already hold and rules that
describe a target. Vendoring the mix unlabelled is worse than not vendoring it:
agents and reviewers start enforcing the target against shipping code.

Every vendored doc therefore carries a header block:

```markdown
> **Source**: <repo or system> · `<path>` @ `<commit or date>`
> **Status**: <what this governs>
> **Binding now**: <the subset already true and enforced on `main`>
> **Direction of travel**: <the subset that is a target, not a rule>
```

and splits its body into those two buckets under explicit headings. A claim goes
in **Binding now** only if it can be pointed at code on `main`. If it cannot be
verified, it goes in **Direction of travel** or it does not get vendored.

## 3. Staying in sync with upstream

**Vendor and pin. Do not auto-sync.**

Upstream knowledge sources are typically working notes under an auto-commit
stream with no review gate. Wiring a sync script would make unreviewed prose
binding on this repo the moment someone edits a paragraph, and would import
churn (renumbering, wave notes, internal cross-links) that means nothing here.

So: copy the excerpt, record source path plus commit SHA and date in the header,
and treat re-vendoring as a normal PR. Drift is then visible — diff the pinned
SHA against upstream — and every change to a binding rule gets reviewed once, in
this repo, by the people it binds.

Drop upstream cross-references that do not resolve here (ADR filenames, wave
identifiers, transcript IDs). A link an agent cannot follow is noise.

## 4. How an agent finds it

Two existing mechanisms, no new ones:

- **Directory-scoped `AGENTS.md`** — the depth loads only when an agent is
  working in that directory. `src/`, `browser_tests/`, `.github/`, and
  `src/lib/litegraph/` already do this; `docs/architecture/AGENTS.md` does it
  for architecture knowledge.
- **Glob frontmatter** in `docs/guidance/*.md` — loads by file type.

The root `AGENTS.md` is read on every turn, so it gets a pointer only, never the
content. Adding knowledge means adding a document plus at most one line at the
root.

## 5. Checklist for vendoring a new body of knowledge

1. Pick the home from §1.
2. Write the header block from §2 with a pinned source.
3. Verify each "binding now" claim against code on `main`, and cite it.
4. Put everything unverified under "direction of travel".
5. Link it from the nearest directory-scoped `AGENTS.md`.
6. If it changes what reviewers should flag, add it to `.agents/checks/`.
