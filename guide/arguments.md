---
title: Command Line Arguments
type: guide
order: 39
is_new: true
---

# Command Line Arguments

Infection accepts file paths and symbol names after the command name, without an option such as `--filter`. These *positional arguments* select the source code to mutate, the tests to run, or both, without changing `infection.json5`.

Source and test paths are supported from Infection 0.34. Source symbol selectors require Infection 0.35.12 or later.

The examples below assume the `infection` command is [installed](/guide/installation.html), `infection.json5` is in the project root, and `source.directories` includes `src/`. The `tests/` directory is outside those source directories. Commands run from the project root; arguments containing backslashes are single-quoted so the shell preserves them.

## Source paths

An existing, readable file or directory inside a configured source directory selects source code. Suppose you're working on `src/Service/Mailer.php`. Passing that file limits mutation generation to it:

```shell
infection src/Service/Mailer.php
```

Passing its directory includes the other source files under that directory too:

```shell
infection src/Service/
```

These arguments narrow which files Infection considers. Coverage, exclusions and the enabled mutators still determine which code in those files produces mutations.

Several source paths include files matching any of them. For example, this command includes both the service directory and one entity file:

```shell
infection src/Service/ src/Entity/Foobar.php
```

Source paths leave the initial test selection unchanged. Infection still runs the configured test suite unless you also supply test paths or test-framework options that narrow it.

