import type { Server as SocketIOServer } from 'socket.io'
import type { Server as BunSocketEngine } from '@socket.io/bun-engine'

export type SocketIOIntegration = {
	io: SocketIOServer
	engine: BunSocketEngine
	path: string
}
