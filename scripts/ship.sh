#!/usr/bin/env bash
#
# Ship HEAD to main, with a local test run standing in for CI.
#
# The "Require smoke test" ruleset only accepts a commit on main once it has a
# passing smoke-test status. GitHub can only attach a status to a commit it
# already has, so after the tests pass this pushes the commit to a scratch
# branch, posts the status, pushes that same commit to main, and deletes the
# scratch branch. Nothing is pushed when the tests fail.
#
# Usage: bun run ship [--dry-run]
#   --dry-run  run the checks and tests, but push nothing

set -euo pipefail

readonly REMOTE=origin
readonly TARGET=main
readonly CONTEXT=smoke-test

die() {
  echo "ship: $*" >&2
  exit 1
}

dry_run=false
case ${1:-} in
  "") ;;
  --dry-run) dry_run=true ;;
  *) die "usage: bun run ship [--dry-run]" ;;
esac

cd "$(git rev-parse --show-toplevel)"
command -v n >/dev/null || die "needs n (brew install n) to test under the pinned Node"
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# --- Preflight ---

[[ $(git branch --show-current) == "$TARGET" ]] || die "not on $TARGET"
sha=$(git rev-parse HEAD)
git fetch --quiet "$REMOTE" "$TARGET"
remote_sha=$(git rev-parse "$REMOTE/$TARGET")
git merge-base --is-ancestor "$remote_sha" "$sha" \
  || die "$REMOTE/$TARGET has commits that $TARGET lacks; merge them first"
if [[ $sha == "$remote_sha" ]] && ! $dry_run; then
  die "nothing to ship: $REMOTE/$TARGET is already at ${sha:0:7}"
fi
if [[ -n $(git status --porcelain) ]]; then
  echo "ship: uncommitted changes are not tested or shipped"
fi

# --- Test the exact commit in a clean worktree ---

tmp=${TMPDIR:-/tmp}
worktree=$(mktemp -d "${tmp%/}/ship.XXXXXX")
scratch=
cleanup() {
  git worktree remove --force "$worktree" 2>/dev/null || rm -rf "$worktree"
  git worktree prune
  if [[ -n $scratch ]]; then
    git push --quiet "$REMOTE" --delete "$scratch" \
      || echo "ship: could not delete $REMOTE/$scratch; remove it by hand" >&2
  fi
}
trap cleanup EXIT

echo "ship: testing ${sha:0:7} in $worktree"
git worktree add --quiet --detach "$worktree" "$sha"

# Use the Node that the commit pins in .node-version, the same file setup-node
# and Cloudflare Pages read. Offline because n needs sudo to download, and
# its download log goes to stdout.
node_bin=$(cd "$worktree" && n --offline --quiet which auto) \
  || die "no cached Node for .node-version; run: sudo n download $(cat "$worktree/.node-version")"
PATH="${node_bin%/*}:$PATH"

(
  cd "$worktree"
  bun install
  bun run smoke-test
)

description="Local run: $(uname -s) $(uname -m), node $(node --version), bun $(bun --version)"
if $dry_run; then
  echo "ship: dry run passed; would push ${sha:0:7} to $TARGET as \"$description\""
  exit 0
fi

# --- Vouch for the commit, then ship it ---

git push --quiet "$REMOTE" "$sha:refs/heads/ci/$sha"
scratch="ci/$sha"
gh api --silent "repos/$repo/statuses/$sha" \
  -f state=success -f context="$CONTEXT" -f description="$description"
git push "$REMOTE" "$sha:refs/heads/$TARGET"
echo "ship: ${sha:0:7} is on $TARGET"
