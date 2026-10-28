import assert from 'node:assert/strict';
import test from 'node:test';
import {
  artifactProjectKey,
  assetDownloadCount,
  distributionGroup,
  parseDistributionGroupId,
  platformBundleIdsDiffer,
  packagePlatform,
  isInstallPackage,
  pcVersion,
  releaseProjectKeys,
  retainLatestVersions,
  selectRecentProjectReleases,
} from '../scripts/build-metadata.mjs';

test('reads a distribution group ID from release notes', () => {
  assert.equal(
    parseDistributionGroupId('Distribution-Group-ID: quickchat\n\nRelease notes'),
    'quickchat',
  );
  assert.equal(parseDistributionGroupId('Release notes only'), null);
});

test('groups by configured ID and falls back to bundle ID', () => {
  assert.deepEqual(distributionGroup('com.quickchat.cn.dev', 'quickchat'), {
    key: 'group:quickchat',
    id: 'quickchat',
  });
  assert.deepEqual(distributionGroup('com.quickchat.cn', null), {
    key: 'com.quickchat.cn',
    id: 'com.quickchat.cn',
  });
});

test('shows platform bundle IDs only when iOS and Android differ', () => {
  assert.equal(platformBundleIdsDiffer({
    ios: [{ bundleId: 'com.quickchat.cn.dev' }],
    android: [{ bundleId: 'com.quickchat.cn' }],
  }), true);

  assert.equal(platformBundleIdsDiffer({
    ios: [{ bundleId: 'com.example.app' }],
    android: [{ bundleId: 'com.example.app' }],
  }), false);

  assert.equal(platformBundleIdsDiffer({
    ios: [{ bundleId: 'com.example.app' }],
    android: [],
  }), false);
});

test('infers a stable project key from release asset names', () => {
  assert.equal(artifactProjectKey('50-mobile_7.1.3_26081301.apk'), '50-mobile');
  assert.equal(artifactProjectKey('YunXiaoLiao-mobile_1.1.53_test.ipa'), 'yunxiaoliao-mobile');
  assert.equal(artifactProjectKey('TFSystem-desktop_1.0.6-arm64.dmg'), 'tfsystem-desktop');
  assert.equal(artifactProjectKey('YunXiaoLiao-Setup-1.1.33-x64.zip'), 'yunxiaoliao');
  assert.equal(artifactProjectKey('1.1.6.1.apk'), null);
});

test('uses the distribution group as the release project key when present', () => {
  assert.deepEqual(releaseProjectKeys({
    body: 'Distribution-Group-ID: QuickChat',
    assets: [
      { name: 'ios-client_1.0.0.ipa' },
      { name: 'android-client_1.0.0.apk' },
    ],
  }), ['group:quickchat']);
});

test('selects at most three recent releases per inferred project before downloads', () => {
  const release = (tag, project, day) => ({
    tag_name: tag,
    published_at: `2026-08-${String(day).padStart(2, '0')}T00:00:00Z`,
    assets: [{ name: `${project}_${tag.match(/\d+(?:\.\d+)*/)[0]}.apk` }],
  });
  const selected = selectRecentProjectReleases([
    release('app-a-1.0.1', 'app-a', 1),
    release('app-a-1.0.4', 'app-a', 4),
    release('app-b-2.0.1', 'app-b', 2),
    release('app-a-1.0.2', 'app-a', 2),
    release('app-a-1.0.3', 'app-a', 3),
    { tag_name: 'empty-1.0.0', published_at: '2026-08-05T00:00:00Z', assets: [] },
  ], 3);

  assert.deepEqual(selected.map(item => item.tag_name), [
    'app-a-1.0.4',
    'app-a-1.0.3',
    'app-b-2.0.1',
    'app-a-1.0.2',
  ]);
});

test('retains three distinct versions while preserving same-version variants', () => {
  const entries = [
    { version: '4.0.0', file: 'app-4.0.0-arm64.dmg' },
    { version: '4.0.0', file: 'app-4.0.0-x64.dmg' },
    { version: '3.0.0', file: 'app-3.0.0.dmg' },
    { version: '2.0.0', file: 'app-2.0.0.dmg' },
    { version: '1.0.0', file: 'app-1.0.0.dmg' },
  ];

  assert.deepEqual(retainLatestVersions(entries, 3).map(entry => entry.version), [
    '4.0.0', '4.0.0', '3.0.0', '2.0.0',
  ]);
});

