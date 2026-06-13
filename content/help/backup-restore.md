> ⓘ バックアップとリストアはサーバー管理者向けの操作です。サーバーへのアクセス権限と、復元には**復号用の秘密鍵**が必要です。

このシステムのデータ（従業員・シフト・各種履歴など）はすべて PostgreSQL データベースに保存されています。障害・誤操作・サーバー故障に備えて、データベースの日次バックアップを取得できます。

バックアップ成果物（データベースのダンプと設定ファイル）は、**公開鍵で暗号化**して保存されます。これは、暗号化されていない共有フォルダ（NAS）へ複製しても、復号用の秘密鍵を持たない人には中身を取り出せないようにするためです。

## バックアップ

- バックアップはサーバー上で **毎日 02:00 に自動** で取得されます（タスクスケジューラに登録されている場合）。
- 取得対象は **データベース全体** と、接続設定ファイル（`.env` / `.env.test`）です。
- 成果物はいずれも **公開鍵で暗号化** され、拡張子 `.cms` のファイルとして保存されます。
- 保存先はサーバーの `C:\backups\` です（`db\` に暗号化ダンプ `*.cms`、`secrets\` に暗号化した設定ファイル `*.cms`）。
- 古いバックアップは **14日** で自動的に削除されます（世代管理）。
- 暗号化用の公開鍵証明書（`scripts/backup/keys/shiftdb-backup-pub.cer`）が無い場合、バックアップは**中止されます**（暗号化できないまま平文を残さないための安全側の動作）。

今すぐ手動で取得したい場合は、サーバー上で **PowerShell** を開き、次の PowerShell コマンドを実行します。実行結果は `C:\backups\backup.log` で確認できます。

`powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup-db.ps1`

## リストア

バックアップからデータベースを復元する操作です。

> ⚠︎ リストアは現在のデータを上書きします。誤って実行すると元に戻せません。実行前に対象のバックアップ日時を必ず確認してください。

バックアップは `.cms`（暗号化済み）なので、**まず秘密鍵で復号**してから `pg_restore` で復元します。復号には、鍵ペア作成時に作った復元用の秘密鍵ファイル `shiftdb-backup-recovery.pfx`（と PFX パスワード）が必要です。

> 🔑 この秘密鍵 PFX を失うと、過去のバックアップは一切復元できません。サーバー上にも共有フォルダにも置かず、復元担当者がオフラインで保管しています。

**以下のコマンドはすべて PowerShell で実行します**（先頭の `&` は PowerShell の呼び出し演算子、`$env:PGPASSWORD` は PowerShell の環境変数指定です）。例は PostgreSQL を `C:\Program Files\PostgreSQL\17\bin` にインストールしている前提です（バージョンが異なる場合はパスを読み替えてください）。コマンド中の `YYYYMMDD_HHMMSS` は、復元したいバックアップの日時に置き換えます。

**1. 秘密鍵 PFX をインポート** — 復号に使う秘密鍵を一時的にインポートします。実行するとパスワード入力を求められます。

`Import-PfxCertificate -FilePath .\shiftdb-backup-recovery.pfx -CertStoreLocation Cert:\CurrentUser\My -Password (Read-Host -AsSecureString)`

**2. 暗号化ダンプを復号** — `.cms` を復号して平文のダンプファイル（`restore.dump`）に書き出します。`[IO.File]` は相対パスを正しく解決しないため、`Join-Path` で絶対パスを渡します。

`$restore = Join-Path (Get-Location) "restore.dump"`

`$b64 = Unprotect-CmsMessage -Path "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump.cms"`

`[System.IO.File]::WriteAllBytes($restore, [System.Convert]::FromBase64String($b64))`

**3. アーカイブ内容の確認** — 復元前に、復号したダンプが壊れていないか・想定の中身かを確認します。次を実行してテーブルなどの一覧が表示されれば正常です。

`& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list $restore`

**4. 既存DBへ復元** — `--clean --if-exists` で既存のテーブルなどを削除してから復元します。先にパスワードを環境変数に設定して実行し、終わったらクリアします。

`$env:PGPASSWORD = "（DBのパスワード）"`

`& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -h localhost -p 5432 -U my_user -d shift_database --clean --if-exists $restore`

`$env:PGPASSWORD = $null`

**5. 復号した平文を削除** — 復元が終わったら、復号して書き出した平文ダンプを残さないよう削除します。

`Remove-Item $restore -Force`

**6. 設定ファイルを戻す（必要な場合）** — `.env` が失われている場合は、`C:\backups\secrets\` の暗号化退避物を同じ手順で復号してプロジェクト直下に `.env` として戻します。設定ファイルが無いとアプリは起動しません。

`$envOut = Join-Path (Get-Location) ".env"`

`$b64 = Unprotect-CmsMessage -Path "C:\backups\secrets\env_YYYYMMDD_HHMMSS.cms"`

`[System.IO.File]::WriteAllBytes($envOut, [System.Convert]::FromBase64String($b64))`

> 公開鍵方式ではサーバーは秘密鍵を持たないため、バックアップが本当に復元できるかをサーバー自身では検証できません。**四半期ごとに、テストDBへの実復元（復元ドリル）**を行い、復元できることを定期的に確認してください。

鍵ペアの作成手順、保管戦略（別拠点への複製）、復元ドリルを含む詳しい手順は、リポジトリの `scripts/backup/README.md` に記載しています。
