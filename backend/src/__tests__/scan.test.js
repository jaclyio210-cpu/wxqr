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
