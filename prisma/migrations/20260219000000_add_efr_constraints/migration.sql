-- 部分ユニークインデックス①: 同一従業員で同一役割の現行レコードは1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS "idx_efr_unique_active_role"
ON "employee_function_roles" ("employee_id", "function_role_id")
WHERE "end_date" IS NULL;

-- 部分ユニークインデックス②（カテゴリ重複防止）: 同一従業員で同一カテゴリの現行レコードは1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS "idx_efr_unique_active_role_type"
ON "employee_function_roles" ("employee_id", "role_type")
WHERE "end_date" IS NULL;

-- トリガー関数: role_type を function_roles から自動設定
CREATE OR REPLACE FUNCTION set_efr_role_type()
RETURNS TRIGGER AS $$
BEGIN
  SELECT role_type INTO NEW.role_type
  FROM function_roles
  WHERE id = NEW.function_role_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー: INSERT / UPDATE 時に role_type を自動設定
DROP TRIGGER IF EXISTS trg_efr_set_role_type ON employee_function_roles;
CREATE TRIGGER trg_efr_set_role_type
BEFORE INSERT OR UPDATE OF function_role_id
ON employee_function_roles
FOR EACH ROW
EXECUTE FUNCTION set_efr_role_type();

-- 既存データの role_type を function_roles から正しい値に修正
UPDATE employee_function_roles efr
SET role_type = fr.role_type
FROM function_roles fr
WHERE efr.function_role_id = fr.id
  AND efr.role_type != fr.role_type;
