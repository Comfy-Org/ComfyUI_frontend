# Website Design-System Contract

The public Comfy website is the primary design source for work under
`apps/website`. Repeated, shipped website patterns outrank a one-off mockup.
Figma may describe page composition, but it does not authorize a new component,
variant, icon, state, or interaction by itself.

## Decision order

1. Meet accessibility and product behavior requirements.
2. Reuse an approved contract in `components/` without changing its appearance.
3. Reuse a repeated website composition documented in a page contract.
4. Record a component gap and leave it out of implementation.
5. Design and approve the missing component before returning it to the page.

External websites are research inputs only. A borrowed pattern becomes a Comfy
pattern only after its anatomy, states, tokens, and ownership are documented and
approved.

## Contract statuses

- `approved`: available for page composition using the listed variants and sizes.
- `proposed`: an explicitly design-only prototype may render it, but production
  data, behavior, and release approval remain blocked.
- `blocked-gap`: the page needs this pattern and no approved implementation exists.
- `prototype-exception`: a temporary non-interactive visual aid with an explicit
  removal or replacement condition.

## Class policy

Approved website components use `class_policy: none`. Page code may control
placement through a wrapper, but it may not pass classes that alter the
component. If a missing size, state, or appearance is needed, update the
component contract and implementation together instead of overriding it at the
call site.

The generated [website token inventory](../generated/WEBSITE_TOKENS.md) records
the website theme vocabulary, and the
[website component inventory](../generated/WEBSITE_COMPONENTS.md) lists
available code. The Markdown files under `components/` are the machine-readable
allowlist enforced by `pnpm design-system:lint`.
