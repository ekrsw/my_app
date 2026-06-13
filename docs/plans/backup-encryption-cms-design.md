# バックアップ成果物の公開鍵暗号化（Protect-CmsMessage）設計

- 作成日: 2026-06-12
- 対象: `scripts/backup/`（`backup-db.ps1` / `sync-backup.ps1`）
- 種別: 設計ドキュメント（office-hours セッション成果物。実装は別タスク）

## 1. 背景と問題

日次バックアップを共有フォルダ（NAS）へ複製しているが、成果物が暗号化されていない。
具体的には:

- `pg_dump -F c` のダンプ（`C:\backups\db\*.dump`）が**平文**。共有にアクセスできる人は
  ファイルをコピーして `pg_restore` で DB 全体を復元・閲覧できる。
- さらに `.env` / `.env.test`（**DBパスワード・AUTH_SECRET を含む平文**）が
  `C:\backups\secrets\` にコピーされ、同じ共有へ複製されている。**ダンプ本体より危険**で、
  これを拾えば稼働中DBへ直接接続できる。

## 2. 脅威モデル（確定事項）

| 項目 | 結論 |
|------|------|
| 守る相手 | **共有フォルダにアクセスできる社内の人**（バックアップ担当以外を含む） |
| 物理盗難 | 主要な懸念ではない |
| アクセス権の制限 | **不可**（共用共有・権限変更に制約がある） |
| 鍵管理方針 | **公開鍵方式。サーバーには公開鍵のみ。秘密鍵はオフライン保管** |

### この脅威モデルから外れる案（不採用の根拠）

- **BitLocker 等のストレージ層暗号化**: 物理盗難用。ボリュームは稼働中は復号済みで、
  共有越しには平文が見える。今回の脅威（共有アクセス者）を一切防げない。
  ※ 前回 revert (`cf2ae5c`) で示された「保存時の盗難対策はストレージ層で別途」方針は、
    物理盗難という別の脅威に対するものであり、本件とは目的が異なる。
- **アクセス制御（NTFS/共有権限の厳格化）**: 本来これが最もシンプルだが、共用共有のため不可。
- **対称パスフレーズ方式（前回の 7-Zip AES-256）**: 暗号化時にもサーバー上にパスフレーズが必要で、
  公開鍵方式の決定と相反。また 7-Zip は公開鍵に非対応。→ ツールごと変更する。

## 3. 採用方式: Protect-CmsMessage による公開鍵暗号化

PowerShell 標準コマンドレット `Protect-CmsMessage` / `Unprotect-CmsMessage` を使用し、
X.509 証明書（`DocumentEncryptionCert`）の公開鍵でバックアップ成果物を暗号化する。

**選定理由**: 直前に `cf2ae5c` でアプリ暗号化フェーズを撤去し依存と複雑さを減らした流れと、
「PowerShell 標準のみ・新規依存ゼロ・Windows Server 完結」が最も整合する。

**重要な制約（検証で判明）**: `Unprotect-CmsMessage` には `-OutFile` が無く、復号結果を
**文字列で返す**＝CMS はテキスト前提の設計。バイナリ `.dump` を直接渡すと復号時に壊れる。
→ **暗号化前に base64 化（純ASCII）し、復号後に base64 デコードしてバイトへ戻す**ことで
バイト無損失を確保する（以下「B'」と呼ぶ）。実DBで往復健全性を検証済み（§6.1）。

### 設計原則

1. **暗号化はバックアップ生成時点で行う**。平文は `C:\backups` にも残さない
   （source 側・共有側ともに最初から暗号文に統一）。生成 → 暗号化 → 平文即削除。
2. **暗号化対象は .dump と .env / .env.test の両方**。secrets の暗号化を最優先に含める。
3. サーバーには**公開鍵 `.cer` のみ**配置（非機密）。秘密鍵 PFX は復元担当者がオフライン保管。

## 4. 詳細設計

### 4.1 鍵ペアの作成（復元担当者のマシンで・1回のみ）

サーバーではなく**復元担当者の手元**で生成する。

```powershell
$cert = New-SelfSignedCertificate `
  -Subject "CN=ShiftDB Backup Recovery" `
  -KeyUsage DataEncipherment, KeyEncipherment `
  -KeyAlgorithm RSA -KeyLength 4096 `
  -Type DocumentEncryptionCert `
  -CertStoreLocation Cert:\CurrentUser\My `
  -NotAfter (Get-Date).AddYears(20)

