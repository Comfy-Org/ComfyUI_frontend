# Mockup Implementation Workflow

## Goal

Preserve the mockup's hierarchy, density, rhythm, and interaction intent while
reusing production semantics. Fidelity is measured across representative
viewports and states, not by matching one screenshot with one-off CSS.

## 1. Select the product authority

Identify the product surface before reading the mockup as an implementation
specification. For `apps/website`, the shipped website, reusable website code,
and `website/components/*.md` contracts are primary. Figma is secondary
composition evidence. Other surfaces follow the precedence in `README.md`.

If the target surface has no component registry, create its inventory and
provenance contracts before implementing the page.

## 2. Build an evidence packet

Capture the Figma URL and node IDs, target viewport sizes, screenshots, visible
states, copy, assets, and known responsive behavior. Record what the mockup does
not specify: focus, loading, empty, error, permissions, overflow, and reduced
motion.

## 3. Decompose before coding

Describe the page as:

- application shell;
- page template or regions;
- known reusable components;
- candidate compositions;
- feature-specific content;
- semantic token roles;
- unresolved behavior.

Search the target surface's generated inventory, approved Markdown contracts,
Storybook, and existing code by behavior and anatomy, not only by the mockup
layer name. Search Figma after establishing which shipped components already
govern the surface.

## 4. Produce a provenance map

Before page implementation, map every visible element to one of:

- an approved component and permitted variant;
- an established page composition;
- a proposed component;
- a blocked gap;
- a named prototype exception with a replacement condition.

Only the first two may introduce interactive UI. Add the map to the page
contract under `pages/` so an agent and reviewer can audit the same evidence.

## 5. Resolve each missing component

Use this decision path:

1. If a code primitive exists, reuse it.
2. If Figma has a component but code does not, inspect its variants and search
   for an equivalent composition elsewhere in the product.
3. If the pattern repeats or is explicitly strategic, add the narrowest shared
   primitive or composition, with Storybook states and behavioral tests.
4. If it is genuinely one-off, document its anatomy and approval before adding
   it as a feature-local composition.
5. If evidence is insufficient, record a blocked gap and omit it. Do not use
   page-local styling as a temporary substitute for an undecided component.

## 6. Research other websites safely

External products are pattern evidence, not a visual source of truth. For each
reference, record its URL, access date, the user problem it solves, interaction
anatomy, states, responsive behavior, and accessibility observations. Compare at
least two references for a consequential new pattern.

Use the findings to write a proposed Comfy component contract. Adopt the
behavior principle only after approval, then express it with Comfy components,
tokens, voice, and accessibility. Do not copy brand assets, proprietary text,
source code, distinctive illustration, or exact styling. Record licensing when
a third-party asset or code example is considered.

## 7. Implement in fidelity passes

1. Structure and semantic components.
2. Layout, responsive constraints, and overflow.
3. Tokens, typography, spacing, radius, and icons.
4. Interaction states and accessibility.
5. Visual comparison at all evidence-packet viewports.

Fix the largest structural mismatch first. Do not accumulate arbitrary values
to compensate for the wrong component or container model.

## 8. Verification and promotion

- Run relevant unit tests and Storybook checks.
- Run `pnpm lint:design-system`; staged and CI checks inspect added lines.
- Run `pnpm design-system:docs` when token or UI inventory changes.
- Compare screenshots at the documented viewports and exercise keyboard states.
- Verify both visual fidelity and system fidelity. A visual match fails when it
  relies on an unapproved component or state.
- Promote a feature-local composition only after repeated use proves its stable
  API. Update `PATTERNS.md` and the relevant component map when promoted.

## Pull request evidence

A mockup-derived page PR should state the design reference, provenance map,
reused components, blocked gaps, new or changed primitives, intentional visual
deviations, responsive viewports verified, and any external pattern references.
This makes both forms of fidelity reviewable without forcing reviewers to
rediscover the design reasoning.
