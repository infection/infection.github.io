---
title: Usage
type: guide
order: 30
---

# Usage

## Configuration

The first time you run Infection for your project, it will ask you several questions to create a config file `infection.json5`, with the following structure:

``` json
{
    "source": {
        "directories": [
            "src"
        ],
        "excludes": [
            "Config",
            "Folder/with/File.php",
            "/\\.interface\\.php/",
            "{Infrastructure/.*}"
        ]
    },
    "timeout": 10,
    "threads": "max",
    "logs": {
        "text": "infection.log",
        "html": "infection.html",
        "summary": "summary.log",
        "json": "infection-log.json",
        "perMutator": "per-mutator.md",
        "github": true,
        "gitlab": "gitlab-code-quality.json",
        "stryker": {
            "badge": "/^release-.*$/"
        },
        "summaryJson": "summary.json"
    },
    "tmpDir": "/opt/tmp-folder",
    "phpUnit": {
        "configDir": "app",
        "customPath": "devTools/phpunit-12.phar"
    },
    "phpStan": {
        "configDir": "app",
        "customPath": "devTools/phpstan.phar"
    },
    "mago": {
        "configDir": "app",
        "customPath": "devTools/mago"
    },
    "mutators": {
        "global-ignore": [
            "FooClass::__construct"
        ],
        "global-ignoreSourceCodeByRegex": [
            "Assert::.*"
        ],
        "@default": true,
        "@function_signature": false,
        "TrueValue": {
            "ignore": [
                "NameSpace\\*\\Class::method"
            ],
            "ignoreSourceCodeByRegex": [
                "\\$this->logger.*"
            ]
        }
    },
    "timeoutsAsEscaped": true,
    "maxTimeouts": 10,
    "dotsPerRow": 80,
    "testFramework":"phpunit",
    "testFrameworkExtraArgs": "--filter=Unit",
    "staticAnalysisTool":"phpstan",
    "bootstrap":"./infection-bootstrap.php",
    "initialTestsPhpOptions": "-d zend_extension=xdebug.so"
}
```

If you want to override settings locally, create and commit to VCS `infection.json5.dist` but locally use `infection.json5` which should be ignored (e.g. in `.gitignore`).

