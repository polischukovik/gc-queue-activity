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
      {{ presence}}
    </div>
    <div class="routing-status">
      {{ routingStatus }}
    </div>
  </div>
</template>

<style scoped>
.member-container {
  border: 1px solid #bbb;
  border-radius: 5px;
  padding: 5px 10px; /* Reduced padding */
  margin: 2px; /* Reduced margin */
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
}

.profile-picture img {
  width: 30px; /* Reduced image size */
  height: 30px; /* Reduced image size */
  border-radius: 100px;
  margin-right: 10px; /* Reduced margin */
}

.name {
  text-align: left;
  width: 50%; /* Adjusted width */
}

.presence {
  width: 25%; /* Adjusted width */
}

.routing-status {
  width: 25%; /* Adjusted width */
}

.rs-NOT_RESPONDING {
  background: #ffbbbb;
}

.rs-IDLE {
  background: #c0e2ff;
}

.p-Offline {
  background: #eee
}
</style>

<script lang="ts">
// import genesyscloudService from '@/services/genesyscloud-service'
import platformClient from 'purecloud-platform-client-v2'
import { defineComponent } from 'vue'

const defaulProfilePicture = './img/default-face.png'

export default defineComponent({
  name: 'QueueMemberDetails',
  props: {
    queueMember: {
      type: Object as () => platformClient.Models.QueueMember
    }
  },
  computed: {
    name: function () {
      return this.queueMember?.name
    },
    presence: function () {
      return this.queueMember?.user?.presence?.presenceDefinition?.systemPresence
    },
    routingStatus: function () {
      return this.queueMember?.user?.routingStatus?.status
    },
    imageURI: function () {
      const images = this.queueMember?.user?.images
      let imageUri = defaulProfilePicture
      if (images) imageUri = images[images.length - 1].imageUri || imageUri

      return imageUri
    }
  }
})
</script>
