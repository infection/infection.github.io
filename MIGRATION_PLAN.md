# infection.github.io — Migration to VitePress

> Goal of this document: validate the stack choice, lock down the URL contract, and describe the work.

## 0. Handover state (read this first)

Written **2026-08-24** against commit `e95e69f` on `master`. **Nothing has been implemented.**

| | |
| --- | --- |
| Code written | **None.** No branch, no `docs/` dir, no dependencies installed, no files in `src/`, `themes/` or `_config.yml` touched. The live site is untouched and still Hexo. |
| What exists | This file only. |
| Where to start | §7 Phase 0 — five blocking decisions in §9 need maintainer answers before any code. Then Phase 1 (verification harness) **before** Phase 2 (content). |
| Do not skip | §5.4 (anchor slugify) and §5.5 (URL/anchor verification harness). Everything else is recoverable; those two are what silently break the site. |
| Findings already verified (don't re-research) | VitePress 1.6.4 stable / v2 alpha; VitePress emits `.html` by default; `markdown.anchor` accepts a custom `slugify` (spread after the default in `src/node/markdown/markdown.ts`); the default theme's outline reads DOM `id`s client-side; local search reuses the same markdown renderer (`localSearchPlugin.ts`); the live Algolia index is stale — 131 headings-only records, crawler no longer running; `npm i vuepress` still installs 1.9.10 (Vue 2), VuePress 2 is `2.0.0-rc.31`. |

---

## 1. TL;DR

| Question | Answer |
| --- | --- |
| Is **VitePress** a good choice? | **Yes — it's the right call for this site.** Stable, Vue-team maintained, and it emits `.html` URLs by default, which is exactly what this migration needs. See §3 for the honest downsides. |
| Alternatives worth knowing? | Astro + Starlight (strong runner-up), Docusaurus, MkDocs Material, VuePress 2. See §4. |
| Can all current URLs be kept? | **Yes — including anchors — but only with a custom slugify.** See §5. This is the single biggest risk and it applies to *any* target SSG. |
| How will search work? | **Built-in local search (MiniSearch)**, no external service. The current Algolia index is already stale/broken — see §6. |
| Effort estimate | ~2–4 focused days: 1 day docs/routing/anchors, 1–2 days theme/homepage, 0.5 day CI/deploy + verification. |

---

## 2. What the current site actually is (inventory)

Hexo **3.8.0**, `hexo-renderer-marked` (marked v0.3-era) + `hexo-renderer-ejs` + Stylus, on a theme forked from `vuejs.org`.

| Item | Detail |
| --- | --- |
| Content | 19 guide pages (`src/guide/*.md`), 19 blog posts (`src/_posts/*.md`), `src/index.md` (homepage), `src/menu/index.md` |
| Theme | 5 EJS layouts + 6 partials (~270 lines), 13 Stylus files (~1300 lines), incl. a hand-rolled dark-theme toggle (`theme-switch.js`) |
| Generated pages | 67 HTML files in `.deploy_git` (see §5) |
| Static assets | `/images/**`, `/static/html-report-example.html`, `/files/infection.pub` (GPG key!), `/manifest.json`, `/browserconfig.xml`, `/atom.xml`, `service-worker.js` |
| Deploy | `make deploy` → `hexo generate && hexo deploy` (git push of `public/` to `infection/infection.github.io`) — **manual, from a laptop** |
| Sidebar order | `type: guide` + numeric `order:` frontmatter; `order > 1000` starts a "Miscellaneous" group |
| Search | Legacy `docsearch.js` v2 from jsDelivr, index `infection`, app `BH4D9OD16A` |
| Markdown flags | `gfm: true`, `breaks: true`, `smartypants: true`, `tables: true` |

Dead weight that should **not** be carried over: `js/vue.js` / `js/vue.min.js` (Vue 2 shipped for demos that no longer exist), `service-worker.js` (33 KB, from vuejs.org), `update.js` + the `make update` target (it builds *Vue* from `../vue` — pure fork residue), ~40 leftover vuejs.org images (`monterail.png`, `laravel.png`, `vuejobs.svg`, …), `db.json`, `.deploy_git/`.

---

## 3. Assessment: is VitePress a good choice?

**Yes.** For a ~40-page PHP tool documentation site that must keep its existing URLs, VitePress is close to a perfect fit. Verified facts as of 2026-08-24:

| Fact | Why it matters here |
| --- | --- |
| Stable at **1.6.4** (v2 in alpha), maintained by the Vue core team; powers the Vue, Vite, Vitest, Pinia and Rollup docs | Maintenance burden stays off Infection's maintainers |
| **Emits `.html` URLs by default** (`cleanUrls: false`) — `guide/usage.md` → `/guide/usage.html` | Your entire `/guide/*.html` namespace (19 pages) is preserved for free. Most modern SSGs default to extensionless/trailing-slash URLs and would have broken every one |
| `markdown.anchor` accepts full `markdown-it-anchor` options, including a **custom `slugify`** (verified in `src/node/markdown/markdown.ts` — `...options.anchor` is spread after the default) | Makes the anchor problem in §5.4 solvable rather than fatal |
| `rewrites` maps arbitrary source files to arbitrary output paths | Handles the `/YYYY/MM/DD/slug/` blog permalinks |
| **Local search built in** (MiniSearch), one config line | Replaces the dead Algolia setup with zero services |
| Dark mode, SSR, code highlighting (Shiki), a polished default docs theme | Directly replaces ~1300 lines of Stylus and the hand-rolled theme toggle |
| Local search reuses the *same* markdown renderer (verified in `localSearchPlugin.ts`) | Your custom anchor slugs propagate into search result deep links automatically |

### The honest downsides — read these before committing

1. **No blog primitives.** No `permalink:` frontmatter, no posts collection, no archives, no pagination, no RSS. VitePress is a *documentation* generator. The 19 release-note posts need `rewrites` (§5.2) and ~40 lines of `createContentLoader` for the post list and Atom feed. Tractable, but it is work that Hexo did for free. This is the one area where VuePress 2 or Docusaurus would genuinely save effort.
2. **Markdown is compiled as Vue templates.** Every `{{ … }}`, unclosed tag, or stray `<` in existing prose becomes a *build error*. With 38 files of PHP/JSON-heavy docs, budget a compatibility pass (§7 Phase 2) and expect `v-pre` in a few places.
3. **No redirect mechanism** — but neither does GitHub Pages, so this is moot. Strategy is "emit files at identical paths" (§5).
4. **v2 is in alpha.** Pin to 1.x and plan the v2 upgrade as a separate exercise later; don't start on alpha.
5. **Deviating from the default theme costs real effort.** Component slots and CSS variables cover a lot, but replicating the current custom hero/homepage means writing Vue components.

**Verdict: proceed with VitePress 1.x.** The blog gap is the only genuine trade-off, and it's ~40 lines of code against a stack that's officially maintained and keeps your URL scheme by default.

---

## 4. Alternatives considered

| Option | Pros | Cons | Fit |
| --- | --- | --- | --- |
| **VitePress** ⭐ | Everything in §3: stable, Vue team, `.html` by default, local search, fast Vite builds, good default theme | No blog/permalink/feed primitives; markdown is Vue-parsed | **Chosen** |
| **Astro + Starlight** | Excellent docs theme, a11y-first, built-in Pagefind search, MDX, framework-agnostic islands, very healthy project | Needs `build.format: 'file'` to emit `.html` URLs (easy to get wrong); more moving parts; blog still a separate concern | Strong runner-up |
| VuePress 2 | Native `permalink:` frontmatter and `@vuepress/plugin-blog` — the one thing VitePress lacks; `vuepress-theme-hope` is very feature-rich | Still **`2.0.0-rc.31`** (perpetual RC); community-maintained; `npm i vuepress` installs **1.9.10 (Vue 2 + webpack 4)**; Vue team designated VitePress the recommended SSG | Only if the blog features are decisive |
| Docusaurus 3 | Most mature docs product: versioning, i18n, real blog with date permalinks, official `plugin-client-redirects` | React (mismatch with the existing Vue-flavoured design), heaviest option, MDX gotchas with raw HTML in markdown | Overkill |
| MkDocs Material | Best-in-class built-in search, very low maintenance, huge feature set | Python toolchain, Jinja theming — throws away all existing design work, non-Vue | Viable but a bigger visual rewrite |
| **Stay on Hexo, upgrade to 7.x** | Zero URL risk, keeps the theme, smallest diff | Keeps EJS/Stylus/marked-of-2018; doesn't fix search or CI; theme is still a vuejs.org fork | Only if the answer is "no time" |
| Hugo / Zola | Single binary, instant builds | Full hand-rolled theme, Go/Tera templates, no component model | Not worth it here |

---

## 5. URL preservation — the hard requirement

**All 67 current URLs can be preserved.** GitHub Pages serves this repo as a static bucket with *no* redirect support (no `_redirects`, no `.htaccess`), so the only reliable strategy is: **emit files at exactly the same paths**. Anything not emitted 1:1 needs an HTML meta-refresh stub.

### 5.1 URL contract

| # | Pattern | Count | VitePress handling |
| --- | --- | --- | --- |
| 1 | `/index.html` | 1 | `index.md` with `layout: home` (or a custom homepage component) |
| 2 | `/guide/*.html` (incl. `/guide/index.html`) | 19 | ✅ **Free.** VitePress emits `.html` by default. Keep filenames identical. |
| 3 | `/YYYY/MM/DD/<slug>/` (blog posts) | 19 | See §5.2 |
| 4 | `/archives/**` (year/month/paginated) | 24 | See §5.3 — **decision needed** |
| 5 | `/page/2/index.html` (home pagination) | 1 | Same decision as #4 |
| 6 | `/menu/index.html` | 1 | `menu/index.md` |
| 7 | `/static/html-report-example.html` | 1 | Drop in `public/static/` verbatim |
| 8 | `/atom.xml` | 1 | Generate in a `buildEnd` hook over `createContentLoader` |
| 9 | `/files/infection.pub`, `/images/**`, `/manifest.json`, `/browserconfig.xml`, `/CNAME` | many | `public/` passthrough — **`infection.pub` is a published GPG key, it must not move** |

> ⚠️ Do **not** enable `cleanUrls: true`. It would turn every `/guide/x.html` into `/guide/x` and break every inbound link on the internet. This default is the main reason VitePress fits.

### 5.2 Blog post permalinks (`/2022/01/10/whats-new-in-0.26.0/`)

VitePress derives the URL from the file path, so recreate the path. Two equivalent options:

- **A (recommended): `rewrites` in `.vitepress/config.ts`.** Keep authoring files in `posts/whats-new-in-0.26.0.md` and map them:
  `'posts/whats-new-in-0.26.0.md': '2022/01/10/whats-new-in-0.26.0/index.md'`
  Generate this map once with a script that reads each post's existing `date:` frontmatter — the dates are already there, so the mapping is mechanical and can't drift.
- **B: physically move files** into `2022/01/10/whats-new-in-0.26.0/index.md`. Simpler config, uglier tree, and authoring a new post means creating three nested folders.

Both emit `.../index.html`, which GitHub Pages serves for the trailing-slash URL. ✔

Watch the two irregular slugs: `whats-new-in-0-8-0` (dashes, not dots — `/2018/02/28/whats-new-in-0-8-0/`) and the 2026 post `/2026/01/14/whats-new-in-0.32.3/`. Dots in directory names are fine on GitHub Pages (they already work today).

### 5.3 Archives & pagination — decision needed

`/archives/**` (24 pages) and `/page/2/` are Hexo generator output. They aren't linked from the site's own navigation, so their value is only "some search engine or old link points there."

Options, cheapest first:
1. **Emit a single `/archives/index.html`** listing all posts, and let the 23 year/month sub-pages 404. Low effort, small residual link loss.
2. **Emit meta-refresh stubs** for all 24 + `/page/2/` pointing at `/archives/`. Preserves every URL, ~30 generated 200-byte files, zero maintenance.
3. **Fully reimplement** year/month archives with `createContentLoader`. Highest fidelity, most code, for pages nobody visits.

> **Recommendation: option 2.** Cheap, and it makes the "all links retained" claim literally true.

### 5.4 ⚠️ Anchors — the real risk

The current site's heading IDs come from `hexo-util.slugize`, which **preserves capitalisation**. Real examples from the deployed site:

```
/guide/installation.html#Phar                 (not #phar)
/guide/installation.html#Compatibility-Note   (not #compatibility-note)
/guide/how-to.html#How-to-disable-Mutators-and-profiles
/guide/command-line-options.html#threads-or-j  (from "`--threads` or `-j`")
```

VitePress's default slugify (`@mdit-vue/shared`) lowercases and strips differently → **every one of these anchors would silently break.** There are **225 internal `.html#…` links across `src/`**, plus every deep link ever posted in a GitHub issue, Stack Overflow answer, or release note.

**Fix — port the exact algorithm.** `hexo-util`'s rule is: escape diacritics → strip control chars → replace `` [\s~`!@#$%^&*()\-_+=[\]{}|\;:"'<>,.?/]+ `` with `-` → collapse repeated `-` → trim leading/trailing `-` → **no case change**. Duplicate headings get `-1`, `-2`… (same convention markdown-it-anchor uses by default). Reimplement as `.vitepress/slugify.ts`, ~15 lines, no runtime dependency on hexo-util.

