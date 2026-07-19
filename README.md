# Vastark 行为验证码 JS SDK

为 Vastark 行为验证码（图形点击验证）提供浏览器端 JavaScript SDK，支持 ESM 和 UMD 两种引入方式。

## 文件说明

| 文件 | 格式 | 适用场景 |
|------|------|----------|
| `vastark-saas-captcha.esm.js` | ES Module | Webpack / Vite / 现代前端工程 / 不支持IE浏览器 |
| `vastark-saas-captcha.umd.js` | UMD | `<script>` 标签直接引入 / 传统页面 / 兼容IE浏览器 |

## 快速开始

### ESM 引入

```js
import { createCaptchaClient } from './vastark-saas-captcha.esm.js';

const captcha = createCaptchaClient({
  platformBaseUrl: 'https://your-platform.com',
  backendGenerateUrl: 'https://your-api.com/captcha/generate',
  backendVerifyUrl: 'https://your-api.com/captcha/verify',
});

// 挂载到页面容器，自动加载验证码
captcha.mount('#captcha-container');
```

### UMD 引入

```html
<script src="vastark-saas-captcha.umd.js"></script>
<script>
  var captcha = VastarkSaaSCaptcha.createCaptchaClient({
    platformBaseUrl: 'https://your-platform.com',
    backendGenerateUrl: 'https://your-api.com/captcha/generate',
    backendVerifyUrl: 'https://your-api.com/captcha/verify',
  });
  captcha.mount('#captcha-container');
</script>
```

## 配置参数

`createCaptchaClient(options)` 接收以下配置项：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `platformBaseUrl` | string | 是 | `""` | Vastark 开放平台基础 URL |
| `backendGenerateUrl` | string | 是 | `""` | 业务后端生成验证码的接口地址（完整 URL） |
| `backendVerifyUrl` | string | 是 | `""` | 业务后端验证结果的接口地址（完整 URL） |
| `failureMode` | string | 否 | `"fail-close"` | 故障模式：`"fail-close"` 阻断 / `"fail-open"` 放行 |
| `useDefaultStyles` | boolean | 否 | `true` | 是否注入默认 CSS 样式 |
| `styleText` | string | 否 | `""` | 自定义 CSS 样式文本（见下方"自定义样式"章节） |
| `deviceFingerprint` | string | 否 | `""` | 设备指纹哈希（留空则自动采集浏览器信号生成） |
| `fetchImpl` | function | 否 | `window.fetch` | 自定义 fetch 实现（用于注入拦截器或适配非浏览器环境） |
| `logIdFactory` | function | 否 | 自动生成 | 请求追踪 ID 生成函数 |

### 回调钩子

| 参数 | 类型 | 说明 |
|------|------|------|
| `onLoaded` | `(res) => void` | 验证码图片加载完成 |
| `onError` | `(msg) => void` | 发生异常时调用 |
| `onServiceDown` | `(err) => void` | 后端服务不可用时调用 |
| `onVerifySuccess` | `(res) => void` | 验证通过（后端返回 code=0） |
| `onVerifyFail` | `(res) => void` | 验证失败（点击错误或被 ban） |
| `onCoordinateSelected` | `({captchaId, clickCoordinates}) => void` | 每次成功点击选中文字时触发 |

## API 方法

### 初始化与挂载

```js
// 挂载到容器并自动加载验证码（推荐）
captcha.mount('#my-container');
// 等价于 captcha.init('#my-container')

// 挂载时覆盖配置
captcha.mount('#my-container', {
  failureMode: 'fail-open',
  onVerifySuccess: (res) => console.log('通过', res),
});
```

### 动态注入自定义样式

`setStyleText(styleText)` 方法可随时替换或注入自定义 CSS，立即生效：

```js
// 注入自定义样式（替换已有自定义样式）
captcha.setStyleText(`
  .saassdk-secure-captcha-verify-btn {
    background: #ff6600;
    border: none;
    border-radius: 6px;
    color: #fff;
    padding: 10px 16px;
    font-size: 15px;
    cursor: pointer;
  }
  .saassdk-secure-captcha-refresh-btn {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 6px;
    color: #333;
    padding: 10px 16px;
    font-size: 15px;
    cursor: pointer;
  }
`);

// 清除所有自定义样式，恢复默认
captcha.clearStyleText();
```

### 验证码操作

```js
// 手动加载验证码
captcha.loadCaptcha();

// 加载时传额外参数（如图片格式）
captcha.loadCaptcha({ width: 320 });

// 手动刷新验证码
captcha.refresh();

// 手动触发验证
captcha.verify();

// 获取已选择坐标
const coords = captcha.getClickCoordinates();

// 获取已识别字符
const chars = captcha.getSelectedChars();

// 销毁实例，清空容器
captcha.destroy();
```

