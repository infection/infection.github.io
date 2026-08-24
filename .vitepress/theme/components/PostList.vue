<script setup lang="ts">
import { computed } from 'vue'
import { data as posts } from '../../../posts/index.data'

/** How many section headings fit on a card before the rest become "+N more". */
const VISIBLE_SECTIONS = 4

/**
 * Some headings are whole sentences ("Major performance improvement for the
 * projects with slow test suites, ..."). Clipped on a word boundary so one of
 * them cannot stretch a card's chip row past everything around it; the full
 * text stays in the title attribute.
 */
const CHIP_LENGTH = 44

function clip(section: string): string {
  if (section.length <= CHIP_LENGTH) return section

  const cut = section.slice(0, CHIP_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')

  return `${(lastSpace > CHIP_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:]$/, '')}…`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

/**
 * `posts` arrives newest-first from loadPosts(), so grouping in order gives
 * newest-first years for free -- no second sort, no year parsing beyond the
 * four digits the permalink already carries.
 */
const years = computed(() => {
  const groups: { year: string; posts: typeof posts }[] = []

  for (const post of posts) {
    const year = post.date.slice(0, 4)
    const last = groups.at(-1)

    if (last?.year === year) last.posts.push(post)
    else groups.push({ year, posts: [post] })
  }

  return groups
})

const span = computed(() => {
  const oldest = posts.at(-1)?.date.slice(0, 4)
  const newest = posts[0]?.date.slice(0, 4)

  return oldest === newest ? newest : `${oldest}–${newest}`
})

const plural = (count: number) => `${count} ${count === 1 ? 'post' : 'posts'}`

const overflow = (count: number) => count - VISIBLE_SECTIONS
</script>

<template>
  <section class="posts">
    <p class="posts-eyebrow">Blog</p>
    <h1 class="posts-heading">Posts</h1>
    <p class="posts-lede">
      Everything published here, newest first — {{ plural(posts.length) }}
      between {{ span }}.
    </p>

    <div v-for="group in years" :key="group.year" class="posts-year">
      <h2 class="posts-year-label">
        {{ group.year }}
        <span class="posts-year-count">{{ plural(group.posts.length) }}</span>
      </h2>

      <ul class="posts-list">
        <li v-for="post of group.posts" :key="post.url">
          <a class="posts-card" :href="post.url">
            <span class="posts-card-title">{{ post.title }}</span>
            <time class="posts-card-date" :datetime="post.date">{{ formatDate(post.date) }}</time>

            <span v-if="post.sections.length" class="posts-sections">
              <span
                v-for="section of post.sections.slice(0, VISIBLE_SECTIONS)"
                :key="section"
                class="posts-section"
                :title="section"
              >{{ clip(section) }}</span>
              <span v-if="overflow(post.sections.length) > 0" class="posts-section posts-more">
                +{{ overflow(post.sections.length) }} more
              </span>
            </span>
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.posts-eyebrow {
  margin: 0;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.posts-heading {
  margin: 8px 0 0;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.posts-lede {
  max-width: 62ch;
  margin: 16px 0 0;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.7;
}

.posts-year {
  margin-top: 48px;
}

/* Sticks under the fixed nav so the year stays visible while its cards scroll. */
.posts-year-label {
  position: sticky;
  top: var(--vp-nav-height);
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0;
  padding: 10px 0;
  /* .vp-doc h2 draws a rule above every h2; this one carries its own below. */
  border-top: none;
  border-bottom: 1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.posts-year-count {
  color: var(--vp-c-text-3);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
}

.posts-list {
  list-style: none;
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
  padding: 0;
}

/* .vp-doc li + li adds a top margin that grid rows would inherit unevenly.
   The flex is what lets the card fill its row, so two cards side by side end
   level even when one has twice the chips. */
.posts-list li {
  display: flex;
  margin: 0;
}

.posts-card {
  display: block;
  flex: 1;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  color: inherit;
  font-weight: 400;
  text-decoration: none;
  transition: border-color 0.25s, background-color 0.25s, transform 0.25s;
}

.posts-card:hover {
  color: inherit;
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-elv);
  transform: translateY(-2px);
}

.posts-card-title {
  display: block;
  color: var(--vp-c-brand-1);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.posts-card-date {
  display: block;
  margin-top: 4px;
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.posts-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.posts-section {
  padding: 3px 10px;
  border-radius: 999px;
  background-color: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
}

.posts-more {
  background-color: transparent;
  color: var(--vp-c-text-3);
}

.posts-card:hover .posts-section:not(.posts-more) {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

@media (min-width: 640px) {
  .posts-heading {
    font-size: 48px;
  }

  .posts-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
