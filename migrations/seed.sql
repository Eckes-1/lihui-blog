INSERT OR IGNORE INTO categories (id, name, slug, description, created_at) VALUES
(1, '技术笔记', 'tech', '编程技术、开发工具与最佳实践', '2025-01-15 10:00:00'),
(2, '生活随笔', 'life', '日常感悟与生活记录', '2025-01-15 10:05:00'),
(3, '项目实战', 'project', '真实项目开发经验分享', '2025-02-01 09:00:00'),
(4, '读书笔记', 'reading', '书籍阅读心得与推荐', '2025-02-10 14:00:00'),
(5, '资源分享', 'resources', '优质工具、网站与学习资源', '2025-03-01 08:30:00');

INSERT OR IGNORE INTO posts (id, title, slug_id, content, description, image, category, pin_top, draft, pub_date, created_at, updated_at) VALUES
(1, '用 Cloudflare Workers 构建全栈应用', 'cloudflare-workers-fullstack',
'# 用 Cloudflare Workers 构建全栈应用

在 Serverless 架构日益流行的今天，Cloudflare Workers 凭借其全球边缘部署、极低延迟和免费额度，成为构建全栈应用的绝佳选择。

## 为什么选择 Cloudflare Workers？

- **全球边缘部署**：代码运行在 Cloudflare 全球 300+ 数据中心，用户访问最近的节点
- **极低延迟**：冷启动时间仅需 0-5ms，远低于传统 Serverless
- **免费额度充足**：每天 10 万次免费请求，个人项目完全够用
- **D1 数据库**：内置 SQLite 兼容的 Serverless 数据库
- **KV 存储**：全球分布式键值存储

## 技术栈选择

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行时 | Cloudflare Workers | V8 隔离实例 |
| 框架 | Hono | 轻量级 Web 框架 |
| 数据库 | D1 | SQLite 兼容 |
| 存储 | KV / D1 BLOB | 文件存储 |
| 部署 | Wrangler CLI | 一键部署 |

## 项目结构

```
my-app/
├── src/
│   ├── lib/
│   │   └── cloudflare-api/
│   │       ├── index.js
│   │       └── routes/
│   └── pages/
├── migrations/
├── wrangler.toml
└── astro.config.mjs
```

## 核心代码示例

```javascript
import { Hono } from ''hono''

const app = new Hono()

app.get(''/api/posts'', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(
    ''SELECT * FROM posts ORDER BY created_at DESC''
  ).all()
  return c.json(results)
})

export default app
```

## 部署流程

1. 安装 Wrangler CLI：`npm install -g wrangler`
2. 登录账号：`wrangler login`
3. 创建 D1 数据库：`wrangler d1 create my-db`
4. 执行迁移：`wrangler d1 execute my-db --file=migrations/0001.sql`
5. 部署应用：`npm run deploy`

## 性能表现

经过实际测试，Workers 应用的响应时间通常在 **10-50ms** 之间，远优于传统 Serverless 方案的 100-500ms。

> 💡 小贴士：使用 `c.env.DB` 直接访问 D1 绑定，无需额外的连接池配置。

## 总结

Cloudflare Workers + D1 + Hono 的组合，为个人开发者和小团队提供了一个低成本、高性能的全栈应用方案。如果你正在寻找一个 Serverless 全栈方案，强烈推荐尝试！',
'探索如何使用 Cloudflare Workers、D1 数据库和 Hono 框架构建高性能全栈应用，从技术选型到部署上线的完整指南。',
'', '技术笔记', 1, 0, '2025-03-15', '2025-03-15 09:00:00', '2025-03-15 09:00:00'),

