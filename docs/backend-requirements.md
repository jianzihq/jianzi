# 后端需求文档 · JIANZI（见字）

**日期**：2026-09-14
**提出**：前端 / 产品
**交给**：后端
**状态**：B2 / B3 已在 `feat/zhihu-oauth-collections` 实现；线上凭证与 Upstash 尚未配置

---

## 0. 先读这四条

1. **截止时间是 9 月 15 日 10:00。** 可运行的体验链接是必交项；接入知乎登录后，登录用户数会计入最佳人气奖。
2. **前端不依赖任何后端也能完整运行。** 卡片内容是仓库里的静态 JSON，评委体验时不调任何接口。后端要做的是：把网站部署上线、接知乎账号登录、让收藏跟着账号走。其中任何一项没做完，网站都必须照常可用。
3. **前端代码由我负责。** 本文定义的是接口契约和验收标准；页面上的登录入口、头像、错误提示都由前端来接。
4. **红线见第 7 节。** 违反任何一条都可能被取消参赛资格。

## 1. 范围

| 编号 | 需求 | 优先级 | 依赖 |
|---|---|---|---|
| B1 | 部署到公网 HTTPS 域名 | P0 | 无 |
| B2 | 知乎 OAuth 登录与会话 | P0 | B1（回调地址需要域名）；队长在活动页领到 `app_id` / `app_key` |
| B3 | 收藏按账号存储 | P1 | B2，以及一个服务端存储 |

**顺序：B1 → B2 → B3。** 域名不先定下来，OAuth 的回调地址就没法登记，B2 会整个卡住。

**不在本文范围**（都不需要后端）：

- 卡片内容池：离线脚本生成的静态 JSON，已经实现
- 喜欢 / 不喜欢：按产品决定只存在浏览器本地，不上服务器
- 反向推荐：前端的一条规则
- 一句推荐理由：人工撰写，或者离线生成

## 2. 技术约定

- 仓库：`github.com/jianzihq/jianzi`，Next.js 16 App Router + TypeScript
- **后端写成 Next.js Route Handlers**，放在 `app/api/**/route.ts`，和前端同域名部署，不另起服务。同域可以省掉跨域和跨域 Cookie 的麻烦，OAuth 回调也只需要登记一个地址
- 部署平台：**Vercel**（已定）
- Next.js 16 和常见资料里的写法有不少差别。写代码前先读 `node_modules/next/dist/docs/` 里对应的章节（仓库里的 `AGENTS.md` 也有这条要求）
- **新增 npm 依赖请先和前端确认**。本次已确认并加入 `@upstash/redis`
- 分支：在 `feat/*` 分支上开发，合并进 `main`

## 3. B1 · 部署

### 需求

- **首次部署由前端做**（2026-09-14 晚）：项目广场要立刻交公网链接，不能等 OAuth。
- 当前生产域名：**https://jianzi-alpha.vercel.app**（Vercel 项目在 Teethe 账号下的 `jianzi`）。GitHub 自动部署还没接上（Vercel 连 `jianzihq/jianzi` 失败），后续推送用 `vercel --prod`，或在 Vercel 里授权 GitHub 组织后再连仓库。
- OAuth 回调登记这个地址（路径不要改）：`https://jianzi-alpha.vercel.app/api/auth/callback`
- 域名先不要换。换了回调就要重新登记。发给队长登记的就是上面这条。
- Preview 部署的地址每次都不一样，OAuth 只能在 Production 域名上走通，这属于正常情况

### 环境变量

在 Vercel 的 Project Settings → Environment Variables 里配置：

