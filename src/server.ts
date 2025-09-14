import http from 'http';
import app from './app';
import { initChat } from './sockets/chat';

const server = http.createServer(app);
initChat(server); // attach Socket.IO

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`API listening on :${PORT}`));