```ts
// .vitepress/config.ts
import { slugify } from './slugify'

markdown: {
  anchor: { slugify },   // the id="" on every heading — this is the one that matters
  breaks: true,          // Hexo had breaks: true; without it, single newlines stop becoming <br> site-wide
  typographer: true,     // ≈ Hexo's smartypants
}
```

Two things verified so you don't over-engineer this:

- **The right-hand outline is safe.** VitePress's default theme builds the page outline client-side by reading `id` attributes out of the rendered DOM, so it inherits your custom slugs automatically.
- **Search deep links are safe.** The local search plugin renders pages through the *same* markdown-it instance and scrapes anchors from that HTML — custom slugs propagate for free.
- **But**: if you ever set `markdown.headers` (to get headings into page data, e.g. for a custom TOC), pass `{ slugify }` there too rather than `true` — that plugin has its own independent slugify default.

### 5.5 Verification harness (build this *first*, before any content work)

Non-negotiable acceptance gate:

1. Build the current site at `e95e69f` → snapshot `public/` as the baseline.
2. Script `bin/check-urls.mjs`:
   - Set A = every path in the baseline; Set B = every path in the new `dist/`. **A ⊆ B must hold**, or the diff must be an explicitly approved allowlist.
   - Extract every `id="…"` from every baseline HTML page → assert each still exists on the corresponding new page. **This is what catches §5.4.**
   - Crawl the new build for internal links and assert every target path + fragment resolves (VitePress's own dead-link checker covers paths but not fragments).
3. Run it in CI on every PR. Keep it after the migration.

---

## 6. Search

### Current state — it's already broken

The site loads legacy `docsearch.js` **v2** (deprecated by Algolia; the free DocSearch programme moved to v3 + the Algolia Crawler years ago). Probing the live index on 2026-08-24:

- 131 records, all with `content: null` — a **headings-only** index, so full-text search does not actually work today.
- `/guide/arguments.html` and `/guide/backward-compatibility.html` are **live (HTTP 200) but absent from the index** → **the crawler is no longer running.** New docs are unsearchable.
- The index's `lvl0` values come from the Hexo theme's sidebar `<h3>` selectors, so **the scraper config is coupled to the current theme's DOM** — a redesign silently degrades results even if the crawler were alive.

So search is not a thing to "preserve" — it's a thing to fix.

### Options

| Option | How it works | Verdict |
| --- | --- | --- |
| **VitePress local search** (MiniSearch) ⭐ | `themeConfig.search = { provider: 'local' }`. Index built at build time from the same markdown renderer, shipped as static JSON, runs in the browser. Full content, not just headings. Supports per-page `search: false` and a `_render` hook to exclude/transform content. Zero services, zero API keys, zero crawler; works offline and on PR previews. | **Recommended.** ~40 pages — index size is trivial. |
| Algolia DocSearch v3 | Re-apply to the free programme, get new `appId`/`apiKey`/`indexName`, write a new crawler config against VitePress's DOM (`.vp-doc`), then `search: { provider: 'algolia' }`. Adds analytics and the "Ask AI" panel. | Better at scale, but reintroduces the exact external dependency that already rotted. Only if someone will own it. |
| Pagefind | Post-build static index; native to Astro/Starlight | Redundant given VitePress ships local search |

> **Recommendation: local search.** Provider swap is a config-level change later if you ever want DocSearch v3.
> Either way, **decommission the old `docsearch.js` v2 snippet and the dead `infection` index** so nobody thinks it still works.

---

## 7. Migration plan

**Ground rule: keep the current site live and untouched until §5.5 passes.** Build in `docs/` on a branch; `src/`, `themes/`, `_config.yml` stay put until the cutover commit.

### Phase 0 — Decisions (blocking)
- [x] Stack: **VitePress 1.x** (pinned; not v2 alpha).
- [ ] Archives strategy (§5.3) — recommendation: meta-refresh stubs.
- [ ] Search (§6) — recommendation: local.
- [ ] Design goal: **replicate the current look** (dark hero, Infection green) vs. **adopt the VitePress default theme** re-skinned with CSS variables. Biggest effort lever: re-skin ≈ 4 hours, replicate ≈ 1–2 days.
- [ ] Confirm blog posts keep their date URLs (yes — they're linked from release notes).

### Phase 1 — Scaffold & safety net
- [ ] Snapshot the current build; land `bin/check-urls.mjs` (§5.5) and prove it passes *baseline vs. baseline* before trusting it.
- [ ] `npm create vitepress@latest` into `docs/`; **pin the VitePress version**. Node 20+.
- [ ] `.vitepress/config.ts`: `title`, `description`, `base: '/'`, **`cleanUrls: false`**, `srcDir`, `outDir`.

### Phase 2 — Content
- [ ] Move `src/guide/*.md` → `docs/guide/*.md`, **filenames unchanged**.
- [ ] Move `src/_posts/*.md` → `docs/posts/*.md`; generate the `rewrites` map from each post's `date:` (§5.2).
- [ ] Add `.vitepress/slugify.ts` + markdown options (§5.4). Run the anchor check — expect it to fail loudly until slugify is right.
- [ ] Frontmatter cleanup: `type: guide` / `order:` become an explicit `sidebar` array in the config (19 entries, current order, "Miscellaneous" split at `order > 1000`). Drop `layout: post`, `type: '{{type}}'`.
- [ ] Markdown compatibility sweep (expect this to be the fiddliest part):
  - raw HTML in markdown is parsed as **Vue templates** — `{{ … }}`, unclosed tags, stray `<` in prose will fail the build. Wrap offenders in `v-pre`.
  - fenced blocks with a title (```` ```json infection.json ````) — Shiki treats the tail as meta; pick a code-title convention.
  - confirm `breaks: true` is set, or paragraph spacing changes across all 38 files.
- [ ] Copy `images/` (only those actually referenced), `static/html-report-example.html`, `files/infection.pub`, `manifest.json`, `browserconfig.xml`, `CNAME` into `docs/public/`.
- [ ] Purge the vuejs.org residue listed in §2.

### Phase 3 — Theme
- [ ] Start from the VitePress default theme; re-skin via `--vp-c-brand-*` CSS variables sourced from `themes/infection/source/css/_settings.styl`.
- [ ] Homepage: built-in `layout: home` hero/features, or a custom `.vue` layout replicating `index.ejs` (hero + GET STARTED / TRY IT! / GITHUB buttons).
- [ ] Nav: Guide · Playground (infection-php.dev) · GitHub · ecosystem dropdown.
- [ ] **Delete `theme-switch.js`** — VitePress has dark mode with SSR-safe no-flash handling built in.
- [ ] Sidebar "Posts" section: latest 5 posts via `createContentLoader`.
- [ ] Keep `/menu/` as a page, or fold it into nav — decide.

### Phase 4 — Feeds, search, extras
- [ ] `atom.xml` generation in `buildEnd` — **same path, same entry `<id>`s**, so existing feed readers don't re-notify.
- [ ] Enable `search: { provider: 'local' }`; remove the docsearch v2 snippet.
- [ ] Sitemap + `robots.txt` (new — the current site has neither).
- [ ] Archives strategy from Phase 0.

### Phase 5 — Deploy
- [ ] Replace `make deploy` (manual, laptop-bound, needs the maintainer's git creds) with a **GitHub Actions workflow** pushing to `infection/infection.github.io` — or better, move the site source *into* that repo and use `actions/deploy-pages`.
- [ ] CI on PRs: build + `bin/check-urls.mjs` + VitePress dead-link check. **Fail the build on a missing URL or anchor.**
- [ ] Preserve `CNAME` in the published output (currently empty but present — verify whether it's still needed).
- [ ] Keep `.deploy_git/` out of git going forward.

### Phase 6 — Cutover
- [ ] Final `check-urls` run: 67/67 paths + all anchors.
- [ ] Deploy; spot-check the top 10 deep links from the Infection README and recent release notes.
- [ ] Delete `themes/`, `src/`, `_config.yml`, `update.js`, `db.json`, `service-worker.js`, and the Hexo deps.
- [ ] Update `README.md` (dev + deploy instructions).
- [ ] Ask Algolia to remove the dead `infection` index, or leave it (harmless once unreferenced).

---

## 8. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| **Anchor drift** (§5.4) breaks 225 internal + unknown external deep links | **High** | Custom slugify in `markdown.anchor`; automated anchor diff in CI |
| Vue-template parse errors from raw HTML / `{{ }}` in existing markdown | Medium | Build fails loudly; fix with `v-pre`. Budget a pass over all 38 files |
| Blog/feed/archives must be hand-rolled (VitePress has no blog primitives) | Medium | ~40 lines of `createContentLoader`; scope it in Phase 4, don't gold-plate |
| Theme replication eats the schedule | Medium | Phase 0 decision: re-skin the default theme instead of rebuilding the fork |
| `service-worker.js` cached at `/service-worker.js` keeps serving stale assets to returning visitors | Medium | Ship a self-unregistering stub at the same path for one release cycle rather than deleting it outright |
| Blog `rewrites` map drifts from post dates | Low | Generate at build time from frontmatter; never hand-edit |
| VitePress v2 churn | Low | Pin 1.x; treat the v2 upgrade as a separate, later task |

## 9. Open questions for the maintainers

1. Replicate the current design, or adopt the VitePress default theme with Infection colors?
2. Archives/pagination — stubs, single index page, or full reimplementation?
3. Should the site source move into the `infection/infection.github.io` repo (enabling `actions/deploy-pages`), or keep the two-repo push?
4. Is the empty `CNAME` load-bearing?
5. Keep `/menu/` as a page, or fold it into the nav?
