<template>
  <div class="member-container">
    <div class="profile-picture" :style="{ borderColor: presenceColor }">
      <img :src="imageURI" />
    </div>
    <div class="info">
      <div class="name">{{ name }}</div>
      <div class="status-line">
        <span class="presence">{{ presence }}</span>
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
  margin: 2px;
  background: #FAFAFA;
  border: 1px solid #E3E3E3;
  border-radius: 10px;
  font-size: 0.85rem;
}

.profile-picture {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid #ccc; /* Thicker border for status indication */
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
  gap: 8px;
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
      const presence = this.presence?.toLowerCase()
      console.log('changing status to: ' + presence)
      switch (presence) {
        case 'on queue':
          return '#52cef8'
        case 'available':
          return '#00FF00' // Green
        case 'busy':
        case 'meeting':
          return '#FF0000' // Red
        case 'away':
        case 'break':
        case 'meal':
        case 'training':
          return '#FFFF00' // Yellow
        case 'out of office':
          return '#ff1dce' // Pink
        default:
          return '#CCCCCC' // Default gray
      }
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