# 公開鍵のみ（サーバーへ配布。機密ではない）
Export-Certificate -Cert $cert -FilePath .\shiftdb-backup-pub.cer

# 秘密鍵込み（オフライン保管・パスワード保護）。複数媒体に冗長保管すること
$pw = Read-Host -AsSecureString "PFXパスワード"
Export-PfxCertificate -Cert $cert -FilePath .\shiftdb-backup-recovery.pfx -Password $pw
```

- `shiftdb-backup-pub.cer` … サーバーの `scripts/backup/keys/`（または `C:\backups\keys\`）へ配置。Git 管理外。
- `shiftdb-backup-recovery.pfx` + PFXパスワード … **オフライン保管**（パスワードマネージャ／金庫／別媒体に2部以上）。
  鍵紛失＝過去バックアップ復元不能のため、冗長保管と復元手順の定期演習を必須とする。

### 4.2 `backup-db.ps1` の改修方針

現行フローのダンプ生成直後・secrets 退避直後に暗号化を挿入する。

```powershell
$PubCert = Join-Path $PSScriptRoot "keys\shiftdb-backup-pub.cer"   # 設定値として先頭に追加

# CMS はテキスト前提のため base64 を噛ませてバイト無損失にする（B'）
# 入力ファイルは削除しない（.env など消してはいけない元ファイルがあるため。削除は呼び出し側の責務）
function Protect-FileCms {
    param([string]$InPath, [string]$OutPath, [string]$Cert)
    $b64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($InPath))
    Protect-CmsMessage -To $Cert -Content $b64 -OutFile $OutPath
    # 健全性チェック: CMS 形式・非ゼロ（サーバーは秘密鍵を持たず復元可否までは検証不可）
    if ((Get-Item $OutPath).Length -eq 0 -or
        -not (Select-String -Path $OutPath -Pattern '-----BEGIN CMS-----' -Quiet)) {
        throw "暗号化結果が不正です: $OutPath"
    }
}

# --- ダンプ暗号化（生成直後）。ダンプは生成物なので暗号化成功後に平文を削除 ---
Protect-FileCms -InPath $dumpFile -OutPath "$dumpFile.cms" -Cert $PubCert
Remove-Item $dumpFile -Force
Write-Log "ダンプを暗号化: $dumpFile.cms"

