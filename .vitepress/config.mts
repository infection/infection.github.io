import { join } from 'node:path'
import { defineConfig } from 'vitepress'
import { slugify } from './slugify'
import { markedHtmlBlocks } from './marked-html-blocks'
import { externalScripts } from './external-scripts'
import { publicAssetLinks } from './public-asset-links'
import { hexoFrontmatterPlugin } from './hexo-frontmatter'
import { loadPosts, postRewrites } from './posts'
import { guideSidebar } from './sidebar'
import { writeAtomFeed } from './feed'
import { writeLegacyStubs } from './legacy-stubs'

const posts = loadPosts()

export default defineConfig({
  title: 'Infection',
  description: 'PHP Mutation Testing Framework',
  lang: 'en-US',

  srcDir: '.',
  outDir: '.vitepress/dist',

  // Non-negotiable. `cleanUrls: true` would turn every /guide/x.html into
  // /guide/x and break every inbound link on the internet.
  cleanUrls: false,

  srcExclude: ['MIGRATION_PLAN.md', 'README.md', 'TODO.md'],

  ignoreDeadLinks: [
    // Absolute dev-server URLs baked into a 2018 post. Already broken on the
    // live site; left alone here because the .md files are byte-identical
    // copies pending a content decision.
    /^http:\/\/localhost:4000\//,
    // A real file in public/, but ".pub" is not on VitePress's asset-extension
    // list so its checker looks for "infection.pub.html". public-asset-links.ts
    // keeps the emitted href correct; bin/check-urls.mjs verifies it resolves.
    '/files/infection.pub'
  ],

  // /2022/01/10/whats-new-in-0.26.0/ and friends, derived from post dates.
  rewrites: postRewrites(posts),

  head: [
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/icons/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/images/icons/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/images/icons/apple-touch-icon.png' }],
    ['link', { rel: 'mask-icon', href: '/images/icons/safari-pinned-tab.svg', color: '#42b983' }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['link', { rel: 'alternate', type: 'application/atom+xml', title: 'Infection', href: '/atom.xml' }],
    ['meta', { name: 'theme-color', content: '#42b983' }]
  ],

  markdown: {
    // The one setting that keeps ~225 internal deep links alive. See slugify.ts.
    anchor: { slugify },
    // Hexo rendered with `breaks: true`; without it every single newline in
    // 38 files stops becoming a <br> and paragraph spacing changes site-wide.
    breaks: true,
    // Closest markdown-it equivalent of Hexo's `smartypants: true`. It is what
    // turns "PHPUnit's" into "PHPUnit’s" -- which some live anchors depend on.
    typographer: true,
    config: (md) => {
      // Order matters: externalScripts is installed last, so it runs first and
      // strips `<script src>` tags before markedHtmlBlocks inline-renders the
      // block they sit in (the Twitter embeds put one next to a <blockquote>).
      markedHtmlBlocks(md)
      externalScripts(md)
      publicAssetLinks(md, join(__dirname, '..', 'public'))
    }
  },

  sitemap: { hostname: 'https://infection.github.io' },

  vite: {
    plugins: [hexoFrontmatterPlugin()]
  },

  themeConfig: {
    logo: '/images/logo.png',
    siteTitle: 'Infection',

    // Replaces the dead docsearch.js v2 setup (headings-only index, crawler no
    // longer running). MiniSearch indexes full content at build time.
    search: { provider: 'local' },

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Playground', link: 'https://infection-php.dev/' },
      { text: 'Posts', link: posts[0].url, activeMatch: '^/\\d{4}/' },
      {
        text: 'Ecosystem',
        items: [
          {
            text: 'Help',
            items: [
              { text: 'Twitter', link: 'https://twitter.com/infection_php' },
              { text: 'Mastodon', link: 'https://mastodon.social/@infection_php' },
              { text: 'Discord', link: 'https://discord.gg/ZUmyHTJ' },
              { text: 'Discussions', link: 'https://github.com/infection/infection/discussions' }
            ]
          },
          {
            text: 'Resource Lists',
            items: [{ text: 'Official Repos', link: 'https://github.com/infection' }]
          }
        ]
      }
    ],

    sidebar: [
      ...guideSidebar(),
      {
        text: 'Posts',
        collapsed: false,
        items: posts.slice(0, 5).map((post) => ({ text: post.title, link: post.url }))
      }
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/infection/infection' }],

    editLink: {
      pattern: 'https://github.com/infection/infection.github.io/edit/master/:path',
      text: 'Edit this page on GitHub'
    },

    outline: { level: [2, 3] },

    footer: {
      message:
        'Released under the <a href="https://opensource.org/licenses/BSD-3-Clause">BSD-3-Clause License</a>',
      copyright: `Copyright © 2017-${new Date().getFullYear()} Maks Rafalko`
    }
  },

  async buildEnd(siteConfig) {
    await writeAtomFeed(siteConfig.outDir, posts)
    await writeLegacyStubs(siteConfig.outDir)
  }
})
