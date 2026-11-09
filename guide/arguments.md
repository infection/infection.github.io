---
title: Command Line Arguments
type: guide
order: 39
is_new: true
---

# Command Line Arguments

Starting from version 0.34, Infection supports positional source and test paths to scope Mutation Analysis.
If you're working on a particular class or method, you can also pass its name to `infection` without looking up its file path or changing `infection.json5`.
These source symbol selectors can be combined with source and test paths.

When an argument points to a readable file or directory, Infection treats it as a path. Files and directories inside the configured `source.directories` are source paths; those outside are test paths.

```shell
infection src/Domain
```

will mutate all files inside `src/Domain`.

```shell
infection src/Domain/UserRepository.php
```

will mutate just one file `src/Domain/UserRepository.php`.

Mutating several folders, files or mix is also possible:

```shell
infection src/Domain src/Infrastructure src/Some/ConcreteFile.php
```

In general, you can pass the argument(s) containing:

- a relative file path:
```shell
infection src/Service/Mailer.php
```

- a filename:
```shell
infection Mailer.php
```

- a relative directory path:
```shell
infection src/Service/
```

- a space separated list of relative paths:
```shell
infection src/Service/Mailer.php src/Entity/Foobar.php
```
- a space separated list of filenames:
```shell
infection Mailer.php Foobar.php
```

This in no way restricts the initial Infection check on the overall test suite, which is still executed in full to ensure all tests are passing correctly before proceeding.

> `infection config:list-sources <filter>` shows which files match a path filter. It lists whole files, so symbol selectors won't narrow what appears in this list.

----

To specify what test(s) needs to be executed, you can run

```shell
infection tests/Domain
```

This will run only `tests/Domain` tests and mutate only those files that marked as covered by these tests.

> For PHPUnit, this boils down to `phpunit tests/Domain`

Specifying several folders, files or mix is also possible:

```shell
infection tests/Domain tests/Infrastructure tests/Some/ConcreteTestFile.php 
```

# Best for performance

Even if you are working on a big project with slow tests suite, you can greatly benefit from specifying both path to a source file and covering test:

```shell
infection src/Domain/UserRepository.php tests/Domain/UserRepositoryTest.php
```

In this case, Infection will run only `tests/Domain/UserRepositoryTest.php` test and mutate only `src/Domain/UserRepository.php`.

If for PHPUnit you use `#[CoversClass(UserRepository::class)]` for `UserRepositoryTest.php`, these both calls are equivalent:

```shell
infection src/Domain/UserRepository.php tests/Domain/UserRepositoryTest.php

infection tests/Domain/UserRepositoryTest.php
```

## Partial name matching

You can also pass a filename such as `Mailer.php` or `Plus_.php`. Infection looks for source files whose paths contain that string:

```shell
infection Mailer.php
infection Plus_.php
```

A bare name such as `Mailer` has a more specific meaning when it doesn't point to a readable file or directory: it selects classes named `Mailer` in files whose paths also contain `Mailer`.
For example, `infection Mailer` can mutate `App\Mailer` in `src/Service/Mailer.php`. It leaves out `App\MailerHelper` in `src/Service/MailerHelper.php`, because the class name differs and `App\Mailer` in `src/Service/Transport.php`, because the path doesn't match.

## Source symbol selectors

<span class="version-since">Available in Infection 0.35.11+</span>

For a closer look at one part of your code, a selector can name a class, a namespace or a method. Adding `::32` narrows it to code spanning line 32 of the source file:

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

Suppose your configured `src/` directory contains these files. Each `Mailer` class has `send()` and `preview()` methods; `MailerHelper` also has a `send()` method.

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

If you're working on `send()`, its short name is enough to select that method in all four `Mailer` classes:

```shell
infection Mailer::send
```

The `preview()` methods and `MailerHelper::send()` are left out. Class and method names match exactly, ignoring case, so `mailer::SEND` gives the same result.

When you only want the service class, its qualified name makes that distinction:

```shell
infection 'App\Service\Mailer::send'
```

This selects only `send()` in `src/Service/Mailer.php`. Without `::send`, the whole `App\Service\Mailer` class is selected, including `preview()`.
The quotes keep the shell from interpreting the backslashes.

The same source tree also illustrates how a class name, a filename and a namespace can select different code:

| Command | Selected code in this example |
| --- | --- |
| `infection Mailer` | The `Mailer` classes in `Service/Mailer.php` and `Legacy/Mailer.php`; the other two `Mailer` classes have no `Mailer` in their paths |
| `infection Mailer.php` | All eligible code in `Service/Mailer.php` and `Legacy/Mailer.php`, regardless of class name |
| `infection src/Service/` | All eligible code in the three files under `Service/` |
| `infection 'App\Service\'` | The `App\Service\Mailer`, `App\Service\MailerHelper` and `App\Service\Delivery\Mailer` classes |
| `infection '\Mailer'` | Only the global `Mailer` in `Global.php` |

A namespace selector includes nested namespaces. For example:

```shell
infection 'App\Service\'
```

This includes `App\Service\Delivery\Mailer` from `Transport.php`, even though its filename doesn't contain `Mailer`. Classes in `App\ServiceTools` or `Other\App\Service` would be outside this namespace prefix.

