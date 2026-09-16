# Playground UX audit

Walked the catalogue, a model page, a runnable workflow page and a local
workflow page at 1440px and 390px. No console errors and no horizontal
overflow on any of the eight combinations.

## Fixed in this pass

**The typeface was misaligning every icon beside a word.** PP Formula ships an
ascent of 91% and a descent of 31% against a cap height of 84%, so its caps sit
12% of the em above the middle of the line box. Anything that centred an icon
next to an uppercase label inherited that: the type badge, the tab counts, the
chips, the filter rows. Re-anchoring the face's ascent to 103% and descent to
19% keeps the same content box, leaves `line-height: normal` at 138%, and puts
the cap box exactly in the middle at any line-height. One change, every row.

**The type badge was neither square nor closed.** `grid-cols-[0fr]` keeps a
min-content floor, so the word never fully collapsed. It is now
`minmax(0,0fr)`, and the badge is 28x28 with the icon centred until hover.

**Entering a category broke the control rhythm.** The sort menu sat alone above
the tab rule, the three filters below it: three stacked rows for four controls.
Tabs now sit on their own, with one control row under them.

**The index had no filters or sort at all.** You could only narrow after picking
a category. Search, Filter and sort now sit together above the shelves, as in
V1.

**The card covered its own picture.** The title sat over the artwork behind a
scrim that darkened the bottom third, and a long title wrapped into the image.
The picture is the sample the reader came to judge, so it is now clean: title
and maker read underneath it, and the tags moved to the page behind the card.

**A runnable workflow page had two filled yellow actions.** "Sign in to run" and
"Open in Comfy Cloud" competed. The Cloud action is now an outline where the
model runs on the page, and filled where it does not.

**The copy explained our data model to the reader.** "The Router does not carry
a runnable operation for this model yet", "The registry lists this model once
per operation", "Titled after it, so they browse here rather than beside it in
the grid". Replaced with what the reader needs to know.

**The workflow page said the same thing twice** — the playground's sample output
and then a second still of it — and buried the sentence explaining what the
workflow does below the form. The still is gone where the playground runs, and
the description now sits under the title.

**An orphan tag row** sat after the ports with no heading. It has one.

**The two detail pages opened differently.** A model page led with one pill and
the provider's bare name; a workflow page led with pills, a byline, and a
sentence about the run wedged between the description and the tab bar. Both now
open the same way: pills that say what it is and whether it runs here, the
title, who made it, what it does, then the playground.

**Neither page said what a run costs** where the model has a single operation —
the price only appeared on the operation buttons, which are hidden when there is
nothing to choose. It is a pill in the header on both pages now.

**The run bar was a pane the form showed through.** `bg-page/85` with a light
blur left the prompt legible behind "Sign in to run". It reads as a bar now.

## Open, and not mine to decide

**Only 72 of the 610 workflow pages get a playground.** The join runs on model
_name_: `partnerModelFor` matches the template's `models` list against
catalogue names and requires an `API` tag. `api_wan3_0_i2v` names "Wan3.0" and
the catalogue has no model called that, so a workflow that is one Wan 3.0 call
shows no playground. Joining on the partner **node type** instead reaches the
239 single-call workflows measured from the graphs. That is data plumbing, not
design.

**The "Runs here" facet is wrong in both directions.** Measured against the
built site: 177 workflows marked not-runnable that are a single partner call
(108 of them calling a node the catalogue already carries), 3 marked runnable
that load local checkpoints, and 16 marked runnable that are chains. The facet
shows 45; the honest number is 134.

**The graph is fetched from raw.githubusercontent.com at view time.** One
request per page view, nothing cached by us, and it fails where GitHub is
blocked. Either proxy it or ship the graphs with the site.

**A model page with no workflows built on it ends abruptly** after the sample
strip, with the footer immediately below.

**The example strip changes its name with its state** — "Sample outputs" where
there is nothing to load, "Try an example" where there is. Deliberate, but
worth a decision rather than an accident.
