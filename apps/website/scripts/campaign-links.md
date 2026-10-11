# Campaign links

The **Campaign Links** GitHub Actions workflow runs in the cloud on demand.
It covers the four Comfy-led and four agency-led landing pages, plus both VFX
v2 pages. Existing links keep working between runs; there is no schedule.

Choose a vertical, campaign type, page version, traffic source, creative and
optional audience. The creative becomes `utm_content`; the audience becomes
`utm_term`. Confirm these match the actual ad and audience before creating drafts.
Campaign names follow the existing `comfy_vfx` convention, with `comfy_` or
`agency_` prefixes and vertical suffixes. Medium remains `ads`.

- **preview** generates a downloadable URL report without contacting the manager.
- **check** reads the manager and reports missing links without creating anything.
- **create-drafts** creates missing records and reads them back to verify they saved.

Duplicate detection compares full URLs returned by the manager with query
parameters sorted. The manager excludes soft-deleted records, so a deleted URL
may appear missing. If its deterministic ID already exists, creation fails;
check the manager before rerunning. Runs never edit or reactivate existing
records. GitHub serializes runs to avoid overlapping writes.
It does not publish Bitly links, launch ads or change landing pages.

Cloud activation requires merging this workflow onto `main` and configuring the
`UTM_MANAGER_TOKEN` GitHub Actions secret with a credential verified by the UTM
Manager owner. The [manager backend](https://github.com/Comfy-Org/UTM_link_manager)
validates requests against its production `ACCESS_TOKEN`. It does not enforce
token expiry or endpoint scopes; the token grants access beyond draft creation.
The owner must approve its use and configure it directly in GitHub from the
production secret store. Rotation requires updating both services. Do not copy
a personal browser session into GitHub. No credential is embedded in code or
output. Drafts use the creator name `Campaign Links automation`; no person is
impersonated.

The target URLs use intended `comfy.org` production routes. They remain drafts
until the campaign pages and partner assets receive launch clearance. Campaign
names must match the ad platform or be mapped in PostHog for spend attribution.
