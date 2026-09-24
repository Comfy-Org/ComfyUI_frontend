# V2: the Playground, in detail

How models, workflows and apps browse as one catalogue under the use case the
visitor came for, what each page holds, and how the two kinds cross. The page
is called Playground. The decision itself is
[ADR-WEBSITE-CATALOGUE-0033](../adr/WEBSITE-CATALOGUE-0033-models-and-workflows-browse-as-one-catalogue.md);
this is the shape that decision takes.

Every figure below is measured from the committed snapshot with
`pnpm hub:audit-overlap`, and moves when the snapshot or the Router catalogue
is refreshed.

## 1. What is in the catalogue

|                 | Model                     | Workflow                                 | App                      |
| --------------- | ------------------------- | ---------------------------------------- | ------------------------ |
| What it is      | A capability we host      | A node graph, a JSON file                | A node graph with a form |
| How many        | 145 entries, 122 names    | 592                                      | 18                       |
| Next step       | Run here, against credits | Save to Cloud                            | Save to Cloud            |
| Needs           | An account and credits    | ComfyUI, weights, sometimes custom nodes | the same                 |
| Carries a price | Yes                       | No                                       | No                       |
| Carries a date  | No                        | Yes                                      | Yes                      |
| Made by         | A partner                 | Anyone                                   | Anyone                   |

Two next steps, and that is the spine of the design. Everything below exists so
a reader can tell which of the two a card is offering before clicking it.

## 2. What the merged grid must not create

101 of the 610 workflows name a model that is also a card in the same list, and
Nano Banana Pro is named by 42 of them. Filtering by _generate images_ must not
put a model and its 42 uses side by side as alternatives. The collision takes
three shapes, and one of them is ours:

1. **Twins.** Two workflow titles are a model name letter for letter, two more
   differ only in case.
2. **Operations.** 37 workflows open their title with a model they name:
   _Seedance 2.5: Text to Video_, _Seedance 2.5: Image to Video_. They are
   configurations of a capability, not competitors to it.
3. **Our own duplication.** The catalogue lists a model once per operation: 145
   entries under 122 names, 21 names appearing more than once. _Nano Banana Pro_
   is already two cards before a single workflow is added, and that alone is why
   19 of the 33 links we cannot make fail.

The third is the one to fix first, because it is the only one we caused.

## 3. The decision: use cases first, then three ranks

The visitor arrives knowing what they want to make, not which kind of run it
takes. So the catalogue opens on one shelf per use case, and each shelf holds
both halves of the answer: the capabilities that do it, and the workflows built
on them. Type is a tab inside the shelf, never the way in.

Rank is not navigation either. One page, one search, one filter panel. Rank is
what a row in the grid _is_.

**Rank 1, the model.** One card per model _name_, not per operation. Operations
live inside the model page as a choice, not beside it as rivals. 145 cards
become 122, the 21 duplicate names disappear, and every workflow naming a model
gains a single place to point.

**Rank 2, the workflow.** One card per graph, except where its title opens with
a model it names. Those 37 belong to the model and appear on the model page
instead of in the grid.

**Rank 3, the app.** A workflow with a form. Same card, its own badge, the same
promise as a workflow.

The grid is then **122 models + 573 workflows and apps**, against 755 if nothing
were grouped.

## 4. The card

One skeleton, so it reads as one catalogue: media at 4:3, the title over the
media, a type badge at top left, the maker underneath, then the price and the
tags.

**The card says what a thing is and opens it. Nothing on it is an action.** A
shelf is read by the dozen, and a verb on every tile is a page's worth of
decisions taken before the reader has looked at anything. So the button and the
line naming the other side of the catalogue both live on the page behind the
card, where the reader can act on them: `Run` is the playground on the model
page, `Save to Cloud` is the workflow page's primary action, `Runs on ‹model›`
is a section of the workflow page, and the workflows built on a model are a
section of its own.

Three things still differ between the kinds, and all three have to:

- **The badge is a mark that opens into a word.** The icon sits on the media at
  rest and the word slides out to its right on hover, so the type is available
  without a label standing over every thumbnail. The word stays in the markup
  throughout, so a screen reader always has it; hovering only decides whether it
  takes room.
- **Only models carry a price.** Credits per run, from the Router. A workflow
  shows nothing in that slot. The prototype invented a price, a rating and a
  rating count for the 538 that cannot run here, and that is the part not to
  repeat.
