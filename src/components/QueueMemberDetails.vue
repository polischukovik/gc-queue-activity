<template>
  <div
    class="member-container"
    :class="[`p-${presence}`, `rs-${routingStatus}`]"
  >
    <div class="profile-picture">
      <img :src="imageURI" />
    </div>
    <div class="name">
      {{ name }}
    </div>
    <div class="presence">
      {{ presence }}
    </div>
    <div class="routing-status">
      {{ routingStatus }}
    </div>
    <div class="status-duration">
      {{ formattedTimeInStatus }}
    </div>
  </div>
</template>

<style scoped>
.member-container {
  border: 1px solid #bbb;
  border-radius: 5px;
  padding: 5px 10px;
  margin: 2px;
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
}

.profile-picture img {
  width: 30px;
  height: 30px;
  border-radius: 100px;
  margin-right: 10px;
}

.name {
  text-align: left;
  width: 30%;
}

.presence,
.routing-status,
.status-duration,
.debug-info {
  width: 15%;
}

.rs-NOT_RESPONDING {
  background: #ffbbbb;
}

.rs-IDLE {
  background: #c0e2ff;
}

.p-Offline {
  background: #eee;
}

.debug-info {
  font-size: 0.8em;
  color: #666;
}
</style>

<script lang="ts">
import platformClient from 'purecloud-platform-client-v2'
import genesysCloudService from '@/services/genesyscloud-service'
import { defineComponent, PropType } from 'vue'

const defaulProfilePicture = './img/default-face.png'

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
    routingStatus (): string | undefined {
      return this.queueMember?.user?.routingStatus?.status
    },
    imageURI (): string {
      const images = this.queueMember?.user?.images
      let imageUri = defaulProfilePicture
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

      if (days > 0) return `${days}d`
      if (hours > 0) return `${hours}h ${minutes}m`
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`
      return `${seconds}s`
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
