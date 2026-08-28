# 提交收录步骤（Submission Guide）

本目录是 `dsh-model-auto-hot-switch` 的社区收录材料。两条通道并行，互相独立：

## 通道 0：先推到 GitHub（本机无 git 时的操作指引）

本仓库目录还没有 git 元数据（机器上的 `git` 指向 Xcode 开发者工具安装器）。两种方式：

**方式 A（推荐，装 GitHub CLI）：**

```bash
brew install gh
gh auth login
cd ~/Desktop/dsh-plugins/dsh-model-auto-hot-switch
gh repo create dsh-model-auto-hot-switch --public --source . --remote origin --push
gh repo edit dsh-model-auto-hot-switch --add-topic dsh-plugin   # ← 自动收录的关键
```

**方式 B（浏览器建仓 + 命令行 git）：**

1. 在 github.com 新建 public 仓库 `dsh-model-auto-hot-switch`（不要勾选任何初始化文件）。
2. 安装 Command Line Tools（`xcode-select --install`），然后：

```bash
cd ~/Desktop/dsh-plugins/dsh-model-auto-hot-switch
git init -b main
git add .
git commit -m "feat: automatic per-task model hot-switching for dsh"
git remote add origin https://github.com/<你的用户名>/dsh-model-auto-hot-switch.git
git push -u origin main
```

3. 在仓库 Settings → Topics 添加 `dsh-plugin`。
4. 发布首个 tag 触发 npm 发布 workflow（可选，需先在仓库 Secrets 配 `NPM_TOKEN`）：`git tag v0.1.0 && git push origin v0.1.0`

> 注意：机器上 `git` 可用前，先装 Command Line Tools。装好后本流程全程命令行可完成。

## 通道 1：自动收录（DSH 1024Store 插件市场）

无需手动提交。把 GitHub 仓库打上 **`dsh-plugin`** topic 后，[DSH 1024Store](https://github.com/imsai-sh/awesome-deepseek-harness-plugins)
的定时流水线（每 30 分钟增量扫描）会自动发现并校验：

- 校验条件：默认分支存在 `package.json`、声明 `dsh.bundle.patch`、patch 文件在同一棵 tree 中真实存在。本包已满足。
- 收录后可在 [deepseek1024.com](https://deepseek1024.com/) 搜索到，并通过 `dsh1024 plugin --profile web add github:<owner>/<repo>` 安装计数。

## 通道 2：人工精选列表（awesome-dsh-plugin）

1. Fork [Anil-matcha/awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin)。
2. 把本目录的 `awesome-dsh-plugin.yml` 复制为 `data/plugins/<owner>__<repo>.yml`（`<owner>` 换成你的 GitHub 用户名），只改 `url` 与 `name` 两行。
3. 仓库本地跑 `npm ci && node scripts/generate-readme.mjs` 重新生成 README 后一起提交（或说明由维护者生成）。
4. 开 PR，只含这一个新文件。

CI 硬性条件（自动检查）：仓库创建满 1 天、提交数 ≥ 10、声明 `dsh.bundle` manifest、仓库带 `dsh-plugin` topic。
未达标会被 CI 打回，完善后重新提交即可，不会记仇。

评审要点（维护者逐条核对）：描述必须与代码一致（本包描述只声明了自动路由行为，无夸大）；分类 `model` 合理。

## 通道 3（可选）：npm 发布

```bash
npm login
npm publish --access public
```

- npm 发布后 `dsh plugin add dsh-model-auto-hot-switch` 走预构建安装，用户免 `allowBuilds` 构建授权。
- 发布后建议在 GitHub 仓库补一个指向 npm 的安装徽章。

## 发布后维护

- 功能变更 → bump 版本 + 同步更新两个 README 与描述（描述与代码必须一致，这是收录的长期条件）。
- 停止维护 → 主动从列表条目中说明或移除。
- 每次迭代都重新跑 `npm test`。
