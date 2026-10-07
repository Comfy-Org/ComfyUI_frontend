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

## How the page is laid out

One section per area, in the order set by `ROADMAP_AREA_ORDER` in
`../roadmap.schema.ts`. An area with no entries is skipped entirely, so adding
the first entry for an area is all it takes to make that section appear.

Within an area, entries sort by `order` ascending. Each one renders its title, a
stage chip, a date chip when it has a date, and the body.

## Adding an entry

1. Create `en/<slug>.mdx` and `zh-CN/<slug>.mdx`. The same filename is the same
   entry in both languages, as with `customers`.
2. Frontmatter (see `../roadmap.schema.ts`):
   - `title`: one line, plain language, the words someone would search for
   - `area`: `engine` | `cloud` | `frontend` | `desktop` | `platform` | `community`
   - `stage`: `exploring` | `building` | `shipping`
   - `date`: optional, see below
   - `order`: sort position within the area section, ascending
3. Body: one short paragraph. Links are styled; other inline markup is not, so
   keep prose plain.
4. Once something is fully rolled out, delete the entry and let the changelog
   carry it.

## Dates

Some entries have a date and some do not, and that is fine. The rules:

- **Omit the field** when there is no date. Do not write `"soon"`, `"TBD"`,
  `"coming up"` or any other filler. An entry with no date chip reads as
  deliberate; a chip saying "TBD" reads as noise.
- **A month and year** (`"Nov 2026"`) or **a quarter** (`"Q4 2026"`) is the
  normal precision.
- **An exact day** only when it is genuinely committed and someone would be
  entitled to hold us to it.
- The string renders **verbatim**, and is never parsed or reformatted. So each
  locale writes its own: `date: "Nov 2026"` in `en/`, `date: "2026年11月"` in
  `zh-CN/`. Keep the two in agreement about the actual date.

## Gotchas

- `order` is scoped to the area section, not the page, so entries in different
  areas can share a number.
- The schema is `z.strictObject`, so an unknown frontmatter key fails the build
  rather than being ignored.
- Area and stage labels are translated copy under `roadmap.area.*` and
  `roadmap.stage.*` in `src/locales/<locale>/main.json`, not content. Renaming a
  label does not touch these files.
- MDX here is excluded from `oxfmt` (see `.oxfmtrc.json`); keep one logical
  block per line.
- `/roadmap` is listed in `PLACEHOLDER_PATHNAMES` in `src/config/indexing.ts`,
  which keeps it out of the index and the sitemap. Remove it there when the real
  content lands, otherwise the page stays invisible to search.
