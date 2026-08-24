# infection.github.io

Source for [infection.github.io](https://infection.github.io), built with
[VitePress](https://vitepress.dev) (pinned to 1.x).

```bash
npm install
npm run docs:dev      # local dev server
npm run docs:build    # static build into .vitepress/dist
npm run check         # docs:build + verify every legacy URL and anchor still resolves
```

## Layout

| Path | What |
| --- | --- |
| `guide/*.md` | 19 documentation pages → `/guide/*.html` |
| `posts/<slug>.md` | 19 blog posts → `/YYYY/MM/DD/<slug>/` via `rewrites` |
| `posts/index.md` | post index → `/posts/` (the posts themselves live beside it) |
| `public/` | images, `files/infection.pub` (GPG key), `static/`, `manifest.json`, `CNAME` |
| `.vitepress/` | config plus the Hexo-compatibility modules described below |
| `bin/` | the URL/anchor verification harness |

## Migrated from Hexo — read before editing

The site ran on Hexo 3.8 until this migration. Three things are load-bearing:

- **`.vitepress/slugify.ts`** reproduces `hexo-util`'s heading slugs, which
  preserve capitalisation (`#Compatibility-Note`, not `#compatibility-note`).
  Replacing it with VitePress's default breaks ~225 internal deep links plus
  every anchor ever pasted into a GitHub issue.
- **`cleanUrls: false`** keeps the `/guide/*.html` namespace. Do not enable it.
- **`bin/check-urls.mjs`** asserts all 143 legacy paths and 377 legacy anchors
  still resolve, and that no internal link or fragment in the new build is dead.
  Run it on every PR.

The `.md` files under `guide/` and `posts/` are still byte-identical copies of
the Hexo originals, so most posts carry Hexo frontmatter (no opening `---`,
`layout: post`, `type: '{{type}}'`). `.vitepress/hexo-frontmatter.ts` normalises
that in memory; `.vitepress/marked-html-blocks.ts` restores marked's habit of
rendering markdown inside raw HTML blocks, which the `<p class="tip">` callouts
depend on. Both can be deleted once the source files are normalised for real.

## Landing page adoption numbers

The stats band under the hero (`31M+ installs`, `2,329 dependents`, …) is
rendered by `.vitepress/theme/components/AdoptionStats.vue` from data supplied
by `.vitepress/packagist.data.ts`, a VitePress data loader that reads
[the Packagist API](https://packagist.org/packages/infection/infection.json).

The loader runs **at build time**, and the result is inlined into the generated
HTML. Readers' browsers never call Packagist.

### Reloading the data

| Where | When it re-fetches |
| --- | --- |
| `npm run docs:build` / `npm run check` | **Every build.** Nothing is cached between builds — a rebuild is all a refresh takes. |
| `npm run docs:dev` | Once per dev-server start. Vite caches the loader module, and editing `.md` files will *not* re-run it. |

So in production the numbers are as fresh as the last deploy; to refresh them,
just build again.

In dev, to force a re-fetch without restarting the server, touch the loader —
VitePress invalidates the module when the loader file itself changes:

```bash
touch .vitepress/packagist.data.ts
```

### When Packagist is unreachable

The fetch has a 10s timeout and falls back to the `FALLBACK` snapshot hardcoded
in the loader, so an offline or egress-less build still succeeds. It is not
silent — the build logs:

```
[packagist.data] could not reach Packagist (fetch failed); using the 2026-08-24 snapshot.
```

If you see that line in CI, the deployed numbers are the snapshot's, not live.

### Refreshing the fallback snapshot

`FALLBACK` only shows up when the network fails, but it should not be allowed to
rot — the "as of" date on the page comes from it. Refresh it occasionally with:

```bash
curl -s https://packagist.org/packages/infection/infection.json \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['package']; \
      print(d['downloads'], d['dependents'], d['github_stars'])"
```

then update the constant and its `fetchedAt` date by hand.

Note that `github_stars` is Packagist's cached copy of the GitHub count and can
lag the real number by a day or so.

## Regenerating the URL contract

`bin/url-manifest.json` is extracted from the last Hexo build:

```bash
npm run manifest   # reads ../infection-site/public
```

It should only be regenerated if the legacy build itself is rebuilt.