test('normalizes GitHub asset download counts', () => {
  assert.equal(assetDownloadCount({ download_count: 12 }), 12);
  assert.equal(assetDownloadCount({ downloadCount: 7 }), 7);
  assert.equal(assetDownloadCount({ download_count: -1 }), 0);
  assert.equal(assetDownloadCount({}), 0);
});

test('classifies APKObj full archives by their platform filename', () => {
  assert.equal(packagePlatform('apkobj-mac-v1.0.12.zip'), 'mac');
  assert.equal(packagePlatform('apkobj-macos-v1.0.12.zip'), 'mac');
  assert.equal(packagePlatform('apkobj-darwin-v1.0.12.zip'), 'mac');
  assert.equal(packagePlatform('apkobj-osx-v1.0.12.zip'), 'mac');
  assert.equal(packagePlatform('apkobj-win-v1.0.12.zip'), 'win');
  assert.equal(packagePlatform('APKOBJ-WINDOWS-v1.0.12.ZIP'), 'win');
  assert.equal(packagePlatform('apkobj-v1.0.12.zip'), 'win');
  assert.equal(packagePlatform('apkobj-v1.0.12.dmg'), 'mac');
  assert.equal(packagePlatform('apkobj-v1.0.12.exe'), 'win');
  assert.equal(packagePlatform('sample_1.0.0.ipa'), 'ios');
  assert.equal(packagePlatform('sample_1.0.0.apk'), 'android');
});

test('offers full installers and excludes desktop update payloads and manifests', () => {
  for (const file of [
    'apkobj-mac-v1.0.12.zip',
    'apkobj-win-v1.0.12.zip',
    'apkobj-v1.0.12.dmg',
    'apkobj-v1.0.12.exe',
    'sample_1.0.0.ipa',
    'sample_1.0.0.apk',
  ]) assert.equal(isInstallPackage(file), true, file);

  for (const file of [
    'apkobj-mac-v1.0.12-update.zip',
    'apkobj-win-v1.0.12-update.zip',
    'apkobj-mac-v1.0.12-incremental.zip',
    'apkobj-win-v1.0.12-delta.zip',
    'APKOBJ-WIN-v1.0.12-UPDATE.ZIP',
    'apkobj-mac-v1.0.12.manifest.json',
    'apkobj-win-v1.0.12.manifest.json',
    'SHA256SUMS',
  ]) assert.equal(isInstallPackage(file), false, file);
});

test('reads desktop versions with an optional v prefix without duplicating it', () => {
  assert.equal(pcVersion('apkobj-mac-v1.0.12.zip', 'v9.9.9'), '1.0.12');
  assert.equal(pcVersion('apkobj-win-v1.0.12.zip', 'v9.9.9'), '1.0.12');
  assert.equal(pcVersion('apkobj-win-1.0.12.zip', 'v9.9.9'), '1.0.12');
  assert.equal(pcVersion('apkobj_1.0.12-arm64.dmg', 'v9.9.9'), '1.0.12');
  assert.equal(pcVersion('apkobj-portable.zip', '1.0.12'), '1.0.12');
});

test('update-only releases do not hide older full installers from retention', () => {
  const release = (version, update = false) => ({
    id: version,
    tag_name: `v1.0.${version}`,
    published_at: `2026-10-${String(version).padStart(2, '0')}T00:00:00Z`,
    assets: [
      { name: `apkobj-mac-v1.0.${version}${update ? '-update' : ''}.zip` },
      { name: `apkobj-win-v1.0.${version}${update ? '-update' : ''}.zip` },
      { name: `apkobj-mac-v1.0.${version}.manifest.json` },
      { name: `apkobj-win-v1.0.${version}.manifest.json` },
    ],
  });
  assert.deepEqual(releaseProjectKeys(release(5, true)), []);
  const selected = selectRecentProjectReleases([
    release(1), release(5, true), release(2), release(4), release(3),
  ], 3);
  assert.deepEqual(selected.map(item => item.tag_name), ['v1.0.4', 'v1.0.3', 'v1.0.2']);
});
