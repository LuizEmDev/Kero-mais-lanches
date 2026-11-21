// Ponte entre a regra de negócio e o Socket.IO (preenchida em index.js).
let io = null
export const attachIO = (server) => { io = server }
export const toRoom = (room, event, payload) => io?.to(room).emit(event, payload)
export const toStaff = (kind, payload = {}) => io?.to('staff').emit('staff', { kind, ...payload })
