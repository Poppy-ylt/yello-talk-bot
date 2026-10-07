#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

cxx="${CXX:-g++}"
command -v "$cxx" >/dev/null 2>&1 || {
  echo "C++ compiler not found: $cxx" >&2
  exit 1
}
command -v pkg-config >/dev/null 2>&1 || {
  echo "pkg-config is required to locate libcurl" >&2
  exit 1
}
pkg-config --exists libcurl || {
  echo "libcurl development files are required (for example libcurl4-openssl-dev)" >&2
  exit 1
}

output="${1:-build/gme-music-bot-linux}"
if [[ "$output" != /* ]]; then
  output="$script_dir/$output"
fi
mkdir -p "$(dirname -- "$output")"
read -r -a curl_flags <<< "$(pkg-config --cflags --libs libcurl)"

"$cxx" -std=c++17 -O2 -pthread -rdynamic \
  main_linux.cpp -o "$output" \
  "${curl_flags[@]}" -ldl -lz -lm

echo "Built $output"
echo "Runtime GME SDK libraries must be installed separately and made available to the dynamic loader."
