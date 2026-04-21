# 微信活码 Windows 桌面 App 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Windows 桌面程序，用于创建微信活码（固定二维码交替指向两个微信号），后端运行在腾讯云 SCF + COS 上。

**Architecture:** 后端为单个腾讯云 SCF 云函数（Node.js），通过 API 网关对外暴露四个端点；图片和元数据存储在 COS；桌面 App 使用 Electron + React，通过 HTTP 调用后端，用 electron-builder 打包成 NSIS `.exe` 安装包。

**Tech Stack:** Node.js 18, cos-nodejs-sdk-v5, nanoid, Jest（后端）；Electron 28, React 18, TypeScript, Vite (electron-vite), qrcode, electron-builder（桌面）

---

## 文件结构

```
WXQR/
├── backend/
│   ├── src/
│   │   ├── cos.js            # COS 客户端封装
│   │   ├── create.js         # POST /create 处理器
│   │   ├── scan.js           # GET /scan/:id 处理器 + getQrKey 纯函数
│   │   ├── list.js           # GET /codes 处理器
│   │   ├── delete.js         # DELETE /codes/:id 处理器
│   │   ├── index.js          # 路由入口（SCF handler）
│   │   └── __tests__/
│   │       ├── scan.test.js
│   │       ├── create.test.js
│   │       └── list-delete.test.js
│   ├── package.json
│   ├── .env.example
│   └── serverless.yml
├── desktop/
│   ├── src/
│   │   ├── main/
│   │   │   └── index.ts      # Electron 主进程 + IPC 处理器
│   │   ├── preload/
│   │   │   └── index.ts      # contextBridge IPC 桥接
│   │   └── renderer/
│   │       └── src/
│   │           ├── main.tsx
│   │           ├── App.tsx           # 路由 + 全局状态
│   │           ├── api.ts            # SCF HTTP 客户端
│   │           ├── pages/
│   │           │   ├── SetupPage.tsx     # 首次配置 API URL
│   │           │   ├── CodeListPage.tsx  # 活码列表
│   │           │   └── CreateCodePage.tsx # 新建活码
│   │           └── components/
│   │               └── CodeCard.tsx
│   ├── electron.vite.config.ts
│   ├── electron-builder.yml
│   ├── package.json
│   └── tsconfig.json
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## Task 1: 后端项目初始化

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/src/cos.js`

- [ ] **Step 1: 创建 backend 目录并初始化 package.json**

```bash
mkdir -p backend/src/__tests__
cd backend
npm init -y
npm install cos-nodejs-sdk-v5 nanoid@3
npm install --save-dev jest
```

- [ ] **Step 2: 配置 package.json 的 test 脚本**

编辑 `backend/package.json`，将 scripts 改为：

```json
{
  "name": "wxqr-backend",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "dependencies": {
    "cos-nodejs-sdk-v5": "^2.14.0",
    "nanoid": "^3.3.7"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 3: 创建 .env.example**

```
COS_SECRET_ID=你的腾讯云SecretId
COS_SECRET_KEY=你的腾讯云SecretKey
COS_BUCKET=wxqr-1234567890
COS_REGION=ap-guangzhou
API_BASE_URL=https://service-xxx.gz.apigw.tencentcs.com/release
```

- [ ] **Step 4: 创建 COS 客户端封装 `backend/src/cos.js`**

```javascript
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
  return JSON.parse(data.Body.toString());
}

function getPublicUrl(key) {
  return `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`;
}

