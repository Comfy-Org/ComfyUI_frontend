---
name: pr-evidence
description: 'Adds before/after screenshots, user-journey demo videos, or benchmark and diagram evidence to a pull request description in collapsible details blocks, and refreshes evidence that went stale. Use whenever you open a PR, push commits to one, or review a PR that changes visible UI or behavior.'
---

# PR evidence

A PR description shows a reviewer what changed without checking out the
branch. The summary and verification stay visible; every screenshot, clip,
benchmark table, and diagram sits in a `<details>` block below them.

## 1. Read the PR state

On a follow-up round, start with the stale check in
[`reference/publishing.md`](reference/publishing.md#stale-evidence). Evidence
is current when the `<!-- pr-evidence ... -->` marker's SHAs still match
the head and base for every file the evidence depends on. When all of it is
current, update the marker's SHAs and end the round there.

## 2. Classify the diff

Classify by what a reviewer must see to trust the change. One PR can carry
several types; produce the evidence for each.

| The diff changes                                                                         | Type                        | Read                                                                             |
| ---------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| What a user can do: new flows, interactions, keyboard or pointer behavior, undo, dialogs | Feature or behavior         | [`reference/journeys-video.md`](reference/journeys-video.md)                     |
| How something looks: components, styles, tokens, layout, icons, click targets            | Visual                      | [`reference/before-after-screenshots.md`](reference/before-after-screenshots.md) |
| How fast something runs, or how modules, stores, or data flow fit together               | Performance or architecture | [`reference/perf-diagrams.md`](reference/perf-diagrams.md)                       |
| Nothing a user sees: refactors with unchanged output, CI, tooling, docs, tests only      | Not user-visible            | No media                                                                         |

A refactor whose rendered output changed is Visual. A not-user-visible PR
gets no evidence section; when someone asks for one, answer in one line
naming why nothing is visible, such as "CI-only change; no rendered output
differs."

## 3. Produce the evidence

Follow the reference file for each type. `scripts/media.sh` (relative to
this skill's base directory) trims, converts, and shrinks clips and builds frame-tile
sheets; it needs `ffmpeg`. Every capture is inspected against a stated
expected result before it goes in the body, by opening the image or video;
a capture you have not looked at does not count as evidence.

## 4. Publish

Follow [`reference/publishing.md`](reference/publishing.md) for every type:
the section layout, media URLs, the marker, the PATCH, and the read-back.
Done means the read-back body has the expected `<details>`, image, and
link counts, every media URL returns HTTP 200, and the marker names the
SHAs you captured.

## Reviewing a PR

The same rules gate approval. Classify the diff as in step 2. When it is
Visual, or a Feature with a visible change, and the body has no before/after
or journey evidence, or the stale check shows the evidence predates the
change, the review withholds approval with a finding that names the
missing states or journeys. The reviewer reports the gap and leaves the
author's body to the author.
