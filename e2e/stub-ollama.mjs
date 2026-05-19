// Tiny stub Ollama server used by Playwright. Responds OK to /api/tags so the
// app boot health check passes; everything else returns 404. The chat stream
// endpoint is mocked client-side via page.route, so this server never needs to
// emit tokens.

import { createServer } from 'node:http';

const port = Number(process.env.STUB_OLLAMA_PORT ?? 39998);

const server = createServer((req, res) => {
	if (req.url === '/api/tags') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ models: [{ name: 'gemma3:4b' }] }));
		return;
	}
	res.writeHead(404);
	res.end();
});

server.listen(port, '127.0.0.1', () => {
	console.log(`stub-ollama listening on http://127.0.0.1:${port}`);
});
