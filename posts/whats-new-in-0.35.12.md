---
layout: post
title: What's new in Infection 0.35.12
date: 2026-11-17 08:52:12
---

# What's new in Infection 0.35.12

[Infection 0.35.12](https://github.com/infection/infection/releases/tag/0.35.12) lets you focus mutation testing on a class, namespace or method without looking up its file path. It also adds tools to discover selector names and preview which code a selector includes.

## Select the code you're working on

Suppose you're changing `send()` in `App\Service\Mailer`. Your `infection.json5` is in the project root, `source.directories` includes `src/`, and the project contains these files:

```text
src/
    Service/
        Mailer.php  # App\Service\Mailer, with send() and preview()
    Legacy/
        Mailer.php  # App\Legacy\Mailer, with send()
tests/
    Unit/
        Service/
            MailerTest.php
```

With the [installed](/guide/installation.html) `infection` command available, this command from the project root selects the service class's `send()` method:

```shell
infection 'App\Service\Mailer::send'
```

Infection generates mutations only within that method, subject to the usual coverage, exclusions and enabled mutators. `App\Service\Mailer::preview()` and `App\Legacy\Mailer::send()` are outside this selection. The single quotes preserve backslashes in the shell.

The short class name selects `send()` in both `Mailer` classes, while a namespace selector includes all classes under `App\Service`:

```shell
infection Mailer::send
infection 'App\Service\'
```

The first command includes both `send()` methods and leaves out `preview()`. The second includes the whole service `Mailer`, including `preview()`, and any classes in nested namespaces such as `App\Service\Delivery`. Class and method names match exactly, ignoring case; wildcards and regular expressions aren't supported.

When `tests/Unit/Service/MailerTest.php` covers the service class, a source directory and a test path narrow both parts of the run:

```shell
infection src/Service/ Mailer::send tests/Unit/Service/MailerTest.php
```

This runs `MailerTest.php` initially and mutates `send()` methods in classes named `Mailer` within `src/Service/`. The legacy class is outside that directory. Without a test path or other test-framework options, selecting a symbol leaves the initial test suite unchanged. Several selectors include code matching any of them within the same source file filters.

If the expression you're investigating is on line 32 of `src/Service/Mailer.php`, inside `send()`, a line suffix narrows the selection further:

```shell
infection 'App\Service\Mailer::send::32'
```

Line numbers start at 1 in each source file. A selector includes syntax nodes whose source range spans that line, so a multiline call starting before line 32 can still produce a mutation reported on its starting line.

## Discover names and preview a selection

`debug:list-symbols` lists the names Infection tracks in a PHP file, in declaration order. With `send()` declared before `preview()` in the service class above, the sample output is:

```console
$ infection debug:list-symbols src/Service/Mailer.php
App\Service\Mailer
App\Service\Mailer::send
App\Service\Mailer::preview
```

The file is parsed without executing it or autoloading its declarations. Each listed name in this example identifies a class or method that can be passed as a selector.

To see which syntax nodes remain eligible for mutation, pass a selector after the file path to `debug:dump-ast`:

```shell
infection debug:dump-ast src/Service/Mailer.php 'App\Service\Mailer::send::32'
```

Selectors automatically enable attributes and line numbers in the dump. `eligible: true` identifies nodes that remain eligible for mutation, and `startLine` and `endLine` show their source ranges. This preview doesn't run tests or establish which mutations they will detect.

See the [source symbol selector reference](/guide/arguments.html#Source-symbol-selectors) for more examples, including nested classes and combining selectors.

### Reuse arguments with diagnostic commands

You can reuse a mutation run's arguments with `config:list-sources` and `initial-test:run`:

```shell
infection config:list-sources src/Service/ Mailer::send
infection initial-test:run Mailer::send tests/Unit/Service/MailerTest.php
```

The first command lists files under `src/Service/`; the second runs `MailerTest.php`. Both accept the selector alongside source file filters or positional test paths, but the selector doesn't narrow their results: it only affects mutation generation.

A standalone selector such as `Mailer::send` is rejected by these two commands because it would have no effect. Supplying test-framework extra options, on the command line or in configuration, doesn't make it valid. The `debug:dump-ast` preview shows which code a selector includes.

## Compatibility changes to source filtering

### Bare names also constrain class names

A bare name such as `Differ` can now select fewer classes. Consider this project, with `src/` configured as a source directory:

```text
src/
    Differ/
        Differ.php  # declares App\Differ\Differ
        Helper.php  # declares App\Differ\Helper
```

From the project root, you run:

```shell
infection Differ
```

Here, `Differ` doesn't point to a readable file or directory: the directory is `src/Differ/`.

Before 0.35.12, both files were selected because their paths contain `Differ`. In 0.35.12, the paths still match, but only classes named `Differ` within those files are selected for mutation. This includes `App\Differ\Differ` and leaves out `App\Differ\Helper`.

A trailing slash makes this a directory filter without the class-name constraint, selecting both files again:

```shell
infection Differ/
```

Readable files and directories still take precedence over symbol selection. A qualified class name such as `'App\Differ\Differ'` selects that class across configured source files without adding a path-substring filter.

### Normalization of deprecated `--filter` values

For existing commands containing the deprecated `--filter` option, Infection now trims whitespace around each comma-separated value, discards blank entries and removes duplicates. An entirely blank filter applies no file restriction. The value `0` is retained: `--filter=0` selects paths containing `0`, such as `src/Version0/Parser.php`, instead of all configured sources.

[Positional arguments](/guide/arguments.html) have replaced this option since Infection 0.34. In the mailer example at the start of this post, a filename fragment selects both the service and legacy mailer files:

```shell
infection Mailer.php
```

## Fixes

### Coverage with a separate PHPUnit configuration directory

If you keep your PHPUnit configuration in a separate directory, Infection could fail to collect coverage even when the initial tests passed. For example:

```text
project/
    infection.json
    src/
    build/
        phpunit.xml
```

In this layout, `infection.json` contains the following source and PHPUnit configuration (other settings omitted), and `build/phpunit.xml` defines the tests without a source include filter:

```json
{
    "source": {
        "directories": ["src"]
    },
    "phpUnit": {
        "configDir": "build"
    }
}
```

When PHPUnit has no source include filter, Infection creates one from `source.directories`. Previously, the relative path `src` in that generated filter was resolved against the PHPUnit configuration directory, producing `project/build/src`. PHPUnit couldn't collect coverage for the intended sources, so Infection aborted.

In 0.35.12, these paths are resolved against the Infection configuration directory. In this example, the generated filter points to `project/src`, so coverage collection works with `build/phpunit.xml` without having to replace `src` with an absolute path in `infection.json`.

### Accurate mutation scores with PHPUnit's development configuration warnings

PHPUnit 13.3 introduced the XML setting `warnWhenPhpIsNotConfiguredForDevelopment`. When enabled, it checks PHP settings against its development recommendations, including `memory_limit=-1`.

Infection can impose a memory limit on mutant processes even when the initial test run has no limit. Previously, the initial run could pass, but every mutant process would then trigger PHPUnit's warning about that memory limit. PHPUnit stopped before executing any tests, and Infection counted the nonzero exit status as a killed mutant. This could produce a misleading MSI of 100%, regardless of whether the tests detected the mutations.

Infection now disables this check for mutant processes by removing the XML setting from their generated configuration and filtering out the explicit `--warn-when-php-is-not-configured-for-development` flag from test-framework options. The initial test run preserves both, so PHPUnit still checks your own PHP configuration there when you enable the check.

### Clearer errors for invalid positional arguments

A missing path such as `src/DefinitelyDoesNotExist.php` previously produced a misleading hint that multiple paths must be passed as separate arguments, even when you had supplied only one.

For that missing path, the error now names the invalid argument and lists the accepted forms:

```text
Invalid positional argument "src/DefinitelyDoesNotExist.php": expected a readable file or directory, a source path filter or a source symbol selector.
```

This distinguishes a missing file path from a filename fragment such as `Mailer.php` or a symbol selector such as `Mailer::send`, which can match source code without resolving to a file at that exact path.

The [full changelog](https://github.com/infection/infection/compare/0.35.11...0.35.12) includes the related internal changes and dependency updates.
