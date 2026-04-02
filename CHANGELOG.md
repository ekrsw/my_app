# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.3] - 2026-04-02

### Changed
- 業務割当の深夜跨ぎ対応: 終了時刻が開始時刻より前でも登録可能に変更（例: 22:00〜08:00）
- ダッシュボードの「当番中」ラベルを「他業務中」に変更
- ダッシュボードのカードタイトルを「対応可能状況」から「現在の対応可能状況」に変更

### Fixed
- 前日の深夜跨ぎ業務割当が翌日のキャパシティ計算に含まれない問題を修正

## [0.1.0.1] - 2026-03-31

### Added
- CLAUDE.md に gstack セットアップ手順（初回インストール用）とトラブルシューティングのパス修正を追加

### Changed
- Claude Code のローカル設定に gstack 関連の自動承認パターンを追加

## [0.1.0.0] - 2026-03-31

### Added
- gstack フレームワークの統合 (スキルルーティング設定、QA/Ship/Review 等のワークフロー対応)
- `.gstack/` ディレクトリを `.gitignore` に追加
