<template>
  <div class="member-container" :class="{ 'not-responding': isNotResponding }">
    <div class="profile-picture" :style="{ borderColor: presenceColor }">
      <img :src="imageURI" />
    </div>
    <div class="info">
      <div class="name">{{ name }}</div>
      <div class="status-line">
        <span class="presence">{{ presence }}</span>
        <span v-if="isNotResponding" class="not-responding-badge">Not Responding</span>
        <span class="status-duration" v-html="formattedTimeInStatus"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: 0;
  background: #FAFAFA;
  border: 1px solid #E3E3E3;
  border-radius: 8px;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.member-container.not-responding {
  background: rgba(255, 232, 232, 0.9);
  border-color: #FFAAAA;
  box-shadow: 0 0 5px rgba(255, 0, 0, 0.15);
}

.profile-picture {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #ccc;
  overflow: hidden;
  flex-shrink: 0;
}

.profile-picture img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
  overflow: hidden;
}

.name {
  font-weight: 500;
  color: #23395D;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.status-line {
  display: flex;
  justify-content: flex-start;
  gap: 6px;
  color: #4E5054;
  font-size: 0.75rem;
  text-align: left;
}

.presence,
.status-duration {
  white-space: nowrap;
}

.status-duration small {
  font-size: 0.65rem;
  color: #959699;
}

.not-responding-badge {
  background-color: #ff3333;
  color: white;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>

<script lang="ts">
import platformClient from 'purecloud-platform-client-v2'
import genesysCloudService from '@/services/genesyscloud-service'
import { defineComponent, PropType } from 'vue'

const defaultProfilePicture = '.\\img\\icon-queue-activity.svg'

export default defineComponent({
  name: 'QueueMemberDetails',
  props: {
    queueMember: {
      type: Object as PropType<platformClient.Models.QueueMember>,
      required: true
    },
    serverTime: {
      type: Date,
      required: true
    }
  },
  data () {
    return {
      now: new Date(),
      serverNow: new Date(this.serverTime),
      timer: null as ReturnType<typeof setInterval> | null
    }
  },
  computed: {
    name (): string | undefined {
      return this.queueMember?.name
    },
    presence (): string | undefined {
      return this.queueMember?.user?.presence?.presenceDefinition?.systemPresence
    },
    // Get the original system presence (primary status)
    originalPresence (): string | undefined {
      return this.queueMember?.user?.presence?.presenceDefinition?.originalSystemPresence
    },
    // Check if the agent is in Not Responding state
    isNotResponding (): boolean {
      return this.queueMember?.user?.routingStatus?.status === 'NOT_RESPONDING'
    },
    imageURI (): string {
      const images = this.queueMember?.user?.images
      let imageUri = defaultProfilePicture
      if (images) imageUri = images[images.length - 1].imageUri || imageUri
      return imageUri
    },
    modifiedDate (): Date | null {
      return this.queueMember?.user?.presence?.modifiedDate
        ? new Date(this.queueMember.user.presence.modifiedDate)
        : null
    },
    formattedTimeInStatus (): string {
      if (!this.modifiedDate) return ''

      // Adjust modifiedDate to local time using the same offset applied to server time
      const adjustedModifiedDate = new Date(this.modifiedDate.getTime() - genesysCloudService.getServerOffset())

      let seconds = Math.floor((this.now.getTime() - adjustedModifiedDate.getTime()) / 1000)
      if (seconds < 0) seconds = 0

      const days = Math.floor(seconds / (3600 * 24))
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)

      if (days > 0) return `${days}<small>d</small>`
      if (hours > 0) return `${hours}<small>h</small> ${minutes}<small>m</small>`
      if (minutes > 0) return `${minutes}<small>m</small> ${seconds % 60}<small>s</small>`
      return `${seconds}<small>s</small>`
    },
    presenceColor (): string {
      // If agent is in Not Responding state, return a distinct color
      if (this.isNotResponding) {
        return '#ff3333' // Bright red for Not Responding
      }
      
      // Special case for Out of Office
      if (this.presence === 'Out of Office') {
        return '#ff1dce' // Pink
      }

      // For custom statuses, use the original system presence for color determination
      const originalPresence = this.originalPresence?.toLowerCase();
      const currentPresence = this.presence?.toLowerCase();

      // First try to use the original presence if available
      if (originalPresence) {
        switch (originalPresence) {
          case 'onqueue':
          case 'on queue':
            return '#52cef8'
          case 'available':
            return '#00FF00' // Green
          case 'busy':
            return '#FF0000' // Red
          case 'meeting':
            return '#FF0000' // Red
          case 'away':
          case 'break':
          case 'meal':
          case 'training':
            return '#FFFF00' // Yellow
        }
      }

      // Fall back to current presence if original is not available or not recognized
      if (currentPresence) {
        switch (currentPresence) {
          case 'onqueue':
          case 'on queue':
            return '#52cef8'
          case 'available':
            return '#00FF00' // Green
          case 'busy':
            return '#FF0000' // Red
          case 'meeting':
          case '1on1':
          case 'team':
            return '#FF0000' // Red for all meeting types
          case 'away':
          case 'break':
          case 'meal':
          case 'training':
            return '#FFFF00' // Yellow
          case 'project work':
          case 'tasks-customer facing':
          case 'tasks-non customer facing':
          case 'email':
            return '#FF0000' // Red for all busy types
        }
      }

      // Default if nothing matches
      return '#CCCCCC' // Default gray
    }
  },
  mounted () {
    this.timer = setInterval(() => {
      this.now = new Date(Date.now() + genesysCloudService.getServerOffset())
      this.serverNow = new Date(this.serverNow.getTime() + 1000)
    }, 1000)
  },
  beforeUnmount () {
    if (this.timer) clearInterval(this.timer)
  }
})
</script>