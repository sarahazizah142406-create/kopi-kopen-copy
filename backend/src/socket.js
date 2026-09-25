// Singleton instance Socket.IO — hindari circular import antara server.js dan routes
let _io = null;

export function setIO(ioInstance) {
  _io = ioInstance;
}

export function getIO() {
  return _io;
}
