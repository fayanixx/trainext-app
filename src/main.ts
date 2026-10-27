import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import { IonicVue } from '@ionic/vue'

/* 1. Mga Default CSS ng Ionic (Hayaang ma-load muna ito) */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* 2. Optional CSS Utils */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'
import '@ionic/vue/css/palettes/dark.system.css'
import 'leaflet/dist/leaflet.css'

/* 3. Variables at Theme (DAPAT NASA PINAKADULO para ito ang manalo sa CSS priority) */
import './theme/variables.css'
import '@/theme/trainext-ui.css'

const app = createApp(App)
  .use(createPinia())
  .use(IonicVue)
  .use(router)

router.isReady().then(() => {
  app.mount('#app')
})