| 变量 | 用途 | 说明 |
|---|---|---|
| `ZHIHU_OAUTH_APP_ID` | 知乎应用 ID | 可以公开，但仍然只在服务端读取 |
| `ZHIHU_OAUTH_APP_KEY` | 换取 token | **只能在服务端** |
| `ZHIHU_OAUTH_REDIRECT_URI` | 回调地址 | 必须和活动页登记的值逐字一致 |
| `SESSION_SECRET` | 会话签名 / 加密 | **只能在服务端**，至少 32 字节随机值 |
| `UPSTASH_REDIS_REST_URL` 或 `KV_REST_API_URL` | B3 Redis REST 地址 | **只能在服务端**。Vercel KV / Upstash 集成写入 `KV_*` 即可 |
| `UPSTASH_REDIS_REST_TOKEN` 或 `KV_REST_API_TOKEN` | B3 Redis REST token | **只能在服务端**。读写用这个，不要用 `READ_ONLY` 那份 |

**不要给任何密钥加 `NEXT_PUBLIC_` 前缀**，带这个前缀的变量会被打包进前端代码，等于公开。

### 验收

- `https://<域名>/` 打开是卡片桌，`/sheet` 能访问，任意页面刷新都不会 404
- 在浏览器的前端资源里搜索 `APP_KEY` 和 `SESSION_SECRET` 的值，搜不到

## 4. B2 · 知乎 OAuth 登录

> 依据官方黑客松 skill 的 `hackathon-oauth.md`、`oauth.md`、`hackathon-user-profile-api.md`。要点都已经摘在下面，不用再去翻原文。

### 4.1 凭证

- `app_id` / `app_key` 由**队长在黑客松活动页创建项目后发放**：`https://www.zhihu.com/hackathon?activity_code=zhihu_hackathon_2026_p2`。队长如果还没创建项目，今天必须建（人气奖从 9 月 13 日就开始计数）
- 它们和开放平台的 Access Secret **不是一回事**，本需求用不到 Access Secret
- 凭证由队长私下交给后端，**不要发在群里**

### 4.2 登录流程

**第 1 步：发起登录** `GET /api/auth/login`

- 用密码学安全的随机数生成 `state`（至少 32 字节），保存在服务端或加密的 `HttpOnly` Cookie 里，绑定当前浏览器，10 分钟后过期
- 可以带一个 `?next=/…` 参数，表示登录后返回的站内路径。**只接受以 `/` 开头、且不是 `//` 开头的站内路径**，防止开放重定向
- 302 跳转到：

```text
https://openapi.zhihu.com/authorize?redirect_uri={URL 编码后的回调地址}&app_id={app_id}&response_type=code&state={state}
```

**第 2 步：接收回调** `GET /api/auth/callback`

- 知乎回调的形态是 `{redirect_uri}?authorization_code=…&state=…`
- **参数名实测是 `authorization_code`，不是 `code`**；为了兼容，也接受 `code`
- 按顺序校验 `state`：存在、与本浏览器保存的值完全一致、未过期、未被使用过。**校验通过后立刻作废**，防止同一个回调被重复使用
- 任何一项校验不通过，或者用户拒绝授权、参数缺失：**不去换 token**，直接 302 回首页并带上 `?login=failed`

**第 3 步：服务端换 token**

```text
POST https://openapi.zhihu.com/access_token
Content-Type: application/x-www-form-urlencoded

app_id={app_id}
app_key={app_key}
grant_type=authorization_code
redirect_uri={与第 1 步完全相同的字符串}
code={回调里拿到的 authorization_code}
```

- 成功时响应为 `{ "access_token": "…", "token_type": "Bearer", "expires_in": 3600 }`，**没有 refresh token**
- **判断是否成功，看响应里有没有 `access_token`**，不要只看 HTTP 200。业务字段 `code: 20000` 表示成功，不是错误

**第 4 步：获取用户信息**

```text
GET https://openapi.zhihu.com/user
Authorization: Bearer {access_token}
```

