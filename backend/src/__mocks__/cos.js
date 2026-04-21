module.exports = {
  putObject: jest.fn(),
  getObject: jest.fn(),
  putJson: jest.fn(),
  getJson: jest.fn(),
  deleteObjects: jest.fn(),
  listObjects: jest.fn(),
  getPublicUrl: jest.fn((key) => `https://bucket.cos.region.myqcloud.com/${key}`),
};
