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

用户访问分发页即可下载最新版本。GUI 内置版本检测,启动时拉本仓库 `releases/latest` API,有新版弹窗提示。

## 一次性初始化

1. 推送本仓库到 `https://github.com/xiaoli55979/apk_obj_release.git`
2. **Settings → Pages**: Source = Deploy from a branch, Branch = main, 目录 = /docs
3. **Settings → Actions → General → Workflow permissions**: 勾 **Read and write permissions**

## pcMatchers 归组规则

`config.json` 里 `pcMatchers` 告诉脚本"文件名以这个前缀开头的 dmg/exe/zip 归到这个 bundleId"。
当前规则:`apkobj` 前缀都归到 `com.apkobj.tools`,所以主工程 Actions 出包时文件名以 `apkobj-` 开头即可。
