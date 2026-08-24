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
| `posts/*.md` | 19 release posts → `/YYYY/MM/DD/<slug>/` via `rewrites` |
| `archives/` | post index → `/archives/` |
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

## Regenerating the URL contract

`bin/url-manifest.json` is extracted from the last Hexo build:

```bash
npm run manifest   # reads ../infection-site/public
```

It should only be regenerated if the legacy build itself is rebuilt.
