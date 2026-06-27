# Visual Realism Design — Neon Runner

**Date:** 2026-06-27
**Status:** Approved
**Approach:** B — Post-processing bloom + environment improvements

---

## Overview

サイバーパンク/ネオン美学を維持しながらマテリアルのリアリティを向上させる。主軸は UnrealBloomPass による neon 発光リアル化と、床反射・環境マップ・フォグによる空間深度の追加。トラック周囲に軽量な構造物を追加して世界観を補強する。

**変更ファイル:** `src/main.js`, `src/scene.js`
**無変更:** `src/obstacle-types.js`, `src/player.js`, `src/collision.js`, `src/constants.js`, その他全モジュール

---

## 1. レンダリング基盤

### Tone Mapping & Shadow

```js
// src/main.js
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
```

### Post-processing Bloom

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,   // strength
  0.6,   // radius
  0.35   // threshold
))
```

`renderer.render(scene, camera)` → `composer.render()` に変更。`onresize` でも `composer.setSize()` 呼び出し。

### ライティング修正（`src/scene.js`）

- `AmbientLight(0x110022, 0.4)` 追加 — 暗部を完全な黒から救う
- `dirLight.castShadow = true` 有効化
- PointLight 2本（cyan 左 / magenta 右）を world 固定 → `updateScene` 内でカメラ Z 追従に変更
- `updateScene(delta, speed)` → `updateScene(delta, speed, cameraZ)` にシグネチャ変更（`main.js` 側で `camera.position.z` を渡す）

```js
// updateScene 内
pointLeft.position.z = cameraZ
pointRight.position.z = cameraZ
```

---

## 2. 床マテリアル

`makeGroundMaterial()` 変更:

```js
return new THREE.MeshStandardMaterial({
  map: tex,
  roughness: 0.15,   // 0.9 → 0.15
  metalness: 0.5,    // 0.1 → 0.5
  envMapIntensity: 1.0,
})
```

床 mesh に `receiveShadow = true`。

キャンバステクスチャ改善:
- グリッド線: `#003366` → `#0044aa`（より視認しやすい青）
- レーン分割線: `#004444` → `#00aaaa`（明るいシアン）
- 中央縦ストライプ2本追加（薄い `#001133`）— スピード感

---

## 3. ビル群

`makeBuildings()` を拡張。InstancedMesh は材質バリエーション不可のため3種に分割:

| 種別 | count | color | emissive | emissiveIntensity |
|------|-------|-------|----------|-------------------|
| ダーク（主） | 36 | `0x110022` | `0x220033` | 0.5 |
| 明るい外壁 | 12 | `0x1a0033` | `0x330055` | 0.8 |
| ネオン窓あり | 12 | `0x110022` | `0x220033` | 0.5 |

窓ストリップ用 InstancedMesh を別途追加（最大 20本）:
- Geometry: `BoxGeometry(0.3, h*0.7, 0.05)` — ビル前面に張り付く薄いパネル
- 色3種ランダム: `0x00ffff` / `0xff00ff` / `0xffaa00`、各 `emissiveIntensity: 2`
- bloom で光って neon 看板感

パラレックス 30% スクロールは既存ロジックのまま。

---

## 4. トラック側面構造物

### サイドレール

左右トラック端（`x = ±6.2`）に neon チューブ。地面タイルと同期スクロール。

```js
BoxGeometry(0.06, 0.12, TILE_LENGTH)
```

- 左レール: `emissive: 0x00ffff, emissiveIntensity: 3`
- 右レール: `emissive: 0xff00ff, emissiveIntensity: 3`
- `y = 0.06`（床面すれすれ）

### 頭上アーチ

間隔 20 ユニットで 3本。タイルと同期スクロール（タイルリサイクルと同じ条件で Z リセット）。

各アーチ構成（3 mesh）:
- 左ポスト: `BoxGeometry(0.08, 3, 0.08)` at `x = -5.5, y = 1.5`
- 右ポスト: 同上 at `x = 5.5`
- 横棒: `BoxGeometry(11, 0.06, 0.06)` at `y = 3`

マテリアル: `emissive: 0x9900ff, emissiveIntensity: 2`。`y = 3` は全障害物より高く視覚干渉なし。

総追加 mesh 数: レール 6 + アーチ 9 = **15 mesh**（軽量）

---

## 5. フォグ + envMap

### フォグ

```js
scene.fog = new THREE.FogExp2(0x0a0018, 0.008)
```

遠景が霞む → 奥行き感、ビルのポップイン隠蔽。

### envMap（`src/main.js`）

```js
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
pmrem.dispose()
```

`scene.environment` 設定で全 MeshStandardMaterial に自動適用。metallic マテリアル（プレイヤー・障害物）が環境光を反射。`roughness` 低いものほど効果大。

---

## 制約・非スコープ

- 衝突判定 (`collision.js`) は無変更 — サイドレール・アーチは視覚のみ、AABB なし
- `obstacle-types.js` / `player.js` は無変更
- カスタム GLSL シェーダーなし
- 床の鏡面反射（MirrorReflector）は非スコープ — 後から追加可能
