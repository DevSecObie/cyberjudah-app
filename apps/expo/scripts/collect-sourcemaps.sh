#!/usr/bin/env bash
# Copies release bundles and their source maps into one folder for the CI artifact that the NAS
# (ask-cyberjudah-monitoring, sourcemap-sync) uploads to GlitchTip. Each map gets the debug ID from
# its bundle (stamp-sourcemap-debugid.mjs), so a crash is matched to its map without a release name.
#
# Usage: collect-sourcemaps.sh <out dir> <bundle> <map> [<bundle> <map> ...]
# The bundle keeps its file name and the map is saved beside it as <bundle name>.map. Fails if a
# file is missing, a name repeats, or a map does not belong to its bundle.
set -euo pipefail

out=${1:?out dir}
shift
(( $# > 0 && $# % 2 == 0 )) || { echo 'Give bundle and map paths in pairs' >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out"

while (( $# )); do
  bundle=$1 map=$2
  shift 2
  [[ -s $bundle ]] || { echo "Missing bundle: $bundle" >&2; exit 1; }
  [[ -s $map ]] || { echo "Missing source map: $map" >&2; exit 1; }
  name=$(basename "$bundle")
  [[ ! -e $out/$name ]] || { echo "Two bundles are named $name" >&2; exit 1; }
  cp "$bundle" "$out/$name"
  cp "$map" "$out/$name.map"
  node "$here/stamp-sourcemap-debugid.mjs" "$out/$name" "$out/$name.map"
done
ls -l "$out"
