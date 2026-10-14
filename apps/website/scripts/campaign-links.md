# Campaign links

The **Campaign Links** GitHub Actions workflow runs in the cloud on demand.
It covers the four Comfy-led and four agency-led landing pages, plus the agency
VFX v2 page. Comfy VFX uses version `v2` at `/solutions/vfx/`; its retired V1
page is excluded. The default preview contains nine links. Existing saved links
are never changed; there is no schedule. Black Math is not included.

Choose a vertical, campaign type, page version, traffic source, creative and
optional audience. The creative becomes `utm_content`; the audience becomes
`utm_term`. Confirm these match the actual ad and audience before creating drafts.
Campaign names follow the existing `comfy_vfx` convention, with `comfy_` or
`agency_` prefixes and vertical suffixes. Medium remains `ads`.

- **preview** generates a downloadable URL report without contacting the manager.
- **check** reads the manager, validates missing links, and reports the results
  without creating anything.
- **create-drafts** validates missing records before creating them, then reads
  them back to verify they saved. Errors, warnings, or newly detected duplicates
  hold the entire batch for review; the report sets `requiresReview: true` and
  lists the issues. Review them before rerunning. Destinations are never changed
  automatically.

Duplicate detection compares full URLs returned by the manager with query
parameters sorted. The manager excludes soft-deleted records, so a deleted URL
may appear missing. If its deterministic ID already exists, creation fails;
check the manager before rerunning. Runs never edit or reactivate existing
records. GitHub serializes runs to avoid overlapping writes.
It does not publish Bitly links, launch ads or change landing pages.

Cloud activation requires merging this workflow onto `main` and configuring the
`UTM_MANAGER_TOKEN` GitHub Actions secret with a scoped API key from the manager's
API Tokens page. It needs `links:read` and `links:draft:create`; publishing,
analytics, editing, and deleting are outside this workflow. The server assigns
creator attribution from the token owner and creator label; set the label to
`Campaign Links automation`. Tokens can expire or be revoked; update the GitHub
secret when replacing one. Do not use the legacy shared token or copy a personal
browser session into GitHub. No credential is embedded in code or output.

The [UTM Manager skill](https://utm-link-manager.pages.dev/skills/utm-link-manager/SKILL.md)
documents the API contract. Batches contain at most ten links, below its
100-link limit. Authenticated execution is available only after merging onto
`main`; pull-request runs receive no manager credential.

The target URLs use intended `comfy.org` production routes. They remain drafts
until the campaign pages and partner assets receive launch clearance. Campaign
names must match the ad platform or be mapped in PostHog for spend attribution.
