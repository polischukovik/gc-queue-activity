import platformClient from 'purecloud-platform-client-v2'
import config from '@/config/config'

const routingApi = new platformClient.RoutingApi()
const notificationsApi = new platformClient.NotificationsApi()
const presenceApi = new platformClient.PresenceApi()
const client = platformClient.ApiClient.instance

let userStatusWebsocket: WebSocket
let presenceDefinitions: { [key: string]: string } = {}
let serverOffset = 0

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
        ['PureCloudPlatformClientV2'],
        ['application/json'],
        ['application/json']
      )
      console.log('Server time response:', response)
      if (response && response.currentTime) {
        return new Date(response.currentTime)
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

  async subscribeToUsersStatus (userIds: string[], callbacks: ((message: MessageEvent) => void)[]): Promise<void> {
    let channelId = ''

    const channel = await notificationsApi.postNotificationsChannels()

    if (!channel.connectUri || !channel.id) throw new Error('Channel not created')
    console.log('Channel created')
    channelId = channel.id

    // Assign callbacks to websocket
    if (userStatusWebsocket) userStatusWebsocket.close()
    userStatusWebsocket = new WebSocket(channel.connectUri)
    userStatusWebsocket.onmessage = (message) => {
      for (const cb of callbacks) {
        cb(message)
      }
    }

    // Subscribe to topics
    const topics: platformClient.Models.ChannelTopic[] = []
    userIds.forEach(userId => {
      // Combined topic for presence, routingStatus, and outOfOffice
      topics.push({
        id: `v2.users.${userId}?presence&routingStatus&outofoffice`
      })
    })

    await notificationsApi.postNotificationsChannelSubscriptions(channelId, topics)
    console.log('Subscribed to topics')
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
