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

[`--git-diff-lines`](./command-line-options.html#git-diff-lines) limits mutation testing to the lines changed by a PR or MR. With [`--git-diff-filter=AM`](./command-line-options.html#git-diff-filter), Infection mutates whole changed files.

Infection picks the comparison base automatically on GitHub Actions and GitLab CI. The examples below prepare the source checkout and fetch the history needed for the comparison. The [`--git-diff-base` reference](./command-line-options.html#git-diff-base) explains overrides, fallback behaviour, and Git diagnostic commands.

::: info Version availability
Automatic base selection is unreleased, added after Infection 0.35.10 in [#3747](https://github.com/infection/infection/pull/3747). On 0.35.10 and earlier, the examples need an explicit base: `--git-diff-base="$PR_BASE_SHA"` for GitHub or `--git-diff-base="$CI_MERGE_REQUEST_DIFF_BASE_SHA"` for GitLab.
:::

The examples assume Infection is a Composer development dependency. Dependencies and any reused coverage need to come from the same source checkout. Tests against the combined merge result can run in a separate job.

### GitHub Actions

These steps run Infection against the PR's own source commit in a `pull_request` job. Infection uses the PR's target as its base, including the immediate parent in a [stacked PR](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests).

```yaml
steps:
  - uses: actions/checkout@...
    with:
      # This checkout contains the PR's own code rather than a synthetic merge.
      ref: ${{ github.event.pull_request.head.sha }}
      persist-credentials: false

  - name: Fetch comparison history
    env:
      PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
      PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
    run: |
      # Both histories are needed to find where the PR diverged from its target.
      git fetch --no-tags --unshallow origin "$PR_HEAD_SHA" "$PR_BASE_SHA"

  # ...

  - name: Run Infection
    run: vendor/bin/infection --git-diff-lines # ...
```

If your checkout already uses `fetch-depth: 0`, the fetch step is usually unnecessary. The [`actions/checkout` documentation](https://github.com/actions/checkout#fetch-all-history-for-all-tags-and-branches) covers the available fetch options.

For a [merge queue](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group), Infection automatically selects the group's base. That job tests the queued changes together, while the `pull_request` job above tests each PR separately.

### GitLab

This example assumes the pipeline already provides PHP, Composer, Git, and a [coverage driver](./installation.html#Compatibility-Note). It checks out the MR's own source commit, including in [merged results](https://docs.gitlab.com/ci/pipelines/merged_results_pipelines/) and [merge train](https://docs.gitlab.com/ci/pipelines/merge_trains/) pipelines.

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
    #...
    - vendor/bin/infection --git-diff-lines #...
```

GitLab's [MR pipeline variables](https://docs.gitlab.com/ci/variables/predefined_variables/#predefined-variables-for-merge-request-pipelines) describe the source and base commit values. The [`--logger-gitlab` option](./command-line-options.html#logger-gitlab) can publish escaped mutants as a Code Quality report.