module.exports = { putObject, getObject, putJson, getJson, deleteObjects, listObjects, getPublicUrl };
```

- [ ] **Step 5: 验证目录结构正确**

```bash
ls backend/src/
```

期望输出：`cos.js  __tests__`

- [ ] **Step 6: Commit**

```bash
git init
git add backend/
git commit -m "feat: backend project setup and COS helper"
```

---

## Task 2: 扫码轮换逻辑（TDD）

**Files:**
- Create: `backend/src/scan.js`
- Create: `backend/src/__tests__/scan.test.js`

- [ ] **Step 1: 写失败测试 `backend/src/__tests__/scan.test.js`**

```javascript
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
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && npm test -- --testPathPattern=scan
```

期望：FAIL，`Cannot find module '../scan'`

- [ ] **Step 3: 实现 `backend/src/scan.js`**

```javascript
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
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<h1>活码不存在</h1>',
    };
  }

  meta.scan_count += 1;
  try {
    await putJson(metaKey, meta);
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<h1>服务器错误，请稍后再试</h1>',
    };
  }

  const qrKey = getQrKey(meta, meta.scan_count);
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd backend && npm test -- --testPathPattern=scan
```

期望：PASS，4 tests passed

- [ ] **Step 5: Commit**

```bash
git add backend/src/scan.js backend/src/__tests__/scan.test.js
git commit -m "feat: scan rotation logic with TDD"
```

---

## Task 3: 创建活码处理器（TDD）

**Files:**
- Create: `backend/src/create.js`
- Create: `backend/src/__tests__/create.test.js`

- [ ] **Step 1: 写失败测试 `backend/src/__tests__/create.test.js`**

```javascript
jest.mock('../cos');
const cos = require('../cos');
const { createCode } = require('../create');

