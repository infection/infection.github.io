---
title: Mutation Badge, cloud HTML report
type: guide
order: 80
---

# Mutation Badge, cloud HTML report

We use the [Stryker Dashboard](https://dashboard.stryker-mutator.io/) to store mutation score for badges and host HTML reports in the cloud. [Stryker](https://stryker-mutator.io) is a mutation testing framework for Javascript that shares its service for other mutations frameworks.

If you can't or don't want to use a third-party service, for example in a private repository or on GitLab, Infection can also write the badge to a local file. See [SVG badge](#SVG-badge).

## How to set it up

[![Infection MSI](https://badge.stryker-mutator.io/github.com/infection/infection/master)](https://infection.github.io)

Take these steps to enable the mutation score badge / cloud HTML report on your repository:

1. Make sure you have enabled a continuous integration service for your project. 

   We use [`ondram/ci-detector`](https://github.com/OndraM/ci-detector) to detect continuous-integration services.  
   
   Feel free to request an additional integration there if the list of [currently supported continuous-integration servers](https://github.com/OndraM/ci-detector#supported-continuous-integration-servers) does not contain a service you require.

2. Go to https://dashboard.stryker-mutator.io and sign in with your GitHub account.

3. Enable a repository for which you want to create a mutation badge / cloud HTML report. Stryker Dashboard will generate a key for you automatically. 

4. Provide the API key for your project as a secret environment variable - either `INFECTION_DASHBOARD_API_KEY` or `STRYKER_DASHBOARD_API_KEY` can be used.

5. Configure the `stryker` logger in your `infection.json5` file:

    for badge

    ```json
    {
        "logs": {
            "stryker": {
                "badge": "/^release-.*$/"
            }
        }
    }
    ```

    or for HTML report to host it on Stryker Dashboard

    ```json
    {
        "logs": {
            "stryker": {
                "report": "/^release-.*$/"
            }
        }
    }
    ```

    > You can use either `badge` or `report`, but not both.
    > 
    > Using HTML report automatically enables badge on Stryker Dashboard. 

    If you provide a value that is not a regular expression starting and ending with `/`, a direct match will be performed:

    ```json
    {
        "logs": {
            "stryker": {
                "badge": "main"
            }
        }
    }
    ```

7. Force a build by running:

   ```shell
   $ git push origin main
   ```

HTML report will be available at URL: `https://badge.stryker-mutator.io/github.com/{username}/{repository_name}/{branch}`. 

For example https://dashboard.stryker-mutator.io/reports/github.com/infection/infection/master

To get the Badge image, go to Stryker Dashboard and copy the link there. Don't forget to add it to your readme file.

That's it! Hope you like it.

## SVG badge

<span class="version-since">Available in Infection 0.35.13+</span>

The Stryker Dashboard integration only works for GitHub repositories and sends your results to an external service. As an alternative, Infection can write the badge itself as an SVG file. You can then publish it from your CI, for example as a job artifact, and display it wherever you like.

Configure the `svgBadge` logger in your `infection.json5` file:

```json
{
    "logs": {
        "svgBadge": "build/infection/mutation-badge.svg"
    }
}
```

Like other logs, the path is relative to the configuration file.

The badge shows the Mutation Score Indicator (MSI), rounded down like in the console output, e.g. `mutation score | 87%`. Its color uses the same thresholds as the MSI printed in the console:

| MSI | Color |
| --- | --- |
| below 50% | red |
| from 50% to below 90% | yellow |
| 90% and above | green |

### Usage with GitLab

Keep the badge as an artifact of the job that runs Infection, in `.gitlab-ci.yml`:

```yaml
infection:
  script:
    - vendor/bin/infection --threads=max
  artifacts:
    paths:
      - build/infection/mutation-badge.svg
```

Then add a badge to your project in GitLab under *Settings > General > Badges*, using the latest artifact of the default branch as the badge image URL:

```
https://gitlab.com/%{project_path}/-/jobs/artifacts/%{default_branch}/raw/build/infection/mutation-badge.svg?job=infection
```

Replace `gitlab.com` with your GitLab host if you use a self-managed instance.
