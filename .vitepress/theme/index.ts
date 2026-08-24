import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AdoptionStats from './components/AdoptionStats.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    // Slotted between the hero and the feature cards on the home page only;
    // the slot is a no-op on every other layout, so nothing else is touched.
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(AdoptionStats)
    })
  }
}
