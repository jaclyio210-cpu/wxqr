jest.mock('../cos');
const cos = require('../cos');
const { createCode } = require('../create');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.API_BASE_URL = 'https://example.com';
  cos.putObject.mockResolvedValue({});
  cos.putJson.mockResolvedValue({});
});

test('createCode 返回 id 和 scan_url', async () => {
  const result = await createCode({
    qr1: Buffer.from('fake-image-1').toString('base64'),
    qr2: Buffer.from('fake-image-2').toString('base64'),
  });
  const body = JSON.parse(result.body);
  expect(result.statusCode).toBe(200);
  expect(body.id).toMatch(/^[a-zA-Z0-9_-]{8}$/);
  expect(body.scan_url).toContain('/scan/');
  expect(body.scan_url).toContain(body.id);
});

test('createCode 上传两张图片到 COS', async () => {
  await createCode({
    qr1: Buffer.from('img1').toString('base64'),
    qr2: Buffer.from('img2').toString('base64'),
  });
  expect(cos.putObject).toHaveBeenCalledTimes(2);
  expect(cos.putJson).toHaveBeenCalledTimes(1);
});
