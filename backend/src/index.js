const { createCode } = require('./create');
const { scanCode } = require('./scan');
const { listCodes } = require('./list');
const { deleteCode } = require('./delete');

exports.handler = async (event, context) => {
  const path = event.path || '/';
  const method = (event.httpMethod || 'GET').toUpperCase();

  let body = {};
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch (e) { body = {}; }
  }

  try {
    if (method === 'POST' && path === '/create') {
      return await createCode(body);
    }
    const scanMatch = path.match(/^\/scan\/(.+)$/);
    if (method === 'GET' && scanMatch) {
      return await scanCode(scanMatch[1]);
    }
    if (method === 'GET' && path === '/codes') {
      return await listCodes();
    }
    const deleteMatch = path.match(/^\/codes\/(.+)$/);
    if (method === 'DELETE' && deleteMatch) {
      return await deleteCode(deleteMatch[1]);
    }
    return { statusCode: 404, body: 'Not Found' };
  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
