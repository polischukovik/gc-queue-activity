<template>
  <router-view/>
</template>

<style>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  background-color: #f5f7fa;
  /* Ensure no implicit minimum width from body */
  min-width: 0;
}

#app {
  min-height: 100vh;
  /* Add a minimum width for the application content */
  min-width: 320px; /* Adjust this value as needed */
  text-align: center;
  padding: 16px;
  box-sizing: border-box;
  /* Allow content within #app to contribute to its minimum width if needed */
  width: 100%; /* Ensure it takes full width up to its container */
  overflow-x: hidden; /* Hide horizontal overflow if any child content exceeds min-width */
}

#nav {
  padding: 10px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}

select {
  color: #2c3e50;
}

/* Responsive breakpoints */
@media (max-width: 768px) {
  #app {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  #app {
    padding: 8px;
  }
}
</style>

<script lang="ts">
import genesysCloud from '@/services/genesyscloud-service'
import config from '@/config/config'

export default {
  name: 'Agent Monitoring App',
  async created (): Promise<void> {
    await genesysCloud.loginImplicitGrant()
    history.pushState({}, '', config.redirectUri)
  }
}
</script>
