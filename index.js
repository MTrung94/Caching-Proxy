#!/usr/bin/env node

const http = require('http');
const { Command } = require('commander');

const program = new Command();

program
  .option('--port <number>', 'Port on which the caching proxy server will run')
  .option('--origin <url>', 'URL of the server to which requests will be forwarded')
  .option('--clear-cache', 'Clear the cached responses');

program.parse(process.argv);

const options = program.opts();

const cache = new Map();

if (options.clearCache) {
  cache.clear();
  console.log('Cache cleared successfully.');
  process.exit(0);
}

if (!options.port || !options.origin) {
  console.error('Error: Both --port and --origin options are required.');
  process.exit(1);
}

const PORT = parseInt(options.port, 10);
const ORIGIN = options.origin.replace(/\/$/, '');

const server = http.createServer(async (req, res) => {
  const cacheKey = `${req.method}:${req.url}`;

  if (cache.has(cacheKey)) {
    const cachedResponse = cache.get(cacheKey);
    res.writeHead(cachedResponse.statusCode, {
      ...cachedResponse.headers,
      'X-Cache': 'HIT'
    });
    return res.end(cachedResponse.body);
  }

  try {
    const targetUrl = `${ORIGIN}${req.url}`;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: new URL(ORIGIN).host }
    });

    const data = await response.arrayBuffer();
    const buffer = Buffer.from(data);

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    cache.set(cacheKey, {
      statusCode: response.status,
      headers: responseHeaders,
      body: buffer
    });

    res.writeHead(response.status, {
      ...responseHeaders,
      'X-Cache': 'MISS'
    });
    res.end(buffer);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Proxy Error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Caching Proxy server is running on port ${PORT}`);
  console.log(`Forwarding requests to: ${ORIGIN}`);
});