Names in selectors are literal; glob wildcards and regular expressions aren't supported. A trailing backslash is the only form of prefix matching.
Infection still looks within your configured source directories and respects their exclusions.

### When a name could mean a path or a class

A name like `Differ` could refer to a directory, part of a filename or a class. If it doesn't point to a readable file or directory, Infection combines the path and class-name filters. This can be surprising when the names don't line up.

For example, suppose your source tree looks like this and there's no readable file or directory named `Differ` at the location where the argument is resolved:

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

::: warning Behavior before Infection 0.35.11
Before Infection 0.35.11, `infection Differ` only applied the path filter. In this example, `Helper.php` and `ColorizedDiffer.php` could also produce mutations even though their classes aren't named `Differ`.
:::

Adding a slash or a backslash makes the intended scope explicit:

| Command | Selected code in this example |
| --- | --- |
| `infection Differ/` | Both classes under `src/Differ/`, including `Helper` |
| `infection 'Differ\'` | `Differ\ColorizedDiffer` in `src/Other/ColorizedDiffer.php`; nested namespaces under `Differ` would also be included |
| `infection '\Differ'` | Only the global class `Differ` in `src/Other/Global.php` |

Readable paths still take precedence. If the argument `Differ` resolves to a readable source directory, `infection Differ` selects that directory's files without adding a class-name filter. A qualified class name, such as `'App\Differ\Differ'`, can help when you meant the class instead.

### Finding selector names

If you're unsure which name to pass, `debug:list-symbols` shows the symbols Infection tracks in a PHP file. For the service `Mailer` above, the output would look like this:

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

The command lists names in declaration order, without executing the file or autoloading its declarations. It helps identify selectors; whether the selected code produces mutations still depends on coverage, exclusions and the enabled mutators.

### Selecting a source line

For a smaller change, a line selector can help focus the run. Consider this version of `src/Service/Mailer.php`:

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

### Nested classes

Code inside anonymous classes is included when you select the surrounding class or method. For example, `Mailer::send` also includes the addition inside this anonymous class:

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

When you know both the method you're working on and its tests, you can scope both parts of the run:

```shell
infection \
    src/Service/ \
    Mailer::send \
    tests/Unit/Service/MailerTest.php
```

Here, Infection runs `MailerTest.php` and mutates `send()` methods in classes named `Mailer` within `src/Service/`.
The source path determines which files to consider and the selector narrows the code inside them. The test path determines which tests run initially; without it, the selector leaves the initial test suite unchanged.

If you also want to work on logging, you can include both methods in the same run:

```shell
infection Mailer::send Logger::log
```

This selects both methods across the configured source files. Adding a source directory narrows both selections:

```shell
infection src/Service/ Mailer::send Logger::log
```

Both methods are selected within `src/Service/`. The directory applies to every selector, so `Logger::log()` elsewhere in the project is outside this run's scope.

The ambiguous bare name from the earlier example also supplies a shared path filter:

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

The first command lists the source files matching `src/Service/`; the second runs `MailerTest.php`. Both accept the symbol selector for convenience, though it doesn't affect their results.
On its own, a selector such as `Mailer::send` would have no effect, so these commands report an error unless there's also a file filter or test-framework extra options. Those extra options can come from configuration.

## Any order is supported

Source paths, symbol selectors and test paths can be mixed in **any order**. Infection works out what each argument refers to:

```shell
# source first, then tests
infection src/Service/Mailer.php tests/Unit/Service/MailerTest.php

# tests first, then source - identical result
infection tests/Unit/Service/MailerTest.php src/Service/Mailer.php
```

## N mixed paths

You can pass as many source and test paths as you need, in any combination:

```shell
infection src/Differ/Differ.php tests/Differ src/Mutator/Plus_.php tests/Mutator/Plus_.php
```

This will:
- Mutate `src/Differ/Differ.php` and all files matching `Plus_.php`
- Run only `tests/Differ` and `tests/Mutator/Plus_.php` tests

## All supported forms at a glance

| Command | Effect |
|---|---|
| `infection src/Service/Mailer.php` | Mutate one source file |
| `infection src/Service/` | Mutate entire source folder |
| `infection Mailer.php` | Mutate all files named `Mailer.php` |
| `infection Mailer` | Mutate classes named `Mailer` in paths containing `Mailer` |
| `infection Mailer::send` | Mutate `send()` methods in classes named `Mailer` |
| `infection 'App\Service\'` | Mutate classes under the `App\Service` namespace prefix |
| `infection Mailer::send::32` | Mutate syntax nodes spanning line 32 in those `send()` methods |
| `infection src/A.php src/B.php` | Mutate multiple source files |
| `infection tests/Unit/` | Run only tests in `tests/Unit/` |
| `infection tests/Unit/MailerTest.php` | Run one test file |
| `infection src/Service/Mailer.php tests/Unit/MailerTest.php` | Mutate one file, run one test |
| `infection src/Service/ tests/Unit/` | Mutate folder, run test folder |
| `infection src/A.php tests/A src/B.php tests/B` | N mixed paths in any order |

