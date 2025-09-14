import http from 'http';
import app from './app';
import { initChat } from './sockets/chat';

const server = http.createServer(app);
initChat(server); // attach Socket.IO

const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';
server.listen(PORT, () => console.log(`API listening on :${PORT}`));
