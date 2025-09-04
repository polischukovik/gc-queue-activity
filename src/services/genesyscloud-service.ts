import platformClient from 'purecloud-platform-client-v2'
import config from '@/config/config'

const routingApi = new platformClient.RoutingApi()
const notificationsApi = new platformClient.NotificationsApi()
const presenceApi = new platformClient.PresenceApi()
const usersApi = new platformClient.UsersApi()
const client = platformClient.ApiClient.instance

let channelId = ''

let userStatusWebsocket: WebSocket
let presenceDefinitions: { [key: string]: string } = {}
let serverOffset = 0
let notificationCallback: ((data: any) => void) | null = null
let lastTopics: platformClient.Models.ChannelTopic[] = []

// Define the OutOfOffice interface
interface OutOfOfficeData {
  active: boolean
  indefinite: boolean
  startDate?: string
  endDate?: string
}

export default {
  // Login to Genesys Cloud and fetch server time
  async loginImplicitGrant (): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search)
    const environment = urlParams.get('environment') || localStorage.getItem('gc-environment') || 'mypurecloud.ie'
    client.setPersistSettings(true, 'agent-monitoring-app')
    client.setEnvironment(environment)
    localStorage.setItem('gc-environment', environment)

    await client.loginImplicitGrant(config.clientId, config.redirectUri)
    console.log('Authenticated')

    // Fetch server time and calculate offset
    const serverTime = await this.fetchServerTime()
    serverOffset = serverTime.getTime() - Date.now()
    console.log('Server Time:', serverTime)
    console.log('Calculated Server Offset:', serverOffset)
  },

  // Fetch presence definitions
  async fetchPresenceDefinitions (): Promise<void> {
    const opts = {
      pageNumber: 1,
      pageSize: 100,
      deleted: 'false',
      localeCode: 'en_US'
    }

    try {
      const data = await presenceApi.getPresenceDefinitions0(opts)
      if (data?.entities) {
        console.log(`raw presence: ${JSON.stringify(data?.entities,null,2)}`)
        presenceDefinitions = data.entities.reduce((acc: { [key: string]: string }, def) => {
          if (def.id) {
            acc[def.id] = def.languageLabels?.en_US || def.systemPresence || ''
          }
          return acc
        }, {})
      }

      console.log('Presence definitions fetched:', presenceDefinitions)
    } catch (err) {
      console.error('Error fetching presence definitions', err)
    }
  },

  // Fetch current server time
  async fetchServerTime (): Promise<Date> {
    try {
      const response = await client.callApi(
        '/api/v2/date',
        'GET',
        {},
        {},
        {},
        {},
        null,
        ['PureCloud OAuth'],
        ['application/json'],
        ['application/json']
      )
      console.log('Server time response:', response)
      if (response && response.currentDate) {
        return new Date(response.currentDate)
      } else {
        console.error('Invalid server time response:', response)
        return new Date()
      }
    } catch (err) {
      console.error('Error fetching server time', err)
      return new Date()
    }
  },

  // Get the organization's queues.
  async getQueues (): Promise<undefined | platformClient.Models.Queue[]> {
    let allQueues: platformClient.Models.Queue[] = []
    let pageNumber = 1
    let pageCount = 1

    do {
      const data = await routingApi.getRoutingQueues({ pageSize: 500, pageNumber: pageNumber })
      if (data.entities) {
        allQueues = allQueues.concat(data.entities)
      }
      pageCount = data.pageCount || 1
      pageNumber++
    } while (pageNumber <= pageCount)

    return allQueues
  },

  async getQueue (queueId: string): Promise<platformClient.Models.Queue> {
    const data = await routingApi.getRoutingQueue(queueId)
    return data
  },

  // Get the queue's members
  async getMembersOfQueue (queueId: string): Promise<undefined | platformClient.Models.QueueMember[]> {
    const data = await routingApi.getRoutingQueueMembers(queueId, { pageSize: 100, expand: ['presence', 'routingStatus', 'outOfOffice'] })
    console.log(data)
    return data.entities
  },

  async getUserDetails(userId: string): Promise<platformClient.Models.User> {
    return await usersApi.getUser(userId, { expand: ['presence', 'routingStatus', 'outOfOffice'] });
  },

  async createNotificationChannel(callback: (data: any) => void): Promise<void> {
    notificationCallback = callback
    const channel = await notificationsApi.postNotificationsChannels()

    if (!channel.connectUri || !channel.id) throw new Error('Channel not created')
    console.log('Channel created')
    channelId = channel.id

    this.setupWebSocket(channel.connectUri)
  },

  setupWebSocket (connectUri: string): void {
    if (userStatusWebsocket) userStatusWebsocket.close()
    userStatusWebsocket = new WebSocket(connectUri)

    userStatusWebsocket.onopen = () => {
      console.log('WebSocket connection established.')
    }

    userStatusWebsocket.onmessage = (message) => {
      const data = JSON.parse(message.data)
      if (data.topicName === 'channel.heartbeat') {
        // Optional: implement a heartbeat timeout
        return
      }
      if (notificationCallback) notificationCallback(data)
    }

    userStatusWebsocket.onclose = () => {
      console.log('WebSocket disconnected.')
      // Use a small delay before attempting to reconnect
      setTimeout(() => this.reconnect(), 3000)
    }

    userStatusWebsocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      // onclose will be called, triggering the reconnect logic
    }
  },

  async reconnect (): Promise<void> {
    console.log('Attempting to reconnect WebSocket...')
    try {
      // Check if the channel is still valid by getting all channels and finding it.
      const channels = await notificationsApi.getNotificationsChannels();
      const currentChannel = channels.entities?.find(c => c.id === channelId);

      if (!currentChannel) {
        // If the channel is not in the list, it's no longer valid.
        throw new Error('Notification channel not found');
      }
      
      // If successful, the channel is valid. Just re-establish the WebSocket connection.
      console.log('Channel is still valid. Re-establishing WebSocket connection.')
      this.setupWebSocket(currentChannel.connectUri!)
    } catch (e) {
      // If it fails, the channel is gone. Create a new one and re-subscribe.
      console.log('Channel is no longer valid. Creating a new channel and re-subscribing.')
      if (notificationCallback) {
        await this.createNotificationChannel(notificationCallback)
        // Re-subscribe to the last known topics
        if (lastTopics.length > 0) {
          await this.subscribeToTopics(lastTopics)
        }
      } else {
        console.error('Cannot reconnect: notification callback is missing.')
      }
    }
  },

  async subscribeToTopics(topics: platformClient.Models.ChannelTopic[]): Promise<void> {
    if (!channelId) throw new Error('Notification channel not created')
    await notificationsApi.putNotificationsChannelSubscriptions(channelId, topics)
    lastTopics = topics // Store topics for re-subscription on reconnect
    console.log('Subscriptions replaced')
  },

  // Get presence name by presence ID
  getPresenceName (presenceId: string): string {
    console.log('resolving presence name by id:' + presenceId + ' => ' + presenceDefinitions[presenceId] || presenceId)
    return presenceDefinitions[presenceId] || presenceId
  },

  // Check if user is out of office
  isOutOfOffice (outOfOfficeData: OutOfOfficeData | null): boolean {
    if (!outOfOfficeData) return false

    // Check if indefinite out of office is active
    if (outOfOfficeData.active && outOfOfficeData.indefinite) {
      return true
    }

    // Check if scheduled out of office is active
    if (outOfOfficeData.active && !outOfOfficeData.indefinite) {
      const now = new Date(Date.now() + serverOffset) // Use server time
      const startDate = outOfOfficeData.startDate ? new Date(outOfOfficeData.startDate) : null
      const endDate = outOfOfficeData.endDate ? new Date(outOfOfficeData.endDate) : null

      return startDate !== null && endDate !== null && now >= startDate && now <= endDate
    }

    return false
  },

  // Get effective status that considers out of office
  getEffectiveStatus (presenceId: string, outOfOfficeData: OutOfOfficeData | null): string {
    if (this.isOutOfOffice(outOfOfficeData)) {
      return 'Out of Office'
    }
    return this.getPresenceName(presenceId)
  },

  // Get server offset
  getServerOffset (): number {
    return serverOffset
  }
}