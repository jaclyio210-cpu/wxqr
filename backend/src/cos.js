const COS = require('cos-nodejs-sdk-v5');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;

function putObject(key, body, contentType = 'application/octet-stream') {
  return new Promise((resolve, reject) => {
    cos.putObject({ Bucket: BUCKET, Region: REGION, Key: key, Body: body, ContentType: contentType },
      (err, data) => err ? reject(err) : resolve(data));
  });
}

function getObject(key) {
  return new Promise((resolve, reject) => {
    cos.getObject({ Bucket: BUCKET, Region: REGION, Key: key },
      (err, data) => err ? reject(err) : resolve(data));
  });
}

function deleteObjects(keys) {
  return new Promise((resolve, reject) => {
    cos.deleteMultipleObject({
      Bucket: BUCKET, Region: REGION,
      Objects: keys.map(k => ({ Key: k })),
    }, (err, data) => err ? reject(err) : resolve(data));
  });
}

function listObjects(prefix) {
  return new Promise((resolve, reject) => {
    cos.getBucket({ Bucket: BUCKET, Region: REGION, Prefix: prefix },
      (err, data) => err ? reject(err) : resolve(data));
  });
}

async function putJson(key, obj) {
  return putObject(key, JSON.stringify(obj), 'application/json');
}

async function getJson(key) {
  const data = await getObject(key);
  try {
    return JSON.parse(data.Body.toString());
  } catch (e) {
    throw new Error(`Failed to parse JSON for key "${key}": ${e.message}`);
  }
}

function getPublicUrl(key) {
  return `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`;
}

module.exports = { putObject, getObject, putJson, getJson, deleteObjects, listObjects, getPublicUrl };
