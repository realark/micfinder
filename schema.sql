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
  account_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
  email citext NOT NULL unique,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE mic (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edit_version BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  last_edited_by UUID NOT NULL REFERENCES app_user(id)
);
CREATE INDEX mic_data_start_date_idx ON mic((data->>'startDate'));
CREATE INDEX mic_data_recurrence_idx ON mic((data->>'recurrence'));

-- mic audit table and trigger
CREATE TABLE audit_mic (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mic_id UUID NOT NULL,
  edit_version BIGINT NOT NULL,
  data JSONB,
  action_type VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', or 'DELETE'
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  changed_by UUID NOT NULL REFERENCES app_user(id)
);
CREATE INDEX audit_mic_mic_id_idx ON audit_mic(mic_id);
CREATE INDEX audit_mic_changed_by_idx ON audit_mic(changed_by);

CREATE OR REPLACE FUNCTION log_mic_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_by UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_mic (
      mic_id, edit_version, data,
      action_type, changed_by
    ) VALUES (
      NEW.id, NEW.edit_version, NEW.data,
      'INSERT', NEW.last_edited_by
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_mic (
      mic_id, edit_version, data,
      action_type, changed_by
    ) VALUES (
      NEW.id, NEW.edit_version, NEW.data,
      'UPDATE', NEW.last_edited_by
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    changed_by := current_setting('app.user_id', true)::uuid;
    IF changed_by is null THEN
      RAISE EXCEPTION 'app.user_id session local var must be set for DELETE ops';
    END IF;
    INSERT INTO audit_mic (
      mic_id, edit_version, data, action_type, changed_by
    ) VALUES (
      OLD.id, old.edit_version + 1, null, 'DELETE', changed_by
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mic_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON mic
FOR EACH ROW EXECUTE FUNCTION log_mic_changes();

CREATE OR REPLACE FUNCTION check_and_increment_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the edit_version matches
  IF NEW.edit_version != OLD.edit_version THEN
    RAISE EXCEPTION 'Edit version mismatch. Expected %, got %', OLD.edit_version, NEW.edit_version;
  END IF;

  -- Increment the edit_version
  NEW.edit_version := OLD.edit_version + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mic_version_check_trigger
BEFORE UPDATE ON mic
FOR EACH ROW EXECUTE FUNCTION check_and_increment_version();

CREATE OR REPLACE FUNCTION validate_mic_data()
RETURNS TRIGGER AS $$
DECLARE
  updated_data JSONB;
BEGIN
  -- For inserts or if id is null in data, set the id in the JSONB to match the table id
  IF TG_OP = 'INSERT' OR NEW.data->>'id' IS NULL THEN
    -- Create a new JSONB with the id from the table
    updated_data = jsonb_set(NEW.data, '{id}', to_jsonb(NEW.id::text));
    NEW.data = updated_data;
  -- For updates, check that the id in the data matches the id in the table
  ELSIF NEW.data->>'id' != NEW.id::text THEN
    RAISE EXCEPTION 'Data id (%) does not match record id (%)', NEW.data->>'id', NEW.id;
  END IF;

  -- Check that recurrence is either not set or a proper rrule
  IF NEW.data->>'recurrence' IS NOT NULL THEN
    -- This will throw an error if the recurrence doesn't match the domain constraints
    PERFORM (NEW.data->>'recurrence')::rrule;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mic_data_validation_trigger
BEFORE INSERT OR UPDATE ON mic
FOR EACH ROW EXECUTE FUNCTION validate_mic_data();
