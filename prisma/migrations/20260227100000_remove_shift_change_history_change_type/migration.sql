-- AlterTable: shift_change_history から change_type カラムを削除
ALTER TABLE "shift_change_history" DROP COLUMN "change_type";

-- トリガー関数を再作成（change_type 関連の INSERT 列を除去）
CREATE OR REPLACE FUNCTION record_shift_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
BEGIN
  -- DELETE の場合: 常に記録（NEW値はすべてNULL）
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM shift_change_history
    WHERE shift_id = OLD.id;

    INSERT INTO shift_change_history (
      shift_id, employee_id, shift_date,
      shift_code, start_time, end_time, is_holiday, is_paid_leave, is_remote,
      new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_paid_leave, new_is_remote,
      version, changed_at
    ) VALUES (
      OLD.id, OLD.employee_id, OLD.shift_date,
      OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_paid_leave, OLD.is_remote,
      NULL, NULL, NULL, NULL, NULL, NULL,
      next_version, CURRENT_TIMESTAMP
    );
    RETURN OLD;
  END IF;

  -- UPDATE の場合: トラッキング対象カラムに変更がある場合のみ記録（OLD値とNEW値の両方を保存）
  IF TG_OP = 'UPDATE' THEN
    IF OLD.shift_code IS DISTINCT FROM NEW.shift_code
      OR OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.end_time IS DISTINCT FROM NEW.end_time
      OR OLD.is_holiday IS DISTINCT FROM NEW.is_holiday
      OR OLD.is_paid_leave IS DISTINCT FROM NEW.is_paid_leave
      OR OLD.is_remote IS DISTINCT FROM NEW.is_remote
    THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
      FROM shift_change_history
      WHERE shift_id = OLD.id;

      INSERT INTO shift_change_history (
        shift_id, employee_id, shift_date,
        shift_code, start_time, end_time, is_holiday, is_paid_leave, is_remote,
        new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_paid_leave, new_is_remote,
        version, changed_at
      ) VALUES (
        OLD.id, OLD.employee_id, OLD.shift_date,
        OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_paid_leave, OLD.is_remote,
        NEW.shift_code, NEW.start_time, NEW.end_time, NEW.is_holiday, NEW.is_paid_leave, NEW.is_remote,
        next_version, CURRENT_TIMESTAMP
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
