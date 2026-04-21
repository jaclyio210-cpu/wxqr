const { listObjects, getJson } = require('./cos');

async function listCodes() {
  const result = await listObjects('codes/');
  const metaKeys = (result.Contents || [])
    .filter(obj => obj.Key.endsWith('/meta.json'))
    .map(obj => obj.Key);

  const metas = await Promise.all(metaKeys.map(key => getJson(key)));
  const codes = metas.map(m => ({ id: m.id, scan_count: m.scan_count, created_at: m.created_at }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(codes),
  };
}

module.exports = { listCodes };
