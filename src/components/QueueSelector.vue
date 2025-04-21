<template>
  <div class="queue-selector">
    <div class="input-wrapper" @click="toggleDropdown">
      <input
        ref="queueInput"
        v-model="searchText"
        @input="handleInput"
        @keydown.down.prevent="highlightNext"
        @keydown.up.prevent="highlightPrevious"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.tab.prevent="highlightNext"
        @keydown.esc.prevent="handleEscape"
        @focus="handleFocus"
        type="text"
        placeholder="Select or search queue"
      />
      <span class="dropdown-icon">▼</span>
    </div>

    <ul v-show="showDropdown" class="dropdown-list">
      <li
        v-for="(queue, index) in filteredQueues"
        :key="queue.id"
        :class="{ highlighted: index === highlightedIndex }"
        @mousedown.prevent="selectQueue(queue)"
      >
        {{ queue.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.queue-selector {
  position: relative;
  width: 100%;
  font-family: sans-serif;
}

.input-wrapper {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

input {
  width: 100%;
  height: 40px;
  font-size: 1em;
  padding: 0 30px 0 10px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.dropdown-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 12px;
  color: #555;
}

.dropdown-list {
  position: absolute;
  z-index: 10;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ccc;
  border-top: none;
  border-radius: 0 0 4px 4px;
  margin-top: -1px;
  padding: 0;
  list-style: none;
}

.dropdown-list li {
  padding: 10px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-list li.highlighted {
  background-color: #007acc;
  color: #fff;
}
</style>

<script lang="ts">
import platformClient from 'purecloud-platform-client-v2'
import genesysCloudService from '@/services/genesyscloud-service'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'QueueSelector',
  data () {
    return {
      queues: [] as platformClient.Models.Queue[],
      searchText: '',
      showDropdown: false,
      highlightedIndex: -1,
      selectedQueue: null as platformClient.Models.Queue | null,
      isSelecting: false
    }
  },
  computed: {
    filteredQueues (): platformClient.Models.Queue[] {
      return this.queues.filter(q =>
        (q.name ?? '').toLowerCase().includes(this.searchText.toLowerCase())
      )
    }
  },
  methods: {
    toggleDropdown () {
      this.showDropdown = !this.showDropdown
      if (this.showDropdown && this.selectedQueue) {
        // Clear input when opening dropdown to search
        this.searchText = ''
      }
    },
    handleInput () {
      this.isSelecting = true
      this.showDropdown = true
    },
    handleFocus () {
      // When input gets focus, prepare for selecting a new queue
      this.isSelecting = true
      if (this.isSelecting) {
        this.searchText = ''
      }
    },
    handleEscape () {
      // Close dropdown and restore selected queue name
      this.showDropdown = false
      this.isSelecting = false
      this.highlightedIndex = -1

      // Restore the selected queue name if available
      if (this.selectedQueue) {
        this.searchText = this.selectedQueue.name || ''
      }

      // Remove focus from input
      this.blurInput()
    },
    highlightNext () {
      if (!this.filteredQueues.length) return
      this.highlightedIndex = (this.highlightedIndex + 1) % this.filteredQueues.length
    },
    highlightPrevious () {
      if (!this.filteredQueues.length) return
      this.highlightedIndex =
        (this.highlightedIndex - 1 + this.filteredQueues.length) % this.filteredQueues.length
    },
    selectHighlighted () {
      if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredQueues.length) {
        this.selectQueue(this.filteredQueues[this.highlightedIndex])
      }
    },
    selectQueue (queue: platformClient.Models.Queue) {
      this.selectedQueue = queue
      this.searchText = queue.name || '' // Set input to selected queue name
      this.$emit('queueSelected', queue.id)
      this.showDropdown = false
      this.highlightedIndex = -1
      this.isSelecting = false

      // Remove focus from input after selection
      this.blurInput()
    },
    blurInput () {
      // Use nextTick to ensure DOM has updated before trying to blur
      this.$nextTick(() => {
        const inputElement = this.$refs.queueInput as HTMLInputElement
        if (inputElement) {
          inputElement.blur()
        }
      })
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
