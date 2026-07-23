# Website content collections

How we keep editable marketing content in code, using Astro Content Collections.
Customer stories (`/customers`) are the first content type moved over, and this is
the pattern to follow for the rest of the marketing content.

## Which kind of collection to use

- **Article / prose content** (case studies, blog-style pages): use an **MDX**
  collection. One MDX file per entry, frontmatter for the metadata, prose body with
  a few small components for images, quotes, etc.
- **Structured / list content** (pricing tiers, feature grids, model lists): use a
  **data** collection (`file()` loader + JSON/YAML + a zod schema). Do not force this
  kind of content into MDX.

## How customer stories are set up (the article pattern)

- The collection is defined in `src/content.config.ts` (a `glob` loader over
  `src/content/customers`).
- One folder per locale: `src/content/customers/en` and `.../zh-CN`. The same
  filename is the same story in both languages. A custom `generateId` keeps the exact
  path as the id, so the `zh-CN` folder is not lower-cased (that silently breaks
  locale filtering otherwise).
- The schema lives in `src/content/customers.schema.ts` (title, category,
  description, cover, order, section list, optional read-more link).
- The body components are in `components/customers/content` (`Section`, `Figure`,
  `Quote`, `Contributors`, `Steps`, plus styled paragraph/heading/list). These are
  generic article blocks. When a second article type is added, move them to a shared
  folder so both can use them.
- The detail page renders the body with `<Content components={...} />` and a small
  scroll-spy sidebar island (`ArticleNav.vue`). The article body itself is static
  HTML; only the sidebar ships JavaScript.

## Adding a new article type (quick version)

1. Add a collection to `src/content.config.ts` with a `glob` loader and a zod schema.
2. Put the content under `src/content/<type>/<locale>/<slug>.mdx`.
3. Build the listing and detail pages that read it with `getCollection`.
4. Reuse the block components above.

## Gotchas worth knowing

- `src/env.d.ts` must reference `../.astro/types.d.ts`, otherwise `getCollection` is
  untyped and entry data comes back empty.
- `astro.config.ts` sets `markdown.smartypants: false` so punctuation stays exactly
  as written (otherwise straight quotes become curly and drift from the rest of the
  site). This option is deprecated in Astro 7 and moves onto the markdown processor;
  handle that as part of the Astro 7 upgrade.
- ESLint: `apps/website` files ignore the `astro:` virtual modules in
  `import-x/no-unresolved` (they are real at build time but the resolver cannot see
  them).
- `ui/button/Button.vue` cannot take an `href` inside a `.astro` file (its props do
  not declare it). Wrap it in a small `.vue` when you need a link button, see
  `components/customers/content/ReadMore.vue`.
- Content MDX is excluded from `oxfmt` in `.oxfmtrc.json`. The formatter rewraps
  component slots and changes the rendered output (it broke blockquotes). Keep one
  logical block per line when editing.
- `components/common/ContentSection.vue` and `config/contentSections.ts` still power
  the legal and privacy pages. Do not delete them.
- The MDX `components` map styles the block elements (paragraphs, `###`, lists) and the
  named block components (`Figure`, `Quote`, etc.). Inline `a`/`strong`/`em` typed
  directly in prose render with browser defaults, so route prose through the block
  components; if styled inline links are ever needed, add them to the map with design
  sign-off.