- **Provenance differs.** A model shows its provider's mark; a workflow shows
  the author's handle.

One warning stays on the card, because it is not an action: a workflow that
needs custom nodes says so before the reader spends a click on it.

## 5. Filters and sort

One panel for both kinds.

- **Type** — All, Models, Workflows, Apps, as tabs inside the use case, with
  counts that respect the rest of the filters. A tab narrows the answer the
  shelf already gave; it is not a way into the catalogue.
- **Use case** — the same eight for both kinds. All 610 workflows classify, none
  unclassified, which is what makes the merge cheap.
- **Output** — image, video, audio, 3D.
- **Provider** — for a model directly, for a workflow through the model it runs.
- **What it needs** — `Runs here` (331), `Needs ComfyUI` (279), `Needs custom
nodes` (78). The honest facet, and the one a visitor actually chooses on.

Sort is where the two kinds genuinely disagree, so the menu says so rather than
hiding it:

| Order   | Models              | Workflows | Behaviour                                       |
| ------- | ------------------- | --------- | ----------------------------------------------- |
| Popular | recommendation rank | installs  | Capabilities first, then what is built on them  |
| Name    | yes                 | yes       | The one order that truly interleaves            |
| Newest  | no date             | date      | Selecting it narrows Type to Workflows, visibly |
| Price   | credits per run     | no price  | Selecting it narrows Type to Models, visibly    |

Two things fall out of building it, and both are worth saying plainly.

**"Popular" has no shared scale.** A model's standing is a recommendation rank
someone set; a workflow's is an install count. Interleaving them would be a
number invented to make the sort look uniform. So the default order reads
capabilities first and then what is built on them.

Taken literally that gives every model before the first workflow, which on a
shelf of eight means no workflow ever reaches the row. So a shelf leads with
**four** models, gives the rest of the row to what people built on them, and
backfills from whichever side still has entries. The row is a reading decision,
not a filter: the count beside the shelf says how many there are altogether, and
opening it shows all of them.

**An order only one kind can honour sets the type facet** instead of
disappearing from the menu. The chip that appears is the explanation.

## 6. Search

One field across both. It matches a model name, a provider, a workflow title, a
tag and an author. Results come back in the default order, which reads models
first, so a search for _nano banana_ answers with the capability before the
workflows that use it rather than burying it under 42 of them.

The field belongs to the catalogue rather than to the list, so it sits in the
page header and is there before anything has been asked. Typing in it is one of
the three things that turn the shelves into a list, beside choosing a use case
and setting a facet.

## 7. The pages

### 7.1 Model page

Three sections, and two of them only exist because of rank 1:

- **The playground.** The model runs on its own page. The operations sharing
  this name are a row of tabs above it, each with its task and its price, and
  the playground under them is the live one, mounted whole rather than linked
  to. This is where the 21 duplicated names go. Switching operation remounts it,
  because the playground reads its schema and its example once.
- **This model's own workflows.** The ones titled after it, folded out of the
  grid. Present only where there are any.
- **Workflows that use this model.** The rest of the join, ordered by usage.
  Present on 18 of the 122 model names today. Absent, not empty, on the other 104.

### 7.2 Workflow page

The prototype built this page and then filled it with numbers the registry does
not have. The V2 page keeps the shape and drops the invention.

Shows, all of it real:

- Title, author, type badge, output medium.
- The example media the registry carries.
- The description from the details file.
- **Runs on** — the models it names. Linked where the catalogue carries them,
  plain text where it does not. Never a dead link, never a "coming soon".
- **What it needs** — ComfyUI, and the custom nodes named one by one for the 78
  that want them. A visitor learns this before the download, not after.
- **Inputs and outputs** — the real ports from the details file.
- Tags, linking back into the catalogue.
- The weights it will pull, in GB, for the workflows that run locally. 588 of
  the 610 carry a size, and it is the honest counterweight to "runs here".
- `Save to Cloud` as the primary action, `Download the JSON` as the secondary.
  The PRD settles the destination: the user's own Cloud account runs the
  workflow, and Local or Desktop is not the first 1P path. Both resolve to the
  same file today, because the Cloud hand-off is not wired yet.
- `Run ‹model› here` where the workflow resolves, with the sentence that keeps
  it honest: the graph opens in ComfyUI, and what runs here is the model
  underneath it.
- Related workflows, by shared tag or shared model, never mixing apps with
  graphs.