(2, '2025 年值得关注的 10 个前端趋势', 'frontend-trends-2025',
'# 2025 年值得关注的 10 个前端趋势

前端领域变化飞快，2025 年有哪些值得关注的方向？让我们一起来看看。

## 1. AI 驱动的开发工具

GitHub Copilot、Cursor 等 AI 编程助手已经改变了开发者的工作方式。2025 年，AI 将更深入地融入开发流程。

## 2. Server Components 成为主流

React Server Components、Astro Islands 等模式正在重新定义前端渲染策略。

## 3. 边缘计算优先

Cloudflare Workers、Vercel Edge Functions 让应用更靠近用户。

## 4. Web Assembly 生态成熟

WASM 不再只是实验性技术，Blazor、Pyodide 等项目让更多语言可以运行在浏览器中。

## 5. CSS 新特性爆发

- `@layer` 层叠控制
- `:has()` 父选择器
- `container queries` 容器查询
- `view transitions` 视图过渡
- `anchor positioning` 锚点定位

## 6. 类型安全全栈

TypeScript 不再只是前端的专利，tRPC、Prisma 等工具让全栈类型安全成为可能。

## 7. 微前端 2.0

Module Federation 的成熟让微前端架构更加实用。

## 8. 设计系统标准化

Design Tokens 标准的推进，让设计系统跨平台一致性更好。

## 9. 性能预算成为标配

Core Web Vitals 的影响越来越大，性能预算从可选项变成必选项。

## 10. 可访问性（a11y）受到重视

随着法规要求和社会意识的提升，Web 可访问性不再是锦上添花。

## 总结

2025 年的前端领域充满机遇和挑战。保持学习，拥抱变化，才能在快速发展的技术浪潮中立于不败之地。',
'盘点 2025 年前端领域最值得关注的十大趋势，从 AI 工具到 CSS 新特性，全面解析技术发展方向。',
'', '技术笔记', 0, 0, '2025-04-02', '2025-04-02 14:30:00', '2025-04-02 14:30:00'),

(3, '我的 2025 春日旅行记', 'spring-travel-2025',
'# 我的 2025 春日旅行记

春天来了，万物复苏。趁着好天气，我踏上了一段说走就走的旅行。

## 第一站：杭州西湖

三月的西湖，桃红柳绿，美不胜收。漫步苏堤，看断桥残雪，品龙井茶香。

> 欲把西湖比西子，淡妆浓抹总相宜。

清晨的西湖最为宁静，雾气缭绕中，远处的雷峰塔若隐若现，仿佛一幅水墨画。

## 第二站：苏州园林

拙政园的精致、留园的雅致、虎丘的雄奇，每一处都让人流连忘返。

苏州的美食也令人难忘：
- 🍜 苏式汤面 — 清晨的一碗面，汤鲜味美
- 🥟 鸡头米 — 软糯香甜，本地特色
- 🍵 碧螺春 — 洞庭山的春茶，清香回甘

## 第三站：南京

秦淮河畔的夜景，夫子庙的热闹，中山陵的庄严肃穆。南京这座城市，承载了太多的历史与记忆。

## 旅行感悟

旅行不仅仅是看风景，更是一种生活态度。走出舒适区，拥抱未知，你会发现世界比你想象的更加精彩。

---

*愿我们都能在路上，遇见更好的自己。*',
'记录 2025 年春天的旅行经历，从杭州西湖到苏州园林再到南京，感受江南春日的美好。',
'', '生活随笔', 0, 0, '2025-03-28', '2025-03-28 20:00:00', '2025-03-28 20:00:00'),

