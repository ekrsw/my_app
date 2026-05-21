-- 業務管理（月次）の期間オーバーラップ判定とソート用 LEFT JOIN のインデックス
-- 設計書: docs/plans/duty-assignment-monthly-filter-spec.md

CREATE INDEX IF NOT EXISTS "employee_groups_employee_dates_idx"
  ON "employee_groups" ("employee_id", "start_date", "end_date");

CREATE INDEX IF NOT EXISTS "employee_function_roles_employee_dates_idx"
  ON "employee_function_roles" ("employee_id", "start_date", "end_date");
