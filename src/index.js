/**
 * Techno Injaz Scheduler Backend (Cloudflare Worker + D1)
 * Handles Delta Sync Protocol for Appointments and General Notes.
 */

const APP_SECRET = "kjsdfh34789fasdnk324789fsdkjfh238947sdf";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // --- PUBLIC ROUTES ---

        // GET / (Home/Download)
        if (url.pathname === '/' || url.pathname === '/download') {
            const object = await env.BUCKET.get('public/TechnoInjaz.apk');

            if (!object) {
                return new Response("APK not found", { status: 404 });
            }

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            headers.set('Content-Type', 'application/vnd.android.package-archive');
            headers.set('Content-Disposition', 'attachment; filename="TechnoInjaz.apk"');

            return new Response(object.body, { headers });
        }

        // 1. Verify App Secret
        const secret = request.headers.get("X-App-Secret");
        if (secret !== APP_SECRET) {
            return new Response(JSON.stringify({ error: "Unauthorized Application" }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            // LOGIN ROUTE
            if (url.pathname === '/api/login' && request.method === 'POST') {
                const { username, password } = await request.json();
                const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
                    .bind(username, password)
                    .first();

                if (!user) {
                    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({
                    user: { id: user.id, username: user.username, color_code: user.color_code },
                    token: `mock_token_${user.id}_${Date.now()}`
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // AUTH CHECK FOR OTHER ROUTES
            const authHeader = request.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return new Response(JSON.stringify({ error: "Token missing" }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            // Mock extract user_id from token (e.g. "mock_token_1_...")
            const token = authHeader.replace("Bearer ", "");
            const userId = parseInt(token.split("_")[2]);

            // SYNC ROUTE
            if (url.pathname === '/api/sync' && request.method === 'POST') {
                const body = await request.json();
                const lastSync = body.last_sync_timestamp || "1970-01-01 00:00:00";
                const changes = body.changes || {};

                const responseChanges = {
                    appointments: { created: [], updated: [], deleted: [] },
                    general_notes: { created: [], updated: [], deleted: [] }
                };

                // --- PROCESS INCOMING CHANGES (Client -> Server) ---

                // Appointments
                if (changes.appointments) {
                    // Created
                    for (const item of (changes.appointments.created || [])) {
                        const result = await env.DB.prepare(
                            "INSERT INTO appointments (user_id, title, appointment_date, start_time, duration_minutes, notes, recurrence_type) VALUES (?, ?, ?, ?, ?, ?, ?)"
                        ).bind(userId, item.title, item.appointment_date, item.start_time, item.duration_minutes, item.notes, item.recurrence_type).run();

                        if (result.success) {
                            responseChanges.appointments.created.push({ temp_id: item.id, server_id: result.meta.last_row_id });
                        }
                    }
                    // Updated
                    for (const item of (changes.appointments.updated || [])) {
                        await env.DB.prepare(
                            "UPDATE appointments SET title = ?, appointment_date = ?, start_time = ?, duration_minutes = ?, notes = ?, recurrence_type = ? WHERE id = ? AND user_id = ?"
                        ).bind(item.title, item.appointment_date, item.start_time, item.duration_minutes, item.notes, item.recurrence_type, item.id, userId).run();
                    }
                    // Deleted
                    for (const id of (changes.appointments.deleted || [])) {
                        await env.DB.prepare("DELETE FROM appointments WHERE id = ? AND user_id = ?").bind(id, userId).run();
                    }
                }

                // General Notes
                if (changes.general_notes) {
                    for (const item of (changes.general_notes.created || [])) {
                        const result = await env.DB.prepare(
                            "INSERT INTO general_notes (user_id, title, content, color_code) VALUES (?, ?, ?, ?)"
                        ).bind(userId, item.title, item.content, item.color_code).run();
                        if (result.success) {
                            responseChanges.general_notes.created.push({ temp_id: item.id, server_id: result.meta.last_row_id });
                        }
                    }
                    for (const item of (changes.general_notes.updated || [])) {
                        await env.DB.prepare(
                            "UPDATE general_notes SET title = ?, content = ?, color_code = ? WHERE id = ? AND user_id = ?"
                        ).bind(item.title, item.content, item.color_code, item.id, userId).run();
                    }
                    for (const id of (changes.general_notes.deleted || [])) {
                        await env.DB.prepare("DELETE FROM general_notes WHERE id = ? AND user_id = ?").bind(id, userId).run();
                    }
                }

                // --- FETCH OUTGOING CHANGES (Server -> Client) ---

                // Fetch updated/created items since last sync - Shared visibility (no user_id filter)
                const serverAppsResults = await env.DB.prepare(
                    `SELECT a.*, u.username, u.color_code 
                     FROM appointments a 
                     JOIN users u ON a.user_id = u.id 
                     WHERE a.server_updated_at > ?`
                ).bind(lastSync).all();

                // Transform into expected format: { ..., user: { id, username, color_code } }
                responseChanges.appointments.updated = serverAppsResults.results.map(row => ({
                    id: row.id,
                    user_id: row.user_id,
                    title: row.title,
                    appointment_date: row.appointment_date,
                    start_time: row.start_time,
                    duration_minutes: row.duration_minutes,
                    notes: row.notes,
                    recurrence_type: row.recurrence_type,
                    server_updated_at: row.server_updated_at,
                    user: {
                        id: row.user_id,
                        username: row.username,
                        color_code: row.color_code
                    }
                }));

                const serverNotes = await env.DB.prepare(
                    "SELECT * FROM general_notes WHERE server_updated_at > ?"
                ).bind(lastSync).all();
                responseChanges.general_notes.updated = serverNotes.results;

                return new Response(JSON.stringify({
                    status: "success",
                    timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
                    changes: responseChanges
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // --- BACKUP ROUTES ---

            // POST /api/upload
            if (url.pathname === '/api/upload' && request.method === 'POST') {
                const formData = await request.formData();
                const file = formData.get('backup_file');
                const notes = formData.get('notes') || '';

                if (!file) {
                    return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
                }

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const key = `backup_${timestamp}.db`;

                // Upload to R2
                await env.BUCKET.put(key, file);

                // Save metadata to D1
                const result = await env.DB.prepare(
                    "INSERT INTO app_backups (file_path, file_size, notes) VALUES (?, ?, ?)"
                ).bind(key, file.size, notes).run();

                return new Response(JSON.stringify({
                    message: "Backup uploaded successfully",
                    file_path: key
                }), {
                    status: 201,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // GET /api/list
            if (url.pathname === '/api/list' && request.method === 'GET') {
                const backups = await env.DB.prepare(
                    "SELECT * FROM app_backups ORDER BY backup_date DESC"
                ).all();

                return new Response(JSON.stringify(backups.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // GET /api/backup/{id}/download
            // Route match: /api/backup/123/download
            const downloadMatch = url.pathname.match(/\/api\/backup\/(\d+)\/download/);
            if (downloadMatch && request.method === 'GET') {
                const id = downloadMatch[1];
                const backup = await env.DB.prepare("SELECT * FROM app_backups WHERE id = ?").bind(id).first();

                if (!backup) {
                    return new Response("Backup not found", { status: 404 });
                }

                const object = await env.BUCKET.get(backup.file_path);
                if (!object) {
                    return new Response("File not found in storage", { status: 404 });
                }

                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                headers.set('Content-Disposition', `attachment; filename="${backup.file_path}"`);

                return new Response(object.body, { headers });
            }

            return new Response("Not Found", { status: 404, headers: corsHeaders });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
