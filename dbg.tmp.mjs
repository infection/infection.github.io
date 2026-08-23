import { readFileSync } from 'node:fs'
import matter from 'gray-matter'
const { normalizeHexoFrontmatter } = await import('./.vitepress/hexo-frontmatter.ts')
const raw = readFileSync('posts/whats-new-in-0-8-0.md', 'utf8')
const n = normalizeHexoFrontmatter(raw)
console.log('normalized head:', JSON.stringify(n.slice(0, 120)))
const r = matter(n)
console.log('r.matter:', JSON.stringify(r.matter))
console.log('r.data:', r.data)
