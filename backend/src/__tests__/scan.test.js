const { getQrKey } = require('../scan');

const meta = { qr1_key: 'codes/abc/qr1.jpg', qr2_key: 'codes/abc/qr2.jpg' };

test('第1次扫描返回 qr1', () => {
  expect(getQrKey(meta, 1)).toBe('codes/abc/qr1.jpg');
});

test('第2次扫描返回 qr2', () => {
  expect(getQrKey(meta, 2)).toBe('codes/abc/qr2.jpg');
});

test('第3次扫描返回 qr1', () => {
  expect(getQrKey(meta, 3)).toBe('codes/abc/qr1.jpg');
});

test('第100次扫描返回 qr2', () => {
  expect(getQrKey(meta, 100)).toBe('codes/abc/qr2.jpg');
});

// --- scanCode integration tests ---
jest.mock('../cos');
const cos = require('../cos');
const { scanCode } = require('../scan');

beforeEach(() => jest.clearAllMocks());

test('scanCode: getJson 失败返回 404', async () => {
  cos.getJson.mockRejectedValue(new Error('not found'));
  const result = await scanCode('abc');
  expect(result.statusCode).toBe(404);
  expect(result.body).toContain('活码不存在');
});

test('scanCode: putJson 失败返回 500', async () => {
  cos.getJson.mockResolvedValue({ id: 'abc', qr1_key: 'k1', qr2_key: 'k2', scan_count: 0 });
  cos.putJson.mockRejectedValue(new Error('write failed'));
  const result = await scanCode('abc');
  expect(result.statusCode).toBe(500);
});

test('scanCode: 第1次扫描返回 200 HTML 含 qr1 URL', async () => {
  cos.getJson.mockResolvedValue({ id: 'abc', qr1_key: 'codes/abc/qr1.jpg', qr2_key: 'codes/abc/qr2.jpg', scan_count: 0 });
  cos.putJson.mockResolvedValue({});
  cos.getPublicUrl.mockImplementation(key => `https://bucket.cos.region.myqcloud.com/${key}`);
  const result = await scanCode('abc');
  expect(result.statusCode).toBe(200);
  expect(result.body).toContain('https://bucket.cos.region.myqcloud.com/codes/abc/qr1.jpg');
  expect(result.body).toContain('长按识别二维码，添加微信');
});
