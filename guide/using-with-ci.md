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

## Mutate only the changes in a pull request or merge request

Use [`--git-diff-lines`](./command-line-options.html#git-diff-lines) to mutate added and modified lines, or [`--git-diff-filter=AM`](./command-line-options.html#git-diff-filter) to mutate whole added and modified files. In both cases, pass the comparison base explicitly with [`--git-diff-base`](./command-line-options.html#git-diff-base). Infection otherwise uses the repository's remote default branch, with an `origin/master` fallback; it does not detect the PR or MR target.

Two choices determine the scope: the source commit checked out for the job, and the reference supplied as the comparison base. Fetch both commits and enough history to find their merge base. A shallow checkout containing only their tips may hide that ancestor and cause Infection to fall back to a direct diff.

The examples below test the request's own source commit. Keep your normal tests against merged results or merge train commits in separate jobs to check that the combined changes work together. Install dependencies and generate any reused coverage after selecting the source commit; coverage from a synthetic merge checkout may describe different code.

### GitHub Actions

For a `pull_request` event, [`actions/checkout` checks out a synthetic merge commit by default](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request). To restrict mutation testing to the PR's own changes, check out `github.event.pull_request.head.sha` and use `github.event.pull_request.base.sha` as the comparison base. This works for default and non-default targets, including the immediate target of a stacked PR.

For [native GitHub stacks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests), Actions evaluates each PR against the stack's final base. `GITHUB_BASE_REF` therefore identifies that final base, so using it can include changes from earlier PRs. The event payload's `pull_request.base` identifies the current PR's immediate target.

This example assumes Infection is installed as a Composer development dependency and the project's tests are configured. Adjust the PHP version to one supported by your project.

```yaml
name: Mutation testing

on:
  pull_request:

permissions:
  contents: read

jobs:
  mutation-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 1
          persist-credentials: false

      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          coverage: pcov
          tools: composer

      - run: composer install --no-interaction --prefer-dist --no-progress

      - name: Run Infection for the PR's changed lines
        env:
          PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: |
          git fetch --no-tags --unshallow origin \
            "$PR_HEAD_SHA" \
            "$PR_BASE_SHA"
          vendor/bin/infection \
            --git-diff-lines \
            --git-diff-base="$PR_BASE_SHA" \
            --min-msi=100 \
            --ignore-msi-with-no-mutations
```

Checkout initially fetches just the PR head. The explicit fetch obtains the histories of the two comparison commits without tags. `--unshallow` is used because this example sets `fetch-depth: 1`; omit it if the checkout already contains full history. Alternatively, `fetch-depth: 0` fetches all history for all branches and tags, so a separate fetch is normally unnecessary. Fetch depth controls the available history, not which commit is checked out.

### GitLab

GitLab has three kinds of merge request pipeline. Their checkouts have different scopes:

| `CI_MERGE_REQUEST_EVENT_TYPE` | Default checkout | Source commit to use for this job |
| --- | --- | --- |
| `detached` | The MR's source commit | `CI_COMMIT_SHA` |
| `merged_result` | A temporary merge of the source and target branches | `CI_MERGE_REQUEST_SOURCE_BRANCH_SHA` |
| `merge_train` | A temporary merge including the target branch and earlier MRs in the train | `CI_MERGE_REQUEST_SOURCE_BRANCH_SHA` |

See GitLab's documentation for [merge request pipelines](https://docs.gitlab.com/ci/pipelines/merge_request_pipelines/), [merged results pipelines](https://docs.gitlab.com/ci/pipelines/merged_results_pipelines/), and [merge trains](https://docs.gitlab.com/ci/pipelines/merge_trains/). In a merge train, diffing the default checkout against the target branch can include changes from earlier MRs in the train.

Use `CI_MERGE_REQUEST_DIFF_BASE_SHA`, the base of the MR's own diff, as `--git-diff-base` in all three cases. This also handles MRs targeting a non-default branch. `CI_MERGE_REQUEST_SOURCE_BRANCH_SHA` is empty in ordinary detached MR pipelines, so use `CI_COMMIT_SHA` there. In merged results and merge train pipelines, `CI_COMMIT_SHA` identifies the temporary combined commit; do not use it as the MR's source head. These variables are described in GitLab's [predefined variables reference](https://docs.gitlab.com/ci/variables/predefined_variables/#predefined-variables-for-merge-request-pipelines).

Add the following job to a PHP pipeline whose runner already provides Git, Composer, PHP, and a coverage driver such as PCOV or Xdebug. It assumes Infection is a Composer development dependency. The job runs only for merge request events, including merged results and merge trains:

```yaml
mutation-testing:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  script:
    - |
      if [ "$CI_MERGE_REQUEST_EVENT_TYPE" = "detached" ]; then
        MR_HEAD_SHA="$CI_COMMIT_SHA"
      else
        MR_HEAD_SHA="${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:?MR source SHA is required}"
      fi
      MR_BASE_SHA="${CI_MERGE_REQUEST_DIFF_BASE_SHA:?MR diff base SHA is required}"

      if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
        git fetch --no-tags --unshallow origin "$MR_HEAD_SHA" "$MR_BASE_SHA"
      else
        git fetch --no-tags origin "$MR_HEAD_SHA" "$MR_BASE_SHA"
      fi
      git checkout --detach "$MR_HEAD_SHA"

      composer install --no-interaction --prefer-dist --no-progress
      vendor/bin/infection \
        --git-diff-lines \
        --git-diff-base="$MR_BASE_SHA" \
        --min-msi=100 \
        --ignore-msi-with-no-mutations
```

The fetch handles shallow and full-history working copies, including working copies reused by a runner. Checking out the recorded source SHA before installing dependencies or collecting coverage keeps this job on the MR's own code, even when the pipeline initially checked out a merged result or merge train commit. The example uses the MR's recorded commits and diff base, so it does not depend on the checkout being attached to a branch or on `origin`'s default branch matching the MR target.

To publish escaped mutants as a GitLab Code Quality report, add [`--logger-gitlab`](./command-line-options.html#logger-gitlab) and configure the report artifact in your pipeline.

## Using with Travis

The simplest `.travis.yml` config to integrate Infection with Travis is:

``` yml
before_script:
    - wget https://github.com/infection/infection/releases/download/0.32.0/infection.phar
    - wget https://github.com/infection/infection/releases/download/0.32.0/infection.phar.asc
    - gpg --recv-keys C6D76C329EBADE2FB9C458CFC5095986493B4AA0
    - gpg --with-fingerprint --verify infection.phar.asc infection.phar
    - chmod +x infection.phar

script:
    - ./infection.phar --min-msi=48 --threads=4
```

This example mutates the full codebase and does not need a comparison base. For a PR-only job, Travis identifies the target branch with `TRAVIS_BRANCH` and the source head with `TRAVIS_PULL_REQUEST_SHA`. Fetch the target branch and enough history to find its merge base with the source head, check out the source head, and pass the fetched target explicitly as `--git-diff-base`. Restrict that setup to PR builds; a branch build does not have the same PR metadata. See Travis's [environment variable reference](https://docs.travis-ci.com/user/environment-variables/).

> [Read more](./mutation-badge.html) about how to add a Mutation Badge to your Github Project

[![Infection MSI](https://badge.stryker-mutator.io/github.com/infection/infection/master)](https://infection.github.io)
