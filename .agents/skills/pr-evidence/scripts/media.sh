#!/usr/bin/env bash
# Media helpers for pr-evidence. Run with no arguments for usage.
set -euo pipefail

usage() {
  cat <<'EOF'
media.sh clip  <in.webm> <start-seconds> <out-base> [end-seconds]
    Trim from start (to end), write <out-base>.mp4 (H.264) and <out-base>.gif
    (looping preview, 640px wide, 10 fps; drops to 480px and 8 fps if over 5 MB).
    Runs shrink on the MP4 when it is over 10 MB.
media.sh shrink <in.mp4> <out.mp4> [max-bytes]
    Re-encode until under max-bytes (default 10000000), trying in order:
    CRF 26, CRF 28, CRF 28 at 1280px wide, CRF 28 at 1280px and 15 fps.
    Exits 1 if the last step is still too large.
media.sh tiles <video> <out.png> [fps]
    Frame-tile sheet, 1 frame per second by default, 5 columns, 320px tiles,
    each stamped with its timestamp in seconds.
EOF
  exit 2
}

gif() { # in out width fps
  ffmpeg -loglevel error -y -i "$1" -vf "fps=$4,scale=$3:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" -loop 0 "$2"
}

size() { stat -c %s "$1"; }

shrink() { # in out max
  local in=$1 out=$2 max=$3 tmp step crf vf
  tmp=$(mktemp --suffix=.mp4); chmod 644 "$tmp"
  for step in "26|" "28|" "28|scale='min(1280,iw)':-2" "28|scale='min(1280,iw)':-2,fps=15"; do
    crf=${step%%|*} vf=${step#*|}
    ffmpeg -loglevel error -y -i "$in" ${vf:+-vf "$vf"} -c:v libx264 -preset slow \
      -crf "$crf" -pix_fmt yuv420p -movflags +faststart -an "$tmp"
    echo "crf $crf ${vf:-unscaled}: $(size "$tmp") bytes"
    if [ "$(size "$tmp")" -le "$max" ]; then mv "$tmp" "$out"; return 0; fi
  done
  mv "$tmp" "$out"
  echo "still over $max bytes; trim the clip or record it shorter" >&2
  return 1
}

case "${1:-}" in
  clip)
    [ $# -ge 4 ] || usage
    in=$2 start=$3 out=$4 end=${5:-}
    ffmpeg -loglevel error -y -ss "$start" ${end:+-to "$end"} -i "$in" \
      -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart -an "$out.mp4"
    if [ "$(size "$out.mp4")" -gt 10000000 ]; then shrink "$out.mp4" "$out.mp4" 10000000; fi
    gif "$out.mp4" "$out.gif" 640 10
    if [ "$(size "$out.gif")" -gt 5000000 ]; then gif "$out.mp4" "$out.gif" 480 8; fi
    if [ "$(size "$out.gif")" -gt 5000000 ]; then
      echo "$out.gif is still over 5 MB; trim the clip shorter" >&2
      exit 1
    fi
    ls -l "$out.mp4" "$out.gif"
    ;;
  tiles)
    [ $# -ge 3 ] || usage
    fps=${4:-1}
    ffmpeg -loglevel error -y -i "$2" -vf "fps=$fps,scale=320:-1,drawtext=text='%{pts\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=5x6" -frames:v 1 "$3"
    echo "$3"
    ;;
  shrink)
    [ $# -ge 3 ] || usage
    shrink "$2" "$3" "${4:-10000000}"
    ls -l "$3"
    ;;
  *) usage ;;
esac
