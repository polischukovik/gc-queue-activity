<template>
  <div class="container">
    <div class="loading" v-show="isLoading">
      <div class="loading-spinner"></div>
      Loading Members...
    </div>
    <div class="table" v-show="!isLoading">
      <div
        v-for="queueMember of queueMembers"
        :key="queueMember.id"
        class="member-row"
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
  margin-top: 4px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  width: 100%;
  padding-top: 0;
}

.table {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-row {
  width: 100%;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  font-size: 0.9em;
  color: #4E5054;
  gap: 8px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #E3E3E3;
  border-top: 2px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.no-users {
  padding: 12px;
  font-size: 0.9em;
  color: #4E5054;
  text-align: center;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .container {
    max-height: calc(100vh - 110px);
  }
}

@media (max-width: 480px) {
  .container {
    margin-top: 3px;
    max-height: calc(100vh - 100px);
  }
  
  .loading, .no-users {
    padding: 10px;
    font-size: 0.85em;
  }
  
  .table {
    gap: 3px;
  }
}
</style>

<script lang="ts">
import genesyscloudService from '@/services/genesyscloud-service'
import platformClient from 'purecloud-platform-client-v2'
import { defineComponent } from 'vue'
import QueueMemberDetails from './QueueMemberDetails.vue'

// Extend PresenceDefinition interface to allow storing original presence
declare module 'purecloud-platform-client-v2' {
  namespace Models {
    interface PresenceDefinition {
      originalSystemPresence?: string;
    }
  }
}

// Create a converter function to convert OutOfOffice to OutOfOfficeData
function convertToOutOfOfficeData(outOfOffice: platformClient.Models.OutOfOffice | undefined | null): any {
  if (!outOfOffice) return null;
  
  return {
    active: outOfOffice.active === true, // Ensure it's boolean
    indefinite: outOfOffice.indefinite === true, // Ensure it's boolean
    startDate: outOfOffice.startDate,
    endDate: outOfOffice.endDate
  };
}

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

      // Apply effective status that considers out of office
      this.updateEffectiveStatuses()

      // modifiedDate can be > now (!) -> modifiedDate := now
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
    // Update all members' effective statuses
    updateEffectiveStatuses(): void {
      this.queueMembers.forEach(member => {
        if (member.user?.presence?.presenceDefinition) {
          const presenceId = member.user.presence.presenceDefinition.id || ''
          
          // Convert OutOfOffice to OutOfOfficeData
          const outOfOfficeData = convertToOutOfOfficeData(member.user.outOfOffice)
          
          // Set the effective status that considers out of office state
          const effectiveStatus = genesyscloudService.getEffectiveStatus(presenceId, outOfOfficeData)
          
          // Store the original system presence
          const originalPresence = member.user.presence.presenceDefinition.systemPresence || ''
          
          // Store original presence as a custom property
          member.user.presence.presenceDefinition.originalSystemPresence = originalPresence
          
          // Override system presence with effective status
          member.user.presence.presenceDefinition.systemPresence = effectiveStatus
        }
      })
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
      if (!queueMember?.user) {
        console.error('User not found in queue')
        return
      }

      switch (updatedProperty) {
        case 'presence': {
          if (queueMember.user.presence && eventBody.presenceDefinition) {
            // Store the original presence ID and system presence before updating
            const presenceId = eventBody.presenceDefinition.id || ''
            const originalSystemPresence = genesyscloudService.getPresenceName(presenceId)

            // Update the presence definition
            queueMember.user.presence.presenceDefinition = eventBody.presenceDefinition

            // Always store the original system presence
            if (queueMember.user.presence.presenceDefinition) {
              queueMember.user.presence.presenceDefinition.originalSystemPresence = originalSystemPresence
            }

            // Safely update modifiedDate
            // modifiedDate can be > now (!) -> modifiedDate := now
            const modifiedDate = new Date(eventBody.modifiedDate)
            const adjustedNow = new Date(Date.now() + genesyscloudService.getServerOffset())
            if (modifiedDate > adjustedNow) {
              queueMember.user.presence.modifiedDate = adjustedNow.toISOString()
            } else {
              queueMember.user.presence.modifiedDate = eventBody.modifiedDate
            }

            // After updating presence, recalculate the effective status
            this.updateEffectiveStatusForMember(queueMember)
          }
          break
        }
        case 'routingStatus': {
          // Update routing status
          queueMember.user.routingStatus = eventBody.routingStatus
          
          // No need to show an alert anymore as we'll highlight it visually
          // if (eventBody.routingStatus.status === 'NOT_RESPONDING') {
          //   this.showNotRespondingAlert(queueMember.user)
          // }
          break
        }
        case 'outofoffice': {
          // Update out of office data
          queueMember.user.outOfOffice = eventBody

          // After updating outOfOffice, recalculate the effective status
          this.updateEffectiveStatusForMember(queueMember)
          break
        }
      }
    },
    updateEffectiveStatusForMember(queueMember: platformClient.Models.QueueMember): void {
      if (!queueMember?.user?.presence?.presenceDefinition?.id) return;
      
      const presenceId = queueMember.user.presence.presenceDefinition.id;
      
      // Store the original system presence for later color determination
      // This ensures we remember the base status even when overridden by Out of Office
      if (queueMember.user.presence.presenceDefinition && !queueMember.user.presence.presenceDefinition.originalSystemPresence) {
        queueMember.user.presence.presenceDefinition.originalSystemPresence = 
          genesyscloudService.getPresenceName(presenceId);
      }
      
      // Convert to OutOfOfficeData
      const outOfOfficeData = convertToOutOfOfficeData(queueMember.user.outOfOffice);
      
      // Update the effective status considering the current presence and out of office state
      const effectiveStatus = genesyscloudService.getEffectiveStatus(presenceId, outOfOfficeData);
      
      // Update the displayed status - with proper type safety
      if (queueMember.user.presence.presenceDefinition) {
        queueMember.user.presence.presenceDefinition.systemPresence = effectiveStatus;
      }
    }
  }
})
</script>
