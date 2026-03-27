import { rooms } from './rooms'

interface GraphEdge {
  from: string
  to: string
}

export const edges: GraphEdge[] = Object.values(rooms).flatMap((room) =>
  room.connections.map((conn) => ({
    from: room.id,
    to: conn.targetRoomId
  }))
)
