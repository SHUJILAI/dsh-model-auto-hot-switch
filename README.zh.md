# ⚡ dsh-model-auto-hot-switch

**DeepSeek Harness（dsh）模型自动热切换插件。** 识图类任务自动切换到视觉模型，其余任务保持你选择的默认模型。零额外 token、不扰动上下文、一键开启。

[![License](https://img.shields.io/github/license/SHUJILAI/dsh-model-auto-hot-switch)](LICENSE)
[![npm version](https://img.shields.io/npm/v/dsh-model-auto-hot-switch)](https://www.npmjs.com/package/dsh-model-auto-hot-switch)

[English](README.md)

---

## 这个插件做什么

DSH 的模型并非都能接收图片。当你让 agent 看截图、做 OCR、读任意图片文件时，这次请求应该交给支持识图的视觉模型；而普通对话与写代码保持快速的默认模型。本插件让这个切换**自动且按任务进行**，并且发生在同一会话内：

- **识图任务**（该步消息包含图片）→ 自动路由到发现的视觉模型，如 `deepseek-v4-flash-vision-exp`
- **其他任务** → 完全保持你选中的默认模型，配置原样返回

## 为什么零成本

- **零额外 token**：任务分类是纯本地代码（该步是否含图片块），不调用任何分类模型、不重写 prompt、不重复请求。
- **不扰动上下文**：只通过官方 `agent/request` 扩展点替换冻结调用配置中的 `provider`/`model` 两个字段；消息、系统提示、工具与会话状态一概不动。
- **普通任务零开销**：无图步骤在之前步骤把视觉模型留在请求头时，会通过一次字段替换恢复会话默认路由（其余情况配置原样返回）——不调用分类器、不产生额外请求。

## 安装

需要已安装 DeepSeek Harness（`dsh`）且使用 Web profile：

```bash
# 从 npm
dsh plugin --profile web add dsh-model-auto-hot-switch

# 或直接从 GitHub
dsh plugin --profile web add github:SHUJILAI/dsh-model-auto-hot-switch
```

重启 `dsh web` 后，点击右下角浮动 **⚡** 按钮即可开启自动热切。状态面板会显示：

- 识图任务的路由目标（第一个被探测到支持图片输入的模型）；
- 其他任务继续使用的默认模型；
- 最近一次热切事件。

开关状态持久化在包目录的 `config.json` 中，重启后保留。

## 前置条件

- 提供方目录里要有支持视觉的模型。插件通过 `llm.listModels` / `llm.resolveModelInfo` 自动发现，无需配置。官方 DeepSeek 提供方对应 `deepseek-v4-flash-vision-exp`（DeepSeek API 已提供）。没有视觉模型时开关依然可用，但识图路由保持空闲，状态面板会如实提示。
- `read_image` 工具自身的识图门控也需要能看到视觉模型——这要求 dsh 版本中的 DeepSeek 适配器为该模型声明了图片输入能力。

## 工作原理

```
用户发起识图任务
   │
   ▼
agent/pre-step ──► 包含图片？── 是 ──► 标记该步为识图步骤
   │                    │
   │                    否
   ▼                    ▼
agent/request ──► 原样返回默认配置      返回 provider/model 已切换为
                 （零开销）             视觉模型的配置
```

分类按 `(会话, 回合, 步)` 逐步进行，并由对应的 `agent/request` 消费；同一回合的后续步骤会独立重新分类。子代理在其自己的会话里享受同样待遇。

## 配置

无。整个插件只有一个开关：

| 字段（`config.json`） | 含义 |
| --- | --- |
| `enabled` | `true` 时识图任务走视觉模型；`false` 时所有请求保持默认模型 |

首选视觉模型 id 为 `deepseek-v4-flash-vision-exp`；若不存在，则使用第一个发现的具备图片能力的模型。

## 兼容性

- 支持 dsh Web profile（路由位于 `/plugins/dsh-model-auto-hot-switch/state`）。
- Headless profile：不注册路由，热切逻辑仍从持久化开关生效。
- 不依赖任何官方 `@deepseek-ai/*` 运行时包，无 `peerDependencies`。

## 开发

```bash
npm test          # 包结构 + 语法冒烟检查
```

## 许可证

MIT — 见 [LICENSE](LICENSE)。
