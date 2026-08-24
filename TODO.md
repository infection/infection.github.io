# TODO — remaining work on the VitePress migration

State as of commit `3417e80`. The site builds and `npm run check` is green:
**143/143 legacy paths, 377/377 legacy anchors.** Everything below is either a
decision you need to make or a phase that was deliberately not started.

Run the gate before and after any change here:

```bash
npm run check      # docs:build + bin/check-urls.mjs
```

---

## 1. Decisions that are blocking cleanup

### 1.1 Normalise the post frontmatter (and delete the shim)

You asked for byte-identical `.md` files, so all 38 are untouched copies. That
leaves two Hexo-isms VitePress cannot read:

- 18 of 19 posts **omit the opening `---`** (Hexo tolerates it, gray-matter
  does not — without a fix the frontmatter renders as prose)
- they carry `layout: post` and `type: '{{type}}'`, which mean nothing here,
  and `layout: post` would render a blank page

`.vitepress/hexo-frontmatter.ts` patches both **in memory** so the files stay
pristine. It works, but it is a shim in the render path forever.

**To fix for real:** add `---` as line 1 of the 18 posts, delete the
`layout:`/`type:` lines from all 19, then delete `hexo-frontmatter.ts` and its
three call sites (`config.mts` vite plugin, `posts.ts`, `feed.ts`).

Only `whats-new-in-0.32.3.md` already has the opening `---`.

### 1.2 Three dead `localhost:4000` links

`posts/whats-new-in-0.9.0.md`, lines 19, 58, 60:

```
http://localhost:4000/guide/profiles.html
http://localhost:4000/guide/mutation-badge.html   (twice)
```

Absolute dev-server URLs baked into the 2018 post — **already broken on the
live site**. Fix is dropping the host: `/guide/profiles.html`.

They are currently silenced by an `ignoreDeadLinks` entry in `.vitepress/config.mts`.
Remove that entry once the links are fixed.

### 1.3 `/menu/index.html` renders empty

`menu/index.md` is byte-identical (`type: menu`) — under Hexo it was an empty
shell filled in by an EJS layout that rendered the mobile nav. VitePress has a
real mobile nav, so the page has no reason to exist, but the URL is in the
legacy contract.

Options: give it content (a docs index), or turn it into a meta-refresh stub to
`/guide/` in `.vitepress/legacy-stubs.ts` alongside the archives stubs.

### 1.4 Five pre-existing broken anchors in the content

`npm run check` reports these as notes, not failures — they 404 on the Hexo
site too, so they are content bugs, not migration regressions:

| Link | In |
| --- | --- |
| `/guide/mutators.html#Boolean-Substitution` | `guide/caveats.html`, `guide/profiles.html` |
| `/guide/mutators.html#nulify` | `guide/profiles.html` |
| `/guide/how-to.html#Disable-in-particular-class-or-method` | 0.13.0 post |
| `/2021/07/27/whats-new-in-0.24.0/#Major-performance-improvement-for-projects-with-slow-test-suites` | `guide/command-line-options.html` |

The real anchors are `#Boolean`, `#Nullify`, and (for 0.24.0)
`#Major-performance-improvement-for-the-projects-with-slow-test-suites-using-only-covering-test-cases-option`.
The how-to one needs a look — the heading was renamed.

Once fixed, the notes disappear on their own.

---

## 2. Phase 5 — deploy (not started)

The old `make deploy` was manual and laptop-bound (`hexo generate && hexo deploy`,
pushing `public/` to `infection/infection.github.io` with your git credentials).

- [ ] GitHub Actions workflow: build + `npm run check`, then publish
- [ ] Decide the repo topology — **open question 3 in `MIGRATION_PLAN.md`**:
      move this source *into* `infection/infection.github.io` and use
      `actions/deploy-pages`, or keep the two-repo push
- [ ] CI on PRs must fail on a missing URL or anchor (`npm run check` already
      exits non-zero; just wire it up)
- [ ] Verify whether the empty `CNAME` is load-bearing — **open question 4**.
      It is currently copied to `public/CNAME` verbatim

---

## 3. Phase 6 — cutover (not started)

- [ ] Spot-check the top 10 deep links from the Infection README and recent
      release notes against a preview build
- [ ] Ship a **self-unregistering `service-worker.js` stub** at the same path
      for one release cycle. The old site registered one; returning visitors
      will keep getting stale assets otherwise. This is a real risk and is not
      handled yet
- [ ] In the *old* repo: delete `themes/`, `src/`, `_config.yml`, `update.js`,
      `db.json`, `service-worker.js`, `.deploy_git/` and the Hexo deps
- [ ] Ask Algolia to remove the dead `infection` index (or leave it — harmless
      once nothing references it)

---

## 4. Smaller things

- [ ] `posts/whats-new-in-0.10.0.md:60` uses a ```` ```brew ```` fence; Shiki
      has no such language and warns on every build, falling back to plain text.
      `bash` is the obvious replacement (it is a `brew install` snippet)
- [ ] No `robots.txt`. The sitemap is generated (`sitemap.xml`), the old site
      had neither
- [ ] `atom.xml` entry `<id>`s are preserved exactly, so no re-notification —
      but `<published>` is pinned to UTC where Hexo used a local offset, so
      timestamps shift by an hour or two. Harmless; noted for completeness
- [ ] The old `.deploy_git/` output is not in this repo and should stay out
- [ ] Consider committing a CI step that regenerates `bin/url-manifest.json`
      never — it is a frozen contract. `npm run manifest` exists only for
      rebuilding it from `../infection-site/public` if that build changes

---

## 5. Answered along the way

These were open questions in `MIGRATION_PLAN.md` §9; noting what was chosen so
you can overrule:

| Question | Chosen | Where |
| --- | --- | --- |
| Replicate the old design or re-skin the default theme? | **Re-skin.** Default theme + Infection green (`#42b983`, the old `$green`), gradient hero wordmark, home hero + 4 feature cards | `.vitepress/theme/style.css`, `index.md` |
| Archives / pagination? | **Meta-refresh stubs** (plan's recommendation) to a real post index at `/posts/` | `.vitepress/legacy-stubs.ts`, `posts/index.md` |
| Search? | **Local MiniSearch** (plan's recommendation). 247 KB index, full content | `config.mts` → `themeConfig.search` |
| Keep post date URLs? | **Yes**, rebuilt from each post's own `date:` | `.vitepress/posts.ts` |

Both stub and search choices are one-line reversals if you disagree.
