#!/bin/bash
# Builds "Googly Heist.app": the whole game packed inside a native Mac window.
# Solo needs no internet; online play uses the Render server (GH_URL or the in-app menu changes it).
# The icon comes from mac/icon-1024.png (drawn by the game itself: open the page with ?icon=1).
set -euo pipefail
cd "$(dirname "$0")"
APP="../Googly Heist.app"
BIN="$APP/Contents/MacOS/GooglyHeist"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web/three/addons/environments" "$APP/Contents/Resources/web/three/addons/utils"
swiftc -O -target "$(uname -m)-apple-macos13.0" main.swift -o "$BIN" -framework Cocoa -framework WebKit 2>&1 | grep -v warning || true
[ -f "$BIN" ] || { echo "Build failed"; exit 1; }
cp Info.plist "$APP/Contents/Info.plist"
# the game itself + three.js
cp -R ../web/public "$APP/Contents/Resources/web/public"
[ -d ../web/node_modules/three ] || (cd ../web && npm install --silent)
cp ../web/node_modules/three/build/three.module.js "$APP/Contents/Resources/web/three/"
cp ../web/node_modules/three/examples/jsm/environments/RoomEnvironment.js "$APP/Contents/Resources/web/three/addons/environments/"
cp ../web/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js "$APP/Contents/Resources/web/three/addons/utils/"
if [ -f icon-1024.png ]; then
  SET="$(mktemp -d)/AppIcon.iconset"; mkdir -p "$SET"
  for s in 16 32 128 256 512; do
    sips -z $s $s icon-1024.png --out "$SET/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) icon-1024.png --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$SET" -o "$APP/Contents/Resources/AppIcon.icns"
fi
codesign --force --deep -s - "$APP" >/dev/null 2>&1
touch "$APP"
echo "Built $(cd .. && pwd)/Googly Heist.app"
