const { getJson, putJson, getPublicUrl } = require('./cos');

function getQrKey(meta, scanCount) {
  return scanCount % 2 === 1 ? meta.qr1_key : meta.qr2_key;
}

async function scanCode(id) {
  const metaKey = `codes/${id}/meta.json`;
  let meta;
  try {
    meta = await getJson(metaKey);
  } catch (e) {
    console.error(`scanCode getJson error for id "${id}":`, e);
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<h1>活码不存在</h1>',
    };
  }

  // NOTE: concurrent scans can cause a race condition here (non-atomic read-modify-write).
  // Acceptable for personal single-user use.
  const newCount = meta.scan_count + 1;
  meta.scan_count = newCount;
  try {
    await putJson(metaKey, meta);
  } catch (e) {
    console.error(`scanCode putJson error for id "${id}":`, e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<h1>服务器错误，请稍后再试</h1>',
    };
  }

  const qrKey = getQrKey(meta, newCount);
  const qrUrl = getPublicUrl(qrKey);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>添加微信</title>
  <style>
    body{margin:0;font-family:-apple-system,sans-serif;background:#f5f5f5;
         display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border-radius:16px;padding:32px 24px;text-align:center;
          box-shadow:0 4px 16px rgba(0,0,0,.1);max-width:320px;width:90%}
    img{width:220px;height:220px;object-fit:contain}
    p{color:#666;font-size:14px;margin-top:16px}
  </style>
</head>
<body>
  <div class="card">
    <img src="${qrUrl}" alt="微信二维码"/>
    <p>长按识别二维码，添加微信</p>
  </div>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}

module.exports = { scanCode, getQrKey };
