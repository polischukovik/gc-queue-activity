<template>
  <div class="container">
    <div class="loading" v-show="isLoading">
      Loading Members...
    </div>
    <div class="table" v-show="!isLoading">
      <div
        v-for="queueMember of queueMembers"
        :key="queueMember.id"
      >
        <QueueMemberDetails :queueMember="queueMember" :serverTime="serverTime" />
      </div>
    </div>
    <div class="no-users" v-show="showNoUsers">
      No users assigned in this queue. 😞
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  margin-top: 5px; /* Reduced margin */
}

.table {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.loading {
  margin: 15px; /* Reduced margin */
  font-size: 1em; /* Reduced font size */
}

.no-users {
  margin: 15px; /* Reduced margin */
  font-size: 1em; /* Reduced font size */
}
</style>

<script lang="ts">
import genesyscloudService from '@/services/genesyscloud-service'
import platformClient from 'purecloud-platform-client-v2'
import { defineComponent } from 'vue'
import QueueMemberDetails from './QueueMemberDetails.vue'

export default defineComponent({
  name: 'QueueDetails',
  components: {
    QueueMemberDetails
  },
  props: {
    queue: {
      type: Object as () => platformClient.Models.Queue,
      required: true
    }
  },
  data () {
    return {
      queueMembers: [] as platformClient.Models.QueueMember[],
      isLoading: false,
      showNoUsers: false,
      serverTime: new Date()
    }
  },
  async created (): Promise<void> {
    console.log('QueueDetails created')
    await genesyscloudService.fetchPresenceDefinitions()
    this.serverTime = await genesyscloudService.fetchServerTime()
    await this.loadQueueMembers()
  },
  watch: {
    queue: async function (): Promise<void> {
      console.log('Queue changed:', this.queue)
      this.isLoading = true
      this.showNoUsers = false

      if (!this.queue?.id) {
        console.error('Queue not found')
        return
      }

      await this.loadQueueMembers()
      this.isLoading = false
    }
  },
  methods: {
    async loadQueueMembers (): Promise<void> {
      if (!this.queue.id) {
        console.error('Queue ID is undefined')
        return
      }
      console.log('Loading queue members for queue:', this.queue.id)
      this.queueMembers = await genesyscloudService.getMembersOfQueue(this.queue.id) ?? []
      console.log('Queue members loaded:', this.queueMembers)

      // modifiedDate can be > now (!) -> modifiedDate := now
      // TODO: issue - change status, refresh page - couter starts with 0
      //       each time until modifiedDate-now seconds elapses
      const adjustedNow = new Date(Date.now() + genesyscloudService.getServerOffset())
      this.queueMembers.forEach(member => {
        if (member.user?.presence?.modifiedDate) {
          const modifiedDate = new Date(member.user.presence.modifiedDate)
          if (modifiedDate > adjustedNow) {
            member.user.presence.modifiedDate = adjustedNow.toISOString()
          }
        }
      })

      const userIds = this.queueMembers.map(member => member.id ?? '')
      if (userIds.length <= 0) {
        console.log('No users in queue')
        this.showNoUsers = true
      } else {
        await genesyscloudService.subscribeToUsersStatus(userIds, [this.onUserEvent])
      }
    },
    // Callback function when Genesys Cloud fires notifications based on the queue members
    onUserEvent (message: MessageEvent): void {
      const data = JSON.parse(message.data)
      const topicName = data.topicName
      const eventBody = data.eventBody

      // Update agent view
      const topicRegex = /(v2\.users\.)(.*)\.(.*)/g
      const match = topicRegex.exec(topicName)
      if (!match) return

      const userId = match[2]
      const updatedProperty = match[3]
      console.log('User event:', userId, updatedProperty)

      const queueMember = this.queueMembers.find(member => member.id === userId)
      if (!queueMember?.user?.presence) {
        console.error('User not found in queue')
        return
      }

      switch (updatedProperty) {
        case 'presence': {
          if (queueMember.user.presence.presenceDefinition) {
            queueMember.user.presence.presenceDefinition.systemPresence = genesyscloudService.getPresenceName(eventBody.presenceDefinition.id)
          }
          // modifiedDate can be > now (!) -> modifiedDate := now
          const modifiedDate = new Date(eventBody.modifiedDate)
          const adjustedNow = new Date(Date.now() + genesyscloudService.getServerOffset())
          if (modifiedDate > adjustedNow) {
            queueMember.user.presence.modifiedDate = adjustedNow.toISOString()
          } else {
            queueMember.user.presence.modifiedDate = eventBody.modifiedDate
          }
          break
        }
        case 'routingStatus': {
          queueMember.user.routingStatus = eventBody.routingStatus
          if (eventBody.routingStatus.status === 'NOT_RESPONDING') {
            this.showNotRespondingAlert(queueMember.user)
          }
          break
        }
      }
    },
    showNotRespondingAlert (user: platformClient.Models.User): void {
      alert(`${user.name} is not responding.`)
    }
  }
})
</script>
