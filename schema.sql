-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    color_code TEXT DEFAULT '#FFFFFF',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    appointment_date TEXT NOT NULL, -- YYYY-MM-DD
    start_time TEXT NOT NULL,       -- HH:MM AM/PM
    duration_minutes INTEGER DEFAULT 30,
    notes TEXT,
    recurrence_type TEXT DEFAULT 'none',
    server_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- General Notes Table
CREATE TABLE IF NOT EXISTS general_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    color_code TEXT DEFAULT '#FFFFFF',
    server_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trigger to update server_updated_at on appointments
CREATE TRIGGER IF NOT EXISTS update_appointment_timestamp 
AFTER UPDATE ON appointments
BEGIN
    UPDATE appointments SET server_updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;

-- Trigger to update server_updated_at on general_notes
CREATE TRIGGER IF NOT EXISTS update_note_timestamp 
AFTER UPDATE ON general_notes
BEGIN
    UPDATE general_notes SET server_updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;

-- Backups Table
CREATE TABLE IF NOT EXISTS app_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    backup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
