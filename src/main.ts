import { createApp } from 'vue';
import App from './App.vue';
import './index.css';

const app = createApp(App);

// Global v-focus directive
app.directive('focus', {
  mounted(el) {
    el.focus();
  }
});

app.mount('#app');
