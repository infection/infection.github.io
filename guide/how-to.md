---
title: How-to Guides
type: guide
order: 90
---

# How-to Guides

## How to run Infection only for changed files

When you're working on a feature branch, mutation testing can focus on the code changed by that feature. File filtering includes whole added or modified source files; line filtering narrows the selection to code spanning their changed lines.

The examples below assume the `infection` executable is [installed](/guide/installation.html), your configuration is in the project root, and you're running commands there with the feature branch checked out. The target commit and enough history to find its common ancestor with the feature branch must also be available locally.

<span class="version-since">Automatic CI base selection: available in Infection 0.35.11+</span>

<!-- Preserve links to the removed Travis example. -->
<span id="Example-for-Travis-CI"></span>

Without an explicit target, Infection uses its [default base](/guide/command-line-options.html#git-diff-base). Since [Infection 0.35.11](https://github.com/infection/infection/releases/tag/0.35.11), that comes from GitHub Actions or GitLab CI request metadata when available, including the immediate target of a stacked GitHub PR. Outside those contexts, Infection looks up the repository's default branch locally, with `origin/master` as its final fallback. An explicit option such as `--git-diff-base=origin/main` selects a different target.

`infection git:default-base` prints the default target, while `infection git:base-reference` resolves its common ancestor with `HEAD`. To fetch the required history and select the source commit for a PR or MR job, see the examples for [GitHub Actions](/guide/using-with-ci.html#GitHub-Actions) and [GitLab CI](/guide/using-with-ci.html#GitLab).

### By using `--git-diff-lines` option

Suppose the feature adds `src/Service/Mailer.php` and changes one method in `src/Service/Logger.php`, both inside your configured source directories. Line filtering includes the new mailer code and code spanning the changed lines in `Logger.php`. Unchanged methods in `Logger.php` are outside this selection:

```shell
infection --git-diff-lines
```

This can reduce the number of mutants to evaluate while you write tests for a change in a large existing file. The [`--git-diff-lines` reference](/guide/command-line-options.html#git-diff-lines) explains the comparison base.

`infection git:changed-lines` lists the source line ranges in the selection; `git:changed-files` only lists their filenames.

### By using `--git-diff-filter` option

In the same example, the `AM` filter selects both added (`A`) and modified (`M`) files:

```shell
infection --git-diff-filter=AM
```

Infection can generate mutations anywhere in those two files, subject to coverage, exclusions and the enabled mutators. Unchanged source files are outside the selection. The [`--git-diff-filter` reference](/guide/command-line-options.html#git-diff-filter) describes the other file statuses.

`infection git:changed-files` lists the source files matching the default target and the added-or-modified filter.

### By using `--filter` option (for the old Infection versions)

```shell
CHANGED_FILES=$(git diff origin/master --diff-filter=AM --name-only | grep src/ | paste -sd "," -);
INFECTION_FILTER="--filter=${CHANGED_FILES} --ignore-msi-with-no-mutations";

infection --threads=4 $INFECTION_FILTER
```

The `--diff-filter=AM` returns only added and modified files, because we are not going to use removed ones.

The [`--ignore-msi-with-no-mutations` option](/guide/command-line-options.html#ignore-msi-with-no-mutations) tells Infection to not error on min MSI when we have `0` mutations.

<p class="tip">You can check the list of changed files by using `infection git:changed-files`.</p>

## How to run Infection for functional tests

Imagine you have functional tests that do real SQL queries. Running such tests in parallel impossible without additional work, because 2 different concurrent processes will write to the same tables and conflict with each other.

To fix this issue, Infection provides `TEST_TOKEN=<int>` environment variable for each process that can be used to set up different connections to the databases.

If you have 3 parallel processes, they will use `db_1`, `db_2`, `db_3` correspondingly.

```shell
infection --threads=3
```

An example of how it can be done for Symfony project with Doctrine:

```yaml config/packages/test/doctrine.yaml
parameters:
    test_token: 1

doctrine:
    dbal:
        dbname: 'db_%env(default:test_token:TEST_TOKEN)%'
```

Or as a plain PHP code:

```php
$dbName = sprintf('db_%s', getenv('TEST_TOKEN'));
```

For this example to work, you will need to set up 3 database schemas.

## How to disable Mutators and profiles

### Disable Mutator

Mutators can be disabled in a config file - `infection.json5`. Let's say you don't want to mutate `+` to `-`. In order to disable this Mutator, the following config can be used: 

```json
{
    "mutators": {
        "@default": true,
        "Plus": false
    }
}
```

> The full list of Mutator names can be found [here](/guide/mutators.html).

In this example, we explicitly enable all Mutators from `@default` profile and disable `Plus` Mutator.

> Read about Profiles [here](/guide/profiles.html)

### Disable Profile

To disable all Mutators that work with Regular Expressions, we should disable the whole [`@regex` profile](/guide/profiles.html#regex):

```json
{
    "mutators": {
        "@default": true,
        "@regex": false
    }
}
```

### Disable in particular class or method or line

Sometimes you may want to disable Mutator or Profile just for one particular method or class. It's possible with `ignore` setting of Mutators and Profiles with the following syntax:

```json
{
    "mutators": {
        "@default": true,
        "@regex": {
            "ignore": [
                "App\\Controller\\User"
            ]
        },
        "Minus": {
            "ignore": [
                "App\\Controller\\User",
                "App\\Api\\Product::productList",
                "App\\Api\\Product::product::33"
            ]
        }
    }
}
```

Want to ignore the whole class? `App\Controller\User`

All classes in the namespace: `App\Api\*` 

All classes `Product` in any namespace: `App\*\Product`

Method of the class: `App\Api\Product::productList`

Method in all classes: `App\Api\*::productList`

Method by pattern: `App\Api\Product::pr?duc?List`

Line of the code: `App\Api\Product::product::33`


Internally, all patterns are passed to [`fnmatch()` PHP function](https://php.net/manual/en/function.fnmatch.php). Please read its documentation to better understand how it works.


### Do not mutate the source code matched by regular expression

You may want to exclude mutations to the code that, if mutated, has little-to-no impact, or, alternatively, sometimes isn't worth testing the result of - for example calls to a logging function. 

If your codebase has lots of logging, this can generate many unwanted mutants and will greatly slow down the mutation test run.

Consider these examples:

```diff
- $this->logger->error($message, /* context */ ['user' => $user]);
+ $this->logger->error($message, []);
```

```diff
- Assert::numeric($string);
```

To avoid them, you can ignore mutations by regular expression, matching the source code:

```json
{
    "mutators": {
        "global-ignoreSourceCodeByRegex": [
            "\\$this->logger.*"
        ]
    }
}
```

Or just per Mutator:

```json
{
    "mutators": {
        "MethodRemoval": {
            "ignoreSourceCodeByRegex": [
                "Assert::.*"
            ]
        }
    }
}
```

Exact matching:

```json
{
    "mutators": {
        "MethodRemoval": {
            "ignoreSourceCodeByRegex": [
                "Assert::numeric\\(\\$string\\);"
            ]
        }
    }
}
```

Ignore any mutants with particular method name, e.g.:

```diff
- public function methodCall() {
+ protected function methodCall() {
```

```diff
- $this->methodCall();
```

with the following config:

```json
{
    "mutators": {
        "global-ignoreSourceCodeByRegex": [
            ".*methodCall.*"
        ]
    }
}
```

<p class="tip">Do not add any delimiters (like `/`) to the regular expression: we are adding and escaping them for you.</p>

### Ignore specific mutators by `@infection-ignore` annotation

An `@infection-ignore` annotation lets you skip specific mutators for a class, method, or statement. For example, this skips `Plus` for one return statement:

```php
class Calculator
{
    public function add(float $a, float $b): float
    {
        // @infection-ignore Plus
        return $a + $b;
    }
}
```

Other enabled mutators can still apply. The annotation accepts several names separated by commas, such as `@infection-ignore ArrayItemRemoval, FalseValue`. Names are case-sensitive, and an annotation above a statement applies to that statement.

The [usage guide](/guide/usage.html#infection-ignore-support) explains how nested annotations work, where to put them, and what the warnings mean.

### Ignore by `@infection-ignore-all` annotation {#Disable-by-infection-ignore-all-annotation}

Use `@infection-ignore-all` before a class, method, or statement to exclude all mutations within that scope.

```php
/**
 * @infection-ignore-all
 */
class Calculator
{
    public function add(float $a, float $b): float
    {
        return $a + $b;
    }
}
```

See the [usage guide](/guide/usage.html#infection-ignore-all-support) for more examples.

## How to debug Infection

Sometimes you need to better understand what's going on during execution of Infection. 

* to use human-readable log file, use [`text`](/guide/usage.html) logger - in `infection.json5` add `logs.text` key
* information added to `text` log file is controlled by [`--log-verbosity`](/guide/command-line-options.html#log-verbosity)

When `--log-verbosity=all` is used, additionally _killed_ and _errored_ mutants will be added to the log file.

> The verbosity of the log file, `all` - this mode will add `“Killed mutants”` into log file and add additional information, `default` - normal mode will skip `“Killed mutants”` section in the log file, `none` - which will disable logging to files.

Use the following config file


```json infection.json5
{
    "logs": {"text": "infection.log"}
}
```

and execute Infection with

```shell
infection --log-verbosity=all
```

If you want to also log PHPUnit's output, as well as CLI commands that are executed internally by Infection, use [`--debug`](/guide/command-line-options.html#debug)

```shell
infection --log-verbosity=all --debug
```
