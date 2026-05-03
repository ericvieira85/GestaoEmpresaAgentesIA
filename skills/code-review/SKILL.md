---
name: code-review
description: >
  Automated pull request code review using 5 parallel specialized agents.
  Use when a PR is created or when explicitly asked to review a pull request.
  Filters false positives with confidence scoring — only posts issues with score ≥ 80.
---

# Code Review Skill

Use this skill after creating a pull request, or when asked to review one.

## When to invoke

- You just created a PR and want to verify it before requesting approval
- You are explicitly asked to review a pull request
- A team member requests a code review on a PR

## Workflow

### 1. Eligibility check

Use a subagent to verify the PR is eligible for review. Skip if any of the following:
- PR is closed or draft
- PR is automated or trivially simple
- You already posted a code review on this PR in a previous run

```sh
gh pr view <pr-number-or-current-branch> --json state,isDraft,author,title
```

### 2. Gather context

In parallel:

**a. CLAUDE.md files** — list paths (not contents) of relevant CLAUDE.md files:
- root `CLAUDE.md`
- any `CLAUDE.md` in directories touched by the PR

**b. PR summary** — use a subagent to view the PR and return a concise summary of the change:

```sh
gh pr view <pr> --json title,body,files
gh pr diff <pr>
```

### 3. Launch 5 parallel review agents

Each agent reviews independently and returns a list of issues with the reason each was flagged:

- **Agent 1 — CLAUDE.md compliance**: Audit changes against all relevant CLAUDE.md files. Note: CLAUDE.md guides Claude while writing code, so not all instructions apply to code review.
- **Agent 2 — Bug scan**: Read file changes only. Shallow scan for obvious bugs. Focus on large bugs; ignore nitpicks and likely false positives. Do not read extra context beyond the diff.
- **Agent 3 — Git history context**: Read `git blame` and history of modified code to identify bugs in light of historical context.
- **Agent 4 — Previous PR comments**: Read previous PRs that touched these files. Check if any past review comments also apply to the current change.
- **Agent 5 — Code comment compliance**: Read code comments in modified files. Verify the changes comply with any guidance expressed in those comments.

### 4. Confidence scoring

For each issue found in step 3, launch a parallel subagent that scores it 0–100:

| Score | Meaning |
|-------|---------|
| 0 | False positive — does not stand up to light scrutiny, or is pre-existing |
| 25 | Uncertain — might be real, unable to verify, or stylistic issue not in CLAUDE.md |
| 50 | Moderate — verifiable but minor, nitpick, or rarely happens in practice |
| 75 | High confidence — double-checked, very likely real, will be hit in practice, or directly mentioned in CLAUDE.md |
| 100 | Certain — confirmed real, will happen frequently, evidence directly confirms it |

The agent must:
- For CLAUDE.md issues: verify the CLAUDE.md actually calls out that specific issue
- Double-check the issue exists in the current PR (not pre-existing)

### 5. Filter

Discard all issues with score < 80. If none remain, skip to step 7 (no-issues comment).

### 6. Final eligibility re-check

Repeat the check from step 1 to confirm the PR is still open and eligible before posting.

### 7. Post review comment

```sh
gh pr comment <pr> --body "<review>"
```

**Format when issues found:**

```
### Code review

Found N issues:

1. <brief description> (CLAUDE.md says "<exact quote>")

https://github.com/<owner>/<repo>/blob/<full-sha>/<file>#L<start>-L<end>

2. <brief description> (bug due to <file and code snippet>)

https://github.com/<owner>/<repo>/blob/<full-sha>/<file>#L<start>-L<end>
```

**Format when no issues found:**

```
### Code review

No issues found. Checked for bugs and CLAUDE.md compliance.
```

Both formats must end with:
```
🤖 Generated with [Claude Code](https://claude.ai/code)
```

## Rules for linking code

- Always use full git SHA (not HEAD or branch name)
- Format: `https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<start>-L<end>`
- Include at least 1 line of context before and after the flagged line
- Repo name must match the repo being reviewed

## False positives to ignore

- Pre-existing issues not introduced by this PR
- Things that look like bugs but are not
- Pedantic nitpicks a senior engineer would not raise
- Issues a linter, typechecker, or CI would catch (assume CI runs separately)
- General code quality concerns (test coverage, documentation) unless CLAUDE.md requires them
- CLAUDE.md issues that are explicitly silenced in code (e.g. lint-ignore comments)
- Intentional behavior changes directly related to the PR's stated purpose
- Real issues on lines the PR did not modify

## Notes

- Use `gh` CLI for all GitHub interactions — do not use web fetch
- Do not build, typecheck, or run tests — CI handles this
- Keep the final comment brief
- Cite and link every issue (file, line, CLAUDE.md quote)
- Make a todo list before starting
