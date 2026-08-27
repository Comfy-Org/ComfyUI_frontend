# Design-System Lint Rules

The linter checks added lines so legacy debt does not block unrelated work.
Errors fail the command; warnings make a reuse decision visible without
forbidding a justified native control.

| Rule    | Severity | Governs                                                                                                                |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DS001` | Error    | No `dark:` or `dark-theme:` Tailwind variants.                                                                         |
| `DS002` | Error    | No Tailwind important utilities.                                                                                       |
| `DS003` | Error    | No arbitrary percentage dimensions when a fraction or token should express the decision.                               |
| `DS004` | Error    | Use `cn()` rather than array-valued `:class`.                                                                          |
| `DS005` | Error    | Iconify icons use `size-*`, not text-size utilities.                                                                   |
| `DS006` | Error    | No hardcoded visual color in product styling. Design-system CSS and the website theme are token-definition boundaries. |
| `DS007` | Error    | No new direct PrimeVue imports in `src`; reuse or extend `src/components/ui`.                                          |
| `DS008` | Warning  | Prefer reusable UI primitives over raw button, input, select, and textarea elements outside the primitive layer.       |
| `DS009` | Error    | Website page compositions use approved components instead of raw interactive controls.                                 |
| `DS010` | Error    | Website actions do not use literal arrow glyphs in place of an approved icon-bearing component.                        |
| `DS011` | Error    | Website hover, focus, active, disabled, and selected states live in approved components rather than page compositions. |
| `DS012` | Error    | Governed website components cannot receive visual class overrides outside their implementation.                        |
| `DS013` | Error    | Every new feature-local website composition must be named in a page contract before implementation.                    |

`DS012` reads the frontmatter in `website/components/*.md`. This makes the
Markdown registry executable: changing an implementation path or class policy
changes enforcement without duplicating the allowlist in the linter.

`DS013` reads `pages/*.md`. A new composition may be approved, proposed, or a
prototype exception, but it cannot remain invisible to system review.

## Commands

- `pnpm lint:design-system` checks working-tree additions and untracked design
  files.
- `pnpm lint:design-system --staged` checks staged additions.
- `pnpm lint:design-system --base main` checks additions since a branch point.
- `pnpm lint:design-system --all` audits all tracked Astro, Vue, and CSS files.
- Explicit file paths lint complete files.

## Exceptions

Add a narrow, time-bounded entry to `LINT_EXCEPTIONS.md` only when the rule does
not model a valid implementation. Prefer an exact file. Directory exceptions
use a trailing `/**`. The linter parses that table; do not change its first two
columns.