beforeEach(() => {
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
```

- [ ] **Step 2: 创建 COS mock 文件 `backend/src/__mocks__/cos.js`**

```javascript
module.exports = {
  putObject: jest.fn(),
  getObject: jest.fn(),
  putJson: jest.fn(),
  getJson: jest.fn(),
  deleteObjects: jest.fn(),
  listObjects: jest.fn(),
  getPublicUrl: jest.fn((key) => `https://bucket.cos.region.myqcloud.com/${key}`),
};
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd backend && npm test -- --testPathPattern=create
```

期望：FAIL，`Cannot find module '../create'`

- [ ] **Step 4: 实现 `backend/src/create.js`**

```javascript
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
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd backend && npm test -- --testPathPattern=create
```

期望：PASS，2 tests passed

- [ ] **Step 6: Commit**

```bash
git add backend/src/create.js backend/src/__tests__/create.test.js backend/src/__mocks__/cos.js
git commit -m "feat: create code handler with TDD"
```

---

## Task 4: List 和 Delete 处理器（TDD）

**Files:**
- Create: `backend/src/list.js`
- Create: `backend/src/delete.js`
- Create: `backend/src/__tests__/list-delete.test.js`

- [ ] **Step 1: 写失败测试 `backend/src/__tests__/list-delete.test.js`**

```javascript
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd backend && npm test -- --testPathPattern=list-delete
```

期望：FAIL，`Cannot find module '../list'`

- [ ] **Step 3: 实现 `backend/src/list.js`**

```javascript
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
```

- [ ] **Step 4: 实现 `backend/src/delete.js`**

```javascript
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
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd backend && npm test -- --testPathPattern=list-delete
```

期望：PASS，2 tests passed

- [ ] **Step 6: 运行全部测试确认无回归**

```bash
cd backend && npm test
```

期望：PASS，8 tests passed

- [ ] **Step 7: Commit**

```bash
git add backend/src/list.js backend/src/delete.js backend/src/__tests__/list-delete.test.js
git commit -m "feat: list and delete handlers with TDD"
```

---

## Task 5: API 路由入口

**Files:**
- Create: `backend/src/index.js`

- [ ] **Step 1: 创建 `backend/src/index.js`**

```javascript
const { createCode } = require('./create');
const { scanCode } = require('./scan');
const { listCodes } = require('./list');
const { deleteCode } = require('./delete');

exports.handler = async (event, context) => {
  const path = event.path || '/';
  const method = (event.httpMethod || 'GET').toUpperCase();

  let body = {};
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch (e) { body = {}; }
  }

  try {
    if (method === 'POST' && path === '/create') {
      return await createCode(body);
    }
    const scanMatch = path.match(/^\/scan\/(.+)$/);
    if (method === 'GET' && scanMatch) {
      return await scanCode(scanMatch[1]);
    }
    if (method === 'GET' && path === '/codes') {
      return await listCodes();
    }
    const deleteMatch = path.match(/^\/codes\/(.+)$/);
    if (method === 'DELETE' && deleteMatch) {
      return await deleteCode(deleteMatch[1]);
    }
    return { statusCode: 404, body: 'Not Found' };
  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
```

- [ ] **Step 2: 创建 `backend/serverless.yml`（Serverless Framework 部署配置）**

```yaml
app: wxqr
stage: prod
name: wxqr-backend

component: scf
inputs:
  name: wxqr-backend
  src:
    src: ./src
    exclude:
      - .env
      - node_modules/.cache/**
  region: ap-guangzhou
  runtime: Nodejs18.15
  handler: index.handler
  memorySize: 128
  timeout: 10
  environment:
    variables:
      COS_SECRET_ID: ${env:COS_SECRET_ID}
      COS_SECRET_KEY: ${env:COS_SECRET_KEY}
      COS_BUCKET: ${env:COS_BUCKET}
      COS_REGION: ${env:COS_REGION}
      API_BASE_URL: ${env:API_BASE_URL}
  events:
    - apigw:
        parameters:
          serviceName: wxqr-api
          environment: release
          endpoints:
            - path: /create
              method: POST
              enableCORS: true
            - path: /scan/{id}
              method: GET
            - path: /codes
              method: GET
              enableCORS: true
            - path: /codes/{id}
              method: DELETE
              enableCORS: true
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.js backend/serverless.yml
git commit -m "feat: SCF router entry point and serverless config"
```

---

## Task 6: 腾讯云资源创建 + 部署后端

> 这个 Task 需要在腾讯云控制台和本地终端操作，**不需要写代码**。

- [ ] **Step 1: 注册腾讯云并完成实名认证**
  - 访问 https://cloud.tencent.com/，注册账号
  - 进入"账号信息" → "实名认证"，完成个人实名

- [ ] **Step 2: 创建 COS Bucket**
  - 进入控制台 → 对象存储 COS → 创建存储桶
  - 名称：`wxqr-你的数字`（例如 `wxqr-1234567890`），地域选"广州"
  - 访问权限：**公有读私有写**
  - 记下完整 Bucket 名称（格式：`wxqr-1234567890`）

- [ ] **Step 3: 获取 API 密钥**
  - 控制台右上角 → 访问管理 → API密钥管理 → 新建密钥
  - 记下 `SecretId` 和 `SecretKey`

- [ ] **Step 4: 本地创建 `backend/.env` 文件（先填已知的部分）**

```
COS_SECRET_ID=<你的SecretId>
COS_SECRET_KEY=<你的SecretKey>
COS_BUCKET=wxqr-你的数字
COS_REGION=ap-guangzhou
API_BASE_URL=占位，部署后填写
```

- [ ] **Step 5: 安装 Serverless Framework 并登录**

```bash
npm install -g serverless
cd backend
serverless login
```

浏览器弹出腾讯云授权页，同意授权。

- [ ] **Step 6: 安装 backend 依赖并部署**

```bash
cd backend
npm install
serverless deploy
```

部署成功后，终端会输出类似：
```
ServiceId: service-xxxxxxxx
Environment: release
URL: https://service-xxxxxxxx.gz.apigw.tencentcs.com/release
```

- [ ] **Step 7: 将 API Gateway URL 填入 .env 并重新部署**

```bash
# 编辑 backend/.env，将 API_BASE_URL 改为上一步的 URL
# 例如：API_BASE_URL=https://service-xxxxxxxx.gz.apigw.tencentcs.com/release
serverless deploy
```

- [ ] **Step 8: 验证后端接口可用**

```bash
# 替换为你的实际 URL
curl -X POST https://service-xxxxxxxx.gz.apigw.tencentcs.com/release/create \
  -H "Content-Type: application/json" \
  -d '{"qr1":"dGVzdA==","qr2":"dGVzdA=="}'
```

期望：收到 `{"id":"...","scan_url":"..."}` 格式的 JSON 响应

- [ ] **Step 9: Commit（不要提交 .env）**

```bash
echo ".env" >> backend/.gitignore
git add backend/.gitignore backend/.env.example
git commit -m "chore: add .gitignore for backend secrets"
```

---

## Task 7: 桌面 App 脚手架

**Files:**
- Create: `desktop/` 整个目录结构（通过 electron-vite 模板）

- [ ] **Step 1: 用 electron-vite 创建项目**

```bash
cd /home/work/openclaude/WXQR
npm create @quick-start/electron@latest desktop -- --template react-ts
cd desktop
npm install
```

- [ ] **Step 2: 安装业务依赖**

```bash
cd desktop
npm install qrcode
npm install --save-dev @types/qrcode
```

- [ ] **Step 3: 验证脚手架可以启动（开发模式）**

```bash
cd desktop
npm run dev
```

期望：Electron 窗口弹出，显示默认 React 页面（Vite + Electron 欢迎页）

关闭窗口后继续。

- [ ] **Step 4: Commit**

```bash
git add desktop/
git commit -m "feat: scaffold Electron + React desktop app"
```

---

## Task 8: Electron 主进程 + IPC 桥接

**Files:**
- Modify: `desktop/src/main/index.ts`
- Modify: `desktop/src/preload/index.ts`

- [ ] **Step 1: 替换 `desktop/src/preload/index.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (dataUrl: string, filename: string): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('save-image', dataUrl, filename),
  getConfig: (): Promise<{ apiUrl: string }> =>
    ipcRenderer.invoke('get-config'),
  setConfig: (config: { apiUrl: string }): Promise<void> =>
    ipcRenderer.invoke('set-config', config),
})
```

- [ ] **Step 2: 在 `desktop/src/main/index.ts` 中注册 IPC 处理器**

在文件 `app.whenReady().then(createWindow)` 之前，添加以下 import 和 IPC 注册代码：

```typescript
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const configPath = join(app.getPath('userData'), 'wxqr-config.json')

ipcMain.handle('save-image', async (_, dataUrl: string, filename: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  })
  if (canceled || !filePath) return { success: false }
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return { success: true, path: filePath }
})

ipcMain.handle('get-config', () => {
  if (existsSync(configPath)) {
    try { return JSON.parse(readFileSync(configPath, 'utf-8')) } catch { /* ignore */ }
  }
  return { apiUrl: '' }
})

