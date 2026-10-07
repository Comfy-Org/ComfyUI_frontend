# Roadmap content

Powers `/roadmap/` and `/zh-CN/roadmap/`.

**The entries are drafted but not yet reviewed for publication.** `/roadmap` is
listed in `PLACEHOLDER_PATHNAMES` (see the gotchas below), so the page is not
indexed. Take it out of that list when the content is signed off.

## What belongs on this page

What we are working on, including bugs and unfinished work, plus a short tail of
work that is already out so the page has a past to anchor the future against. It
is not a changelog: the full per-release detail is the
[changelog](https://docs.comfy.org/changelog), which the page links to.

## How the page is laid out

One continuous timeline, newest at the top.

- `shipped` entries sit **above** a NOW marker, and each one shows the month it
  landed.
- Everything else sits **below** the marker, in the order set by
  `ROADMAP_BELOW_NOW` in `../roadmap.schema.ts`: `shipping`, then `building`,
  then `exploring`.
- `order` breaks ties within each of those two groups.

Area is a chip on each entry rather than a heading, and the filter at the top of
the page narrows the timeline to one area. The filter is pure CSS, so it works
with scripting disabled; with `:has()` unsupported the chips hide themselves and
every entry stays visible.

## Adding an entry

1. Create `en/<slug>.mdx` and `zh-CN/<slug>.mdx`. The same filename is the same
   entry in both languages, as with `customers`.
2. Frontmatter (see `../roadmap.schema.ts`):
   - `title`: one line, plain language, the words someone would search for
   - `area`: `engine` | `cloud` | `frontend` | `desktop` | `platform` | `community`
   - `stage`: `exploring` | `building` | `shipping` | `shipped`
   - `date`: required for `shipped`, optional otherwise, see below
   - `link`: optional, see below
   - `order`: sort position within the group, ascending
3. Body: one short paragraph. Links are styled; other inline markup is not, so
   keep prose plain.
4. When something ships, move it to `shipped` and give it a verified month. When
   it is old enough to stop being news, delete it and let the changelog carry it.

## Dates

- **`shipped` requires a date.** The schema refuses the entry otherwise, so a
  claim that something is out always says when. Every other stage may omit it.
- **Verify the month against a public source** before writing it: a GitHub
  release tag, a dated entry on the changelog, a merged PR, or a dated entry in
  `src/data/drops.ts` (which is published at `/launches/`). If you cannot find
  one, do not promote the entry to `shipped`. A wrong date on a public page is
  worse than a missing entry.
- **Omit the field** when there is no date. Do not write `"soon"`, `"TBD"`,
  `"coming up"` or any other filler. An entry with no date chip reads as
  deliberate; a chip saying "TBD" reads as noise.
- **A month and year** (`"Sep 2026"`) or **a quarter** (`"Q4 2026"`) is the
  right precision. Avoid exact days.
- The string renders **verbatim**, and is never parsed or reformatted. So each
  locale writes its own: `date: "Sep 2026"` in `en/`, `date: "2026年9月"` in
  `zh-CN/`. Keep the two in agreement about the actual date.

Below the marker, no entry carries a date today. That is deliberate rather than
unfinished: a date goes on only when someone will stand behind it personally.

## Links

`link` points at the thing itself, and the title becomes a link when it is set.
Any stage may carry one, not only `shipped`, since some in-flight work already
has a public page.

Pick the destination in this order: the product or landing page on `comfy.org`,
then the docs page on `docs.comfy.org`, then an announcement on
`blog.comfy.org`. A changelog anchor is a last resort and usually worse than no
link, because the page already links the changelog once at the top.

- **Only Comfy properties.** `comfy.org`, `docs.comfy.org`, `blog.comfy.org` or
  `github.com/Comfy-Org`. If the best destination is somebody else's page, raise
  it rather than linking it.
- **Curl it before you commit it.** A 404 from our own roadmap is worse than an
  unlinked row. If there is no live page, omit the field.
- Links open in a new tab so a reader does not lose their place on the
  timeline. That applies to `link` and to any anchor you write in a body, and
  both get a visually hidden "opens in a new tab" suffix for screen readers.

## Gotchas

- `order` is scoped to the group (shipped, or everything below the marker), not
  to the area, so keep it unique within a group or the sort is ambiguous.
- Shipped entries are newest first, and since the date string is never parsed,
  `order` is what actually controls that. Renumber when you add one.
- The schema is `z.strictObject`, so an unknown frontmatter key fails the build
  rather than being ignored.
- Area and stage labels are translated copy under `roadmap.area.*` and
  `roadmap.stage.*` in `src/locales/<locale>/main.json`, not content. Renaming a
  label does not touch these files.
- MDX here is excluded from `oxfmt` (see `.oxfmtrc.json`); keep one logical
  block per line.
- `/roadmap` is listed in `PLACEHOLDER_PATHNAMES` in `src/config/indexing.ts`,
  which keeps it out of the index and the sitemap. Remove it there when the
  content is signed off, otherwise the page stays invisible to search.
