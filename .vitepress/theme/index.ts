import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AdoptionStats from './components/AdoptionStats.vue'
import MutantHunt from './components/MutantHunt.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Slotted between the hero and the feature cards on the home page only;
      // the slot is a no-op on every other layout, so nothing else is touched.
      'home-hero-after': () => h(AdoptionStats),
      // Landing-page easter egg. Renders nothing at all until the trigger word
      // is typed, and gates itself on `layout: home` internally.
      'layout-bottom': () => h(MutantHunt)
    })
  }
}
