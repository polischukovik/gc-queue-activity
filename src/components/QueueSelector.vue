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
  position: sticky;
  top: 0;
  width: 100%;
  z-index: 100;
  padding-bottom: 6px;
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
  padding: 0 36px 0 12px;
  box-sizing: border-box;
  border: 1px solid #E3E3E3;
  border-radius: 8px;
  transition: all 0.2s ease;
  color: #23395D;
}

input:focus {
  border-color: #007acc;
  outline: none;
}

input::placeholder {
  color: #959699;
}

.dropdown-icon {
  position: absolute;
  right: 12px;
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
  max-height: 300px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #E3E3E3;
  border-radius: 0 0 8px 8px;
  margin-top: 1px;
  padding: 2px 0;
  list-style: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.dropdown-list li {
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #23395D;
}

.dropdown-list li.highlighted {
  background-color: #007acc;
  color: #fff;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  input {
    height: 36px;
    font-size: 0.95em;
  }
  
  .dropdown-list {
    max-height: 250px;
  }
  
  .dropdown-list li {
    padding: 8px 10px;
  }
}
</style>

<script lang="ts">
import platformClient from 'purecloud-platform-client-v2'
import genesysCloudService from '@/services/genesyscloud-service'
import { defineComponent } from 'vue'

// Local storage key for persisting selected queue
const LAST_SELECTED_QUEUE_KEY = 'lastSelectedQueue'

export default defineComponent({
  name: 'QueueSelector',
  data() {
    return {
      queues: [] as platformClient.Models.Queue[],
      searchText: '',
      showDropdown: false,
      highlightedIndex: -1,
      selectedQueue: null as platformClient.Models.Queue | null,
      isSelecting: false,
      isLoaded: false
    }
  },
  computed: {
    filteredQueues(): platformClient.Models.Queue[] {
      return this.queues.filter(q =>
        (q.name ?? '').toLowerCase().includes(this.searchText.toLowerCase())
      )
    }
  },
  methods: {
    toggleDropdown() {
      this.showDropdown = !this.showDropdown
      if (this.showDropdown && this.selectedQueue) {
        // Clear input when opening dropdown to search
        this.searchText = ''
      }
    },
    handleInput() {
      this.isSelecting = true
      this.showDropdown = true
    },
    handleFocus() {
      // When input gets focus, prepare for selecting a new queue
      this.isSelecting = true
      if (this.isSelecting) {
        this.searchText = ''
      }
    },
    handleEscape() {
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
    highlightNext() {
      if (!this.filteredQueues.length) return
      this.highlightedIndex = (this.highlightedIndex + 1) % this.filteredQueues.length
    },
    highlightPrevious() {
      if (!this.filteredQueues.length) return
      this.highlightedIndex =
        (this.highlightedIndex - 1 + this.filteredQueues.length) % this.filteredQueues.length
    },
    selectHighlighted() {
      if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredQueues.length) {
        this.selectQueue(this.filteredQueues[this.highlightedIndex])
      }
    },
    selectQueue(queue: platformClient.Models.Queue) {
      this.selectedQueue = queue
      this.searchText = queue.name || '' // Set input to selected queue name
      this.$emit('queueSelected', queue.id)
      this.showDropdown = false
      this.highlightedIndex = -1
      this.isSelecting = false

      // Save selected queue to localStorage
      this.saveSelectedQueue(queue)

      // Remove focus from input after selection
      this.blurInput()
    },
    blurInput() {
      // Use nextTick to ensure DOM has updated before trying to blur
      this.$nextTick(() => {
        const inputElement = this.$refs.queueInput as HTMLInputElement
        if (inputElement) {
          inputElement.blur()
        }
      })
    },
    saveSelectedQueue(queue: platformClient.Models.Queue) {
      try {
        const queueData = {
          id: queue.id,
          name: queue.name
        }
        localStorage.setItem(LAST_SELECTED_QUEUE_KEY, JSON.stringify(queueData))
      } catch (e) {
        console.error('Failed to save queue to localStorage:', e)
      }
    },
    loadSelectedQueue() {
      try {
        const savedQueueData = localStorage.getItem(LAST_SELECTED_QUEUE_KEY)
        if (savedQueueData) {
          const queueData = JSON.parse(savedQueueData)
          // Return the parsed data
          return queueData
        }
      } catch (e) {
        console.error('Failed to load queue from localStorage:', e)
      }
      return null
    },
    selectQueueById(queueId: string) {
      const queue = this.queues.find(q => q.id === queueId)
      if (queue) {
        this.selectQueue(queue)
      }
    },
    handleQueueData() {
      // If only one queue exists, select it automatically
      if (this.queues.length === 1) {
        this.selectQueue(this.queues[0])
        return
      }

      // Otherwise try to load the last selected queue
      const savedQueue = this.loadSelectedQueue()
      if (savedQueue) {
        // Verify the queue still exists in our current queue list
        const existingQueue = this.queues.find(q => q.id === savedQueue.id)
        if (existingQueue) {
          this.selectedQueue = existingQueue
          this.searchText = existingQueue.name || ''
          this.$emit('queueSelected', existingQueue.id)
        }
      }
    }
  },
  emits: ['queueSelected'],
  created() {
    genesysCloudService.getQueues()
      .then(queues => {
        if (queues) {
          this.queues = queues
          this.isLoaded = true
          this.handleQueueData()
        }
      })
      .catch(err => console.error(err))
  }
})
</script>
