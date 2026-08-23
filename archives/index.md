---
title: Archives
description: Every Infection release post.
---

<script setup>
import { data as posts } from './posts.data'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
</script>

# Archives

<ul>
  <li v-for="post of posts" :key="post.url">
    <a :href="post.url">{{ post.title }}</a>
    <span> &mdash; <time :datetime="post.date">{{ formatDate(post.date) }}</time></span>
  </li>
</ul>
