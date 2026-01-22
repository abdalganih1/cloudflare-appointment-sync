-- Migration to Damascus Time (UTC+3)

-- 1. Update Existing Timestamps
UPDATE appointments SET server_updated_at = datetime(server_updated_at, '+3 hours');
UPDATE general_notes SET server_updated_at = datetime(server_updated_at, '+3 hours');
UPDATE app_backups SET backup_date = datetime(backup_date, '+3 hours');

-- 2. Drop Old Triggers (Sanity Check)
DROP TRIGGER IF EXISTS update_appointment_timestamp;
DROP TRIGGER IF EXISTS update_note_timestamp;

-- 3. Re-install Triggers with UTC+3 Logic
CREATE TRIGGER update_appointment_timestamp 
AFTER UPDATE ON appointments
BEGIN
    UPDATE appointments SET server_updated_at = datetime('now', '+3 hours') WHERE id = old.id;
END;

CREATE TRIGGER update_note_timestamp 
AFTER UPDATE ON general_notes
BEGIN
    UPDATE general_notes SET server_updated_at = datetime('now', '+3 hours') WHERE id = old.id;
END;