## 自定义 CSS 样式

SDK 支持两种样式注入方式：**初始化时 `styleText` 配置**和**运行时 `setStyleText()` 方法**。

### CSS 变量

默认样式的容器最大宽度可通过 CSS 变量覆盖：

```css
:root {
  --recaptcha-max-width: 400px; /* 默认 320px，控制验证码容器最大宽度 */
}
```

### 可覆盖的 CSS 类名

| 类名 | 作用 |
|------|------|
| `.saassdk-secure-captcha` | 验证码最外层容器 |
| `.saassdk-secure-captcha-content` | 内容区（含 max-width 限制） |
| `.saassdk-secure-captcha-hint` | 提示文字（如"请按顺序点击图片中的文字"） |
| `.saassdk-secure-captcha-selected` | 已选择字符显示区 |
| `.saassdk-secure-captcha-image-container` | 图片容器（含边框和圆角） |
| `.saassdk-secure-captcha-image` | 验证码图片（cursor: crosshair） |
| `.saassdk-secure-captcha-controls` | 按钮区域（grid 布局） |
| `.saassdk-secure-captcha-verify-btn` | "验证"按钮 |
| `.saassdk-secure-captcha-refresh-btn` | "刷新"按钮 |
| `.saassdk-secure-click-marker` | 点击标记（绿色圆形箭头） |

### 自定义样式示例

```js
captcha.setStyleText(`
  /* 修改按钮样式 */
  .saassdk-secure-captcha-verify-btn {
    background: #1677ff;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .saassdk-secure-captcha-verify-btn:hover {
    background: #4096ff;
  }

  .saassdk-secure-captcha-refresh-btn {
    background: #fff;
    color: #666;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
  }
  .saassdk-secure-captcha-refresh-btn:hover {
    color: #1677ff;
    border-color: #1677ff;
  }

  /* 修改图片容器边框 */
  .saassdk-secure-captcha-image-container {
    border-color: #1677ff;
    border-width: 2px;
    border-radius: 12px;
  }

  /* 修改提示文字颜色 */
  .saassdk-secure-captcha-hint {
    color: #333;
    font-size: 15px;
    margin-bottom: 12px;
  }
`);
```

### 完全自定义（关闭默认样式）

```js
const captcha = createCaptchaClient({
  useDefaultStyles: false, // 关闭默认样式注入
  styleText: `/* 你的完整样式 */`,
  // ...
});
```

关闭默认样式后，你需要为上述所有类名提供完整的 CSS 定义。

## 图形验证码约束

### 图片尺寸

| 属性 | 值 |
|------|------|
| 默认宽度 | 320px |
| 最小宽度 | 200px |
| 最大宽度 | 320px |
| 高度 | 由服务端根据文字内容动态生成（默认 180px） |
| 计算规则 | `Math.min(Math.max(container.clientWidth - 2, 200), 320)` |

图片宽度根据挂载容器宽度自适应，但限制在 200px~320px 之间。加载时可通过 `loadCaptcha({ width: 280 })` 手动指定。

### 图片格式

图片格式由服务端默认决定（默认为 JPEG），可通过以下方式请求特定格式：

- **URL 参数**：在页面 URL 添加 `?captchaImageFormat=jpeg_q85`（JPEG 85% 质量）或 `?captchaImageFormat=png`
- **代码传参**：`captcha.loadCaptcha({ image_format: 'jpeg_q85' })`
- **推荐图片格式**: 推荐使用jpeg格式，体积只有png的1/10，生成速度快40%-50%，肉眼区分不了图片质量差别

### 点击规则

- 验证码图片显示若干文字（汉字），用户需**按顺序**依次点击对应文字位置
- 每次点击后向服务端验证坐标，命中的文字显示在"已选择"区域
- 最多保留最近 3 次点击，超出时自动移除最早的点击
- 点击验证通过后需调用 `verify()` 提交最终结果

### 错误处理

| 错误枚举 | 含义 |
|----------|------|
| `E_CORS_BLOCKED` | Click 请求跨域被拦截（需在开放平台配置 CORS 来源） |
| `E_NETWORK` | 网络异常 |
| `E_BANNED` | 请求频率过高被临时封禁 |
| `E_VERIFY_TICKET_INVALID` | 验证票据过期或无效（SDK 自动刷新验证码） |
| `E_UNKNOWN` | 未知错误 |

## 容器约束

验证码容器在展示时必须满足以下约束，否则会导致点击坐标计算错误，用户无法正常通过验证。

### 容器必须可见

