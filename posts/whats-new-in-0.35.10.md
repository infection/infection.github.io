---
layout: post
title: What's new in Infection 0.35.10
date: 2026-11-05 12:00:00
---

# What's new in Infection 0.35.10

Infection 0.35.10 adds `@infection-ignore`, so you can skip specific mutators for a piece of code and keep checking it with the other mutators you've enabled.

Release: [Infection 0.35.10](https://github.com/infection/infection/releases/tag/0.35.10).

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

If Infection removes that early return, the method still sorts an empty list and returns an empty list. There's no change in the result for your tests to catch.

You can skip `ReturnRemoval` for just that statement by adding a comment above it:

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

Spell mutator names exactly as Infection does, including capital letters. You can't use profiles or wildcards. If a name isn't recognised or the list is empty, Infection warns you and continues the run.

Put the annotation on its own line, above the code you want it to affect. Keep your explanation on a separate line. A comment after a statement can end up attached to the next one instead.

Infection doesn't generate the mutations you exclude, so they don't count towards MSI. Before excluding an escaped mutation, check whether it points to a missing test or code you no longer need.

For more on scope, comment placement, and warnings, see the [annotation reference](/guide/usage.html#infection-ignore-support). The [how-to guide](/guide/how-to.html#Disable-specific-mutators-by-infection-ignore-annotation) has a quick example.
