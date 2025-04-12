import platformClient from 'purecloud-platform-client-v2'
import config from '@/config/config'

const routingApi = new platformClient.RoutingApi()
const notificationsApi = new platformClient.NotificationsApi()
const presenceApi = new platformClient.PresenceApi()

let userStatusWebsocket: WebSocket
let presenceDefinitions: { [key: string]: string } = {}

export default {
  // Login to Genesys Cloud
  async loginImplicitGrant (): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search)
    const environment = urlParams.get('environment') || localStorage.getItem('gc-environment') || 'mypurecloud.com'
    const client = platformClient.ApiClient.instance

    client.setPersistSettings(true, 'agent-monitoring-app')
    client.setEnvironment(environment)
    localStorage.setItem('gc-environment', environment)

    await client.loginImplicitGrant(config.clientId, config.redirectUri)

    console.log('Authenticated')
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
      const data = await presenceApi.getPresencedefinitions(opts)
      if (data?.entities) {
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

  // Get the organization's queues.
  async getQueues (): Promise<undefined | platformClient.Models.Queue[]> {
    const data = await routingApi.getRoutingQueues({ pageSize: 100 })
    return data.entities
  },

  async getQueue (queueId: string): Promise<platformClient.Models.Queue> {
    const data = await routingApi.getRoutingQueue(queueId)
    return data
  },

  // Get the queue's members
  async getMembersOfQueue (queueId: string): Promise<undefined | platformClient.Models.QueueMember[]> {
    const data = await routingApi.getRoutingQueueMembers(queueId, { pageSize: 100, expand: ['presence', 'routingStatus'] })
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
      topics.push({
        id: `v2.users.${userId}?presence&routingStatus`
      })
    })

    await notificationsApi.postNotificationsChannelSubscriptions(channelId, topics)
    console.log('Subscribed to topics')
  },

  // Get presence name by presence ID
  getPresenceName (presenceId: string): string {
    return presenceDefinitions[presenceId] || presenceId
  }
}
