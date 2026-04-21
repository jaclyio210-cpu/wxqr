const { nanoid } = require('nanoid');
const { putObject, putJson } = require('./cos');

async function createCode({ qr1, qr2 }) {
  const id = nanoid(8);
  const qr1Key = `codes/${id}/qr1.jpg`;
  const qr2Key = `codes/${id}/qr2.jpg`;
  const metaKey = `codes/${id}/meta.json`;

  await putObject(qr1Key, Buffer.from(qr1, 'base64'), 'image/jpeg');
  await putObject(qr2Key, Buffer.from(qr2, 'base64'), 'image/jpeg');

  const meta = {
    id,
    qr1_key: qr1Key,
    qr2_key: qr2Key,
    scan_count: 0,
    created_at: new Date().toISOString(),
  };
  await putJson(metaKey, meta);

  const scanUrl = `${process.env.API_BASE_URL}/scan/${id}`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ id, scan_url: scanUrl }),
  };
}

module.exports = { createCode };
