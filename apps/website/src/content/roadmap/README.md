# Roadmap content

Powers `/roadmap/` and `/zh-CN/roadmap/`.

**Every entry currently in here is a placeholder.** Each one has `PLACEHOLDER` in
its title, `placeholder-` in its filename, and a body that says so. Replace them
before this page is announced, and delete any you do not need.

## What belongs on this page

What we are working on internally, including bugs and unfinished work. It is not
a list of what already shipped: that is the
[changelog](https://docs.comfy.org/changelog), which the page links to so the
distinction is obvious.

**No dates.** No quarters, no months, no "soon". The only ordering signal is
`stage`, and `order` within a stage. There is deliberately no date field in the
schema, so a date can only get in via prose, which is where to be careful.

## Adding an entry

1. Create `en/<slug>.mdx` and `zh-CN/<slug>.mdx`. The same filename is the same
   entry in both languages, as with `customers`.
2. Frontmatter (all required, see `../roadmap.schema.ts`):
   - `title`: one line, plain language, the words someone would search for
   - `area`: `engine` | `cloud` | `frontend` | `desktop` | `platform` | `community`
   - `stage`: `exploring` | `building` | `shipping`
   - `order`: sort position within the stage column, ascending
3. Body: one short paragraph. Links are styled; other inline markup is not, so
   keep prose plain.
4. Moving an entry between stages is an `stage` edit. Once something is fully
   rolled out, delete the entry and let the changelog carry it.

## Gotchas

- `order` is scoped to the stage column, not the page, so two entries in
  different stages can share a number.
- The schema is `z.strictObject`, so an unknown frontmatter key fails the build
  rather than being ignored.
- MDX here is excluded from `oxfmt` (see `.oxfmtrc.json`); keep one logical
  block per line.
- `/roadmap` is listed in `PLACEHOLDER_PATHNAMES` in `src/config/indexing.ts`,
  which keeps it out of the index and the sitemap. Remove it there when the real
  content lands, otherwise the page stays invisible to search.
