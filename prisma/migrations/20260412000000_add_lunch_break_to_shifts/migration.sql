-- Add lunch_break_start/end to shifts
ALTER TABLE shifts
  ADD COLUMN lunch_break_start TIME(6),
  ADD COLUMN lunch_break_end   TIME(6);

-- Add default_lunch_break_start/end to shift_codes
ALTER TABLE shift_codes
  ADD COLUMN default_lunch_break_start TIME(6),
  ADD COLUMN default_lunch_break_end   TIME(6);

-- Add lunch_break columns to shift_change_history (OLD values + NEW values)
ALTER TABLE shift_change_history
  ADD COLUMN lunch_break_start     TIME(6),
  ADD COLUMN lunch_break_end       TIME(6),
  ADD COLUMN new_lunch_break_start TIME(6),
  ADD COLUMN new_lunch_break_end   TIME(6);

-- Update apply_shift_code_defaults to also fill lunch_break_start/end from shift_code defaults
CREATE OR REPLACE FUNCTION apply_shift_code_defaults()
RETURNS TRIGGER AS $$
DECLARE
  sc RECORD;
BEGIN
  -- Only apply when shift_code is set and has changed (or on INSERT)
  IF NEW.shift_code IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.shift_code IS DISTINCT FROM NEW.shift_code)
  THEN
    SELECT default_start_time, default_end_time, default_is_holiday,
           default_lunch_break_start, default_lunch_break_end
    INTO sc
    FROM shift_codes
    WHERE code = NEW.shift_code;

    IF FOUND THEN
      IF NEW.start_time IS NULL AND sc.default_start_time IS NOT NULL THEN
        NEW.start_time := sc.default_start_time;
      END IF;
      IF NEW.end_time IS NULL AND sc.default_end_time IS NOT NULL THEN
        NEW.end_time := sc.default_end_time;
      END IF;
      IF NEW.is_holiday IS NULL THEN
        NEW.is_holiday := sc.default_is_holiday;
      END IF;
      IF NEW.lunch_break_start IS NULL AND sc.default_lunch_break_start IS NOT NULL THEN
        NEW.lunch_break_start := sc.default_lunch_break_start;
      END IF;
      IF NEW.lunch_break_end IS NULL AND sc.default_lunch_break_end IS NOT NULL THEN
        NEW.lunch_break_end := sc.default_lunch_break_end;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update record_shift_change to track lunch_break changes
CREATE OR REPLACE FUNCTION record_shift_change()
RETURNS TRIGGER AS $$
DECLARE
  next_version integer;
  note_text varchar(255);
BEGIN
  -- セッション変数から備考テキストを取得（未設定の場合はNULL）
  note_text := current_setting('app.shift_note', true);

  -- DELETE の場合: 常に記録
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM shift_change_history
    WHERE shift_id = OLD.id;

    INSERT INTO shift_change_history (
      shift_id, employee_id, shift_date,
      shift_code, start_time, end_time, is_holiday, is_remote,
      lunch_break_start, lunch_break_end,
      new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_remote,
      new_lunch_break_start, new_lunch_break_end,
      note, version, changed_at
    ) VALUES (
      OLD.id, OLD.employee_id, OLD.shift_date,
      OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_remote,
      OLD.lunch_break_start, OLD.lunch_break_end,
      NULL, NULL, NULL, NULL, NULL,
      NULL, NULL,
      note_text, next_version, CURRENT_TIMESTAMP
    );
    RETURN OLD;
  END IF;

  -- UPDATE の場合
  IF TG_OP = 'UPDATE' THEN
    -- skip_shift_history が 'true' の場合は履歴をスキップ
    IF current_setting('app.skip_shift_history', true) = 'true' THEN
      RETURN NEW;
    END IF;

    -- トラッキング対象カラムに変更がある場合のみ記録
    IF OLD.shift_code IS DISTINCT FROM NEW.shift_code
      OR OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.end_time IS DISTINCT FROM NEW.end_time
      OR OLD.is_holiday IS DISTINCT FROM NEW.is_holiday
      OR OLD.is_remote IS DISTINCT FROM NEW.is_remote
      OR OLD.lunch_break_start IS DISTINCT FROM NEW.lunch_break_start
      OR OLD.lunch_break_end IS DISTINCT FROM NEW.lunch_break_end
    THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
      FROM shift_change_history
      WHERE shift_id = OLD.id;

      INSERT INTO shift_change_history (
        shift_id, employee_id, shift_date,
        shift_code, start_time, end_time, is_holiday, is_remote,
        lunch_break_start, lunch_break_end,
        new_shift_code, new_start_time, new_end_time, new_is_holiday, new_is_remote,
        new_lunch_break_start, new_lunch_break_end,
        note, version, changed_at
      ) VALUES (
        OLD.id, OLD.employee_id, OLD.shift_date,
        OLD.shift_code, OLD.start_time, OLD.end_time, OLD.is_holiday, OLD.is_remote,
        OLD.lunch_break_start, OLD.lunch_break_end,
        NEW.shift_code, NEW.start_time, NEW.end_time, NEW.is_holiday, NEW.is_remote,
        NEW.lunch_break_start, NEW.lunch_break_end,
        note_text, next_version, CURRENT_TIMESTAMP
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