Does not show: a credits price, a star rating, comments, or a Run button for
the workflow itself.

### 7.3 App page

The same page with the order changed. An app is a graph someone wrapped in a
form, so the page leads with **the form** — the inputs the app asks for — and
the graph becomes the second section. The badge says App, and the promise stays
`Open in ComfyUI`.

Worth stating plainly, because it is easy to assume otherwise: an app is not the
runnable kind. 8 of the 18 are local graphs running weights we do not serve.

## 8. Do models and workflows connect, and how

Yes, and the data says how much weight the connection can carry.

**Model to workflows.** Only 18 of the 122 model names have any workflow naming
them, and the counts fall away fast: 42, 14, 8, 7, 5, 4, then twos and ones. So
the section is a real feature on a handful of pages and absent on the rest. It
must be absent rather than empty, never a heading over nothing.

**Workflow to model.** 72 of 610 resolve today. On most workflow pages the
`Runs on` list therefore holds names we cannot link, and 226 hold nothing we
carry at all.

That asymmetry is the answer: the crossing is worth building and is worth
nothing structural. It is an enhancement that is usually missing, so no layout
may depend on it, and every place it appears must survive its absence.

Both sides of it are read on the pages rather than on the cards, so the
asymmetry costs the grid nothing: a model with no workflows simply has no such
section, and a workflow naming a model we do not carry shows the name without a
link.

It is also the strongest argument for catalogue coverage. 126 of the 226 name a
family, an operation or a provider we already carry under another name, and
another 33 name a model we carry but land nowhere. Closing those turns a thin
connection into the thing that makes one catalogue worth having.

## 9. The cases the design has to survive

| #   | Case                                                     | What the interface does                                               |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | A model with no workflows (104 of 122)                   | No section on the page; the card never said anything about it         |
| 2   | A model with 42 workflows                                | A section on the page, ordered by usage                               |
| 3   | A model listed under several operations (21 names)       | One card, operations chosen inside the page                           |
| 4   | A workflow that resolves to a model (72)                 | `Runs on ‹model›`, linked, on the workflow page                       |
| 5   | A workflow naming a model we do not carry (226)          | The name as plain text, no link, no promise                           |
| 6   | A workflow naming several models (179)                   | Every name listed, each linked only if we carry it                    |
| 7   | A workflow naming a model but no single destination (33) | Links to the model name, never to an operation                        |
| 8   | A local workflow (279)                                   | No `Runs here`; the page offers `Save to Cloud` and the weights       |
| 9   | A workflow needing custom nodes (78)                     | Named before the download, on the card as a `Needs custom nodes` mark |
| 10  | A workflow titled after its own model (37)               | Folded onto the model page, not a card in the grid                    |
| 11  | A title that is a model name letter for letter (2)       | Same fold; the collision cannot occur                                 |
| 12  | An app (18)                                              | App badge on the card; form first, graph second, `Save to Cloud`      |
| 13  | An app running local weights (8)                         | Nothing implies it runs here                                          |
| 14  | A search matching both kinds                             | One list, models first, then the workflows that use them              |
| 15  | A filter combination with no results                     | The empty state names which filter to drop                            |
| 16  | A workflow with no thumbnail                             | The placeholder already in the card, never a blank tile               |

## 10. What this leaves open

- Whether Run ever appears on a workflow page. The site calls one model per
  request today, and 179 workflows name more than one. But 293 of the 610 pull
  nothing down, and of 44 sampled from those, 29 hold only loaders, savers and
  partner calls: roughly 190 workflows are a chain of Router calls and nothing
  else. What is missing is a small client-side runner that walks that chain, not
  Comfy Cloud. This is the question worth taking to the team.
- Whether the model page's operations are tabs, a select, or separate sections.
  Rank 1 says they live on one page; it does not say in what shape.
- The noun. The hub says workflows, the repo data says templates, the interface
  says both.
- How far catalogue coverage goes before V2 ships, which decides whether the
  crossings in section 8 are a feature or a footnote.
- Whether the fold should key on more than the title. It catches 37 workflows
  today; a workflow called _Text to Video with Seedance 2.5_ is the same thing
  and the rule misses it.

## 11. Where to see it

The Playground answers at `/playground/`, with `/playground/model/<name>/`
and `/playground/workflow/<name>/` behind it. The live catalogue at
`/workshop` is untouched.
