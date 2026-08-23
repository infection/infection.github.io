---
layout: home

hero:
  name: Infection
  text: PHP Mutation Testing Framework
  tagline: Find the tests you are missing. Infection mutates your source code and tells you which changes your test suite fails to catch.
  image:
    src: /images/logo.png
    alt: Infection
  actions:
    - theme: brand
      text: Get started
      link: /guide/
    - theme: alt
      text: Try it online
      link: https://infection-php.dev/
    - theme: alt
      text: GitHub
      link: https://github.com/infection/infection

features:
  - icon: 🧬
    title: Mutation Testing, not coverage
    details: Line coverage only proves a line ran. Infection changes the code under test and reports the mutations your suite still passes on — the gaps coverage cannot see.
    link: /guide/
    linkText: How it works
  - icon: 📊
    title: Mutation Score Indicator
    details: A single number for test-suite quality, enforceable in CI with --min-msi and --min-covered-msi, and publishable as a badge on your README.
    link: /guide/mutation-badge.html
    linkText: MSI and badges
  - icon: ⚡
    title: Built for real test suites
    details: Parallel runs, reuse of existing coverage, and --git-diff-lines to mutate only what a pull request touched — so mutation testing fits inside a normal build.
    link: /guide/command-line-options.html
    linkText: Command line options
  - icon: 🧩
    title: Works with your stack
    details: PHPUnit, Pest, Codeception and PHPSpec, with 60+ mutators grouped into profiles, custom mutators, and static analysis integration.
    link: /guide/supported-test-frameworks.html
    linkText: Supported frameworks
---
