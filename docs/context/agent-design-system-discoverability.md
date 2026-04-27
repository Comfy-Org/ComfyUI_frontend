# Agent discoverability of the design system

**Status:** Thinking note — not authoritative, not blocking any PR. Captured here so we can pick this back up after PR #11317 lands.

## Why this matters

The repo has a strong design system, but it's optimized for humans reading prose, not for AI agents (Claude Code, CodeRabbit, custom tooling) that need to enumerate available tokens and primitives quickly. Today an agent asked "what tokens are available?" has to read three CSS files by hand (`_palette.css`, `layout.css`, `style.css`) and infer naming patterns; an agent asked "what UI primitives can I use?" has to glob `src/components/ui/*/` and read CVA variant files. There's no single "look here first" entry point, and the `.agents/checks/` infrastructure (which has 25 checks, including `pattern-compliance.md` flagging hex values, `dark:` modifiers, and `withDefaults` anti-patterns) doesn't link to where the right answers live.

This is solvable with cheap, hand-maintained docs. It's also the kind of thing that's easy to do badly — a botched first draft (premature, partly wrong, in the wrong place) makes the system _less_ discoverable, not more.

## Current state (snapshot)

What exists and works:

- `packages/design-system/README.md` — explains the package as a static CSS bundle, lists the files, when to add tokens here vs. elsewhere. Good as a package-local doc.
- `src/components/appMode/layout/README.md` — gold-standard model for a feature-package README. Links back to `layout.css` as source of truth, documents naming conventions, lists structure, calls out conventions. **Use as a template** for any future package-level docs.
- `docs/guidance/design-standards.md` — binding rules around Figma mapping, color tiers, hover/selected derivation.
- `.agents/checks/pattern-compliance.md` — flags violations (hex values, `dark:` modifiers, `<style>` blocks in new code, `withDefaults`, hand-rolled focus rings, new PrimeVue usage).

What's missing:

- A single agent-first entry point at `packages/design-system/AGENT.md` (or similar) that says "you are an agent and you need to use the design system; start here."
- A token index — a hand-maintained or generated reference enumerating every `--color-*`, `--spacing-*`, `--text-*`, `--radius-*`, `--ease-*`, `--duration-*` with one-line "when to use." Today an agent has to read CSS to find these.
- A primitives index at `src/components/ui/README.md` — every primitive listed, props summary, when to use, the CVA-variant pattern. Mirror the layout README's style.
- Cross-links from `.agents/checks/pattern-compliance.md` → wherever the right answer lives. When the check fires, the agent has nowhere to go for "what should I have done instead."

## Proposed direction (when we come back to this)

Four pieces, roughly ordered by impact:

1. **`packages/design-system/AGENT.md`** — agent-first entry doc. Lists token categories, where each is defined, naming rules, a "decision tree" for which file to edit when. ~60–100 lines.
2. **`src/components/ui/README.md`** — primitives index mirroring the layout README's style. ~40–80 lines.
3. **Token index** — either `packages/design-system/TOKENS.md` (hand-maintained) or a small script that emits a generated index from the `@theme` blocks. Hand-maintained ships faster and is easier to keep accurate; generated is self-updating but adds CI complexity.
4. **Cross-link from `.agents/checks/pattern-compliance.md`** — single "see also" section pointing at AGENT.md so the check has a destination.

## Open questions

- **Token index scope.** Full enumeration (every `--*` token) or just the App Mode subset? Full is more useful but ~3× longer.
- **Style.** Terse reference (good for agent grep) vs. annotated prose (good for humans skimming). Lean reference, since agents are the primary audience for this work.
- **Where `.agents/` should grow.** A new `.agents/design-system.md` workflow doc, or extend `pattern-compliance.md`? Probably both eventually, but start with the workflow doc.
- **Generated vs. hand-maintained TOKENS.** Hand-maintained is fastest to ship; if the repo grows to 50+ tokens we'll regret hand-maintenance. Maybe ship hand-maintained now and replace with a script later if it pays off.
- **Where does this overlap `docs/guidance/design-standards.md`?** That doc is the binding rules; AGENT.md would be the entry-point map. They're complementary, but the boundary needs care so we don't duplicate or contradict.

## What's NOT in scope (yet)

- Generated-from-CSS scripts (CI complexity).
- Storybook integration.
- Touching `.agents/checks/*` beyond a single back-reference.
- A root-level `DESIGN.md`. An earlier draft of this work added one in PR #11317; it was removed because it was published prematurely without aligning on scope. Any future "single root entry point for design" should be designed deliberately, with reviewer input, not slipped into a feature PR.

## Why this is deferred

The right scope for this work isn't obvious yet — it's been a moving target across this PR (added a root `DESIGN.md`, then removed it; added cross-references, then untangled them). Doing this well needs (a) a separate PR with focused review from the design-system maintainers and (b) alignment on the boundary between "agent-first entry doc" and the existing `docs/guidance/*` and `.agents/*` material. Trying to land it inside PR #11317 would balloon the diff and dilute review attention from the App Mode redesign that PR is actually about.
