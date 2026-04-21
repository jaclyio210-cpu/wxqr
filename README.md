# WXQR 微信活码工具

一个 Windows 桌面应用，用于管理微信「活码」——扫一次码跳转微信号A，再扫一次跳转微信号B，如此轮换，解决单个微信号加人上限的问题。

## 工作原理

用户将两张微信个人二维码上传，系统生成一个「活码」。每次有人扫描该活码：
- 奇数次扫码 → 跳转微信号 1 的二维码
- 偶数次扫码 → 跳转微信号 2 的二维码

扫描计数和图片存储在腾讯云 COS，跳转逻辑运行在腾讯云 SCF（云函数）。

## 技术栈

| 模块 | 技术 |
|------|------|
| 桌面端 | Electron 28 + React 18 + TypeScript + electron-vite |
| 后端 | Node.js 18 云函数（腾讯云 SCF） |
| 存储 | 腾讯云 COS（图片 + 活码元数据） |
| 打包 | electron-builder → NSIS `.exe` 安装包 |

## 项目结构

```
WXQR/
├── backend/          # 腾讯云 SCF 云函数
│   ├── src/
│   │   ├── index.js  # API 路由入口（/create /scan /codes /codes/:id）
│   │   ├── scan.js   # 扫码轮换逻辑
│   │   ├── create.js # 创建活码
│   │   ├── list.js   # 列出所有活码
│   │   ├── delete.js # 删除活码
│   │   └── cos.js    # COS 存储封装
│   └── serverless.yml
└── desktop/          # Electron 桌面应用
    └── src/
        ├── main/     # Electron 主进程
        ├── preload/  # IPC 桥接
        └── renderer/ # React 前端页面
```

---

## 部署指南

### 第一步：准备腾讯云资源

1. 注册并登录 [腾讯云控制台](https://console.cloud.tencent.com/)，完成实名认证。

2. **创建 COS Bucket**
   - 进入对象存储 → 创建存储桶
   - 地域选「广州（ap-guangzhou）」
   - 访问权限：**公有读私有写**
   - 记下 Bucket 名称（格式：`wxqr-你的APPID`）

3. **获取 API 密钥**
   - 进入「访问管理」→「API 密钥管理」
   - 创建或查看 SecretId / SecretKey

### 第二步：部署后端云函数

```bash
cd backend

# 安装依赖
npm install

# 复制并填写配置
cp .env.example .env
```

编辑 `.env`：

```env
COS_SECRET_ID=你的腾讯云SecretId
COS_SECRET_KEY=你的腾讯云SecretKey
COS_BUCKET=wxqr-1234567890      # 你的 Bucket 名称
COS_REGION=ap-guangzhou
API_BASE_URL=                   # 先留空，部署后填写
```

```bash
# 安装 Serverless Framework
npm install -g serverless

# 登录腾讯云（扫码授权）
serverless login

# 首次部署
serverless deploy
```

部署完成后，终端会输出 API Gateway 地址，格式类似：
```
https://service-xxxxxxxx.gz.apigw.tencentcs.com/release
```

将该地址填入 `.env` 的 `API_BASE_URL`，然后再次部署：

```bash
serverless deploy
```

**验证后端是否正常：**

```bash
curl -X POST https://service-xxx.gz.apigw.tencentcs.com/release/create \
  -H "Content-Type: application/json" \
  -d '{"qr1":"dGVzdA==","qr2":"dGVzdA=="}'
```

### 第三步：配置并运行桌面应用

```bash
cd desktop
npm install
```

首次运行时，应用会弹出设置页，填入上一步获得的 API 地址即可。

**开发模式：**

```bash
npm run dev
```

**打包为 Windows 安装包：**

```bash
npm run build:win
```

生成的 `.exe` 安装包位于 `desktop/dist/` 目录。

---

## API 接口说明

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/create` | 创建活码，body: `{ qr1: base64, qr2: base64 }` |
| `GET` | `/scan/{id}` | 扫码跳转（轮换逻辑在此执行） |
| `GET` | `/codes` | 列出所有活码 |
| `DELETE` | `/codes/{id}` | 删除指定活码 |

## 注意事项

- 活码的扫描跳转地址（`/scan/{id}`）需要可公开访问，确保 API Gateway 未设置鉴权。
- 微信内置浏览器对跳转有限制，建议使用系统默认浏览器扫码测试后再实际使用。
- COS Bucket 设为公有读，图片 URL 可直接访问，无需额外签名。