- **`uid` 是 int64，会超出 JavaScript 的安全整数范围**。不要先解析成 Number 再转字符串，那样会丢精度。建议直接用 `hash_id`（字符串）作为用户主键
- **只读取、只保存以下字段**：`hash_id`、`fullname`（昵称）、`avatar_path`（头像）、`headline`（一句话介绍）
- **不读取、不保存** `email`、`phone_no`、`phone`、`gender`、`description`
- 响应里没有有效的用户标识时，按登录失败处理

**第 5 步：建立会话**，然后 302 回 `next` 或 `/`

- 浏览器只持有会话 Cookie：`HttpOnly; Secure; SameSite=Lax; Path=/`，有效期 7 天。本地 `next dev`（HTTP）不设 `Secure`，否则 Cookie 写不进去；Production 仍为 `Secure`
- **OAuth token 只在登录那一刻用来取用户信息**，之后我们不会再调用知乎，所以不需要长期保存 token。不保存是最省事、也最安全的做法
- Vercel 是 Serverless 多实例，**不能用进程内 Map 保存会话**。可以用签名或加密的 Cookie 直接存 `{ userId, name, avatar, headline, exp }`（无状态），也可以和 B3 共用同一个存储

### 4.3 接口契约（前端会调用这些）

**`GET /api/me`**

已登录：

```json
{ "user": { "id": "hash_id 字符串", "name": "昵称", "avatar": "https://…", "headline": "一句话介绍" } }
```

未登录：

```json
{ "user": null }
```

- 未登录**返回 200 和 `user: null`，不要返回 401**，前端把未登录当作正常状态处理
- 接口出错时，前端按未登录处理，网站照常可用

**`POST /api/auth/logout`**：清除会话 Cookie，返回 204

**`GET /api/auth/login`**、**`GET /api/auth/callback`**：见 4.2

### 4.4 前端配合（我来做）

- 登录入口和头像的显示；未登录时网站照常可用
- URL 带 `?login=failed` 时，提示「登录没有成功，可以再试一次」

**已实现**（`feat/login-entry`）：顶边纸签 `app/components/AccountTab.tsx`，登录状态在 `lib/account.ts`。

### 4.5 验收

- 在线上 HTTPS 域名上完成一次真实授权，`/api/me` 返回自己的昵称和头像
- `state` 缺失、不匹配、过期、重复使用这四种情况都被拒绝（请留一份手测记录）
- 退出后 `/api/me` 返回 `{ "user": null }`
- 浏览器的 Network 和 Console、前端资源、服务端日志里，都**看不到** `app_key` 和 `access_token`
- 录制演示视频前再检查一遍上一条

## 5. B3 · 收藏按账号存储

### 5.1 背景

屏幕左侧有三个收藏标签：**稍后读、值得再读、想转给谁**。读者可以把卡片拖到标签上，也可以把标签拖到卡片上。目前前端把收藏存在浏览器本地（`lib/collections.ts`）；登录之后，收藏应该跟着账号走，换一台设备也还在。

### 5.2 数据

- 以用户 id（`hash_id`）为键，值是三个标签各自的卡片 id 数组，**最新收藏的排在最前面**：

```json
{ "later": ["-1663265844044586579", "7438239565019306808"], "again": [], "share": [] }
```

- 标签 id 固定为三个：`later`、`again`、`share`，后端**不支持新增标签**
- 卡片 id 是**字符串**（知乎 ContentID，可能带负号），**不要转成数字**
- 同一个标签里 id 不重复；每个标签最多 500 条
- **存储已定为 Upstash Redis**：一用户一条 JSON，键为 `collections:{hash_id}`。Vercel 集成后写入 `UPSTASH_REDIS_REST_URL` 与 `UPSTASH_REDIS_REST_TOKEN`。依赖 `@upstash/redis`

### 5.3 接口契约

以下接口**全部需要登录**，未登录时返回 `401 { "error": "unauthenticated" }`。