SDK 通过 `getBoundingClientRect()` 获取图片元素在页面中的位置和尺寸，再结合 `offsetX/offsetY` 计算点击坐标。如果容器在视觉上不可见或尺寸为零，坐标计算将完全错误。

**禁止的做法**：

| 做法 | 问题 |
|------|------|
| `display: none` | 容器宽高为 0，`getBoundingClientRect()` 返回全零矩形 |
| `visibility: hidden` | 虽然占位，但 `offsetX/offsetY` 可能不准确 |
| `opacity: 0` + `height: 0` | CSS 过渡期间高度为 0，图片尚未渲染出正确尺寸 |
| `transform: scale(0)` | 视觉消失但占位不变，坐标需反算缩放比 |
| `position: absolute; left: -9999px` | 屏幕外定位导致 `clientX/clientY` 回退计算异常 |

**正确的做法**：验证码容器始终保持可见，用外层包裹元素控制显隐：

```html
<!-- 外层控制显隐，内层保持渲染 -->
<div id="captcha-modal" style="display: none;">
  <div id="captcha-container"></div>
</div>
```

```js
// 先让容器可见，再挂载验证码
document.getElementById('captcha-modal').style.display = 'block';
// 等待一帧确保布局计算完成
requestAnimationFrame(() => {
  captcha.mount('#captcha-container');
});
```

### CSS 动画过渡的潜在问题

使用 CSS `transition` 或 `animation` 改变容器高度、透明度时，动画中间帧的容器尺寸可能不准确，导致验证码加载时拿到错误的 `clientWidth`，进而请求到尺寸不匹配的验证码图片。

**问题场景**：

```css
/* 问题：opacity 过渡期间容器可能尚未完成布局 */
.modal {
  opacity: 0;
  transition: opacity 0.3s;
}
.modal.show {
  opacity: 1;
}
```

如果在 `opacity` 过渡开始时立即挂载验证码，此时浏览器可能还未完成重排，`container.clientWidth` 可能为 0 或过渡中间值。

**解决方案**：

1. 等待过渡完成后再挂载：

```js
modal.classList.add('show');
// 等待 CSS 过渡结束
modal.addEventListener('transitionend', () => {
  captcha.mount('#captcha-container');
}, { once: true });
```

2. 使用 `requestAnimationFrame` 双帧等待布局稳定：

```js
modal.style.display = 'block';
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    captcha.mount('#captcha-container');
  });
});
```

3. 在初始时就让容器参与布局，仅控制 `visibility` 和 `opacity`，不改变尺寸：

```css
.captcha-modal {
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.3s, visibility 0.3s;
  /* 关键：保持固定高度，不参与高度过渡 */
  min-height: 300px;
}
.captcha-modal.show {
  visibility: visible;
  opacity: 1;
}
```

### 验证码刷新时的容器稳定性

调用 `captcha.refresh()` 或 `captcha.loadCaptcha()` 时，SDK 会重新读取 `container.clientWidth` 来决定请求的图片宽度。刷新期间容器尺寸发生变化会导致新旧验证码图片宽度不一致。

**建议**：刷新验证码时保持容器尺寸稳定，不要在刷新同时改变容器或父级的宽度。

## 响应式容器 CSS 设置指南

为使验证码在 PC 和移动端均正常展示，需正确设置容器和父级元素的 CSS。以下为推荐配置。

### 必须的 HTML Meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

缺少此 meta 标签时，移动端浏览器会以桌面宽度渲染页面，导致验证码容器宽度远大于屏幕，图片和按钮比例失调。

### 容器 CSS 最小配置

```css
/* 验证码外层包裹 —— 控制整体宽度和居中 */
.captcha-wrapper {
  width: 100%;
  max-width: 360px;       /* PC 端限制最大宽度 */
  margin: 0 auto;          /* 水平居中 */
  padding: 16px;
  box-sizing: border-box;
}

/* 验证码挂载容器 —— 不要设置固定高度 */
#captcha-container {
  width: 100%;
  /* 不要设置 height、min-height、overflow: hidden */
}
```

### PC 端配置

```css
@media (min-width: 769px) {
  .captcha-wrapper {
    max-width: 360px;
    padding: 24px;
  }
}
```

### 移动端配置

```css
@media (max-width: 768px) {
  .captcha-wrapper {
    max-width: 100%;        /* 铺满屏幕宽度 */
    padding: 12px;
  }
}
```

### 容器宽度与验证码图片的关系

SDK 加载验证码时使用 `container.clientWidth` 计算图片请求宽度：
- `container.clientWidth >= 320` → 请求 320px 宽度图片
- `200 <= container.clientWidth < 320` → 请求实际宽度图片
- `container.clientWidth < 200` → 请求 200px 最小宽度图片