(4, '从零搭建个人博客系统', 'build-blog-from-scratch',
'# 从零搭建个人博客系统

作为一个程序员，拥有一个属于自己的博客是很有意义的事情。这篇文章记录了我从零开始搭建博客系统的全过程。

## 需求分析

在开始之前，我列出了以下需求：

- ✅ 支持 Markdown 写作
- ✅ 后台管理系统
- ✅ 评论功能
- ✅ 邮件通知
- ✅ SEO 友好
- ✅ 响应式设计
- ✅ 部署在 Cloudflare（免费且快速）

## 技术选型

经过多方比较，最终选择了以下技术栈：

| 层面 | 技术 | 理由 |
|------|------|------|
| 前端框架 | Astro 5 | 内容优先，性能极佳 |
| 管理后台 | Svelte + TailwindCSS | 轻量且开发体验好 |
| 后端 API | Hono on Workers | 边缘计算，低延迟 |
| 数据库 | Cloudflare D1 | 免费，SQLite 兼容 |
| 部署 | Cloudflare Pages | 全球 CDN，自动部署 |

## 开发过程

### 1. 初始化项目

```bash
npm create astro@latest my-blog
cd my-blog
npx astro add cloudflare
```

### 2. 设计数据库

核心表包括：用户、文章、分类、评论、友情链接、站点配置等。

### 3. 开发 API

使用 Hono 框架开发 RESTful API，支持 JWT 认证。

### 4. 构建前端

Astro 的 Islands 架构让页面加载极快，交互组件按需水合。

### 5. 管理后台

使用 Svelte 构建独立的管理后台 SPA，支持文章管理、评论审核、站点配置等功能。

## 遇到的挑战

1. **D1 时区问题**：`localtime` 在 D1 中返回 UTC，需要用 `+8 hours`
2. **SMTP 发送**：Workers 不支持 `net.connect`，需要用 `cloudflare:sockets`
3. **静态资源缓存**：需要合理配置 `_headers` 文件

## 最终效果

- 首屏加载 < 1s
- Lighthouse 评分 95+
- 全球访问延迟 < 50ms
- 完全免费运行

## 总结

借助现代工具链，搭建一个高性能的个人博客并不困难。关键在于选择合适的技术栈，并理解每个组件的特性和限制。',
'详细记录从零搭建个人博客系统的全过程，包括需求分析、技术选型、开发过程和遇到的挑战。',
'', '项目实战', 0, 0, '2025-04-10', '2025-04-10 10:00:00', '2025-04-10 10:00:00'),

(5, '《代码整洁之道》读书笔记', 'clean-code-notes',
'# 《代码整洁之道》读书笔记

Robert C. Martin 的《代码整洁之道》是每个程序员都应该读的经典之作。以下是我在阅读过程中的笔记和思考。

## 核心原则

### 有意义的命名

好的命名应该：
- **名副其实**：名称应该说明它为什么存在、做什么事、怎么用
- **避免误导**：不要用保留字、不要用缩写
- **做有意义的区分**：`Product` 和 `ProductInfo` 没有区别

```javascript
// Bad
const d = new Date()
const y = d.getFullYear()

// Good
const currentDate = new Date()
const currentYear = currentDate.getFullYear()
```

### 函数

- **短小**：函数应该尽量短小，20 行封顶
- **只做一件事**：函数应该做一件事，做好这件事，只做这一件事
- **使用描述性的名称**：别害怕长名称

### 注释

> 注释不是用来弥补糟糕代码的，好的代码本身就是最好的注释。

- 好注释：法律信息、提供信息的注释、TODO
- 坏注释：多余的注释、误导性注释、日志式注释

## 重要的设计原则

1. **单一职责原则（SRP）**：一个类应该只有一个引起它变化的原因
2. **开放封闭原则（OCP）**：对扩展开放，对修改封闭
3. **依赖倒置原则（DIP）**：依赖抽象，不依赖具体实现

## 格式化

- 垂直格式：文件不要太长，相关代码放在一起
- 水平格式：行宽不要超过 120 字符
- 缩进：保持一致的缩进风格

## 错误处理

- 使用异常而非错误码
- 先写 Try-Catch-Finally 语句
- 使用 unchecked 异常
- 不要返回 null，也不要传递 null

## 个人感悟

读完这本书，最大的收获是：**写代码是一种表达，代码的读者不仅仅是计算机，更是人**。我们每天花更多的时间在阅读代码而不是写代码，所以让代码易读、易懂是最重要的投资。

> "任何傻瓜都能写出计算机能理解的代码。优秀的程序员写出人类能理解的代码。" — Martin Fowler

## 推荐指数：⭐⭐⭐⭐⭐

这本书值得反复阅读，每次都会有新的收获。',
'《代码整洁之道》的读书笔记，涵盖命名、函数、注释、设计原则等核心内容，以及个人感悟。',
'', '读书笔记', 0, 0, '2025-02-20', '2025-02-20 16:00:00', '2025-02-20 16:00:00'),

