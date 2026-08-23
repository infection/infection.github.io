// Build-time data loader: the post list, straight from the post frontmatter.
import { loadPosts } from '../.vitepress/posts'

export default {
  watch: ['../posts/*.md'],
  load: () => loadPosts()
}
