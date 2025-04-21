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
  justify-content: flex-start;
  align-items: center;
  width: 100%;
}

.home {
  width: 100%;
  max-width: 700px;
  box-sizing: border-box;
  padding: 0 8px;
}

/* Responsive styles */
@media (max-width: 768px) {
  .home {
    max-width: 95%;
  }
}

@media (max-width: 480px) {
  .container {
    padding-top: 8px;
  }
  
  .home {
    max-width: 100%;
  }
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
