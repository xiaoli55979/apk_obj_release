# apk_obj_release

APKObj 工具的分发仓库。基于 [ipa_install](https://github.com/xiaoli55979/ipa_install) 同套机制:
**Releases 当文件仓库 + Pages 当分发页 + Actions 当打包流水线**,零服务器零成本。

## 地址

- 分发页:https://xiaoli55979.github.io/apk_obj_release/
- 主工程:https://github.com/xiaoli55979/apk_obj

## 自动化流程

```
主工程 apk_obj  ──tag v*──▶  GitHub Actions
                              ├─ macos-latest:  pack-mac.sh   → apkobj-mac-vX.zip
                              └─ windows-latest: pack-windows  → apkobj-win-vX.zip
                                     │
                                     ▼
                          gh release create (此仓库)
                                     │
                                     ▼
                          本仓库 build.yml: 解析资产 → 生成 docs/apps.json
                                     │
                                     ▼
                          GitHub Pages 自动重新部署
```

用户访问分发页即可下载最新版本。GUI 内置版本检测，启动时读取本仓库 `releases/latest` API，有新版时在界面提示。

## 一次性初始化

1. 推送本仓库到 `https://github.com/xiaoli55979/apk_obj_release.git`
2. **Settings → Pages**: Source = Deploy from a branch, Branch = main, 目录 = /docs
3. **Settings → Actions → General → Workflow permissions**: 勾 **Read and write permissions**

## pcMatchers 归组规则

`config.json` 里 `pcMatchers` 告诉脚本"文件名以这个前缀开头的 dmg/exe/zip 归到这个 bundleId"。
当前规则:`apkobj` 前缀都归到 `com.apkobj.tools`,所以主工程 Actions 出包时文件名以 `apkobj-` 开头即可。


## 下载页与配置

页面与 `ipa_install` 同步使用居中卡片、平台下载按钮、二维码、更新时间、下载次数及折叠历史版本。本站保留 APKObj 品牌、桌面平台和自己的 Release 地址。

- `siteTitle`、`repo`、`publicUrl` 分别控制站点标题、资产来源和 Pages 地址。
- `appMetadata` 为 `com.apkobj.tools` 配置统一名称 `APKObj` 和 `assets/icons/apkobj.png` 图标。
- `pcMatchers` 通过 `apkobj` 文件名前缀，把 macOS / Windows 包归到同一张卡片。
- `maxVersionsPerApp: 3` 控制每个平台显示的最近三个完整安装版本。只限制下载页展示，不删除 GitHub Release 或资产。
- Mac ZIP 文件名须带 `-mac-`（也识别 `macos` / `darwin` / `osx`）；Windows ZIP、EXE 与 Mac DMG 按平台分别展示。
- `-update.zip`、`-incremental.zip`、`-delta.zip` 和 `*.manifest.json` 不作为完整安装包展示；旧 `apps.json` 也会在前端过滤增量文件。应用内升级仍可直接读取 Release 中的增量包及 manifest。

资源全部上传完毕后，可手动运行 `Build metadata` 工作流更新页面；下载次数在元数据工作流运行时刷新。工作流不执行远端 Release 删除。

```bash
npm ci
npm test
npm run build
python3 -m http.server 8842 --directory docs
```

本地 `npm run build` 只读查询 Release，需要已登录 `gh`；页面预览地址为 `http://127.0.0.1:8842/`。