因此，容器的 CSS 宽度直接决定了验证码图片的清晰度。推荐容器内容区宽度至少 200px。

### 常见 PC + 移动端布局模板

```html
<style>
  /* reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f5f5f5;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .captcha-card {
    width: 100%;
    max-width: 400px;
    margin: 16px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 24px;
  }

  .captcha-card h3 {
    font-size: 18px;
    margin-bottom: 16px;
    text-align: center;
  }

  /* 挂载容器：不设固定高度，由内容撑开 */
  #captcha-container {
    width: 100%;
  }
</style>

<div class="captcha-card">
  <h3>安全验证</h3>
  <div id="captcha-container"></div>
</div>
```

此布局在 PC 端居中显示 400px 卡片，移动端卡片自适应屏幕宽度（减去 32px 边距），验证码容器由内容自然撑开。

### 弹窗/Modal 中的验证码

在弹窗中展示验证码时，需注意弹窗打开动画完成后再挂载：

```js
// 打开弹窗
function openCaptchaModal() {
  overlay.classList.add('show');
  // 等待弹窗动画完成（假定 300ms transition）
  setTimeout(() => {
    captcha.mount('#captcha-container');
  }, 300);
}
```

弹窗 CSS 建议：

```css
.overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.3s, visibility 0.3s;
}
.overlay.show {
  visibility: visible;
  opacity: 1;
}

.modal {
  width: 90vw;
  max-width: 400px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}
```

## 响应式样式说明

### 容器自适应

SDK 的默认 CSS 使用以下响应式策略：

```css
.saassdk-secure-captcha {
  width: 100%;           /* 容器填满父级宽度 */
  box-sizing: border-box;
}

.saassdk-secure-captcha-content {
  width: 100%;
  max-width: var(--recaptcha-max-width, 320px);  /* CSS 变量控制最大宽度 */
  margin: 0 auto;        /* 水平居中 */
}

.saassdk-secure-captcha-image {
  width: 100%;           /* 图片自适应容器宽度 */
  height: auto;          /* 保持宽高比 */
}

.saassdk-secure-captcha-controls {
  display: grid;
  grid-template-columns: 1fr;  /* 按钮各占一整行 */
  gap: 12px;
}
```

### 宽度控制建议

| 场景 | `--recaptcha-max-width` | 说明 |
|------|-------------------------|------|
| 移动端全屏 | `100%` 或不设置 | 验证码铺满屏幕宽度 |
| PC 侧边栏 | `280px` | 适合侧边栏或弹窗 |
| PC 居中弹窗 | `360px` | 适合居中 Modal |
| 默认 | `320px` | 平衡移动端和 PC 端 |

### 移动端触摸支持

SDK 同时支持鼠标点击和触摸事件：

- **桌面端**：`click` 事件 + `offsetX/offsetY` 获取相对图片坐标
- **移动端**：`touchend` 事件 + `clientX/clientY` + 图片边界框回退计算

按钮区域使用 CSS Grid 单列布局，移动端狭窄屏幕下按钮自然堆叠，无需额外媒体查询。如需进一步优化移动端体验，可通过自定义样式覆盖：

```css
/* 移动端按钮并排 */
@media (max-width: 480px) {
  .saassdk-secure-captcha-controls {
    grid-template-columns: 1fr 1fr;  /* 按钮并排 */
  }
  .saassdk-secure-captcha-verify-btn,
  .saassdk-secure-captcha-refresh-btn {
    font-size: 13px;
    padding: 10px 12px;
  }
}
```

## 完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vastark 验证码示例</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px; }
    .captcha-wrapper { max-width: 360px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="captcha-wrapper">
    <h2>行为验证</h2>
    <div id="captcha-container"></div>
    <p id="result" style="margin-top:16px;color:#666;"></p>
  </div>

  <script src="vastark-saas-captcha.umd.js"></script>
  <script>
    var captcha = VastarkSaaSCaptcha.createCaptchaClient({
      platformBaseUrl: 'https://your-platform.com',
      backendGenerateUrl: 'https://your-api.com/captcha/generate',
      backendVerifyUrl: 'https://your-api.com/captcha/verify',
      failureMode: 'fail-close',
      useDefaultStyles: true,
      onLoaded: function(res) {
        console.log('验证码已加载', res);
      },
      onVerifySuccess: function(res) {
        document.getElementById('result').textContent = '验证通过！';
        console.log('验证成功', res);
      },
      onVerifyFail: function(res) {
        document.getElementById('result').textContent = '验证失败: ' + (res.message || '请重试');
      },
      onCoordinateSelected: function(data) {
        console.log('坐标选择', data.clickCoordinates);
      },
    });

    captcha.mount('#captcha-container');
  </script>
</body>
</html>
```
