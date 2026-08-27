# Website Media Hosting

- Host videos and large or shared media on `media.comfy.org`; do not add them
  to the repository. Keep ordinary page images in `src/assets/marketing/` so
  Astro can optimize them, as documented in `src/assets/marketing/README.md`.
- The source of truth is the
  [Frontend Binary Upload Playbook](https://app.notion.com/p/3b06d73d365081acb5bcd34170b84a59).
  `gs://comfy-org-videos/website/<section>/<file>` maps to
  `https://media.comfy.org/website/<section>/<file>`.
- Before uploading, inspect neighboring objects and use the matching section.
  Prefer a new descriptive filename instead of overwriting an existing CDN
  path, which can remain stale until its cache expires.
- Process marketing videos with `scripts/process-videos.sh` when encoding is
  needed. Follow `scripts/README.md` when choosing between `SiteVideo` and
  `VideoPlayer`.
- Upload with `gcloud storage cp`, then verify every public URL returns HTTP
  200 before replacing local references or deleting local files. Stop on a
  403 and ask for `frontend@comfy.org` write access; never store credentials
  in the repository.
