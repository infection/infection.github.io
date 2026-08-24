<script setup lang="ts">
import { computed } from 'vue'
import { data as packagist } from '../../packagist.data'

/**
 * Rounds down to a "safe" headline figure -- 31,063,019 becomes "31M+", not
 * "31.1M". Rounding down keeps the claim true for as long as the page is
 * cached, which matters because the numbers only ever go up.
 */
function compact(n: number): string {
  if (n >= 1_000_000) {
    const millions = Math.floor(n / 100_000) / 10
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
  }

  if (n >= 10_000) {
    return `${Math.floor(n / 1_000)}K`
  }

  return n.toLocaleString('en-US')
}

const stats = computed(() => [
  {
    value: `${compact(packagist.installsTotal)}+`,
    label: 'installs to date',
    note: `${packagist.installsTotal.toLocaleString('en-US')} via Composer`
  },
  {
    value: `${compact(packagist.installsMonthly)}`,
    label: 'installs a month',
    note: `about ${packagist.installsDaily.toLocaleString('en-US')} every day`
  },
  {
    value: packagist.dependents.toLocaleString('en-US'),
    label: 'packages depend on it',
    note: 'listed as a dependency on Packagist'
  },
  {
    value: compact(packagist.githubStars),
    label: 'stars on GitHub',
    note: 'infection/infection'
  }
])
</script>

<template>
  <section class="adoption">
    <div class="adoption-container">
      <p class="adoption-eyebrow">Adopted across the PHP ecosystem</p>
      <h2 class="adoption-title">
        The standard for mutation testing in PHP
      </h2>
      <p class="adoption-lede">
        Infection is the tool the PHP community reaches for when line coverage
        stops being convincing — used by frameworks, libraries and application
        teams to prove their tests actually assert something.
      </p>

      <dl class="adoption-grid">
        <div v-for="stat in stats" :key="stat.label" class="adoption-stat">
          <dt class="adoption-value">{{ stat.value }}</dt>
          <dd class="adoption-label">
            {{ stat.label }}
            <span class="adoption-note">{{ stat.note }}</span>
          </dd>
        </div>
      </dl>

      <p class="adoption-source">
        Source:
        <a href="https://packagist.org/packages/infection/infection" target="_blank" rel="noreferrer">
          packagist.org/packages/infection/infection
        </a>
        <span class="adoption-asof">— as of {{ packagist.fetchedAt }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.adoption {
  border-top: 1px solid var(--vp-c-divider);
  padding: 64px 24px;
}

.adoption-container {
  max-width: 1152px;
  margin: 0 auto;
}

.adoption-eyebrow {
  margin: 0;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.adoption-title {
  margin: 12px 0 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.adoption-lede {
  max-width: 62ch;
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.6;
}

.adoption-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin: 40px 0 0;
}

.adoption-stat {
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  transition: border-color 0.25s;
}

.adoption-stat:hover {
  border-color: var(--vp-c-brand-1);
}

.adoption-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--vp-c-brand-1);
}

/* Same gradient as the hero wordmark, so the figures read as one family.
   Behind @supports because the transparent fill would hide the numbers
   entirely anywhere background-clip: text is unavailable. */
@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .adoption-value {
    background: var(--vp-home-hero-name-background);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.adoption-label {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

.adoption-note {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.adoption-source {
  margin: 28px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.adoption-source a {
  color: var(--vp-c-text-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.25s;
}

.adoption-source a:hover {
  color: var(--vp-c-brand-1);
}

.adoption-asof {
  white-space: nowrap;
}

@media (min-width: 640px) {
  .adoption-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .adoption-title {
    font-size: 32px;
  }
}

@media (min-width: 960px) {
  .adoption {
    padding: 80px 48px;
  }

  .adoption-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
