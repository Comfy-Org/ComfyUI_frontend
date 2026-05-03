#!/usr/bin/env bash
#
# Generate multi-resolution VP9/WebM + H.264/MP4 variants and a poster frame
# for every source video in a given directory. Intended to be run locally
# before uploading the outputs to media.comfy.org.
#
# Usage:
#   apps/website/scripts/process-videos.sh <input-dir> <output-dir> [widths]
#
# Example:
#   apps/website/scripts/process-videos.sh \
#     ./video-sources \
#     ./dist/videos \
#     "640 960 1280 1920"
#
# Defaults to widths "1280" if omitted.
#
# Output naming matches buildVideoSources() in src/utils/video.ts:
#   <name>-<width>.webm
#   <name>-<width>.mp4
#   <name>-poster.jpg          (single 1280w poster, suitable for SiteVideo)
#
# Requires ffmpeg on PATH. Tested with ffmpeg 6.x and 7.x.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  cat <<USAGE >&2
Usage: $0 <input-dir> <output-dir> [widths]
  widths: space-separated list, e.g. "640 1280 1920" (default: "1280")
USAGE
  exit 64
fi

input_dir=$1
output_dir=$2
widths=${3:-1280}

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found on PATH" >&2
  exit 127
fi

if [[ ! -d $input_dir ]]; then
  echo "error: input dir not found: $input_dir" >&2
  exit 66
fi

mkdir -p "$output_dir"

shopt -s nullglob
sources=("$input_dir"/*.{mp4,mov,webm,mkv})
shopt -u nullglob

if [[ ${#sources[@]} -eq 0 ]]; then
  echo "error: no source videos in $input_dir (looked for .mp4 .mov .webm .mkv)" >&2
  exit 66
fi

for src in "${sources[@]}"; do
  name=$(basename "$src")
  name=${name%.*}
  echo "==> $name"

  for w in $widths; do
    webm_out="$output_dir/${name}-${w}.webm"
    mp4_out="$output_dir/${name}-${w}.mp4"

    echo "    encoding ${w}w VP9/WebM -> $webm_out"
    ffmpeg -y -hide_banner -loglevel error \
      -i "$src" \
      -vf "scale=${w}:-2:flags=lanczos" \
      -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 -tile-columns 2 \
      -c:a libopus -b:a 96k \
      -f webm "$webm_out"

    echo "    encoding ${w}w H.264/MP4 -> $mp4_out"
    ffmpeg -y -hide_banner -loglevel error \
      -i "$src" \
      -vf "scale=${w}:-2:flags=lanczos" \
      -c:v libx264 -crf 23 -preset slow -profile:v high -pix_fmt yuv420p \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      "$mp4_out"
  done

  poster_out="$output_dir/${name}-poster.jpg"
  echo "    extracting poster -> $poster_out"
  ffmpeg -y -hide_banner -loglevel error \
    -ss 00:00:01 -i "$src" \
    -vframes 1 -vf "scale=1280:-2:flags=lanczos" \
    -q:v 4 \
    "$poster_out"
done

echo "done. upload contents of $output_dir to media.comfy.org."