(6, '5 个提升开发效率的 VS Code 插件', 'vscode-extensions-2025',
'# 5 个提升开发效率的 VS Code 插件

工欲善其事，必先利其器。分享 5 个我每天都在用的 VS Code 插件。

## 1. GitHub Copilot

AI 编程助手，根据上下文自动补全代码。支持多种编程语言，越用越聪明。

**推荐场景**：日常编码、写测试用例、生成样板代码

## 2. Error Lens

直接在代码行内显示错误和警告信息，不用再悬停查看。

**推荐场景**：TypeScript 项目、大型代码库

## 3. GitLens

Git 增强工具，可以在每一行代码旁边显示最后修改者和修改时间。

**推荐场景**：团队协作、代码审查

## 4. Thunder Client

轻量级 REST API 测试工具，VS Code 内的 Postman 替代品。

**推荐场景**：API 开发和调试

## 5. Pretty TypeScript Errors

让 TypeScript 的错误信息更易读，将复杂的类型错误转换为人类可理解的描述。

**推荐场景**：TypeScript 重度用户

## 额外推荐

- **Tailwind CSS IntelliSense**：Tailwind 类名自动补全
- **Astro**：Astro 框架语法支持
- **Svelte for VS Code**：Svelte 语法高亮和智能提示

---

你有什么好用的 VS Code 插件推荐吗？欢迎在评论区分享！',
'分享 5 个日常开发中必不可少的 VS Code 插件，以及额外推荐，帮助提升开发效率。',
'', '资源分享', 0, 0, '2025-04-15', '2025-04-15 11:00:00', '2025-04-15 11:00:00'),

