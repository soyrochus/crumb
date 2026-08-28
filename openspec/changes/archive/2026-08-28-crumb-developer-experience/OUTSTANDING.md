# Outstanding after archive

Two tasks in this change could not be completed locally. They require a version
tag to be pushed to GitHub so `.github/workflows/verify.yml` actually runs, and
they were carried forward rather than marked done.

## 6.4 — Record the Linux CI job duration

The Linux job installs the GTK/WebKitGTK toolchain and compiles the pinned
native addon from source on every run. That duration is the baseline that
justifies prebuilding the addon.

**To complete:** after the first `v<major>.<minor>.<patch>` tag runs, note the
Linux job's wall-clock time and record it in the prebuilt-addon change's
proposal as the "before" figure.

## 6.5 — Confirm a failing build is caught

Verify the workflow reports failure rather than passing silently. Now cheap:
it costs a throwaway tag rather than a bad commit on a branch.

**To complete:** push a tag from a commit with a deliberate compile error,
confirm the run fails on both targets, then delete the tag.

## What was verified locally

The complete macOS command sequence was dry-run in the order the workflow runs
it — `bun install`, typecheck, test, `verify:readonly`, build starter, build
file-explorer — and every step passes. What is unverified is the workflow
*mechanism* on GitHub's runners and the Linux leg's timing, not the commands
themselves.