ipcMain.handle('set-config', (_, config: { apiUrl: string }) => {
  writeFileSync(configPath, JSON.stringify(config))
})
```

> 注意：electron-vite 模板的 `main/index.ts` 已有 `app`、`BrowserWindow` 等 import，只需添加 `ipcMain`, `dialog` 到已有 import 行，并将 `fs` 和 IPC 注册代码插入 `app.whenReady()` 之前。

- [ ] **Step 3: 为 TypeScript 声明 window.electronAPI 类型**

创建 `desktop/src/renderer/src/env.d.ts`（如果不存在则创建）：

```typescript
interface Window {
  electronAPI: {
    saveImage: (dataUrl: string, filename: string) => Promise<{ success: boolean; path?: string }>
    getConfig: () => Promise<{ apiUrl: string }>
    setConfig: (config: { apiUrl: string }) => Promise<void>
  }
}
```

- [ ] **Step 4: 启动 dev 验证无编译错误**

```bash
cd desktop && npm run dev
```

期望：窗口正常弹出，终端无 TypeScript 报错

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/index.ts desktop/src/preload/index.ts desktop/src/renderer/src/env.d.ts
git commit -m "feat: IPC bridge for save-image, get-config, set-config"
```

---

## Task 9: API 客户端（TDD）

**Files:**
- Create: `desktop/src/renderer/src/api.ts`
- Create: `desktop/src/renderer/src/__tests__/api.test.ts`

