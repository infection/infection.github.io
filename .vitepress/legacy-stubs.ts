/**
 * Meta-refresh stubs for the Hexo generator output nobody links to any more.
 *
 * Hexo emitted 24 paginated `/archives/**` pages plus `/page/2/`. They were
 * never in the site's own navigation, so their only remaining value is "an old
 * link or a search engine still points there". Reimplementing year/month
 * pagination for pages nobody visits is not worth it; 200-byte redirect stubs
 * make the "every URL still resolves" claim literally true for ~0 maintenance.
 *
 * `/archives/` itself is in that set: the post index lives at `/posts/`
 * (posts/index.md), so the old URL redirects there like the rest.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { loadPosts } from './posts'

const TARGET = '/posts/'

export async function writeLegacyStubs(outDir: string): Promise<void> {
  for (const path of legacyArchivePaths()) {
    const file = join(outDir, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, stub(TARGET), 'utf-8')
  }
}

/** Exactly the paths Hexo used to emit, derived from the posts themselves. */
export function legacyArchivePaths(): string[] {
  const years = new Set<string>()
  const months = new Set<string>()

  for (const post of loadPosts()) {
    const [, year, month] = post.url.split('/')
    years.add(year)
    months.add(`${year}/${month}`)
  }

  return [
    'archives/index.html',
    ...[...years].sort().map((year) => `archives/${year}/index.html`),
    ...[...months].sort().map((month) => `archives/${month}/index.html`),
    // Hexo paginated both the archive index and the home page at 10 per page.
    'archives/page/2/index.html',
    'page/2/index.html'
  ]
}

function stub(target: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<meta name="robots" content="noindex">
<title>Redirecting&hellip;</title>
</head>
<body><p>Redirecting to <a href="${target}">${target}</a>&hellip;</p></body>
</html>
`
}
