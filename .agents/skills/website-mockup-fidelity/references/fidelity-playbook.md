# High-fidelity website playbook

This reference preserves the non-obvious work required to translate the
Supported Models mockup into a page that matched the shipped Comfy website.
Use it when implementing or reviewing a mockup-derived `apps/website` page.

## What fidelity actually meant

Pixel similarity was only one layer. The accepted page needed four forms of
fidelity at the same time:

1. **Composition fidelity** — the mockup's hierarchy, emphasis, density, and
   content sequence remained recognizable.
2. **System fidelity** — controls and cards belonged to existing website
   families instead of being page-local approximations.
3. **Behavior fidelity** — interactions came from established components;
   anything not designed was omitted or left static.
4. **Process fidelity** — every choice was traceable, documented, lintable, and
   reviewable by another person or agent.

A page can look close in one screenshot and still fail the other three.

## Why the first attempts lost fidelity

Implementation began before the design system had been inventoried. Once page
composition was underway, empty spaces in the mockup felt like invitations to
complete the design. That produced plausible but unsupported decisions:

- a literal arrow on a collection action;
- decorative carousel pagination;
- a search treatment that did not match `/workflows`;
- page-local filter tabs instead of the shipped hub-filter anatomy;
- a second card language for model cards;
- rollover states inferred from convention rather than evidence;
- a secondary hero action whose visual treatment needed confirmation;
- status badges with the right words but the wrong geometry and scale;
- a Partner APIs card colored green instead of reusing the enterprise gray;
- task cards without the media slot visible in the intended composition;
- and premature search, filtering, URL state, and catalog classification work.

None of these choices was absurd. That was precisely the problem: an invention
can look reasonable enough to escape notice while gradually replacing the
actual design language.

## The key correction: require provenance

Every visible element was assigned an owner before further refinement.

| Question                           | Acceptable answer                           |
| ---------------------------------- | ------------------------------------------- |
| Where does this control come from? | Exact component and shipped page            |
| Is this a supported variation?     | Named variant in code and its contract      |
| Who owns its spacing and state?    | The reusable component, not the page        |
| Is it unique to this page?         | Feature composition wrapping approved parts |
| No source exists?                  | Documented gap or intentional omission      |

"It looks like the mockup" was not accepted as provenance.

For Supported Models, this changed the implementation in concrete ways:

- Header and footer stayed inside `BaseLayout`; no page-specific navigation
  decoration was added.
- Hero actions used existing `BrandButton` variants.
- Search reused the `/workflows` `SearchField` anatomy.
- Modality selection reused `HubFilterTabs`, including icon placement,
  container radius, selected yellow treatment, and horizontal overflow.
- Model collections reused `CardWorkflow01` rather than defining a model-card
  system.
- Task discovery used a governed `TaskTile` with a 16:9 media slot.
- Access and conversion cards reused `ProductCard` and the shipped pricing
  banner.
- Family rows used the existing small `IconButton` and arrow-right asset.
- FAQ reused the localized `FAQSection`.

## How Figma was used correctly

The supplied Figma mockup remained valuable for:

- page hierarchy;
- section order;
- headline and supporting copy;
- approximate density;
- the intended relationship between content groups;
- and evidence that a missing pattern needed design attention.

It was not treated as automatic authority for:

- new component APIs;
- hover or focus states;
- motion and carousel timing;
- icons and literal arrow characters;
- responsive behavior absent from the frame;
- or semantic token names.

The live Comfy Design Standards were consulted for general principles and
published assets. For `apps/website`, repeated shipped website patterns remained
the primary component authority. When the library did not contain a Comfy badge
matching the page, the existing website `Badge` API governed the result.

## The section-by-section review loop

The page reached fidelity through many small comparisons, not one final audit.

### Hero

The review checked headline scale and wrapping, copy width, button family,
button color role, stats placement, featured-card anatomy, and whether carousel
controls actually existed in the system. Unapproved pagination was removed and
the featured card stayed static.

### Search and filters

The decisive question was not "does this search field look good?" It was "is
this the same field used on `/workflows`?" The same standard applied to tabs.
This forced direct reuse instead of visual approximation.

The filter review also separated appearance from behavior. The approved preview
could show Image, Video, Audio, 3D, Edit, Upscale, LLM, and Train without needing
production classification logic or URL state.

### Model cards and badges

Card review compared the entire anatomy: surface, radius, media inset, 4:3 crop,
title, description, metadata row, badge order, and grid density. Fixing isolated
colors would not have been enough.

Day Zero and Open Weights became explicit semantic roles:

- Day Zero → yellow slanted `accent` badge.
- Open Weights → plum slanted `callout` badge.
- Both roles are rendered by `CardWorkflow01`, not selected by page call sites.
- Later review reduced status badges from `card` to the governed `md` size while
  descriptive tags remained `card`.

That final size correction illustrates the right feedback path: update the
shared card contract, update the badge and page documentation, regenerate the
inventory, rebuild, and redeploy. Do not add one-off padding to the selected
card.