- [ ] **Step 1: 安装测试依赖**

```bash
cd desktop
npm install --save-dev vitest @vitest/ui jsdom
```

- [ ] **Step 2: 在 `desktop/electron.vite.config.ts` 中添加 vitest 配置**

在 `renderer` 配置中添加 `test`：

```typescript
renderer: {
  // ...已有配置...
  test: {
    environment: 'jsdom',
    globals: true,
  },
},
```

在 `desktop/package.json` scripts 中添加：

```json
"test": "vitest run"
```

- [ ] **Step 3: 写失败测试 `desktop/src/renderer/src/__tests__/api.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock window.electronAPI
const mockGetConfig = vi.fn().mockResolvedValue({ apiUrl: 'https://api.example.com' })
vi.stubGlobal('electronAPI', { getConfig: mockGetConfig, saveImage: vi.fn(), setConfig: vi.fn() })

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { listCodes, deleteCode } from '../api'

beforeEach(() => vi.clearAllMocks())

describe('listCodes', () => {
  it('发起 GET /codes 请求并返回数组', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'abc', scan_count: 5, created_at: '2026-01-01T00:00:00Z' }]),
    })
    const result = await listCodes()
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/codes')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('abc')
  })
})

describe('deleteCode', () => {
  it('发起 DELETE /codes/:id 请求', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })
    await deleteCode('abc')
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/codes/abc', { method: 'DELETE' })
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

```bash
cd desktop && npm test
```

期望：FAIL，`Cannot find module '../api'`

- [ ] **Step 5: 实现 `desktop/src/renderer/src/api.ts`**

```typescript
async function getApiUrl(): Promise<string> {
  const config = await window.electronAPI.getConfig()
  return config.apiUrl
}

