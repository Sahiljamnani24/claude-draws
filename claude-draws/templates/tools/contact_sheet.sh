#!/bin/sh
# Make one contact sheet (a grid of frames) from a rendered video, to look at it all at once.
#   sh tools/contact_sheet.sh renders/film.mp4 renders/film_sheet.jpg [frames=6] [columns=3]
# Frames are spread evenly over the video. Needs ffmpeg and ffprobe.
set -e
V="$1"
OUT="${2:-sheet.jpg}"
N="${3:-6}"
COLS="${4:-3}"
if [ -z "$V" ] || [ ! -f "$V" ]; then
  echo "usage: sh tools/contact_sheet.sh video.mp4 out.jpg [frames] [columns]"
  exit 1
fi
FRAMES=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$V")
ROWS=$(( (N + COLS - 1) / COLS ))
# pick N frame numbers spread over the clip (skip the very first and last frame)
SEL=""
i=0
while [ $i -lt "$N" ]; do
  F=$(( (FRAMES - 2) * (2 * i + 1) / (2 * N) + 1 ))
  SEL="${SEL}${SEL:+\+}eq(n\,$F)"
  i=$((i + 1))
done
ffmpeg -hide_banner -loglevel error -y -i "$V" \
  -vf "select='$SEL',scale=540:-2,tile=${COLS}x${ROWS}:padding=8:color=0x1a1a1a" \
  -frames:v 1 -q:v 3 "$OUT"
echo "wrote $OUT ($N frames from $FRAMES)"