### Task and access sections

The task cards initially cut a major corner by omitting their images. The fix
was not decorative page markup; the governed tile gained the expected media
slot and placeholder policy.

The Partner APIs access card initially drifted into a green surface. Comparing
against the shipped product-card family showed that the appropriate semantic
surface was the same cool gray used by Comfy Enterprise.

### Family, pricing, and FAQ

Family rows needed real arrow controls and reviewed destinations, but only after
the action anatomy was traced to `IconButton`. The conversion section reused
the exact `/cloud/pricing` banner. FAQ used the existing accordion rather than
inventing open and rollover treatments.

## Working with media and links

High fidelity did not require pretending every asset or destination was ready.

The accepted media policy was:

- use exact Comfy-owned stills when the promoted model had a reviewed source;
- keep a governed decorative placeholder when no exact owned still existed;
- never scrape arbitrary destination media;
- never substitute a visually similar model;
- let the shared card own cropping, loading, and alt treatment.

The accepted linking policy was:

- connect reviewed canonical destinations;
- distinguish internal and external target behavior;
- do not infer routes from display-name similarity;
- and do not make every preview element interactive merely because it could be.

## Design-first scope control

The most important product decision was to stop at a design preview.

Search, filters, remote data, exhaustive links, and carousel behavior can each
become significant implementation projects. Adding them before visual approval
created more code and more opportunities for the design to drift.

Use these scope levels explicitly:

| Level                 | Includes                                                                 | Excludes unless requested                       |
| --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| Design preview        | Approved anatomy, fixtures, placeholders, reviewed media                 | Full data and behavior                          |
| Interactive prototype | Demonstration state and bounded interactions                             | Production ownership and exhaustive integration |
| Production page       | Authoritative data, resilient behavior, analytics, complete destinations | Nothing implied; define the release contract    |

Never infer permission to move between levels from "finish the page."

## Documentation that made the result repeatable

The page contract became the memory of the review. It recorded:

- the current approval status;
- the evidence hierarchy;
- every major review decision;
- exclusions such as carousel pagination and suggestion chips;
- the provenance of each page element;
- feature-local composition responsibilities;
- blocked component gaps;
- catalog, media, and link boundaries;
- and acceptance gates for visual and system fidelity.

Reusable contracts were updated when review changed a component rule. For
example, the final badge-size decision appears in the Badge contract,
CardWorkflow contract, and Supported Models page contract. An agent should not
need to reconstruct that decision from screenshots.

## What the linter can and cannot prevent

The design-system linter is useful for structural drift:

- raw interactive elements where governed components are required;
- unsupported or undocumented component compositions;
- arbitrary values and page-local interaction utilities;
- unregistered website components;
- and call-site overrides that bypass component policy.

It cannot determine whether a card is the correct family, whether a gray should
have been green, or whether an arrow was invented from a still image. Those
require provenance review and visual comparison.

The strongest process combines:

1. documentation that tells the agent what is allowed;
2. lint rules for mechanically detectable violations;
3. visual review for anatomy and composition;
4. and human annotations for unresolved judgment.

## Efficient implementation sequence

Use this order on future pages:

1. Read repository and website design-system guidance.
2. Inspect the mockup and record the full section hierarchy.
3. Inspect the most relevant shipped pages at desktop and narrow widths.
4. Search existing components, stories, contracts, and tokens.
5. Build a provenance map and gap list.
6. Decide the scope level and document exclusions.
7. Implement missing reusable variants before page composition.
8. Compose the static page with fixtures and governed placeholders.
9. Review one section at a time, correcting owning components.
10. Update component and page contracts as decisions stabilize.
11. Regenerate inventories and run design lint.
12. Run focused tests and the website build.
13. Deploy an isolated, public, `noindex` preview.
14. Verify the exact route and critical rendered markers.
15. Only then decide whether production integration is a separate task.

## Review questions that expose invention

Ask these questions during every pass:

- Which shipped page proves this pattern?
- Is this the exact component or only a visual imitation?
- Is the variant named and documented?
- Did the mockup actually define this state or did the implementation invent it?
- Is an icon from the established family, or is it a literal character?
- Does the page override spacing or color that belongs to the component?
- Are mobile behavior and overflow inherited from an owner?
- Is this link reviewed, or guessed from its label?
- Is the media exact and owned, or merely similar?
- Is behavior required for this scope, or are we over-integrating?
- If this element is removed, is the preview more honest?

## Definition of done

A high-fidelity design preview is ready when:

- every visible pattern has approved provenance or a documented exception;
- the section hierarchy and responsive composition match the approved intent;
- reusable components own their anatomy and states;
- unknown behavior remains omitted or explicitly static;
- media and links follow reviewed ownership rules;
- page and component contracts reflect the final review decisions;
- generated inventories are current;
- relevant tests and the website build pass;
- design lint has no findings attributable to the page;
- and the shared preview URL renders the reviewed artifact without requiring an
  account.

The core rule is simple: if the implementation cannot explain where a design
decision came from, it must not quietly ship that decision.
