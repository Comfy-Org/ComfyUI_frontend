# Gordian Knot

Import cycles in `src/` per commit across the FE-3037 PRs, and domain architecture progress (see [DOMAINS.md](DOMAINS.md)). Open `index.html`.

- `data/timeline.json`: per-commit stats, knots (stable ids) and freed/entangled module lists
- `data/graph.json`: module positions and knot membership over time
- `data/data.js`: both, as `window.GORDIAN`, so the page works from `file://`

Regenerate from the repo root (needs Graphviz `sfdp` on PATH):

```
node tools/depcruise/scripts/cruise.mjs <base> <head> <workDir> [concurrency]
node tools/depcruise/scripts/open-prs.mjs <workDir> <head>   # optional: open PRs labelled refactor-gordian-knot
node tools/depcruise/scripts/census.mjs <workDir> [toolRef]  # optional: domain census, see DOMAINS.md
node tools/depcruise/scripts/build-data.mjs <workDir>
```

Current data: `7475c964f6..70c0a86139` (79 commits).

Publish to https://gordian-knot-comfyui.vercel.app (ComfyUI Vercel team members only), after `pnpm dlx vercel@62 login`:

```
node tools/depcruise/scripts/publish.mjs --prod
node tools/depcruise/scripts/publish.mjs --base <sha> --head <sha> --prod
```
