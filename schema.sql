-- Currently we only have two types of queries:
-- - give me all mics from X date to Y date
-- - CRUD for mic with id=1234
-- So, most data is going to be stored de-normalized in a json blob.
-- Should we desire a normalized db in the future it should be trivial to migrate (because the number of mics is going to be <10 and unlikely to grow larger).

CREATE EXTENSION if NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RRULE conforming to RFC 5545: https://datatracker.ietf.org/doc/html/rfc5545
-- https://freetools.textmagic.com/rrule-generator
-- null for a one-off event
CREATE DOMAIN rrule AS VARCHAR(100) CHECK (
  VALUE IS NULL OR
  -- TODO: I didn't actually read the spec so this regex is probably wrong
  VALUE ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;\s*(INTERVAL=\d+|BYDAY=[A-Z,]+|BYMONTH=\d+|BYMONTHDAY=[0-9,]+|BYSETPOS=\d+|UNTIL=\d+))*$'
);

CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email citext NOT NULL unique,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE mic (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edit_version BIGINT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  recurrence RRULE,
  data JSONB NOT NULL,
  last_edited_by UUID NOT NULL REFERENCES app_user(id)
);
CREATE INDEX mic_start_date_idx ON mic(start_date);

-- mic audit table and trigger
CREATE TABLE audit_mic (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mic_id UUID NOT NULL REFERENCES mic(id),
  edit_version BIGINT NOT NULL,
  start_date DATE NOT NULL,
  recurrence RRULE,
  data JSONB NOT NULL,
  action_type VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', or 'DELETE'
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  changed_by UUID NOT NULL REFERENCES app_user(id)
);
CREATE INDEX audit_mic_mic_id_idx ON audit_mic(mic_id);
CREATE INDEX audit_mic_changed_by_idx ON audit_mic(changed_by);

CREATE OR REPLACE FUNCTION log_mic_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_mic (
      mic_id, edit_version, start_date, recurrence, data,
      action_type, changed_by
    ) VALUES (
      NEW.id, NEW.edit_version, NEW.start_date, NEW.recurrence, NEW.data,
      'INSERT', NEW.last_edited_by
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Increment the edit version
    NEW.edit_version := OLD.edit_version + 1;

    INSERT INTO audit_mic (
      mic_id, edit_version, start_date, recurrence, data,
      action_type, changed_by
    ) VALUES (
      NEW.id, NEW.edit_version, NEW.start_date, NEW.recurrence, NEW.data,
      'UPDATE', NEW.last_edited_by
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_mic (
      mic_id, edit_version, start_date, recurrence, data,
      action_type, changed_by
    ) VALUES (
      OLD.id, OLD.edit_version, OLD.start_date, OLD.recurrence, OLD.data,
      'DELETE', OLD.last_edited_by
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the mic table
CREATE TRIGGER mic_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON mic
FOR EACH ROW EXECUTE FUNCTION log_mic_changes();
