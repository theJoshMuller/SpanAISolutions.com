#!/usr/bin/env bash
set -euo pipefail

wordmarks=(
  logo-black-text.png
  logo-email-sig.png
  logo-white-text.png
)

failed=0

for file in "${wordmarks[@]}"; do
  if ! magick "$file" txt:- | awk '
    BEGIN { bad = 0 }
    /^[0-9]/ {
      gsub(/[():,]/, " ")
      r = $3
      g = $4
      b = $5
      a = $6
      if (a > 0 && r > g + 20 && r > b + 20) {
        bad = 1
      }
    }
    END { exit bad }
  '; then
    echo "$file contains unexpected red-dominant pixels"
    failed=1
  fi
done

exit "$failed"