# --- secrets 暗号化（.env / .env.test を平文コピーではなく暗号化して退避）---
# 元の .env は削除しない（live 設定ファイルのため）。secrets\ に .cms のみ作る
Protect-FileCms -InPath $src -OutPath "$dst.cms" -Cert $PubCert
```

#### fail-closed クリーンアップ（FINDING 1 / 🔴）

`pg_dump` 成功後に暗号化が失敗すると、`$ErrorActionPreference="Stop"` により
`Remove-Item`（平文削除）の手前で停止し、**平文 `.dump` が `C:\backups\db` に残る**。
次回 sync でそれが共有へ複製され、防ぎたかった漏洩そのものになる。
catch ブロックで「`.cms` を持たない平文成果物」を必ず掃除してから exit する:

```powershell
catch {
    Write-Log "バックアップ失敗: $($_.Exception.Message)" "ERROR"
    if ($env:PGPASSWORD) { $env:PGPASSWORD = $null }
    # fail-closed: db\ / secrets\ には本来 .cms しか存在しないため、非 .cms（平文）を全削除
    foreach ($dir in @($DumpDir, $SecretDir)) {
        if (Test-Path $dir) {
            Get-ChildItem $dir -File -ErrorAction SilentlyContinue |
              Where-Object { $_.Extension -ne ".cms" } |
              ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
        }
    }
    exit 1
}
```

- 世代管理（`LastWriteTime` ベースの保持日数削除）は `.cms` ファイルに対しても従来どおり機能する。

### 4.2.1 `sync-backup.ps1` の改修方針（FINDING 2 / 🟡 多層防御）

`sync-backup.ps1` は現状 `C:\backups\` を中身を問わず丸ごと robocopy する。FINDING 1 を
直しても、手動ファイルや別経路で平文が紛れ込めば共有へ出てしまう。**robocopy を許可リスト方式**
にし、暗号文とログ以外は構造的に共有へ出ないようにする（疲れた運用者でも安全な fail-safe）:

```powershell
# robocopy のファイル名フィルタ（/IF = Include Files）。暗号文とログのみ複製
$rcArgs = @("`"$BackupRoot`"", "`"$DestRoot`"", $mode, "/Z", "/R:3", "/W:10",
            "/NP", "/NDL", "/TEE", "/LOG+:`"$rcLog`"",
            "/IF", "*.cms", "*.log")
```

> 注: `/IF` は robocopy のファイル名フィルタ。これにより万一ローカルに平文 `.dump` が
> 残っていても共有へは複製されない。FINDING 1（生成元での fail-closed）との二重の防御線。

### 4.3 復元手順（README 追記）

```powershell
# 復元担当者のマシンで PFX をインポート（または一時インポート）
Import-PfxCertificate -FilePath .\shiftdb-backup-recovery.pfx `
  -CertStoreLocation Cert:\CurrentUser\My -Password (Read-Host -AsSecureString)

# 復号: Unprotect は base64 文字列を返す → バイトに戻す（-OutFile は存在しない）
# 注意: [IO.File] の相対パスは .NET のカレントで解決される。必ず絶対パスを渡す。
$restore = Join-Path (Get-Location) "restore.dump"
$b64 = Unprotect-CmsMessage -Path .\shift_database_YYYYMMDD_HHMMSS.dump.cms
[System.IO.File]::WriteAllBytes($restore, [System.Convert]::FromBase64String($b64))

& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -h localhost -p 5432 -U my_user `
  -d shift_database --clean --if-exists $restore
Remove-Item $restore -Force   # 復号した平文を残さない

# .env も同様に復号して戻す（同じ base64 → WriteAllBytes 手順。同様に絶対パスを渡す）
```

## 5. 移行・インシデント対応（重要）

平文 `.env`（DBパスワード・AUTH_SECRET）が、アクセス制御できない共有に一定期間置かれていた。
**既に漏洩済みとみなして対応する**:

1. **AUTH_SECRET をローテーション**（再発行）。既存セッションは無効化される前提で計画。
2. **DBパスワードを変更**し、`.env` の `DATABASE_URL` を更新。
3. 初回の暗号化バックアップが §6 の検証を通過したら、**共有上およびローカルの既存平文成果物
   （`db\*.dump`、`secrets\*`）を削除**する。アクセスは絞れないので、平文を残さないことが防御線。
4. ローカル `C:\backups` 内の過去平文世代も同様に削除（暗号文へ統一）。

## 6. 検証ゲート（go/no-go）— 実装前に必ず実施

CMS のバイナリ往復健全性と性能を、本番相当のダンプで確認する。**1つでも失敗したら age へ切替**。

1. **ダンプサイズ計測**: `Get-Item C:\backups\db\*.dump | Select Length`。
   目安として数百MB以下なら CMS で実用、GB級なら性能要注意。
2. **往復健全性テスト（最重要）**:
   ```powershell
   Protect-CmsMessage -To .\keys\shiftdb-backup-pub.cer -Path real.dump -OutFile real.dump.cms
   Unprotect-CmsMessage -Path real.dump.cms -OutFile roundtrip.dump
   # バイト一致を確認
   (Get-FileHash real.dump).Hash -eq (Get-FileHash roundtrip.dump).Hash   # → True 必須
   # 復号物が pg_restore で読めるか
   & pg_restore.exe --list roundtrip.dump   # → 正常にリスト出力されること
   ```
   ※ `Protect-CmsMessage` はテキスト処理前提の設計で、バイナリ入力で破損する既知リスクがある。
     ハッシュ不一致なら CMS は不採用。
3. **性能計測**: 暗号化＋復号の所要時間が日次バッチ窓（02:00〜）に収まるか。

### 6.1 検証結果（2026-06-12 実走 / B' 採用確定）

実DB（`shift_database`）で B'（base64+CMS）を往復テストし、合格。

| 項目 | 結果 | 判定 |
|------|------|------|
| ダンプサイズ | 0.5 MB | 小さい（単一企業のシフトDB） |
| ハッシュ一致（SHA256） | True | ✅ バイト無損失 |
| pg_restore --list | 成功 | ✅ 復元可能 |
| 暗号化時間 | 1.4s | ✅ 日次バッチで問題なし |
| 復号時間 | 11.3s | ✅ 復元は手動・稀のため許容 |
| 暗号文サイズ | 0.92 MB（約1.8倍） | ✅ 14日保持でも容量問題なし |

**結論: B'（Protect-CmsMessage + base64）を採用確定。新規依存ゼロを維持。**
- 日次バッチのクリティカルパスは暗号化（1.4s）のみで高速。
- `Unprotect-CmsMessage` は遅い（0.5MB で 11.3s）が、復号は復元時の手動操作のみのため許容。
  将来 DB が大きく育ち復号が分単位になる場合は age（§7）への移行を再検討する。

## 7. フォールバック: age 方式（将来 DB 肥大化時の移行先）

- `age.exe` をバージョン＋SHA256 ピン留めで `scripts/backup/bin/` に vendoring。
- `recipients.txt`（公開鍵 `age1...`）のみサーバー配置、秘密鍵 `identity.txt` はオフライン保管。
- 暗号化: `age -R recipients.txt -o "$dumpFile.age" $dumpFile`、復号: `age -d -i identity.txt`。
- 公開鍵方式・ストリーミングで大容量も安定。トレードオフは外部依存の継続管理。

## 8. リスクとトレードオフ

| リスク | 対応 |
|--------|------|
| 秘密鍵紛失＝過去分復元不能 | 冗長保管（2部以上・別媒体）＋復元ドリル（§8.1） |
| 暗号化失敗時に平文ダンプが残り共有へ漏れる | fail-closed クリーンアップ（§4.2）＋ sync 許可リスト（§4.2.1）の二重防御 |
| バックアップが静かに復元不能になる | 暗号化直後の健全性チェック（§4.2）＋ 四半期の実復元ドリル（§8.1） |
| CMS のバイナリ破損／性能 | §6 検証ゲートで go/no-go、不可なら age |
| 平文 .env の既往漏洩 | §5 で AUTH_SECRET / DBパスワードをローテーション |
| 公開鍵 .cer の差し替え攻撃（サーバー侵害時に攻撃者の鍵へ） | .cer のサムプリントを運用手順に控え、定期照合 |

### 8.1 復元ドリル（FINDING 3 / 🟡 唯一の安全網）

公開鍵方式の本質的な制約として、**サーバーは秘密鍵を持たないため、暗号化したバックアップが
本当に復元できるかを自分で検証できない**。`Protect-FileCms` の健全性チェック（§4.2）は
「CMS 形式・非ゼロ」までしか確認できない。実際に復元できる保証は、秘密鍵を使った**実復元ドリル
でしか得られない**。これを抽象的な「定期演習」で終わらせず、運用に組み込む:

| 項目 | 内容 |
|------|------|
| 頻度 | 四半期ごと（鍵・PowerShell・証明書の更新後は臨時で必ず実施） |
| 担当 | 復元担当者（秘密鍵 PFX 保持者） |
| 環境 | 本番とは別のテストDB（`shift_database` を上書きしない） |
| 手順 | ①共有から最新 `.cms` を取得 → ②秘密鍵で復号（§4.3）→ ③`pg_restore` でテストDBへ復元 → ④主要テーブルの件数・サンプル行を確認 |
| 合格条件 | 復号物が `pg_restore --list` を通り、テストDBへ復元でき、データが妥当 |
| 記録 | 実施日・対象世代・結果を `C:\backups\restore-drill.log` に残す |

> ドリルで失敗を検知できれば「復元したい本番障害時」より遥かに安いタイミングで気づける。
> これが backup 経路で最も blast radius が大きい「静かな復元不能」への唯一の防御。

## 9. スコープ外

- `restic` / `Borg` 等の専用バックアップツールへの全面移行: いずれも対称パスフレーズ方式で
  「公開鍵のみサーバー配置」の決定と相反し、自作スクリプト一式の置換＝別規模。本件とは分離。
- アプリ層（列）暗号化: `cf2ae5c` で撤去済み・脅威モデル不一致のため対象外。