`infection config:list-sources src/Service/` lists the source files matching that directory. It lists whole files; [symbol selectors](#Source-symbol-selectors) narrow mutation generation within them rather than the file list.

## Test paths

An existing, readable path outside the configured source directories selects tests. With the configuration above, `tests/Unit/Service/MailerTest.php` is a test path because it is outside `src/`; the name `tests/` itself has no special meaning.

Passing a test directory limits the initial run to tests under it:

```shell
infection tests/Unit/Service/
```

For PHPUnit, Infection passes that directory to PHPUnit, as in `phpunit tests/Unit/Service/`. The coverage collected comes from those tests. A test path does not add a source file filter; an explicit source path can narrow mutation generation further.

Test files and directories can be combined when the initial run needs more than one set of tests:

```shell
infection tests/Unit/Service/ tests/Integration/Service/MailerTest.php
```

## Best for performance

When you're working on one class and know which tests cover it, combining the source and test paths narrows both mutation generation and the initial test run:

```shell
infection src/Service/Mailer.php tests/Unit/Service/MailerTest.php
```

Infection runs `MailerTest.php` initially and generates mutations only in `src/Service/Mailer.php`. This avoids running the full test suite to collect coverage for a change confined to that file.

If PHPUnit's coverage metadata restricts `MailerTest.php` to `Mailer`, for example with `#[CoversClass(Mailer::class)]`, the test path alone can give the same covered source scope:

```shell
infection tests/Unit/Service/MailerTest.php
```

The explicit source path remains useful when the selected tests cover several source files and only one should be mutated.

## Partial name matching

When a filename such as `Mailer.php` doesn't resolve to a readable path, Infection treats it as a path fragment. It searches the configured source files for paths containing that string:

```shell
infection Mailer.php
```

This can match both `src/Service/Mailer.php` and `src/Legacy/Mailer.php`. A match depends on the path, so it doesn't require a class named `Mailer` inside the file.

A bare name such as `Mailer`, without `.php`, also adds a class-name constraint when it doesn't resolve to a readable path. The [path-or-class example](#When-a-name-could-mean-a-path-or-a-class) below explains how this differs from a filename fragment.

## Source symbol selectors

<span class="version-since">Available in Infection 0.35.12+</span>

A *source symbol selector* identifies code by a declared class or method name instead of its file path. A namespace prefix selects classes under that namespace. These selectors narrow mutation generation inside the selected source files; they don't change which tests run initially.

The forms below can also include a source line number. For example, `Mailer::send::32` selects code spanning line 32 inside `send()` methods of classes named `Mailer`:

| Selector | Mutation scope |
| --- | --- |
| `Mailer` | Classes named `Mailer` in files whose paths contain `Mailer` |
| `Mailer::send` | `send()` methods in classes named `Mailer`, across configured source files |
| `Mailer::32` | Syntax nodes spanning source line 32 in classes named `Mailer` |
| `Mailer::send::32` | Syntax nodes spanning line 32 within those `send()` methods |
| `'App\Service\Mailer'` | The class `App\Service\Mailer` |
| `'App\Service\Mailer::send'` | The `send()` method in that qualified class |
| `'App\Service\'` | Classes under `App\Service`, including nested namespaces |
| `'\Mailer'` | Only the global class `Mailer` |

### Selecting classes and methods

Suppose the project's configured `src/` directory contains these files. The comments name the classes declared in each file. Each `Mailer` class has `send()` and `preview()` methods; `MailerHelper` also has a `send()` method.

```text
src/
    Service/
        Mailer.php        # App\Service\Mailer
        MailerHelper.php  # App\Service\MailerHelper
        Transport.php     # App\Service\Delivery\Mailer
    Legacy/
        Mailer.php        # App\Legacy\Mailer
    Global.php            # Mailer (global namespace)
```

The selector `Mailer::send` combines the short class name `Mailer` with the method name `send`. In this source tree, it selects `send()` in all four `Mailer` classes, including those whose filenames don't contain `Mailer`:

```shell
infection Mailer::send
```

The `preview()` methods and `MailerHelper::send()` are left out. Class and method names match exactly, ignoring case, so `mailer::SEND` gives the same result.

When you only want the service class, its qualified name makes that distinction:

```shell
infection 'App\Service\Mailer::send'
```

This selects only `send()` in `src/Service/Mailer.php`. Without `::send`, the whole `App\Service\Mailer` class is selected, including `preview()`.

The same source tree also illustrates how a class name, a filename and a namespace can select different code:

| Command | Selected code in this example |
| --- | --- |
| `infection Mailer` | The `Mailer` classes in `Service/Mailer.php` and `Legacy/Mailer.php`; the other two `Mailer` classes have no `Mailer` in their paths |
| `infection Mailer.php` | All eligible code in `Service/Mailer.php` and `Legacy/Mailer.php`, regardless of class name |
| `infection src/Service/` | All eligible code in the three files under `Service/` |
| `infection 'App\Service\'` | The `App\Service\Mailer`, `App\Service\MailerHelper` and `App\Service\Delivery\Mailer` classes |
| `infection '\Mailer'` | Only the global `Mailer` in `Global.php` |

A namespace selector ends with a backslash and includes nested namespaces. In the table above, `'App\Service\'` includes `App\Service\Delivery\Mailer` from `Transport.php`, even though its filename doesn't contain `Mailer`. Classes in `App\ServiceTools` or `Other\App\Service` are outside this namespace prefix.

Names in selectors are literal; glob wildcards and regular expressions aren't supported. A trailing backslash is the only form of prefix matching.
Infection still looks within your configured source directories and respects their exclusions.

### When a name could mean a path or a class

A bare name like `Differ` could refer to a directory, part of a filename or a class. If it doesn't point to a readable file or directory, Infection requires both a matching file path and a matching short class name.

For example, suppose the project has this source tree. With `infection.json5` in the project root, the directory's relative path is `src/Differ/`, so the argument `Differ` doesn't resolve to that directory:

```text
src/
    Differ/
        Differ.php           # App\Differ\Differ
        Helper.php           # App\Differ\Helper
    Other/
        ColorizedDiffer.php  # Differ\ColorizedDiffer
        Namespaced.php       # App\Other\Differ
        Global.php           # Differ (global namespace)
```

With this command:

```shell
infection Differ
```

The path filter finds `Differ.php`, `Helper.php` and `ColorizedDiffer.php`, since all three paths contain `Differ`. Within those files, only classes whose short name is exactly `Differ` are selected for mutation:

| File | Selected for mutation | Why |
| --- | --- | --- |
| `src/Differ/Differ.php` | Yes | The path contains `Differ` and the class is named `Differ` |
| `src/Differ/Helper.php` | No | The class is named `Helper` |
| `src/Other/ColorizedDiffer.php` | No | The class is named `ColorizedDiffer` |
| `src/Other/Namespaced.php` | No | The path doesn't contain `Differ` |
| `src/Other/Global.php` | No | The path doesn't contain `Differ` |

::: warning Behavior before Infection 0.35.12
Before Infection 0.35.12, `infection Differ` only applied the path filter. In this example, `Helper.php` and `ColorizedDiffer.php` could also produce mutations even though their classes aren't named `Differ`.
:::

Adding a slash or a backslash makes the intended scope explicit:

| Command | Selected code in this example |
| --- | --- |
| `infection Differ/` | Both classes under `src/Differ/`, including `Helper` |
| `infection 'Differ\'` | `Differ\ColorizedDiffer` in `src/Other/ColorizedDiffer.php`; nested namespaces under `Differ` would also be included |
| `infection '\Differ'` | Only the global class `Differ` in `src/Other/Global.php` |

Readable paths still take precedence. If the argument `Differ` resolves to a readable source directory, `infection Differ` selects that directory's files without adding a class-name filter. A qualified class name, such as `'App\Differ\Differ'`, can help when you meant the class instead.

### Finding selector names

`debug:list-symbols` shows the class and method names Infection tracks in a PHP file. For `src/Service/Mailer.php` in the example above, with `send()` declared before `preview()`, the sample output is:

```console
$ infection debug:list-symbols src/Service/Mailer.php
App\Service\Mailer
App\Service\Mailer::send
App\Service\Mailer::preview
```

Each name can be copied into a selector:

```shell
infection 'App\Service\Mailer::send'
```

The command lists names in declaration order, without executing the file or autoloading its declarations. It includes named classes, traits, enums and concrete methods; it omits interfaces, abstract methods and standalone functions. A listed symbol doesn't guarantee mutations: coverage, exclusions and the enabled mutators still apply.

### Selecting a source line

A line selector narrows mutation generation to syntax nodes spanning a particular source line. Consider this version of `src/Service/Mailer.php`:

```php:line-numbers
<?php

namespace App\Service;

final class Mailer
{
    public function send(int $attempts): int
    {
        return abs(
            $attempts + 1,
        );
    }

    public function preview(int $attempts): int
    {
        return $attempts + 1;
    }
}
```

To focus on the addition on line 10:

```shell
infection 'App\Service\Mailer::send::10'
```

This selects code spanning line 10 inside `send()`, leaving `preview()` out. `Mailer::10` would apply the line constraint to every class named `Mailer` across your configured source files.
Line numbers count from the start of each source file, beginning at 1. Infection expects a positive integer without leading zeroes, so `Mailer::0` and `Mailer::send::010` aren't valid selectors.

You may see mutations reported on a different line from the one you selected. This happens because Infection considers the full source range of each syntax node.
In this example, line 10 is also inside the `abs()` call spanning lines 9-11, so Infection can generate a mutation that unwraps that call and report it on line 9.
The method declaration spans lines 7-12, so a change to its visibility, such as `PublicVisibility`, can also be selected and reported on line 7.

### Previewing a selection

To inspect which syntax nodes a selector leaves eligible for mutation, pass it after the file path to `debug:dump-ast`:

```shell
infection debug:dump-ast src/Service/Mailer.php 'App\Service\Mailer::send'
infection debug:dump-ast src/Service/Mailer.php 'App\Service\Mailer::send::10'
```

Selectors automatically enable node attributes and line numbers in the dump. `eligible: true` marks a node that remains eligible for mutation; `startLine` and `endLine` show its source range. For the line-10 selector, the `abs()` call can remain eligible even though its range begins on line 9.
The command inspects eligibility without running tests; it doesn't tell you which mutations your tests will detect.

### Nested classes

Code inside anonymous classes is included when you select the surrounding class or method. In this separate class excerpt, `Mailer::send` also selects the addition inside the anonymous class's `nested()` method:

```php
class Mailer
{
    public function send(): object
    {
        return new class {
            public function nested(int $attempts): int
            {
                return $attempts + 1;
            }
        };
    }
}
```

`Mailer::nested` won't select that method: it belongs to the anonymous class. The same behavior applies when anonymous classes are nested inside one another.

A named class declared inside another class or method is matched by its own name. If your selector includes a line number, each syntax node still needs to span that line.

### Combining paths, symbols and tests

For a project with source under `src/` and tests outside it, a source directory, a selector and a test path can narrow different parts of the same run. Suppose `tests/Unit/Service/MailerTest.php` covers the service `Mailer` from the earlier source tree:

```shell
infection \
    src/Service/ \
    Mailer::send \
    tests/Unit/Service/MailerTest.php
```

Here, Infection runs `MailerTest.php` and mutates `send()` methods in classes named `Mailer` within `src/Service/`.
The source path determines which files to consider and the selector narrows the code inside them. The test path determines which tests run initially; without it, the selector leaves the initial test suite unchanged.

Several selectors include code matching any of them. Suppose the project also has `App\Service\Logger::log()` in `src/Service/Logger.php` and `App\Legacy\Logger::log()` in `src/Legacy/Logger.php`. This command includes the mailer methods and both logging methods:

```shell
infection Mailer::send Logger::log
```

Adding a source directory narrows every selector to files under that directory:

```shell
infection src/Service/ Mailer::send Logger::log
```

This selects the mailer and logging methods within `src/Service/`. The legacy `Logger::log()` and `Mailer::send()` are outside this run's scope because their files are under `src/Legacy/`.

The bare name `Differ` from the earlier example also supplies a shared path filter. In a project containing both the `Differ` and `Mailer` source trees above:

```shell
infection Differ Mailer::send
```

This selects classes named `Differ`, plus `Mailer::send()`, only in files whose paths contain `Differ`. It won't add `Mailer::send()` from a file such as `src/Service/Mailer.php`.
If you meant to include one particular `Differ` class and the mailer methods across your configured source files, a qualified class name avoids that extra path filter:

```shell
infection 'App\Differ\Differ' Mailer::send
```

### Reusing arguments with diagnostic commands

When checking which files or tests a run would use, you can reuse its arguments with `config:list-sources` and `initial-test:run`:

```shell
infection config:list-sources src/Service/ Mailer::send
infection initial-test:run Mailer::send tests/Unit/Service/MailerTest.php
```

The first command lists the source files matching `src/Service/`; the second runs `MailerTest.php`. Both accept the symbol selector so the same arguments can be reused from a mutation run, but they don't apply it: selectors affect mutation generation, not file collection or the initial test run.
On its own, a selector such as `Mailer::send` would have no effect, so these commands report an error unless there's also a source file filter or a positional test path. Test-framework extra options, whether supplied on the command line or in configuration, don't make a standalone selector valid.

## Any order is supported

Source paths, symbol selectors and test paths can be mixed in any order. Their position doesn't pair a source file with a test or a selector with a preceding directory. Infection collects all source paths, all test paths and all selectors before applying them:

```shell
# source first, then tests
infection src/Service/Mailer.php Mailer::send tests/Unit/Service/MailerTest.php

# tests first, then source - identical result
infection tests/Unit/Service/MailerTest.php Mailer::send src/Service/Mailer.php
```

Both commands select `send()` in `src/Service/Mailer.php` and run `MailerTest.php` initially.

## N mixed paths

Several source and test paths can be included in the same run. Suppose the earlier service and legacy classes each have a test file outside `src/`, at the paths shown in this command:

```shell
infection \
    src/Service/Mailer.php tests/Unit/Service/MailerTest.php \
    src/Legacy/Mailer.php tests/Unit/Legacy/MailerTest.php
```

Infection runs both test files initially and generates mutations in both source files. The ordering doesn't associate a test path with its preceding source path; coverage determines which tests run against each mutant.

## All supported forms at a glance

These forms assume the same source and test configuration as the examples above. Short filenames such as `Mailer.php` are path fragments that don't resolve to a readable file in the project root.

| Command | Effect |
|---|---|
| `infection src/Service/Mailer.php` | Mutate one source file |
| `infection src/Service/` | Mutate entire source folder |
| `infection Mailer.php` | Mutate source files whose paths contain `Mailer.php` |
| `infection Mailer` | Mutate classes named `Mailer` in paths containing `Mailer` |
| `infection Mailer::send` | Mutate `send()` methods in classes named `Mailer` |
| `infection 'App\Service\'` | Mutate classes under the `App\Service` namespace prefix |
| `infection Mailer::send::32` | Mutate syntax nodes spanning line 32 in those `send()` methods |
| `infection src/A.php src/B.php` | Mutate multiple source files |
| `infection tests/Unit/` | Run only tests in `tests/Unit/` |
| `infection tests/Unit/MailerTest.php` | Run one test file |
| `infection src/Service/Mailer.php tests/Unit/MailerTest.php` | Mutate one file, run one test |
| `infection src/Service/ tests/Unit/` | Mutate folder, run test folder |
| `infection src/A.php tests/A src/B.php tests/B` | Mutate both source files and run both test paths initially |

