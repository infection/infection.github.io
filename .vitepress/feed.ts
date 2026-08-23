/**
 * /atom.xml -- same path and, crucially, the same entry <id>s as the Hexo feed,
 * so existing readers do not re-notify every subscriber about 19 old posts.
 *
 * Hexo's feed plugin has no VitePress equivalent, so the entries are rendered
 * here with VitePress's own markdown-it instance (custom slugify included, so
 * in-feed anchors match the site).
 */
import { writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { createMarkdownRenderer } from 'vitepress'
import { slugify } from './slugify'
import { normalizeHexoFrontmatter } from './hexo-frontmatter'
import type { Post } from './posts'

const SITE = 'https://infection.github.io'
const AUTHOR = 'Maks Rafalko'
const TITLE = 'Infection'

export async function writeAtomFeed(outDir: string, posts: Post[]): Promise<void> {
  const srcDir = join(__dirname, '..')
  const md = await createMarkdownRenderer(srcDir, {
    anchor: { slugify },
    breaks: true,
    typographer: true
  })

  const entries = posts.map((post) => {
    const raw = readFileSync(join(srcDir, post.source), 'utf-8')
    const { content } = matter(normalizeHexoFrontmatter(raw))
    const url = SITE + post.url

    return [
      '  <entry>',
      `    <title>${escapeXml(post.title)}</title>`,
      `    <link href="${url}"/>`,
      // Must not change: this is the identity a feed reader dedupes on.
      `    <id>${url}</id>`,
      `    <published>${post.date}</published>`,
      `    <updated>${post.date}</updated>`,
      `    <content type="html"><![CDATA[${stripCdataEnd(md.render(content))}]]></content>`,
      '  </entry>'
    ].join('\n')
  })

  const feed = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${TITLE}</title>`,
    '  <link href="/atom.xml" rel="self"/>',
    `  <link href="${SITE}/"/>`,
    // Derived from the newest post rather than build time, so rebuilding an
    // unchanged site produces an unchanged feed.
    `  <updated>${posts[0].date}</updated>`,
    `  <id>${SITE}/</id>`,
    '  <author>',
    `    <name>${AUTHOR}</name>`,
    '  </author>',
    '  <generator uri="https://vitepress.dev/">VitePress</generator>',
    ...entries,
    '</feed>',
    ''
  ].join('\n')

  await writeFile(join(outDir, 'atom.xml'), feed, 'utf-8')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** A `]]>` inside post HTML would close the CDATA section early. */
function stripCdataEnd(html: string): string {
  return html.replace(/]]>/g, ']]&gt;')
}