> By default, Infection uses [`json5`](https://json5.org/) format for configuration file. It allows using comments, ES5-like keys and many more. But if you for some reason can't use it, Infection also supports `json` format. 

### Configuration settings

* `source` section:
  * `directories` - array, contains all folders with source code you want to mutate. Can be `.`, but make sure to exclude `vendor` in this case. Paths are relative to the configuration file location.
  * `excludes` - array, contains all folders or files you want to exclude within your source folders. It accepts full paths, as well as regular expressions, enclosed [by any delimiter accepted by PHP](https://www.php.net/manual/en/regexp.reference.delimiters.php). It accepts glob pattern too. However, its usage is discouraged, as it does not work exactly the same in all OS.
    Infection automatically excludes `vendor`, `test`, `tests` folders if the source folder is `.` (current dir). Make sure to not mutate your test suite.
    Paths under `excludes` key are relative to the `source.directories` folders.
    Here are some examples of `excludes`, assuming that `src` is defined in `source.directories`:
    * `"excludes": ["Config"]` skips the folder `src/Config`.
    * `"excludes": ["Folder/with/File.php"]` skips the file `src/Folder/with/File.php`.
    * `"excludes": ["/\\.interface\\.php/"]` skips all files containing `.interface.php` in the name.
    * `"excludes": ["{Infrastructure/.*}"]` skips all files within `src/Infrastructure` folder. Note that braces (`{}`) is a valid regex delimiter in PHP.
    * `"excludes": ["{.*/Infrastructure/.*}"]` skips all files within the `Infrastructure` path of the second level of directories within `src`. Therefore, `src/Shared/Infrastructure` or `src/SomeBoundedContext/Infrastructure` would be excluded, whereas `src/Shared/Domain` or `src/SomeBoundedContext/Application` would not.
    Use `bin/infection config:list-sources` to debug and see which files are to be used excluded. This command understands `infection.json5` file as well as different CLI options, such as `--filter` etc.
* `timeout` - the maximum allowed time for mutated processes to run, in whole seconds, before they are considered a timeout. Make sure to set it to higher value than your tests are executed in seconds to avoid false-positives.
* `threads` - the number of threads to use by the runner when executing the mutations. Use `"auto"` (default) to let Infection select the count, or `"max"` to use all the available CPU cores but one. See [`--threads`](/guide/command-line-options.html#threads-or-j).
* `logs`
  * `text` - human-readable text log file. Must see to understand what is going on during mutation process.
  * `html` - human-readable report, similar to PHPUnit HTML report. Based on [Stryker Elements](https://stryker-mutator.io/blog/one-mutation-testing-html-report/). Here is [an example](/static/html-report-example.html) for Infection itself. If you want to store HTML report in the cloud (useful for OSS projects), see [Stryker Dashboard](/guide/mutation-badge.html) integration.
  * `summary` - summary log file, which will only display the amount of mutants per category, (Killed, Errored, Escaped, Timed Out, [Skipped](/2020/08/18/whats-new-in-0.17.0/#Skip-S-mutations-that-are-over-specified-time-limit), and Not Covered)
  * `json` - machine-readable file in JSON format. Can be programmatically analyzed. In addition to general stats, contains original, mutated code, diff and test framework output for each Mutant.
  * `perMutator` - a markdown file which will give a break-down of the effectiveness of each mutator.  
  Each of the above logs accept a local filename to write to (eg `infection.log`), or you can write to a PHP stream using `php://stdout`, `php://stderr`, or `php://output`. This can be useful in CI to store the mutation results in the output, or in same-process PHP wrappers to capture the output with output buffering.
  * `github` - prints GitHub Annotation warnings right in the Pull Request. Supposed to be used with GitHub Actions. See [`--logger-github`](/guide/command-line-options.html#logger-github), but usually not necessary as it is automatically detected.
  * `gitlab` - GitLab (Code Climate) code quality report. Can be processed as a `codequality` report artifact in Gitlab.
  * `summaryJson` - machine-readable file in JSON format like `json` but containing only general stats. Can be programmatically analyzed, for example on CI.
* `tmpDir` - Optional. It's a folder where Infection creates its configs, caches and other stuff. It may be useful for people who doesn't have access to the default system temporary folder and/or doesn't have write permissions. Either absolute `/tmp/folder` or relative `var/cache` paths can be used.
* `phpUnit` - optional key
  * `configDir` - custom directory path with `phpunit.xml.dist` file. This is useful for example for old Symfony app, where `phpunit.xml.dist` is located at `./app`
  * `customPath` - custom path to PHPUnit executable. This is useful when you run tests by external shared phar file that is located outside project root. Relative paths are relative to the configuration file.
* `phpStan` - optional key
    * `configDir` - custom directory path with `phpstan.neon.dist` file.
    * `customPath` - custom path to PHPStan executable. This is useful when you run static analysis by external shared phar file that is located outside project root. Relative paths are relative to the configuration file.
* `mago` - optional key
    * `configDir` - custom directory path with `mago.toml` file.
    * `customPath` - custom path to mago executable. This is useful when you run static analysis by external file that is located outside project root. Relative paths are relative to the configuration file.
* `ignoreMsiWithNoMutations` - optional key, whether to ignore MSI violations with zero mutations
* `minMsi` - optional key, a value for the Minimum Mutation Score Indicator (MSI) percentage value
* `minCoveredMsi` - optional key, a value for the Minimum Covered Code Mutation Score Indicator (MSI) percentage value
* `timeoutsAsEscaped` - optional key, treats timed-out mutants as escaped in MSI calculation, giving an honest picture of test quality. See [`--with-timeouts`](/guide/command-line-options.html#with-timeouts)
* `maxTimeouts` - optional key, maximum number of allowed timed-out mutants before the build fails. See [`--max-timeouts`](/guide/command-line-options.html#max-timeouts)
* `dotsPerRow` - optional key, number of dots per row in the dot progress formatter. Accepts a positive integer or the literal `"max"` to fit the terminal width. Defaults to `50`. See [`--dots-per-row`](/guide/command-line-options.html#dots-per-row)
* `mutators`: optional key, it contains the settings for different mutations and profiles, read more about it [here](/guide/profiles.html)
* `testFramework`: optional key, it sets the framework to use for testing. Defaults to `phpunit`. This gets overridden by the `--test-framework` command line argument.
* `testFrameworkExtraArgs`: optional key, specifies additional arguments to pass to the test framework (e.g. enabling verbose mode). `--test-framework-extra-args` overrides this option.
* `testFrameworkOptions`: deprecated. Use `testFrameworkExtraArgs` or `--test-framework-extra-args`.
* `staticAnalysisTool`: optional key, enables static analysis integration to catch escaped mutants. Supports `"phpstan"` and `"mago"`. When enabled, Infection will run the static analysis tool on mutants that escape the test suite to identify additional issues like type violations, dead code, or unreachable paths. This helps improve mutation testing effectiveness by catching errors that tests might miss. Can be overridden by the `--static-analysis-tool` command line argument.
* `staticAnalysisToolOptions` optional key, it specifies additional options to pass to the static analysis tool (e.g. memory limit). `--static-analysis-tool-options` will override this option.
* `bootstrap`: optional key, use it to specify a file to include as part of the startup to pre-configure the Infection environment. Useful for adding custom autoloaders not included in composer.
* `initialTestsPhpOptions`: optional key, specify additional php options for the initial test (IE: Enabling X-Debug). `--initial-tests-php-options` will override this option.

<p class="tip">You can check the result of the source configuration by executing `infection config:list-sources`.</p>


#### How to use custom autoloader or bootstrap file

If you have a custom autoloader or bootstrap file for your application, you should tell Infection about it.

For example, you have

```php
// custom-autoloader.php

require 'NonPsr4CompliantFile.php';
```

then you have to add it to the `infection.json5` file:

```json
{
    "bootstrap": "./custom-autoloader.php"
}
```

Thus, Infection will know how to autoload `NonPsr4CompliantFile` class. Without adding it to the config, Infection will not be able to create Mutations because internally it uses `new \ReflectionClass()` objects.

## Running Infection

Ensure that your tests are all in a passing state (incomplete and skipped tests are allowed). Infection will quit if any of your tests are failing.

If you have installed Infection as a global composer package, just run it in your project's root:

```shell
infection
```

or if you cloned it to some folder:

```shell
# cd /path/to/project/root

~/infection/bin/infection
```

### Running with `Xdebug`

In order to run Infection with Xdebug, you have several options:

#### Enable Xdebug globally

In this case just run

```shell
./infection.phar --threads=4
```

#### Enable Xdebug per process

Since Infection needs Xdebug *only* to generate code coverage in a separate process, it is possible to enable debugger just there. 

Assuming Xdebug is disabled globally, run

```shell
./infection.phar --initial-tests-php-options="-d zend_extension=xdebug.so"
```

### Running with `phpdbg`

In order to run Infection with `phpdbg` instead of Xdebug, you need to execute the following command:

```shell
phpdbg -qrr infection.phar
```

### Running without debugger

It is possible to run Infection without any debugger enabled. However, in this case you should provide already generated code coverage as an option

```shell
./infection.phar --coverage=path/to/coverage
```

> [Read more](./command-line-options.html#coverage) what types of coverage Infection requires and how to do it.

### `@infection-ignore` support

Use `@infection-ignore` to exclude specific mutators on a class, method, or statement while allowing other mutators to apply:

```php
class Example
{
    // @infection-ignore ArrayItemRemoval, FalseValue
    public function values(): array
    {
        return [false, true];
    }
}
```

Here, `ArrayItemRemoval` and `FalseValue` are excluded throughout `values()`. Other enabled mutators, such as `TrueValue`, can still apply.

List one or more exact, case-sensitive [mutator names](/guide/mutators.html), separated by commas, on the same comment line as `@infection-ignore`. Spaces around names are optional. Ordinary comments and PHPDoc comments are both supported. Profile names such as `@default` and wildcard patterns are not supported. Configured custom mutator names are supported.

Infection warns about unknown names and lists with no names, including lists containing only spaces or commas. Each warning includes the source file and the annotated code's line number. The run continues. Unknown names have no effect; valid names in the same list still apply. Built-in mutator names are recognised even when those mutators are disabled. An annotation only excludes mutations; it does not enable a disabled mutator.

Keep explanations on a separate comment line so they are not interpreted as part of a mutator name:

```php
// Removing this fast path changes performance without changing the result.
// @infection-ignore ReturnRemoval
return [];
```

#### Nested annotations

The annotation applies to the annotated code and everything nested inside it. A class annotation covers all methods; a method annotation covers its signature and body; a statement annotation covers the statement and its expressions. Nested annotations add exclusions to those inherited from the enclosing code:

```php
// @infection-ignore ArrayItemRemoval
class Example
{
    public function values(): array
    {
        // @infection-ignore FalseValue
        $defaults = [false, true];

        return [false, true];
    }
}
```

`ArrayItemRemoval` is excluded throughout the class. `FalseValue` is excluded only in the assignment to `$defaults`; it can still mutate the `false` in the return statement. `TrueValue` remains enabled in both statements. An inner annotation cannot re-enable an inherited exclusion.

#### Choosing where to annotate

An annotation affects the annotated code and its contents, so place it on the code targeted by the mutator or on an enclosing statement, method, or class. For example, `ArrayItemRemoval` targets an array, so annotating one of its items does not exclude that mutation:

```php
class Example
{
    public function itemAnnotation(): array
    {
        return [
            // @infection-ignore ArrayItemRemoval
            false,
        ]; // ArrayItemRemoval can still produce [].
    }

    public function statementAnnotation(): array
    {
        // @infection-ignore ArrayItemRemoval
        return [false]; // ArrayItemRemoval is excluded here.
    }
}
```

Place annotations on their own line before the target code. A trailing annotation can attach to the next statement. An annotation after the final statement in a method does not exclude that statement.

As with [`@infection-ignore-all`](#infection-ignore-all-support), excluded mutations are never generated, so they do not contribute to MSI or appear in the `Ignored` result count. That count records mutations excluded by source-code regular expressions.

### `@infection-ignore-all` support

Use `@infection-ignore-all` to exclude all mutations from a class, method, or statement and everything inside it.

To exclude only named mutators, use [`@infection-ignore`](#infection-ignore-support).

Infection will not mutate the following class, even if tests cover some of its lines.

```php
// @infection-ignore-all
class Calculator
{
    public function add(float $a, float $b): float
    {
        return $a + $b;
    }
}
```
 
In this example, Infection skips `generate()` and mutates `getDependencies()` as usual.
 
```php
class ProductFixture
{
    // @infection-ignore-all
    public function generate(): void
    {
        // generate logic
    }
    
    public function getDependencies(): array
    {
        return [CategoryFixture::class];
    }
}
```

Similarly, this annotation excludes all mutations within the loop:

```php
// @infection-ignore-all
foreach ($foo as $bar) {
    // 
}
```

## Exposed environment variables

Infection exposes a couple of environment variables:

* `INFECTION=1` this can be used in test environment to check whether the tests are executed from Infection or not.
* `TEST_TOKEN=<int>` for each process that Infection creates for running tests for particular Mutant, it adds `TEST_TOKEN=<int>` environment variable to be used for setting up connections to different databases. Read more [here](/guide/how-to.html#How-to-run-Infection-for-functional-tests).
