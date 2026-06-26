# NEON RUNNER — Juice & Addiction Design Spec

**Date:** 2026-06-26
**Status:** Approved

---

## Overview

爽快感・中毒性を高める5機能を追加する。既存アーキテクチャを最小限に拡張し、新規モジュールは作らない。

**スコープ（確定）:**
- 初速アップ
- コンボ倍率システム
- 画面シェイク
- 被弾スロー演出
- ハイスコアlocalStorage永続

---

## 1. 初速アップ

`src/constants.js` の `BASE_SPEED` を `8` → `12` に変更。他の定数（`MAX_SPEED=22`, `ACCEL_FACTOR`）は変更なし。

---

## 2. コンボ倍率システム

### GameState 追加フィールド

```js
combo: 1,         // 現在の倍率 (1, 2, 3, 4)
comboTimer: 0,    // 最後のシャード取得からの経過秒数
```

### ロジック

- シャード取得ごとに `combo = Math.min(combo + 1, 4)`、`comboTimer = 0`
- 毎フレーム `comboTimer += delta`。`comboTimer > 2.0` でコンボリセット（`combo = 1`）
- 被弾時も即リセット（`combo = 1`, `comboTimer = 0`）
- シャードボーナス計算: `shardBonus += 10 * gameState.combo`（現行の固定10から変更）

### HUD 表示

- `combo >= 2` のときのみ表示: `×2 COMBO` / `×3 COMBO` / `×4 COMBO`
- コンボ更新時に短いスケールアニメ（CSS `transform: scale` で実装）
- タイマーバー: `comboTimer / 2.0` の割合で横幅が縮むプログレスバー

---

## 3. 画面シェイク

### GameState 追加フィールド

```js
cameraShake: { intensity: 0, duration: 0 },
```

### トリガー・パラメータ

| イベント | intensity | duration |
|----------|-----------|----------|
| 被弾 | 0.15 | 0.3秒 |
| ジャンプ着地 | 0.06 | 0.1秒 |

### 実装

- 被弾・着地時: `gameState.cameraShake = { intensity, duration }` を直接セット（`player.js` は `gameState` を受け取っているので直接書き込み可）
- `scene.js` の `update(delta, gameState)` 内でカメラオフセット計算:
  ```js
  if (cameraShake.duration > 0) {
    camera.position.x += (Math.random() - 0.5) * cameraShake.intensity
    camera.position.y += (Math.random() - 0.5) * cameraShake.intensity
    cameraShake.duration -= delta
    if (cameraShake.duration <= 0) {
      camera.position.x = baseX
      camera.position.y = baseY
    }
  }
  ```
- `scene.js` はカメラの基準位置（`baseX`, `baseY`）を closure で保持

---

## 4. 被弾スロー演出

### GameState 追加フィールド

```js
timeScale: 1.0,      // 通常は1.0
slowTimer: 0,        // スロー残り秒数（実時間）
```

### ロジック

- 被弾時: `timeScale = 0.25`, `slowTimer = 0.2`（実時間0.2秒）
- `main.js` ゲームループ:
  ```js
  if (gameState.slowTimer > 0) {
    gameState.slowTimer -= realDelta   // requestAnimationFrame の生delta
    if (gameState.slowTimer <= 0) gameState.timeScale = 1.0
  }
  const delta = realDelta * gameState.timeScale
  ```
- `delta` を使う全モジュール（player, obstacles, collectibles, particles）が自動的にスロー対象になる
- `slowTimer` の減算だけ `realDelta` を使う（スロー中でもタイマーが止まらないように）

---

## 5. ハイスコア localStorage 永続

### キー

`neonRunner_highScore` (string → parseInt)

### 読み込み

`main.js` 初期化時に `localStorage.getItem('neonRunner_highScore') ?? 0` を読み込み、`gameState.highScore` として保持。

### 保存

ゲームオーバー時に `gameState.score > gameState.highScore` なら更新・保存。

### HUD 表示

- タイトル画面: `BEST: 12345` を常時表示
- ゲームオーバー画面:
  - 通常: `BEST: 12345`
  - 更新時: `NEW BEST! 12345` （ゴールド色 + CSS アニメ）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/constants.js` | `BASE_SPEED` 8→12 |
| `src/main.js` | `gameState` 新フィールド追加、`timeScale`/`slowTimer` ループ処理、localStorage読み書き |
| `src/player.js` | 被弾時に `triggerShake` + スロー呼び出し、着地時に `triggerShake` |
| `src/collectibles.js` | シャード取得時にコンボ更新、スコア計算を `10 * combo` に変更 |
| `src/scene.js` | カメラシェイク処理を `update()` に追加、基準位置をclosureで保持 |
| `src/hud.js` | コンボ表示要素追加（DOM）、ハイスコア表示、ゲームオーバー画面にベスト更新表示 |
| `src/audio.js` | コンボ音（シャード取得音を倍率に応じてピッチアップ）、被弾シェイク音 |

---

## 非スコープ（明示的に除外）

- ニアミスボーナス
- マイルストーン演出
- サーバーサイドスコアボード
- アンロック・スキンシステム
