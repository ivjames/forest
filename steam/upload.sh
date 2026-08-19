#!/usr/bin/env bash
# Package the desktop builds and push them to Steam.
#
# Prereqs (one-time):
#   - steamcmd installed: https://developer.valvesoftware.com/wiki/SteamCMD
#   - IDs filled into app_build.vdf (app id + three depot ids from Steamworks)
#   - your Steamworks account has the "Edit App Metadata" + "Publish" permissions
#
# Usage:
#   ./upload.sh <steam_account>
# steamcmd prompts for password + Steam Guard on first login, then caches a
# session token so later runs are non-interactive.
set -euo pipefail
cd "$(dirname "$0")"

ACCOUNT="${1:?usage: ./upload.sh <steam_account>}"

if grep -q YOUR_APP_ID app_build.vdf; then
  echo "error: fill in the app/depot ids in steam/app_build.vdf first" >&2
  exit 1
fi

echo "==> packaging desktop builds (win / linux / mac)"
( cd ../desktop && npm install && npm run package:all )

echo "==> uploading via SteamPipe"
steamcmd +login "$ACCOUNT" +run_app_build "$(pwd)/app_build.vdf" +quit

echo "==> done. Promote the build: Steamworks -> SteamPipe -> Builds"
