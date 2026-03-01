import http from 'http';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  console.log(`${req.method} ${url.pathname}`);

  // Health endpoint
  if (url.pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'groundcheck-backend-mock',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Extract claims endpoint
  if (url.pathname === '/api/extract-claims' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);

        // Normalize text for processing
        const normalizedText = text.replace(/\s+/g, ' ').trim();

        // Simple claim extraction - find INDIVIDUAL sentences with numbers or dates
        // Split more aggressively to get shorter claims
        const claims = [];

        // Match sentences that contain specific factual patterns
        const patterns = [
          /(?:^|[.!?]\s+)([^.!?]*?\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion|thousand|percent|%)[^.!?]*[.!?])/gi,
          /(?:^|[.!?]\s+)([^.!?]*?\b(?:18|19|20)\d{2}\b[^.!?]*[.!?])/gi,
          /(?:^|[.!?]\s+)([^.!?]*?\b(?:founded|built|created|invented|discovered|established)\b[^.!?]*[.!?])/gi,
        ];

        const foundClaims = new Set();

        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(normalizedText)) !== null) {
            const claimText = match[1].trim();
            // Skip if too long (over 200 chars) or already found
            if (claimText.length > 200 || claimText.length < 20 || foundClaims.has(claimText)) {
              continue;
            }
            foundClaims.add(claimText);
          }
        });

        // Convert to claims array with offsets
        let claimIndex = 0;
        foundClaims.forEach(claimText => {
          const start = normalizedText.indexOf(claimText);
          if (start >= 0) {
            claims.push({
              id: `claim-${claimIndex}-${Date.now()}`,
              text: claimText,
              type: /\d/.test(claimText) ? 'statistical' : 'factual',
              confidence: 0.85,
              sourceOffset: {
                start: start,
                end: start + claimText.length
              }
            });
            claimIndex++;
          }
        });

        console.log(`Extracted ${claims.length} claims from ${text.length} chars`);
        claims.forEach(c => console.log(`  - "${c.text.slice(0, 60)}..."`));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ claims, processingTime: 50 }));
      } catch (err) {
        console.error('Error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // Verify claim endpoint
  if (url.pathname === '/api/verify-claim' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { claimId, claimText } = JSON.parse(body);

        // Mock verification - randomly assign status
        const statuses = ['verified', 'disputed', 'unverified'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        const verification = {
          status,
          sources: status !== 'unverified' ? [{
            name: status === 'verified' ? 'Wikipedia' : 'Snopes',
            url: 'https://example.com/fact-check',
            verdict: status === 'verified' ? 'True' : 'False',
            publishedDate: '2024-01-15'
          }] : [],
          confidence: status === 'verified' ? 0.95 : status === 'disputed' ? 0.8 : 0.3,
          verifiedAt: new Date().toISOString()
        };

        console.log(`Verified claim ${claimId}: ${status}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ claimId, verification }));
      } catch (err) {
        console.error('Error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/extract-claims');
  console.log('  POST /api/verify-claim');
});
