# 离线私钥保险箱

一个完全离线的文本加密网页。使用随机 256 位密钥和 AES-256-GCM，导出的 HTML 自带解密界面。以后只需保留加密网页与独立密钥，在兼容浏览器中打开，无需服务器、账户或额外解密软件。

## 使用

**在线打开：[离线私钥保险箱](https://userinner.github.io/offline-private-key-vault/)**

在线版打开时会从 GitHub Pages 加载网页；文本与密钥仍由浏览器在本地处理。导出的加密网页可以断网独立使用。

下载仓库 ZIP 并解压，用浏览器打开 [dist/离线私钥保险箱.html](dist/离线私钥保险箱.html)。GitHub 的源码预览页不能直接运行工具。

1. 输入文本，生成并下载密钥，或选择已有密钥。
2. 重新选择已保存的密钥，然后下载加密网页。
3. 选择刚下载的网页，完成完整文件保存校验。
4. 以后双击导出的加密网页，选择对应密钥，再点击显示原文。

**密钥与加密网页分开备份。密钥丢失无法恢复；同时拥有两份文件的人可以解密。请勿把个人密钥或私密加密文件提交到本仓库。**

## 安全范围

全程本地处理，不使用远程脚本、遥测、浏览器存储或网络服务。密文格式公开，不绑定原电脑。先验证 GCM 认证标签，才允许显示明文。

只运行自己导出或确认可信的 HTML；自带解密程序的网页若被替换，可能窃取随后提供的密钥。密码学保护不能抵御已经控制电脑或浏览器的攻击者。本项目通过功能和互操作测试，未经独立专业安全审计，不承诺绝对不可破解。

## 文档

- [中文使用说明](docs/使用说明.md)
- [公开文件格式](FORMAT.md)
- [设计说明](docs/私钥保险箱-设计方案.md)
- [验证记录与平台范围](docs/验证记录.md)

## 开发

Node.js 22+。日常使用交付的 HTML 不需要 Node.js 或安装依赖。

```sh
node build.cjs
node --test tests/core.test.cjs
```

构建结果位于 `dist/离线私钥保险箱.html`。浏览器集成测试需要开发环境提供 Playwright 和 Chrome；具体设置见 `FORMAT.md`。

```sh
node tests/browser.cjs
```

`src/core.js` 处理公开格式和密码运算；`src/app.js` 处理文件选择与页面状态；构建脚本将所有资源内嵌，并生成 CSP 哈希。所有测试仅使用虚构数据。

## GitHub Pages 发布

Pages 从 `main` 分支的 `/docs` 目录发布，入口为 `docs/index.html`。更新源码后，生成离线文件和发布入口，再一起提交：

```sh
node build.cjs
node build.cjs docs/index.html
git add src build.cjs dist docs/index.html
git commit -m "Update vault"
git push origin main
```

`docs/.nojekyll` 让 Pages 直接发布静态文件，不改变页面内容。
