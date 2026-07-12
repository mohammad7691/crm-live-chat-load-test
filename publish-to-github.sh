#!/bin/bash
# One-time script to publish this repo to GitHub.
# Prerequisites: GitHub account, git installed.
set -euo pipefail

REPO_NAME="${1:-crm-live-chat-load-test}"
VISIBILITY="${2:-public}"   # public or private

cd "$(dirname "$0")"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Run from a git-initialized folder. Already done if you see this after setup."
  exit 1
fi

echo "Publishing to GitHub as: $REPO_NAME ($VISIBILITY)"
echo ""
echo "Step 1: Create a new repo at https://github.com/new"
echo "        Name: $REPO_NAME"
echo "        Do NOT add README, .gitignore, or license (we already have them)"
echo ""
read -r -p "Press Enter after you created the empty repo on GitHub..."

read -r -p "Your GitHub username: " GH_USER

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/${GH_USER}/${REPO_NAME}.git"
else
  git remote add origin "https://github.com/${GH_USER}/${REPO_NAME}.git"
fi

git branch -M main
echo ""
echo "Pushing to GitHub (browser login may open)..."
git push -u origin main

echo ""
echo "Done! Your repo: https://github.com/${GH_USER}/${REPO_NAME}"