(7, 'Docker 容器化部署实践', 'docker-deployment-guide',
'# Docker 容器化部署实践

Docker 已经成为现代应用部署的标准工具。本文将分享我在实际项目中使用 Docker 的经验和最佳实践。

## 基础概念

### 镜像（Image）
只读模板，包含运行应用所需的一切：代码、运行时、库、环境变量和配置文件。

### 容器（Container）
镜像的运行实例，轻量级、可移植、自包含。

### Dockerfile
构建镜像的蓝图，定义了从基础镜像到最终镜像的每一步操作。

## 编写高效的 Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER nextjs
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## Docker Compose 编排

```yaml
version: ''3.8''
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./dev.db
    volumes:
      - ./data:/app/data
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## 最佳实践

1. **使用多阶段构建**：减小最终镜像体积
2. **利用构建缓存**：先复制 package.json，再复制源码
3. **不要以 root 运行**：创建非 root 用户
4. **使用 .dockerignore**：排除不需要的文件
5. **固定版本号**：避免 `latest` 标签带来的不确定性

## 常见问题

### 容器时间不对
```dockerfile
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime
```

### 容器内无法访问宿主机服务
使用 `host.docker.internal` 代替 `localhost`

### 镜像体积过大
使用 Alpine 基础镜像 + 多阶段构建，通常可以将镜像从 GB 级降到 MB 级。

## 总结

Docker 让应用的构建、分发和部署变得标准化和可重复。掌握 Docker 的最佳实践，可以显著提升开发效率和部署可靠性。',
'分享 Docker 容器化部署的实践经验，包括 Dockerfile 编写、Compose 编排和常见问题解决。',
'', '技术笔记', 0, 0, '2025-03-05', '2025-03-05 15:00:00', '2025-03-05 15:00:00'),

(8, '周末厨房：三道快手家常菜', 'quick-home-cooking',
'# 周末厨房：三道快手家常菜

工作日太忙没时间做饭？周末试试这三道简单又好吃的家常菜吧！

## 🍅 番茄炒蛋

最经典的家常菜，10 分钟搞定！

**食材**：番茄 2 个、鸡蛋 3 个、葱花、盐、糖

**步骤**：
1. 鸡蛋打散，加少许盐搅匀
2. 番茄切块（开水烫一下更容易去皮）
3. 热锅凉油，倒入蛋液，快速翻炒盛出
4. 锅中加少许油，放入番茄翻炒出汁
5. 加一勺糖提鲜，倒回鸡蛋翻炒均匀
6. 撒葱花出锅

> 💡 小窍门：加一点点番茄酱，颜色更红亮，味道更浓郁！

## 🥬 蒜蓉西兰花

健康又美味，5 分钟上桌。

**食材**：西兰花 1 朵、蒜 4-5 瓣、盐、蚝油

**步骤**：
1. 西兰花掰小朵，淡盐水浸泡 10 分钟
2. 烧开水，加少许盐和油，焯水 1 分钟捞出
3. 热锅下油，爆香蒜末
4. 倒入西兰花翻炒，加蚝油和盐调味

## 🍜 阳春面

一碗暖胃的清汤面，简单到极致。

**食材**：细面条、猪油、葱花、酱油、盐

**步骤**：
1. 碗中放一勺猪油、一勺酱油、少许盐
2. 煮面的开水舀两勺到碗中，冲开调料
3. 面条煮熟捞入碗中
4. 撒上葱花，完成！

---

做饭是一种享受，简单的食材也能做出幸福的味道 🍳',
'分享三道简单快手的家常菜做法：番茄炒蛋、蒜蓉西兰花和阳春面，周末轻松下厨。',
'', '生活随笔', 0, 0, '2025-04-08', '2025-04-08 19:00:00', '2025-04-08 19:00:00'),

(9, 'TypeScript 高级类型体操指南', 'typescript-advanced-types',
'# TypeScript 高级类型体操指南

TypeScript 的类型系统是图灵完备的，这意味着你可以用类型来实现各种复杂的逻辑。本文将带你从入门到进阶。

## 条件类型

```typescript
type IsString<T> = T extends string ? true : false

type A = IsString<string>  // true
type B = IsString<number>  // false
```

## 映射类型

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

type Optional<T> = {
  [P in keyof T]?: T[P]
}
```

## 模板字面量类型

```typescript
type EventName = `on${Capitalize<string>}`
// "onClick" | "onHover" | ...

type CSSProperty = `${string}-${string}`
// "margin-top" | "font-size" | ...
```

## 递归类型

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P]
}
```

## 实战：实现 DeepPartial

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? DeepPartial<T[P]>
    : T[P]
}

interface User {
  name: string
  profile: {
    age: number
    address: {
      city: string
    }
  }
}

type PartialUser = DeepPartial<User>
// 所有属性都变为可选，包括嵌套的
```

## 实战：实现路径类型

```typescript
type PathKeys<T> = T extends object
  ? {
      [K in keyof T & string]: K | `${K}.${PathKeys<T[K]>}`
    }[keyof T & string]
  : never

type UserPaths = PathKeys<User>
// "name" | "profile" | "profile.age" | "profile.address" | "profile.address.city"
```

## 类型体操练习网站

推荐 [Type Challenges](https://github.com/type-challenges/type-challenges)，从 Easy 到 Hard 循序渐进。

## 总结

TypeScript 的类型系统非常强大，掌握高级类型可以让你写出更安全、更优雅的代码。但也要注意适度，不要为了炫技而过度使用复杂类型。',
'深入讲解 TypeScript 高级类型技巧，包括条件类型、映射类型、模板字面量类型和递归类型，附带实战案例。',
'', '技术笔记', 0, 0, '2025-04-18', '2025-04-18 13:00:00', '2025-04-18 13:00:00'),

