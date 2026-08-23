# Comfy Frontend Design System

This directory is the durable, AI-readable bridge between shipped product
patterns, mockups, and production components. It exists to make page work a
composition task instead of a fresh visual interpretation each time.

## Agent read order

Before implementing a page or user-facing component:

1. Read this file and [MOCKUP_WORKFLOW.md](./MOCKUP_WORKFLOW.md).
2. Read [FOUNDATIONS.md](./FOUNDATIONS.md) and the generated
   [token inventory](./generated/TOKENS.md).
3. For public website work, read the [website contract](./website/README.md) and
   generated [website token inventory](./generated/WEBSITE_TOKENS.md) and
   [website component inventory](./generated/WEBSITE_COMPONENTS.md).
   For application work, search the generated
   [code component inventory](./generated/COMPONENTS.md).
4. Read [PATTERNS.md](./PATTERNS.md) for page-level composition guidance.
5. Use Figma as a secondary composition reference. It does not authorize a new
   component, state, or variant without a documented contract.

Page-specific implementation contracts live under `pages/`. Read the matching
contract before changing a documented page; these files may describe
feature-local patterns that are not yet general design-system standards.

## Source precedence

Use the first source that answers the decision:

1. Accessibility and product behavior requirements.
2. Approved components and repeated patterns in the target product surface.
3. Existing component behavior and Storybook stories.
4. Semantic tokens from `@comfyorg/design-system`.
5. Live Figma libraries and page mockups as secondary design evidence.
6. External product research, used only as evidence for a proposed pattern.
7. A documented, approved feature-local composition.

Pixel similarity does not override component semantics, accessibility, theme
behavior, or responsive behavior.

## Sources of truth

| Concern                                        | Source                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Public website patterns and components         | `apps/website/src/components/`, governed by `website/components/*.md`                                |
| Public website tokens                          | `apps/website/src/styles/global.css`                                                                 |
| Design principles and component specifications | [Comfy Design Standards](https://www.figma.com/design/QreIv5htUaSICNuO2VBHw0/Comfy-Design-Standards) |
| Published Figma assets                         | `Comfy Design System` subscribed library; query it live                                              |
| CSS tokens and Tailwind theme                  | `packages/design-system/src/css/`                                                                    |
| Reusable Vue primitives                        | `src/components/ui/` and adjacent established component families                                     |
| Executable component examples                  | Storybook `*.stories.ts` files                                                                       |
| Deterministic implementation constraints       | [LINT_RULES.md](./LINT_RULES.md)                                                                     |

## Keeping this context current

- Run `pnpm design-system:docs` after changing design-system CSS,
  `src/components/ui`, website theme CSS, or reusable website components.
- Run `pnpm design-system:docs:check` to verify the generated inventories.
- Update `FIGMA_COMPONENTS.md` when a live Figma component is mapped, renamed,
  or found to have no code equivalent.
- Update `PATTERNS.md` only after a pattern has repeated or been deliberately
  adopted. A single mockup is evidence, not automatically a standard.
- Record temporary lint waivers in `LINT_EXCEPTIONS.md`; source-code suppression
  comments are not part of this system.
