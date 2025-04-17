<template>
  <div class="container">
    <div class="home">
      <QueueSelector @queueSelected="onQueueSelected" />
      <QueueDetails :queue="queue" v-if="queue.id" />
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.home {
  width: 700px; /* Reduced width */
}
</style>

<script lang="ts">
import platformClient from 'purecloud-platform-client-v2'
import genesysCloudService from '@/services/genesyscloud-service'
import { defineComponent } from 'vue'
import QueueSelector from '@/components/QueueSelector.vue'
import QueueDetails from '@/components/QueueDetails.vue'

export default defineComponent({
  name: 'Home',
  components: {
    QueueSelector,
    QueueDetails
  },
  data () {
    return {
      queue: {} as platformClient.Models.Queue
    }
  },
  methods: {
    async onQueueSelected (queueId: string): Promise<void> {
      console.log('Queue selected:', queueId)
      this.queue = await genesysCloudService.getQueue(queueId) ?? {}
      console.log('Queue ', this.queue)
    }
  }
})
</script>