(10, '免费开发者资源大全', 'free-developer-resources',
'# 免费开发者资源大全

整理了一份免费的开发者资源清单，涵盖托管、数据库、CI/CD 等各个方面。

## ☁️ 云服务与托管

| 服务 | 免费额度 | 说明 |
|------|----------|------|
| Cloudflare Pages | 无限请求 | 静态站点 + Workers |
| Vercel | 100GB 带宽/月 | Next.js 官方推荐 |
| Netlify | 100GB 带宽/月 | 静态站点托管 |
| GitHub Pages | 无限 | 静态站点 |
| Railway | $5/月 | 全栈应用 |

## 💾 数据库

| 服务 | 免费额度 | 说明 |
|------|----------|------|
| Cloudflare D1 | 5GB 存储 | SQLite 兼容 |
| Supabase | 500MB 存储 | PostgreSQL |
| PlanetScale | 1 存储 | MySQL 兼容 |
| MongoDB Atlas | 512MB | 文档数据库 |
| Redis Cloud | 30MB | 缓存数据库 |

## 🔧 CI/CD

| 服务 | 免费额度 | 说明 |
|------|----------|------|
| GitHub Actions | 2000 分钟/月 | 最常用 |
| Cloudflare CI | 无限 | Pages 专用 |

## 📧 邮件服务

| 服务 | 免费额度 | 说明 |
|------|----------|------|
| Resend | 100 封/天 | 开发者友好 |
| Cloudflare Email | 无限 | Workers 集成 |

## 🎨 设计资源

- **Unsplash**：免费高质量图片
- **Heroicons**：开源 SVG 图标
- **Google Fonts**：免费字体
- **Figma**：免费 3 个项目

## 📚 学习平台

- **freeCodeCamp**：完全免费的编程课程
- **MDN Web Docs**：最权威的 Web 技术文档
- **The Odin Project**：全栈开发课程

---

如果你有其他好用的免费资源，欢迎在评论区补充！',
'整理免费开发者资源清单，涵盖云服务、数据库、CI/CD、邮件服务、设计资源和学习平台。',
'', '资源分享', 0, 0, '2025-04-20', '2025-04-20 09:30:00', '2025-04-20 09:30:00'),

(11, '关于写作这件事', 'about-writing',
'# 关于写作这件事

写博客已经一年了，想聊聊关于写作的一些想法。

## 为什么要写作？

最初写博客的原因很简单——**怕忘记**。

学过的东西不记录下来，过段时间就忘了。踩过的坑不写下来，下次还会再踩。

但写着写着，发现写作带来的远不止记忆的保存：

- 🧠 **理清思路**：写下来的过程就是思考的过程
- 📖 **加深理解**：能把一件事讲清楚，才是真正理解了
- 🤝 **连接他人**：通过文字认识了很多志同道合的朋友
- 📈 **持续成长**：写作是最好的学习方式

## 写作的心路历程

### 第一阶段：不敢写

> "我写得不好，还是别丢人了。"

这是很多人的心态，包括曾经的我。但后来想通了——**写给自己看也是值得的**。

### 第二阶段：为了写而写

> "这周还没更新，随便写点什么吧。"

这个阶段容易产出低质量的内容。后来我给自己定了一个规则：**没有想写的内容就不写，不为了更新而更新**。

### 第三阶段：享受写作

现在，写作已经成了一种习惯。当学到新东西、遇到有趣的问题、或者有了新的感悟，自然就会想写下来。

## 一些写作技巧

1. **先写再改**：不要追求一次写好，先完成再完善
2. **用简单的语言**：把复杂的事情讲简单才是真本事
3. **加入个人经历**：真实的经历比空洞的理论更有说服力
4. **适当留白**：不要把文章塞得太满，给读者思考的空间

## 写在最后

> 写作不是为了证明自己有多厉害，而是为了记录成长、分享经验、连接同频的人。

如果你也在犹豫要不要开始写作，我的建议是：**现在就开始写，哪怕只是一段话**。

---

*感谢每一个阅读我文章的人 🙏*',
'分享写博客一年来的心路历程，从不敢写到享受写作，以及一些实用的写作技巧。',
'', '生活随笔', 0, 0, '2025-04-22', '2025-04-22 21:00:00', '2025-04-22 21:00:00'),

