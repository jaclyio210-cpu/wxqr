const { deleteObjects } = require('./cos');

async function deleteCode(id) {
  await deleteObjects([
    `codes/${id}/qr1.jpg`,
    `codes/${id}/qr2.jpg`,
    `codes/${id}/meta.json`,
  ]);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true }),
  };
}

module.exports = { deleteCode };
