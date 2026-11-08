---
layout: post
title: What's new in Infection 0.35.10
date: 2026-11-05 12:00:00
---

# What's new in Infection 0.35.10

[Infection 0.35.10](https://github.com/infection/infection/releases/tag/0.35.10) adds `@infection-ignore` alongside the existing `@infection-ignore-all`, so you can skip only specific mutators for a piece of code.

## Exclude a mutation that adds no value

Say you have a method that returns early for an empty list:

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

If Infection removes that early return, the method still sorts an empty list and returns an empty list. Tests that only check the returned value won't notice. You could extract the sorting call into a separate method and use a partial mock to check that it isn't called for an empty list, but that changes the code and tests just to observe this optimisation.

If that extra test would add little value for your project, you can now skip `ReturnRemoval` for just that statement by adding a comment above it:

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

Infection can still use other mutators on this statement and mutate the rest of the method. Using `@infection-ignore-all` here would skip every mutator on the statement. With `@infection-ignore`, you skip only the mutator you've checked, and the reason stays next to the code.

## List mutators and choose the scope

To skip several mutators, separate their names with commas:

```php
// @infection-ignore ArrayItemRemoval, FalseValue
return [false, true];
```

In this example, Infection can still change `true` to `false` with `TrueValue`.

You can put the annotation above a method or class too. It then applies to everything inside. If you add another annotation inside that code, its exclusions add to the outer ones; they don't replace them or extend beyond the annotated code.

::: warning
Mutator names are case-sensitive. Profiles and wildcards aren't supported. If the list is empty or contains a name Infection doesn't recognise, you'll get a warning, but the run will continue. This also applies to names removed or renamed in a newer release. If a mutator was renamed, update the annotation to keep excluding it.
:::

The placement matters: an annotation above a statement applies to that statement.

An annotation at the end of a statement can attach to the next one instead. Any explanation can go on a separate comment line above the annotation, so Infection doesn't read it as part of a mutator name:

```php
// FalseValue is excluded for $first.
// @infection-ignore FalseValue
$first = false;

$second = false; // @infection-ignore FalseValue
$third = false; // The trailing annotation applies here, not to $second.
```

Infection doesn't generate the mutations you exclude, so they don't count towards MSI. Before excluding an escaped mutation, check whether it points to a missing test or code you no longer need.

For more on scope, comment placement, and warnings, see the [annotation reference](/guide/usage.html#infection-ignore-support). The [how-to guide](/guide/how-to.html#Ignore-specific-mutators-by-infection-ignore-annotation) has a quick example.
