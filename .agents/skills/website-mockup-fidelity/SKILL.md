---
name: website-mockup-fidelity
description: Translate or review apps/website pages from Figma mockups, screenshots, or reference sites while preserving Comfy's shipped website system and preventing invented components, states, and behavior. Use for high-fidelity website page work, mockup comparison, visual QA, and design-preview handoff.
---

# Website mockup fidelity

Produce a page that feels assembled from the shipped Comfy website, not merely
styled to resemble a still image. Preserve both visual fidelity and system
fidelity.

Read the repository guidance before acting:

- `docs/design-system/README.md`
- `docs/design-system/MOCKUP_WORKFLOW.md`
- `docs/design-system/website/README.md`
- the relevant page contract under `docs/design-system/pages/`, if one exists
- generated website component and token inventories relevant to the page

For the detailed reasoning, failure modes, review method, and Supported Models
case study, read
[`references/fidelity-playbook.md`](references/fidelity-playbook.md).

## Evidence hierarchy

Use sources in this order for `apps/website`:

1. Repeated components and patterns already shipped on the Comfy website.
2. Website component contracts under `docs/design-system/website/`.
3. Existing semantic tokens and generated inventories.
4. Live Comfy Design Standards for general principles and governed components.
5. The supplied page mockup for hierarchy, content, density, and composition.
6. External websites only as research for a proposed gap.

A mockup may show that something should exist. It does not automatically define
a reusable component, interaction state, icon, animation, or token.

## Required workflow

### 1. Freeze the requested scope

Identify whether the deliverable is:

- a static design preview;
- an interactive prototype;
- or a production-integrated page.

Do not silently advance to the next level. In a design-first preview, controls
may demonstrate approved anatomy without filtering data, fetching media, or
linking every destination. Record those boundaries in the page contract.

### 2. Audit before composing

Inspect the mockup and the most relevant shipped pages. Search the codebase,
Storybook, website contracts, and generated inventories by anatomy and behavior,
not only by the mockup's labels.

Create a provenance map for every visible pattern:

- exact reuse;
- approved variant;
- feature-local composition around approved components;
- blocked component gap;
- or intentional omission.

Do not begin page composition while important controls or card families remain
unclassified.

### 3. Treat unknowns as gaps, not invitations

If no approved source exists, omit the element or stop to define a component.
Never improvise page-local arrows, hover states, carousel controls, pills,
badges, card anatomy, or search behavior to fill the mockup.

External references can inform a proposal, but cannot authorize direct copying.

### 4. Reuse anatomy, not just colors

Match the owning component's complete contract:

- content order and grouping;
- dimensions, padding, gaps, and radii;
- type family, scale, weight, line height, and case;
- semantic colors and surfaces;
- icon family and placement;
- responsive behavior;
- focus, hover, disabled, selected, and reduced-motion behavior;
- link target and accessibility semantics.

When a mismatch appears on a page, fix the owning component or documented
variant when the decision is reusable. Avoid call-site class overrides.

### 5. Build in fidelity passes

Work section by section:

1. hierarchy and content coverage;
2. macro geometry and container widths;
3. typography and vertical rhythm;
4. component anatomy and variants;
5. color, media, and finishing details;
6. responsive and interaction verification.

Compare at representative desktop and narrow widths after each meaningful
section. Browser annotations are authoritative review feedback; resolve them at
the component-contract level and update the provenance record.

### 6. Separate visual approval from integration

Do not let data work destabilize an approved preview. Use truthful fixtures,
owned media, and documented placeholders. Connect search, filters, carousels,
remote data, and exhaustive navigation only when that scope is explicitly
requested.

### 7. Document the accepted result

The page contract must capture:

- status and approval boundary;
- source priority;
- decisions that produced the baseline;
- explicit exclusions;
- provenance map;
- feature-local compositions;
- blocked gaps;
- media and data boundaries;
- visual and system acceptance gates.

Update reusable component contracts when review changes a governed variant or
role. Run `pnpm design-system:docs` after reusable website component changes.

### 8. Verify and hand off

Run the narrowest relevant tests, the website build, and
`pnpm lint:design-system`. Do not hide unrelated failures; identify their exact
owner and continue only when the requested artifact remains verifiable.

For a preview handoff, deploy an isolated non-production artifact, make it
reviewable without account access, keep it `noindex`, and verify the exact route
and critical page markers before sharing the URL.

## Stop conditions

Stop and surface a design decision when:

- a visible pattern has no approved provenance;
- a requested behavior would move a preview into production integration;
- reference sources conflict materially;
- a responsive or interaction state cannot be inferred from an owning
  component;
- or fixing the issue would require changing an unrelated system.

Do not trade fidelity for apparent completeness. A documented omission is
better than a plausible invention.