| 方法与路径 | 作用 | 成功响应 |
|---|---|---|
| `GET /api/collections` | 读取当前用户的收藏；没有记录时返回三个空数组 | `200`，形状同 5.2 |
| `PUT /api/collections/{tag}/{cardId}` | 加入收藏，放到最前面；幂等 | `200`，返回完整收藏 |
| `DELETE /api/collections/{tag}/{cardId}` | 移出收藏；幂等 | `200`，返回完整收藏 |
| `POST /api/collections/merge` | 首次登录时，把浏览器本地的收藏合并进账号 | `200`，返回合并后的完整收藏 |

**`merge` 的规则**：请求体形状同 5.2。结果按标签取并集：账号里原有的条目保持原来的顺序排在前面，本地新增的条目按本地顺序接在后面。

**校验**：

- `tag` 必须是三个之一，否则 `400 { "error": "bad_tag" }`
- `cardId` 必须存在于内容池（服务端可以直接 `import { pool } from '@/lib/pool'`），否则 `400 { "error": "unknown_card" }`。`merge` 时**忽略**未知 id，不报错
- 请求体不超过 64KB
- 修改类请求（`PUT` / `DELETE` / `POST`）要校验 `Origin` 头与本站一致，配合 `SameSite=Lax` 防 CSRF

**错误格式统一为** `{ "error": "<code>" }`。遇到 5xx 时，前端会退回本地模式，并提示「收藏暂时没能同步」。

### 5.4 前端配合（我来做）

- 只需要替换 `lib/collections.ts` 里浏览器存储那一层：登录状态下读写走接口，未登录或接口失败时用本地存储
- 首次登录时调用 `merge`，把本地已有的收藏带进账号

**已实现**（`feat/login-entry`）：`lib/collections.ts` 本机留镜像，改动先落本机再发接口。这台浏览器第一次遇到该账号、或有没送达的改动时调 `merge`，否则 `GET` 覆盖镜像；发送失败标记未同步并提示「收藏暂时没能同步」；退出登录清空本机镜像。

### 5.5 验收

- 登录后收藏一张卡，换一个浏览器登录同一账号，能看到这张卡
- 登录前收藏的卡，登录后仍然在
- 非法 `tag`、不存在的卡、未登录三种情况，分别返回 `400`、`400`、`401`

## 6. 需要谁拍板

| 事项 | 找谁 |
|---|---|
| 部署域名 | 后端决定，定下来马上告诉队长登记 |
| `app_id` / `app_key` | 队长在活动页创建项目后领取，私下交给后端 |
| 存储选型 | 已定为 Upstash Redis |
| 新增 npm 依赖 | 和前端确认 |

## 7. 红线

- **不爬取知乎站点**，只使用官方 OAuth 和开放平台接口。赛事规则原文是「严禁批量爬取、滥用站内用户数据」，违规后果是取消参赛资格、封禁开发者账号及关联账号
- **密钥只放在服务端环境变量里**，不进仓库、前端资源、URL、日志、截图、演示视频。仓库是公开的
- **只保存功能必需的用户数据**：用户 id、昵称、头像、一句话介绍。不存邮箱和手机号
- **`redirect_uri` 必须和活动页登记值逐字一致**：协议、域名、端口、路径、尾部斜杠都算
- **token 失效或鉴权失败时停止访问**，不要改用开放平台 Access Secret 所属的账号去调用接口

## 8. 交付方式

- 代码进 `jianzi` 仓库，在 `feat/*` 分支开发，合并进 `main`
- 在合并说明里写清楚：新增了哪些环境变量（只写名字，不写值），手测了哪些验收项
- 实现和本文有出入的地方，直接修改本文件，保持文档和代码一致

## 9. 新增评估项 · AI 初筛与读者复筛

> 本节目前是交给后端的可行性评估，不自动进入 B1 至 B3 的实现范围。后端确认成本和交付时间后，再决定是否进入本次版本。

### 9.1 要解决的问题

