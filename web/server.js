// placeholder until the game lands
import http from 'node:http';
http.createServer((q, s) => { if (q.url === '/health') return s.end('ok'); s.writeHead(200, { 'Content-Type': 'text/html' }); s.end('<h1>Googly Heist — coming soon</h1>'); }).listen(process.env.PORT || 8000);
