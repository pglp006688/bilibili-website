# bilibili-website

一个仿 Bilibili 的竖屏短视频站点。纯静态，Vue 3 + Python，
GitHub Actions 构建，GitHub Pages 托管。

没有后端，没有数据库。视频来自仓库文件或 CDN，
点赞数写在 `config.json`，评论直接用 GitHub Issues。

---

## 特性

- 竖向滑动信息流，滚到哪条播哪条
- 支持本地视频和 CDN 直链，可混用
- 文件名或目录自动解析作者与标题，同名图片自动当封面
- 点赞数由 `config.json` 配置，点击本地 +1
- 评论走 GitHub Issues，用户用 GitHub 账号留言
- 零依赖前端，Vue 走 CDN，构建只跑一次 Python 脚本
- Actions 手动触发，不占用 CI 额度

---

## 快速开始

### 1. Fork 或克隆本仓库

### 2. 放视频

创建 `videos/` 目录，两种放法任选：

```
videos/
├── 小明-第一次做菜.mp4        ← 文件名解析
├── 小红/旅行日记.mp4          ← 目录解析
└── cdn.json                   ← CDN 清单
```

详见 [IMPORT.md](./videos/IMPORT.md)。

### 3. 配置 `config.json`

```json
{
  "repo": "yourname/your-repo",
  "likes": {
    "小明/第一次做菜": 1234
  },
  "issues": {
    "小明/第一次做菜": 1
  }
}
```

`likes` 和 `issues` 的 key 都是 `作者/标题`，
必须和构建生成的 `videos.json` 完全一致。

### 4. 建 Issue

仓库 Issues → New issue，标题随意（建议和视频同名），
建好后把编号填进 `config.json` 的 `issues`。
一个视频对应一个 issue，用户就在这个 issue 里评论。

### 5. 启用 Pages

**Settings → Pages → Source** 选 **GitHub Actions**。

> 这一步必须手动做一次，否则工作流会报 `Get Pages site failed`。

### 6. 部署

**Actions → Build and Deploy → Run workflow**。

构建完成后访问 `https://<用户名>.github.io/<仓库名>/`。

---

## 目录结构

```
.
├── .github/workflows/deploy.yml   # 构建与部署
├── config.json                    # 点赞数 + issue 映射
├── scripts/gen_manifest.py        # 扫描 videos/ 生成清单
├── index.html                     # 页面骨架与样式
├── src/app.js                     # Vue 应用逻辑
├── videos/                        # 你的素材（自行创建）
└── IMPORT.md                      # 导入说明
```

---

## 工作流程

```
访客打开页面
   ├─ 点赞  读 config.json → 本地 +1，刷新还原
   └─ 评论  点 💬 → 拉取 GitHub Issues 评论
            → 点「发评论 ↗」跳转 GitHub 留言
```

构建时 Python 脚本做的事：

```
扫描 videos/
   ├─ *.mp4 等  → 解析作者/标题，找同名封面
   └─ *.json    → 读取 CDN 链接
输出 videos.json
```

---

## 本地预览

```bash
python scripts/gen_manifest.py --src videos --out videos.json
python -m http.server 8000
```

然后打开 `http://localhost:8000`。

> 必须走 HTTP 服务，直接双击 `index.html` 会因为 `fetch` 跨域失败。

---

## 注意事项

| 项 | 说明 |
| --- | --- |
| 仓库体积 | Pages 对仓库大小敏感，大视频请走 CDN |
| GitHub API | 未认证 60 次/小时/IP，每个视频只请求一次 |
| 点赞持久化 | 只在本地内存，刷新即还原，不写回仓库 |
| 评论删除 | 删掉对应 issue 即等于清空评论 |
| 视频格式 | `.mkv` 浏览器兼容性差，建议转 `.mp4` |
| 自动播放 | 浏览器要求静音才能自动播放，右上角可解除 |

---

## 常见问题

**Pages 报 `Get Pages site failed`**
Settings → Pages → Source 未选 `GitHub Actions`。

**页面显示「暂无视频」**
`videos/` 为空、被 `.gitignore` 排除，或里面没有可识别文件。

**作者全变成「未知UP主」**
文件名缺分隔符。`小明第一次做菜.mp4` 无法切分，
需写成 `小明-第一次做菜.mp4`，或改用目录形式。

**点赞数不显示**
`config.json` 里缺对应 key，或 key 与 `作者/标题` 拼写不一致。

**评论为空**
`repo` 或 `issues` 未配置；或目标 issue 确实还没有评论。

---

## 许可

Apache-2.0 license