(12, 'Svelte 5 Runes 新特性详解', 'svelte5-runes-guide',
'# Svelte 5 Runes 新特性详解

Svelte 5 引入了全新的响应式原语——Runes，彻底改变了状态管理的方式。让我们一起来了解这个革命性的变化。

## 什么是 Runes？

Runes 是以 `$` 符号开头的特殊函数，用于告诉 Svelte 编译器某个变量是响应式的。

## 核心 Runes

### $state — 响应式状态

```svelte
<script>
  let count = $state(0)
  let user = $state({ name: ''栗辉'', role: ''admin'' })
</script>

<button onclick={() => count++}>
  点击了 {count} 次
</button>
```

### $derived — 派生状态

```svelte
<script>
  let count = $state(0)
  let doubled = $derived(count * 2)
</script>

<p>{count} × 2 = {doubled}</p>
```

### $effect — 副作用

```svelte
<script>
  let count = $state(0)

  $effect(() => {
    console.log(`count 变为 ${count}`)
    document.title = `计数器: ${count}`
  })
</script>
```

### $props — 组件属性

```svelte
<script>
  let { title, count = 0 } = $props()
</script>

<h1>{title}</h1>
<p>计数: {count}</p>
```

## 与 Svelte 4 的对比

| 特性 | Svelte 4 | Svelte 5 |
|------|----------|----------|
| 状态声明 | `let count = 0` | `let count = $state(0)` |
| 派生值 | `$: doubled = count * 2` | `let doubled = $derived(count * 2)` |
| 副作用 | `$: { ... }` | `$effect(() => { ... })` |
| Props | `export let title` | `let { title } = $props()` |

## 迁移建议

1. 使用官方迁移工具：`npx sv migrate`
2. 逐步迁移，Svelte 5 兼容旧语法
3. 优先迁移状态管理部分
4. 测试每个组件的响应式行为

## 总结

Runes 让 Svelte 的响应式系统更加显式和灵活。虽然需要一定的学习成本，但带来的好处是值得的。',
'详解 Svelte 5 的 Runes 响应式系统，包括 $state、$derived、$effect、$props 的用法和迁移建议。',
'', '技术笔记', 0, 0, '2025-04-25', '2025-04-25 10:30:00', '2025-04-25 10:30:00');