export async function createCode(qr1File: File, qr2File: File): Promise<{ id: string; scan_url: string }> {
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const [qr1, qr2] = await Promise.all([toBase64(qr1File), toBase64(qr2File)])
  const apiUrl = await getApiUrl()

  const res = await fetch(`${apiUrl}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qr1, qr2 }),
  })
  if (!res.ok) throw new Error(`创建失败: HTTP ${res.status}`)
  return res.json()
}

export async function listCodes(): Promise<Array<{ id: string; scan_count: number; created_at: string }>> {
  const apiUrl = await getApiUrl()
  const res = await fetch(`${apiUrl}/codes`)
  if (!res.ok) throw new Error(`获取列表失败: HTTP ${res.status}`)
  return res.json()
}

export async function deleteCode(id: string): Promise<void> {
  const apiUrl = await getApiUrl()
  const res = await fetch(`${apiUrl}/codes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除失败: HTTP ${res.status}`)
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd desktop && npm test
```

期望：PASS，2 tests passed

- [ ] **Step 7: Commit**

```bash
git add desktop/src/renderer/src/api.ts desktop/src/renderer/src/__tests__/api.test.ts
git commit -m "feat: API client with TDD"
```

---

## Task 10: 配置页 + 应用路由

**Files:**
- Modify: `desktop/src/renderer/src/App.tsx`
- Create: `desktop/src/renderer/src/pages/SetupPage.tsx`

- [ ] **Step 1: 创建 `desktop/src/renderer/src/pages/SetupPage.tsx`**

```tsx
import { useState } from 'react'

interface Props {
  onSaved: (apiUrl: string) => void
}

export default function SetupPage({ onSaved }: Props) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!url.startsWith('http')) {
      alert('请输入完整的 https:// 地址')
      return
    }
    setSaving(true)
    await window.electronAPI.setConfig({ apiUrl: url.trim() })
    setSaving(false)
    onSaved(url.trim())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '0 40px' }}>
      <h2 style={{ marginBottom: 8 }}>初始配置</h2>
      <p style={{ color: '#666', marginBottom: 24, textAlign: 'center' }}>
        请输入你部署好的腾讯云 SCF API 网关地址
      </p>
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://service-xxx.gz.apigw.tencentcs.com/release"
        style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #ccc', marginBottom: 16, boxSizing: 'border-box' }}
      />
      <button
        onClick={handleSave}
        disabled={saving || !url}
        style={{ padding: '10px 32px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
      >
        {saving ? '保存中...' : '保存并开始使用'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 替换 `desktop/src/renderer/src/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import SetupPage from './pages/SetupPage'
import CodeListPage from './pages/CodeListPage'
import CreateCodePage from './pages/CreateCodePage'

type Page = 'list' | 'create'

export default function App() {
  const [apiUrl, setApiUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('list')

  useEffect(() => {
    window.electronAPI.getConfig().then(config => {
      setApiUrl(config.apiUrl || null)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>加载中...</div>
  if (!apiUrl) return <SetupPage onSaved={url => setApiUrl(url)} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1976d2', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>🔄 微信活码管理</span>
        {page === 'list'
          ? <button onClick={() => setPage('create')} style={{ background: '#fff', color: '#1976d2', border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>+ 新建活码</button>
          : <button onClick={() => setPage('list')} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>← 返回列表</button>
        }
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {page === 'list'
          ? <CodeListPage />
          : <CreateCodePage onCreated={() => setPage('list')} />
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 启动 dev 确认配置页正常显示**

```bash
cd desktop && npm run dev
```

期望：弹出配置页，输入框和按钮正常显示

- [ ] **Step 4: Commit**

```bash
git add desktop/src/renderer/src/App.tsx desktop/src/renderer/src/pages/SetupPage.tsx
git commit -m "feat: setup page and app routing"
```

---

## Task 11: 活码列表页

**Files:**
- Create: `desktop/src/renderer/src/pages/CodeListPage.tsx`
- Create: `desktop/src/renderer/src/components/CodeCard.tsx`

- [ ] **Step 1: 创建 `desktop/src/renderer/src/components/CodeCard.tsx`**

```tsx
interface Code {
  id: string
  scan_count: number
  created_at: string
  qrDataUrl?: string
}

interface Props {
  code: Code
  onDelete: (id: string) => void
  onSave: (id: string) => void
}

export default function CodeCard({ code, onDelete, onSave }: Props) {
  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14, background: '#fff' }}>
      <div style={{ width: 56, height: 56, background: '#f5f5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {code.qrDataUrl
          ? <img src={code.qrDataUrl} alt="活码" style={{ width: 52, height: 52 }} />
          : <span style={{ fontSize: 24 }}>▦</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 'bold', fontSize: 14 }}>活码 {code.id}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          已扫描 {code.scan_count} 次 · {new Date(code.created_at).toLocaleDateString('zh-CN')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onSave(code.id)} style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
          💾 保存图片
        </button>
        <button onClick={() => onDelete(code.id)} style={{ background: '#fce4ec', color: '#c62828', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
          删除
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `desktop/src/renderer/src/pages/CodeListPage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import CodeCard from '../components/CodeCard'
import { listCodes, deleteCode } from '../api'

interface CodeItem {
  id: string
  scan_count: number
  created_at: string
  qrDataUrl?: string
  scan_url?: string
}

export default function CodeListPage() {
  const [codes, setCodes] = useState<CodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCodes = async () => {
    setLoading(true)
    setError('')
    try {
      const config = await window.electronAPI.getConfig()
      const raw = await listCodes()
      const withQr = await Promise.all(raw.map(async c => {
        const scanUrl = `${config.apiUrl}/scan/${c.id}`
        const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 200, margin: 1 })
        return { ...c, qrDataUrl, scan_url: scanUrl }
      }))
      setCodes(withQr)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCodes() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm(`确认删除活码 ${id}？删除后无法恢复。`)) return
    try {
      await deleteCode(id)
      setCodes(prev => prev.filter(c => c.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const handleSave = async (id: string) => {
    const code = codes.find(c => c.id === id)
    if (!code?.qrDataUrl) return
    const result = await window.electronAPI.saveImage(code.qrDataUrl, `活码-${id}.png`)
    if (result.success) alert(`已保存到: ${result.path}`)
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>加载中...</div>
  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#c62828' }}>{error}</p>
      <button onClick={loadCodes} style={{ padding: '8px 20px', cursor: 'pointer' }}>重试</button>
    </div>
  )
  if (codes.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>
      <p>还没有活码，点击右上角"新建活码"开始</p>
    </div>
  )

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {codes.map(code => (
        <CodeCard key={code.id} code={code} onDelete={handleDelete} onSave={handleSave} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 启动 dev，配置 API URL，验证列表页加载（可先用空列表）**

```bash
cd desktop && npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add desktop/src/renderer/src/pages/CodeListPage.tsx desktop/src/renderer/src/components/CodeCard.tsx
git commit -m "feat: code list page with QR preview and delete/save"
```

---

## Task 12: 新建活码页

**Files:**
- Create: `desktop/src/renderer/src/pages/CreateCodePage.tsx`

- [ ] **Step 1: 创建 `desktop/src/renderer/src/pages/CreateCodePage.tsx`**

```tsx
import { useState, useRef } from 'react'
import QRCode from 'qrcode'
import { createCode } from '../api'

interface Props {
  onCreated: () => void
}

function ImageUploadBox({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    onFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{ flex: 1, border: `2px dashed #1976d2`, borderRadius: 10, padding: 16, textAlign: 'center', background: '#f8fbff', cursor: 'pointer', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
      {preview
        ? <img src={preview} alt={label} style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 8 }} />
        : <span style={{ fontSize: 28, marginBottom: 6 }}>📷</span>
      }
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1976d2' }}>{label}</div>
      {!file && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>点击选择图片</div>}
      {file && <div style={{ fontSize: 11, color: '#4caf50', marginTop: 4 }}>✓ {file.name}</div>}
    </div>
  )
}

export default function CreateCodePage({ onCreated }: Props) {
  const [qr1File, setQr1File] = useState<File | null>(null)
  const [qr2File, setQr2File] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ id: string; qrDataUrl: string; scan_url: string } | null>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!qr1File || !qr2File) { setError('请先上传两个微信号的二维码图片'); return }
    setGenerating(true)
    setError('')
    try {
      const data = await createCode(qr1File, qr2File)
      const qrDataUrl = await QRCode.toDataURL(data.scan_url, { width: 256, margin: 2 })
      setResult({ id: data.id, qrDataUrl, scan_url: data.scan_url })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败，请检查网络和 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    const res = await window.electronAPI.saveImage(result.qrDataUrl, `活码-${result.id}.png`)
    if (res.success) alert(`活码图片已保存到:\n${res.path}`)
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>上传两个微信号的二维码图片，第1位扫到微信号1，第2位扫到微信号2，循环交替</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <ImageUploadBox label="微信号 1" file={qr1File} onFile={setQr1File} />
        <ImageUploadBox label="微信号 2" file={qr2File} onFile={setQr2File} />
      </div>

      {error && <p style={{ color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {!result && (
        <button
          onClick={handleGenerate}
          disabled={generating || !qr1File || !qr2File}
          style={{ width: '100%', padding: '11px', background: generating ? '#90caf9' : '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
        >
          {generating ? '生成中...' : '⚡ 生成活码'}
        </button>
      )}

      {result && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 20, textAlign: 'center', background: '#f9f9f9' }}>
          <img src={result.qrDataUrl} alt="活码" style={{ width: 180, height: 180 }} />
          <p style={{ fontSize: 12, color: '#888', margin: '8px 0 16px' }}>将此图片发给客户扫描即可</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={handleSave} style={{ padding: '8px 20px', background: '#43a047', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              💾 保存图片到本地
            </button>
            <button onClick={onCreated} style={{ padding: '8px 20px', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              返回列表
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 端到端测试（需要后端已部署）**

```bash
cd desktop && npm run dev
```

操作步骤：
1. 配置页填入 SCF API URL，保存
2. 点击"新建活码"
3. 上传两张图片（任意 jpg/png）
4. 点击"生成活码"，等待生成
5. 确认活码 QR 图显示，点"保存图片"确认文件保存
6. 用手机扫描保存的 QR 图，确认打开网页显示微信二维码1
7. 再次扫描，确认显示微信二维码2

- [ ] **Step 3: Commit**

```bash
git add desktop/src/renderer/src/pages/CreateCodePage.tsx
git commit -m "feat: create code page with image upload and QR generation"
```

---

## Task 13: 打包为 Windows .exe 安装包

**Files:**
- Modify: `desktop/electron-builder.yml`
- Modify: `desktop/package.json`

- [ ] **Step 1: 替换 `desktop/electron-builder.yml`**

```yaml
appId: com.wxqr.desktop
productName: 微信活码管理
copyright: Copyright © 2026

directories:
  buildResources: resources

files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: resources/icon.ico
  uninstallerIcon: resources/icon.ico
  installerHeaderIcon: resources/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: 微信活码管理
```

- [ ] **Step 2: 在 `desktop/package.json` 中确认 build 脚本存在**

确认 scripts 中有：
```json
"build:win": "npm run build && electron-builder --win"
```

如果没有，添加该行。

- [ ] **Step 3: 创建 Windows 图标（如果 resources/icon.ico 不存在则用 png 代替）**

检查 `desktop/resources/` 目录，确认存在 `icon.ico`。electron-vite 模板通常已提供默认图标，如无 `.ico` 则将 `electron-builder.yml` 中 `icon` 路径改为 `resources/icon.png`：

```bash
ls desktop/resources/
```

如只有 `icon.png`，将 yml 中所有 `icon.ico` 改为 `icon.png`。

- [ ] **Step 4: 构建 .exe**

```bash
cd desktop
npm run build:win
```

构建时间约 3-5 分钟（需要下载 Electron 二进制）。

期望输出：`dist/` 目录中出现 `微信活码管理 Setup 1.0.0.exe`

- [ ] **Step 5: 安装并验证**

双击 `dist/微信活码管理 Setup 1.0.0.exe`，按向导安装，启动 App，完整验证流程：
1. 配置页输入 API URL
2. 新建活码，上传两张图，生成并保存
3. 列表页显示活码，扫码次数正确
4. 删除活码

- [ ] **Step 6: 最终 Commit**

```bash
git add desktop/electron-builder.yml desktop/package.json
git commit -m "feat: electron-builder NSIS Windows installer config"
```

---

## 自检

| 规格要求 | 对应 Task |
|---------|----------|
| 上传两个微信号二维码 | Task 12: CreateCodePage 两个上传框 |
| 生成活码 QR 图 | Task 12: qrcode 生成 + 展示 |
| 保存图片到本地 | Task 8: IPC save-image + Task 12 保存按钮 |
| 奇数次扫→微信号1，偶数次→微信号2 | Task 2: getQrKey + scan.js |
| 扫码页显示微信二维码 | Task 2: scan.js 返回 HTML |
| 活码列表 + 扫码次数 | Task 11: CodeListPage |
| 删除活码 | Task 4: delete.js + Task 11: handleDelete |
| 腾讯云 SCF + COS 免费 | Task 6: 部署步骤 |
| Windows .exe 安装包 | Task 13: electron-builder |
| 首次配置 API URL | Task 10: SetupPage |
