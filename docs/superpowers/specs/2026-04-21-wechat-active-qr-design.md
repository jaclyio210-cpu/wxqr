# 微信活码 Windows 桌面 App — 设计文档

**日期：** 2026-04-21  
**状态：** 已批准

---

## 1. 目标

个人使用的 Windows 桌面工具，用于创建和管理微信活码。活码是一个固定二维码，扫描者每次轮流看到两个不同的微信号二维码（第1次扫→微信号1，第2次扫→微信号2，循环）。

---

## 2. 架构

```
[Windows 桌面 App]  ←→  [腾讯云 SCF]  ←→  [腾讯云 COS]
  Electron + React        云函数           对象存储
  - 创建活码              - 处理上传        - 微信QR图片
  - 展示活码图            - 处理扫码跳转    - 活码元数据JSON
  - 保存图片到本地        - 计数轮换逻辑
```

扫码流程：
1. 用户扫描活码 → 手机打开 SCF 生成的 URL
2. SCF 读取 COS 中该活码的 JSON 元数据（含 scan_count）
3. scan_count + 1，写回 COS
4. scan_count 为奇数 → 返回微信号1二维码页；偶数 → 微信号2

---

## 3. 技术栈

| 层级 | 技术 |
|------|------|
| 桌面 App | Electron + React + TypeScript |
| 打包分发 | electron-builder → NSIS `.exe` 安装包 |
| QR 生成 | `qrcode` npm 包（客户端生成） |
| 后端逻辑 | 腾讯云 SCF，Node.js 18，HTTP 触发器 |
| 图片存储 | 腾讯云 COS（免费 50GB） |
| 计数存储 | COS JSON 文件（每个活码一个，个人用途并发可接受） |

---

## 4. 数据模型

每个活码在 COS 存储一个 JSON 文件，路径：`codes/{id}/meta.json`

```json
{
  "id": "abc123",
  "qr1_key": "codes/abc123/qr1.jpg",
  "qr2_key": "codes/abc123/qr2.jpg",
  "scan_count": 0,
  "created_at": "2026-04-21T10:00:00Z"
}
```

微信二维码图片存储路径：`codes/{id}/qr1.jpg`，`codes/{id}/qr2.jpg`

---

## 5. SCF API 端点

### POST `/create`
创建活码。接收两张图片（base64），上传至 COS，写入元数据 JSON，返回活码 URL。

**请求：**
```json
{ "qr1": "<base64>", "qr2": "<base64>" }
```

**响应：**
```json
{ "id": "abc123", "scan_url": "https://service-xxx.gz.apigw.tencentcs.com/scan/abc123" }
```

### GET `/scan/{id}`
处理扫码。读取元数据 → 计数+1 → 写回 → 返回 HTML 页面展示对应微信二维码。

### GET `/codes`
返回所有活码列表（id、scan_count、created_at），供桌面 App 首页展示。

### DELETE `/codes/{id}`
删除活码（删除 COS 中的图片和元数据）。

---

## 6. UI 界面

### 界面 1 — 活码列表（主页）
- 顶部栏：App 名称 + "新建活码"按钮
- 每条记录：活码缩略图、已扫次数、"保存图片"按钮、"删除"按钮

### 界面 2 — 新建活码（弹窗或页面）
- 两个上传区域（微信号1、微信号2），点击选择图片文件
- "生成活码"按钮 → 调用 SCF `/create`
- 生成结果展示：活码 QR 图 + "保存图片到本地"按钮

### 扫码者看到的页面（SCF 返回 HTML）
- 简洁手机页面，居中显示对应微信二维码图片
- 文字提示："长按识别二维码，添加微信"

---

## 7. 错误处理

- 上传图片失败：弹出错误提示，保留已上传的图片
- 扫码时 COS 读写失败：返回 500 页面，不修改计数
- 网络超时（App 侧）：3s 超时 + 提示重试

---

## 8. 部署流程（一次性配置）

1. 注册腾讯云账号（实名认证），开通 SCF 和 COS
2. 创建 COS Bucket（公读私写，用于图片访问）
3. 部署 SCF 函数（项目内提供部署脚本）
4. 将 SCF 网关 URL 填入桌面 App 配置
5. electron-builder 打包生成 `.exe`，双击安装即用

---

## 9. 范围限制（不做）

- 不做账号/登录系统
- 不做多用户
- 不做活码访问统计图表（只显示扫码总次数）
- 不做自动分享到社交平台（手动保存图片后自行发布）
