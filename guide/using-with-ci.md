---
title: Using with CI
type: guide
order: 70
---

# Using with CI

## CLI options

We like the idea of using Infection together with other code quality tools in your Continuous Integration (CI) server.

For this purpose, there are two available options:

* `--min-msi`
* `--min-covered-msi`

```
Metrics:
    Mutation Score Indicator (MSI): 47%
    Mutation Code Coverage: 67%
    Covered Code MSI: 70%
```

The first option `--min-msi` allows to control your [Mutation Score Indicator](./index.html#Mutation-Score-Indicator-MSI). As soon as the actual MSI value is below than the value you provided by this option your build will fail.

Example of usage in CI server:

```shell
./infection.phar --min-msi=48 --threads=4
```

This example means that if you get MSI `47%`, the build will be failed. **This forces you to write more tests with each commit.**

The second option `--min-covered-msi` allows to control [Covered Code MSI](./index.html#Covered-Code-Mutation-Score-Indicator).

As soon as the actual Covered Code MSI value is below than the value you provided by this option your build will fail.

Example of usage in CI server:

```shell
./infection.phar --min-covered-msi=70 --threads=4
```

**This forces you to write more effective tests.**

Both these options can be used together. As soon as one of them is failed - the build will also be failed.

Example:

```shell
./infection.phar --min-msi=48 --min-covered-msi=70 --threads=4
```

<!-- Preserve links to the removed Travis example. -->
<span id="Using-with-Travis"></span>

## Mutate only the changes in a pull request or merge request

[`--git-diff-lines`](./command-line-options.html#git-diff-lines) limits mutation generation to code spanning the lines changed by a pull request (PR) or merge request (MR). For example, when a request changes one method in an existing source file, unchanged methods are outside that selection. With [`--git-diff-filter=AM`](./command-line-options.html#git-diff-filter), Infection can mutate eligible code throughout each added or modified source file instead.

The comparison needs a source checkout and a base commit. CI may check out a generated merge commit containing both the request's changes and newer target-branch changes. A GitLab merge train can also contain earlier requests in the queue. Checking out the request's own source commit keeps those other changes out of its mutation-testing run.

Infection selects the comparison base from GitHub Actions or GitLab CI metadata, but it doesn't change the checkout or fetch missing history. The examples below prepare both before installing dependencies and running Infection. The [`--git-diff-base` reference](./command-line-options.html#git-diff-base) explains default selection, explicit overrides and fallback behaviour when the common ancestor is unavailable.

::: info Version availability
Automatic CI base selection is available in Infection 0.35.11 and later. On 0.35.10 and earlier, the Infection command in these examples needs an explicit base: `--git-diff-base="$PR_BASE_SHA"` for GitHub or `--git-diff-base="$CI_MERGE_REQUEST_DIFF_BASE_SHA"` for GitLab.
:::

These configuration excerpts assume your job already provides PHP, Composer, Git and a [coverage driver](./installation.html#Compatibility-Note). Infection is a Composer development dependency, its configuration is in the project root, and `origin` must allow fetching both the request's source and base commits.

Composer installs dependencies after the source checkout so it reads that commit's `composer.lock`. Any reused coverage must also come from that source commit. A separate job can test the combined merge result without changing what this mutation-testing job selects.

### GitHub Actions

The following job excerpt belongs in a workflow triggered by `pull_request`. It checks out the source commit recorded in the event, then fetches that commit and the PR's target commit with their histories. The checkout action keeps its read-only credentials available for the fetch step, including for private repositories.

```yaml
permissions:
  contents: read
env:
  PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
  PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
    with:
      ref: ${{ github.event.pull_request.head.sha }}

  - name: Fetch comparison history
    run: |
      if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
        git fetch --no-tags --unshallow origin "$PR_HEAD_SHA" "$PR_BASE_SHA"
      else
        git fetch --no-tags origin "$PR_HEAD_SHA" "$PR_BASE_SHA"
      fi

  # Existing PHP, Composer and coverage-driver setup steps go here.

  - name: Install dependencies for the source commit
    run: composer install --no-interaction --prefer-dist

  - name: Run Infection
    run: vendor/bin/infection --git-diff-lines
```

`PR_HEAD_SHA` identifies the code to mutate. `PR_BASE_SHA` identifies the PR's target at the time of the event, from which Infection finds the common ancestor with the source commit. The fetch step removes a shallow checkout's history limit; fetching only the two commit snapshots at depth 1 would not necessarily make their common ancestor available.

For a [stacked PR](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests), the event's target is the immediate parent. If `feature/top` targets `feature/base`, Infection compares against that parent rather than the stack's final target, such as `main`. Changes inherited from `feature/base` are therefore outside the top PR's mutation selection.

With [`fetch-depth: 0`](https://github.com/actions/checkout#fetch-all-history-for-all-tags-and-branches), checkout fetches full history. The explicit fetch is unnecessary if both event commits and their common ancestry are already available; the conditional above also works when the repository is no longer shallow.

For a [merge queue](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group), Infection automatically selects the group's base. That job tests the queued changes together, while the `pull_request` job above tests each PR separately.

### GitLab

This job excerpt runs only for MR pipelines. It selects the MR's own source commit in ordinary MR pipelines, [merged results pipelines](https://docs.gitlab.com/ci/pipelines/merged_results_pipelines/) and [merge trains](https://docs.gitlab.com/ci/pipelines/merge_trains/):

```yaml
mutation-testing:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  script:
    - |
      # Ordinary MR pipelines already use the source commit as CI_COMMIT_SHA.
      MR_HEAD_SHA="${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:-$CI_COMMIT_SHA}"
    - |
      # Fetching both commits also restores history missing from shallow clones.
      if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
        git fetch --no-tags --unshallow origin "$MR_HEAD_SHA" "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
      else
        git fetch --no-tags origin "$MR_HEAD_SHA" "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
      fi
    - git checkout --detach "$MR_HEAD_SHA"
    - composer install --no-interaction --prefer-dist
    - vendor/bin/infection --git-diff-lines
```

In an ordinary MR pipeline, `CI_MERGE_REQUEST_SOURCE_BRANCH_SHA` is empty and `CI_COMMIT_SHA` already identifies the source commit. In a merged results or merge train pipeline, `CI_COMMIT_SHA` identifies the generated merge commit, so the script uses `CI_MERGE_REQUEST_SOURCE_BRANCH_SHA` instead. After the detached checkout, dependencies and coverage come from the MR's source code.

Infection reads `CI_MERGE_REQUEST_DIFF_BASE_SHA` as the comparison base. That value already identifies the common ancestor for the MR diff. Checking out the source commit excludes newer target-branch changes and earlier merge-train requests that could otherwise be present in the generated merge result.

GitLab's [MR pipeline variables](https://docs.gitlab.com/ci/variables/predefined_variables/#predefined-variables-for-merge-request-pipelines) describe these values. The [`--logger-gitlab` option](./command-line-options.html#logger-gitlab) writes escaped mutants as a Code Quality report that the job can upload as a `codequality` artifact.
