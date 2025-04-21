<template>
  <div class="queue-selector-container">
    <select @change="onChange" name="queue-selector" id="queue-selector" v-model="selectedOption">
      <option selected disabled hidden>Select Queue</option>
      <option v-for="queue in queues" :key="queue.id" :value="queue.id">
        {{ queue.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.queue-selector-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 10px;
  gap: 5px;
}

select {
  width: 100%;
  height: 40px;
  font-size: 1rem;
  padding: 0 12px;
  border: 2px solid #ccc;
  background-color: #fff;
  border-radius: 8px;
  color: #4E5054;
  box-sizing: border-box;
  outline: none;
}

select:focus {
  border-color: #4E92F6; /* Highlight border color on focus */
}

option {
  padding: 8px;
  font-size: 1rem;
}

option[selected] {
  color: #A2A2A2;
}

option:disabled {
  color: #D8D8D8;
}
</style>

<script lang="ts">
import platformClient from 'purecloud-platform-client-v2'
import genesysCloudService from '@/services/genesyscloud-service'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'QueueList',
  data () {
    return {
      queues: [] as platformClient.Models.Queue[],
      selectedOption: ''
    }
  },
  methods: {
    onChange (event: Event) {
      if (event.target) {
        const queueId = (event.target as HTMLSelectElement).value
        this.$emit('queueSelected', queueId)
      }
    }
  },
  emits: ['queueSelected'],
  created () {
    genesysCloudService.getQueues()
      .then(queues => {
        if (queues) this.queues = queues
      })
      .catch(err => console.error(err))
  }
})
</script>
