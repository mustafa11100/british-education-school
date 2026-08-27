const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'EduCore V2' }));
app.get('/api', (_req, res) => res.json({ name: 'EduCore V2 API', version: '1.0.0', status: 'ready' }));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`EduCore V2 listening on ${PORT}`));
