---
layout: post
title: What's new in Infection 0.35.10
date: 2026-11-05 12:00:00
---

# What's new in Infection 0.35.10

Infection 0.35.10 introduces `@infection-ignore` annotations to exclude specific mutators from a section of code. Other enabled mutators can still apply, allowing you to continue mutation testing the surrounding behaviour.

Release: [Infection 0.35.10](https://github.com/infection/infection/releases/tag/0.35.10).

## Exclude a mutation that adds no value

Consider a method that returns early when given an empty list:

```php
class NameSorter
{
    public function sort(array $names): array
    {
        if ($names === []) {
            return [];
        }

        sort($names);

        return $names;
    }
}
```

Removing the early return leaves the result unchanged: sorting an empty list still produces an empty list. Tests that check only the method's result cannot detect this mutation.

Use `@infection-ignore` to exclude `ReturnRemoval` from that return statement:

```php
class NameSorter
{
    public function sort(array $names): array
    {
        if ($names === []) {
            // Removing this fast path does not change the result.
            // @infection-ignore ReturnRemoval
            return [];
        }

        sort($names);

        return $names;
    }
}
```

Other mutators can still apply to the annotated statement, and mutations elsewhere in the method are unaffected. Using `@infection-ignore` instead of `@infection-ignore-all` limits the exclusion to the mutator you have investigated. The explanation stays beside the relevant code.

## List mutators and choose the scope

To exclude several mutators, separate their names with commas:

```php
// @infection-ignore ArrayItemRemoval, FalseValue
return [false, true];
```

Here, Infection can still change `true` to `false` with `TrueValue`.

Place an annotation before a method or class to apply it throughout that scope. Nested annotations add to the enclosing exclusions without replacing them or affecting code outside the annotated scope.

Use exact, case-sensitive mutator names. Profiles and wildcards are not supported. Unknown names and empty lists produce warnings, and the run continues.

Place annotations on their own line before the target code, with any explanation on a separate line. A comment after a statement can attach to the following statement instead.

Excluded mutations are never generated and do not contribute to MSI. Before excluding an escaping mutation, check whether it reveals a missing test or unnecessary code.

See the [annotation reference](/guide/usage.html#infection-ignore-support) for scope, placement, and warning details, or the [how-to guide](/guide/how-to.html#Disable-specific-mutators-by-infection-ignore-annotation) for a quick example.