人工逐条审核内容池的成本很高。实操中已经确认，只要限定时间范围和关键词，AI 可以从知乎开放平台返回的结果中辅助找出一批值得进一步阅读的内容。

希望把内容筛选拆成两步：AI 负责产生候选，读者在实际阅读过程中完成复筛。审核组继续负责规则和兜底，不需要提前审完每一张候选卡。

### 9.2 AI 候选内容

- 离线脚本按照指定的时间范围和关键词调用知乎开放平台接口
- AI 读取问题标题、作者资料、开放平台提供的原文片段和精选评论，判断内容是否适合进入候选池
- AI 筛出的卡片保留独立状态，与人工审核过的内容区分
- 模型调用只发生在离线建池阶段，用户浏览时不实时调用模型
- 候选内容继续写入静态 JSON，线上页面仍能在模型服务不可用时正常运行

建议先考虑以下数据字段，字段名称可以由实现者调整：

```ts
curationSource: 'human' | 'ai'
curationStatus: 'candidate' | 'approved' | 'rejected'
```

AI 候选卡需要显示轻量标识，并向读者询问：**「你觉得这篇文章好吗？」** 这个问题评价的是原内容质量，不是卡片设计或推荐便签写得好不好。

### 9.3 读者复筛与共享权重

读者对 AI 候选卡提交「好」或「不好」后，反馈进入共享统计。正向反馈逐步提高该卡片的展示权重，负向反馈降低展示概率。少量投票不应立刻决定内容去留，需要设置最低样本数或基础权重，避免一两次操作把卡片推到最前或直接淘汰。

这里会改变当前架构。现有喜欢与不喜欢只保存在浏览器本地，无法形成所有读者共同参与的筛选结果。请后端重点评估：

- 反馈是否只允许已登录用户提交，匿名用户是否需要设备级限制
- 如何阻止同一用户对同一卡片重复投票
- 反馈数据采用什么服务端存储
- 聚合权重如何提供给现有的纯函数排序逻辑
- 是否需要管理入口处理明显误判或恶意反馈
- 在当前截止时间前，能够交付的最小版本是什么

接口可以先按下面的最小形状评估，这只是讨论稿，不是已经冻结的契约：

```text
POST /api/curation-feedback
{ "cardId": "内容 ID 字符串", "vote": "good" | "bad" }
```

服务端必须校验卡片存在、投票值合法，并保证同一身份对同一卡片只有一份有效反馈。是否允许用户修改自己的选择，由后端在评估时给出建议。

### 9.4 AI 推荐便签

AI 还可以为卡片生成一句引人继续阅读的推荐便签。这里的「便签」专指卡片上用图钉固定的「为什么挑它」，不指知乎原评论，也不能伪装成知乎用户发表的评论。

模型输入仅限当前卡片已有材料：问题标题、作者资料、开放平台提供的原文片段、精选评论和基础元信息。输出需要遵守以下约束：

- 只写输入材料能够支持的事实，不补写作者经历
- 负责勾起阅读兴趣，不概括全文或提前交付答案
- 不模仿作者与评论者的口吻
- 保存生成依据，方便人工检查和后续纠错
- 标记便签由 AI 生成，人工改写后可以切换为人工来源

建议的数据字段如下：

```ts
hook: string
hookSource: 'human' | 'ai'
hookEvidence: string
```

推荐便签也在离线阶段生成并写入静态内容池。模型调用失败、生成结果为空或依据不足时，卡片可以不显示便签，不能用虚构内容补位。

### 9.5 建议的最小交付范围

如果共享反馈的服务端存储来不及完成，可以先交付以下部分：

1. 离线生成 AI 候选卡与推荐便签
2. 前端显示 AI 候选标识和评价入口
3. 反馈暂存在浏览器本地，用于演示完整交互

这个版本不能宣称已经形成跨用户的共同筛选结果。只有服务端存储与聚合权重接通后，才能在产品说明中写成真实运行的读者复筛机制。
