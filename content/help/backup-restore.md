> ⓘ バックアップとリストアはサーバー管理者向けの操作です。サーバーへのアクセス権限が必要です。

このシステムのデータ（従業員・シフト・各種履歴など）はすべて PostgreSQL データベースに保存されています。障害・誤操作・サーバー故障に備えて、データベースの日次バックアップを取得できます。

## バックアップ

- バックアップはサーバー上で **毎日自動** で取得されます（タスクスケジューラに登録されている場合）。
- 取得対象は **データベース全体** と、接続設定ファイル（`.env`）です。
- 保存先はサーバーの `C:\backups\` です（`db\` にデータベース、`secrets\` に設定ファイル）。
- 古いバックアップは **14日** で自動的に削除されます（世代管理）。

今すぐ手動で取得したい場合は、サーバー上で **PowerShell** を開き、次の PowerShell コマンドを実行します。実行結果は `C:\backups\backup.log` で確認できます。

`powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup-db.ps1`

## リストア

バックアップからデータベースを復元する操作です。

> ⚠️ リストアは現在のデータを上書きします。誤って実行すると元に戻せません。実行前に対象のバックアップ日時を必ず確認してください。

復元はサーバー上で `pg_restore` を使って行います。**以下のコマンドはすべて PowerShell で実行します**（先頭の `&` は PowerShell の呼び出し演算子、`$env:PGPASSWORD` は PowerShell の環境変数指定です）。例は PostgreSQL を `C:\Program Files\PostgreSQL\17\bin` にインストールしている前提です（バージョンが異なる場合はパスを読み替えてください）。コマンド中の `YYYYMMDD_HHMMSS` は、復元したいバックアップの日時に置き換えます。

**1. アーカイブ内容の確認** — 復元前に、バックアップが壊れていないか・想定の中身かを確認します。次を実行してテーブルなどの一覧が表示されれば正常です。

`& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump"`

**2. 既存DBへ復元** — `--clean --if-exists` で既存のテーブルなどを削除してから復元します。先にパスワードを環境変数に設定して実行し、終わったらクリアします。

`$env:PGPASSWORD = "（DBのパスワード）"`

`& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -h localhost -p 5432 -U my_user -d shift_database --clean --if-exists "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump"`

`$env:PGPASSWORD = $null`

**3. 設定ファイルを戻す（必要な場合）** — `.env` が失われている場合は、`C:\backups\secrets\` に退避された `env_YYYYMMDD_HHMMSS` をプロジェクト直下に `.env` として戻します。設定ファイルが無いとアプリは起動しません。

保管のしかた（別拠点への複製など）を含む詳しい手順は、リポジトリの `scripts/backup/README.md` に記載しています。
