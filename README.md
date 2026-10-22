# The Fifth Season

HTML、CSS、JavaScript 分开保存，使用用户提供的 Palmetto 字体和背景图。

## 本地打开

在 VS Code 终端运行 `node server.mjs`，浏览器打开 http://127.0.0.1:5173/ 。核心游戏也可双击 index.html 打开，摄像头建议在 localhost 或 HTTPS 下使用。

## 开头与菜单

食指或鼠标按住圆环顺时针转一圈，进入主菜单。食指悬停使选项放大发光，单手拇指与食指捏合约 150ms 确认，松开后才能再次确认。捏合时暂时锁定已有选项以容许手指移动。

`New game` 开始序章；`continue` 恢复同一浏览器的本地存档；`exist game` 返回圆环并关闭摄像头。没有存档时 continue 不可用。鼠标可以直接点击，入口按 Enter 可进入菜单。

## 关卡

左右方向键 / A D 行走，上方向键 / W / 空格跳跃。张开手掌左右移动控制行走，回到中心停止，单独向上伸食指跳跃。共十枚青绿色、金色轮廓的树叶，收集时有粒子反馈，右上角十格对应各枚树叶。高处树叶需要跳跃，连续雪岸可向左返回补收。收齐十枚后走到右端进入结尾。Escape 返回菜单。

## 性能与素材

手势检测首选独立 Worker，256×192 输入，避免同步识别阻塞动画；不支持的浏览器使用低频 GPU 备用路径。识别不阻塞基础游戏加载。视频只在本机处理，模型随站点提供，开启摄像头时才加载；localhost / HTTPS 不依赖第三方 CDN。直接打开 file:// 时的兼容路径仍可能需要联网。

高 DPI 画布限制像素总量，菜单与森林预缩放缓存，仅绘制视野内树叶；减少雪粒和 DOM 更新。圆环与光标在动画帧内插值，角色与猫使用用户模型图清理出的透明精灵。加载细线宽度为桌面 48%、最大 640px，进度平滑变化。

角色素材与清理提示词见 [assets/prompts.md](assets/prompts.md)。画面反馈参考 [Neva 官方介绍](https://neva.game/) 的克制 UI 与旅途氛围，未复制其游戏素材。

font.css 内嵌原始 PALMETTOV0.4TEST-REGULAR.OTF，避免 file:// 字体跨域问题。`node build.mjs` 重新生成字体 CSS 并复制完整静态游戏到 dist。

## 验证与部署

- `node tests/check-interaction.mjs`：圆环平滑、逆向与跳点、单手捏合和去重。
- `node tests/check-level.mjs`：十枚树叶、连续雪岸、跳跃与终点。
- `node build.mjs`：静态资源构建。

GitHub 为 origin 指向的仓库。Cloudflare 按用户最新要求暂缓。本机发布命令为 `npx wrangler deploy`，需要先完成官方登录。

本地 Worker 实际推理冒烟检查：打开 /tests/hand-tracker.html，使用空画布验证同站模型初始化及 ImageBitmap 帧传输，不需要摄像头。

