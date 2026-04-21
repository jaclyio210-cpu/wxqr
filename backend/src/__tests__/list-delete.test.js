jest.mock('../cos');
const cos = require('../cos');
const { listCodes } = require('../list');
const { deleteCode } = require('../delete');

beforeEach(() => {
  jest.clearAllMocks();
});

test('listCodes 返回所有活码摘要', async () => {
  cos.listObjects.mockResolvedValue({
    Contents: [
      { Key: 'codes/abc/meta.json' },
      { Key: 'codes/abc/qr1.jpg' },
      { Key: 'codes/def/meta.json' },
    ],
  });
  cos.getJson.mockResolvedValueOnce({ id: 'abc', scan_count: 5, created_at: '2026-01-01T00:00:00Z' });
  cos.getJson.mockResolvedValueOnce({ id: 'def', scan_count: 2, created_at: '2026-01-02T00:00:00Z' });

  const result = await listCodes();
  const body = JSON.parse(result.body);
  expect(result.statusCode).toBe(200);
  expect(body).toHaveLength(2);
  expect(body[0]).toEqual({ id: 'abc', scan_count: 5, created_at: '2026-01-01T00:00:00Z' });
});

test('deleteCode 删除三个 COS 对象', async () => {
  cos.deleteObjects.mockResolvedValue({});
  const result = await deleteCode('abc123');
  expect(cos.deleteObjects).toHaveBeenCalledWith([
    'codes/abc123/qr1.jpg',
    'codes/abc123/qr2.jpg',
    'codes/abc123/meta.json',
  ]);
  expect(JSON.parse(result.body).success).toBe(true);
});