INSERT OR IGNORE INTO comments (id, post_id, parent_id, username, email, avatar, content, is_admin, approved, deleted, created_at) VALUES
(1, 1, NULL, '小明', 'xiaoming@example.com', '', '写得很好！Cloudflare Workers 确实是个人项目的最佳选择，免费额度完全够用。', 0, 1, 0, '2025-03-15 10:30:00'),
(2, 1, 1, '栗辉', '', '', '谢谢支持！有什么问题欢迎交流~', 1, 1, 0, '2025-03-15 11:00:00'),
(3, 1, NULL, '开发者A', 'dev@example.com', '', '请问 D1 数据库的性能怎么样？适合生产环境吗？', 0, 1, 0, '2025-03-16 09:15:00'),
(4, 1, 3, '栗辉', '', '', '对于个人项目和小型应用完全没问题，读性能很好，写性能稍弱但够用。大型项目建议还是用传统数据库。', 1, 1, 0, '2025-03-16 10:00:00'),
(5, 2, NULL, '前端爱好者', 'fe@example.com', '', 'CSS 的新特性真的太棒了，:has() 选择器简直是神器！', 0, 1, 0, '2025-04-02 15:00:00'),
(6, 2, NULL, 'CodeFan', 'codefan@example.com', '', 'AI 工具确实改变了开发方式，但也要注意不要过度依赖，基础能力还是最重要的。', 0, 1, 0, '2025-04-03 08:20:00'),
(7, 3, NULL, '旅行者小王', 'traveler@example.com', '', '杭州西湖真的很美！推荐去灵隐寺看看，也很不错。', 0, 1, 0, '2025-03-29 10:00:00'),
(8, 3, NULL, '吃货小陈', 'foodie@example.com', '', '苏州的鸡头米真的好吃！每年夏天都要买好几斤', 0, 1, 0, '2025-03-29 14:30:00'),
(9, 4, NULL, '新手开发者', 'newbie@example.com', '', '正好想搭博客，这篇文章帮了大忙！请问 SMTP 邮件发送配置难吗？', 0, 1, 0, '2025-04-10 12:00:00'),
(10, 4, 9, '栗辉', '', '', '用 cloudflare:sockets 的话不算难，主要就是 SMTP 协议的交互。后面我可以写一篇详细的教程。', 1, 1, 0, '2025-04-10 13:00:00'),
(11, 5, NULL, '代码洁癖者', 'clean@example.com', '', '这本书我也读过，确实经典！命名那章对我的影响最大。', 0, 1, 0, '2025-02-21 09:00:00'),
(12, 5, NULL, 'Java开发者', 'java@example.com', '', '推荐再看看《重构》，两本书搭配阅读效果更好。', 0, 1, 0, '2025-02-22 16:30:00'),
(13, 6, NULL, 'VS Code 重度用户', 'vscoder@example.com', '', 'Error Lens 真的太好用了，装了就回不去了！', 0, 1, 0, '2025-04-15 14:00:00'),
(14, 6, NULL, '插件收藏家', 'plugin@example.com', '', '推荐一下 CSS Peek 插件，可以直接从 HTML 跳转到 CSS 定义，非常方便。', 0, 1, 0, '2025-04-16 10:00:00'),
(15, 8, NULL, '美食家小李', 'food@example.com', '', '阳春面看起来好简单，今晚就试试！', 0, 1, 0, '2025-04-09 18:00:00'),
(16, 9, NULL, 'TS爱好者', 'ts@example.com', '', '类型体操太烧脑了，但是掌握了之后写代码确实更安全了。', 0, 1, 0, '2025-04-18 16:00:00'),
(17, 10, NULL, '资源控', 'resource@example.com', '', '收藏了！Cloudflare 的免费额度真的很良心。', 0, 1, 0, '2025-04-20 11:00:00'),
(18, 11, NULL, '写作新手', 'writer@example.com', '', '"先写再改"这个建议太好了，我之前总是追求完美，结果什么都写不出来。', 0, 1, 0, '2025-04-23 08:30:00'),
(19, 11, 18, '栗辉', '', '', '对，完成比完美更重要！先写出来，后面慢慢改就好。', 1, 1, 0, '2025-04-23 09:00:00'),
(20, 12, NULL, 'Svelte粉丝', 'svelte@example.com', '', 'Runes 确实让响应式更清晰了，$effect 比 $: 好理解多了。', 0, 1, 0, '2025-04-25 14:00:00');

INSERT OR IGNORE INTO friend_links (id, name, avatar, url, description, sort_order, created_at) VALUES
(1, '阮一峰的博客', '', 'https://www.ruanyifeng.com/blog/', '科技爱好者周刊，前端技术分享', 1, '2025-01-20 10:00:00'),
(2, '张鑫旭的博客', '', 'https://www.zhangxinxu.com/', '前端 CSS 大神，深入浅出', 2, '2025-01-20 10:05:00'),
(3, '酷壳 CoolShell', '', 'https://coolshell.cn/', '陈皓的技术博客，深度好文', 3, '2025-01-20 10:10:00'),
(4, 'CSS-Tricks', '', 'https://css-tricks.com/', 'CSS 技巧和前端教程', 4, '2025-02-01 09:00:00'),
(5, 'Dev.to', '', 'https://dev.to/', '开发者社区，技术文章聚合', 5, '2025-02-01 09:05:00'),
(6, '奇舞周刊', '', 'https://weekly.75.team/', '360 前端团队的技术周刊', 6, '2025-02-15 14:00:00');

INSERT OR IGNORE INTO site_config (key, value) VALUES
('profile.name', '栗辉'),
('profile.description', '热爱编程，热爱生活 | 全栈开发者'),
('site.title', '栗辉的博客'),
('site.subTitle', '记录技术与生活'),
('profile.startYear', '2024'),
('comments.enable', 'true'),
('toc.enable', 'true'),
('turnstile.siteKey', '0x4AAAAAADUShM6UdKH82zQ5'),
('turnstile.secretKey', '0x4AAAAAADUShMmx-RFuMJNMy6kbf6Qe6l8');
