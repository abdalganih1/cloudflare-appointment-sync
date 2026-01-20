# Techno Injaz Sync Backend (Cloudflare Workers)

This is the serverless backend for the **Techno Injaz Scheduler** application. It replaces the legacy Laravel backend with a high-performance, edge-deployed Cloudflare Worker.

## 🚀 Features

*   **⚡ Cloudflare Workers**: Runs on the edge with minimal latency.
*   **💾 Cloudflare D1**: SQL database (SQLite) for storing Users, Appointments, and Notes.
*   **📦 Cloudflare R2**: Object storage for secure Mobile Backups (Upload/Download).
*   **🔄 Delta Sync Protocol**: efficient synchronization mechanism for offline-first Android apps.

## 🛠 Prerequisites

*   Node.js & npm
*   Cloudflare Account (Free tier works)
*   Wrangler CLI (`npm install -g wrangler`)

## 🏗 Setup & Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/YOUR_USERNAME/techno-injaz-sync-backend.git
    cd techno-injaz-sync-backend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Login to Cloudflare**:
    ```bash
    npx wrangler login
    ```

4.  **Create Resources**:

    *   **Database (D1)**:
        ```bash
        npx wrangler d1 create appointment-sync-db
        ```
        *Update `wrangler.toml` with the generated `database_id`.*

    *   **Storage (R2)**:
        ```bash
        npx wrangler r2 bucket create appointment-backups
        ```

5.  **Initialize Database**:
    ```bash
    npx wrangler d1 execute appointment-sync-db --file=./schema.sql --remote
    ```

## 📜 API Documentation

### Authentication
All requests must include the **App Secret Header**:
`X-App-Secret: kjsdfh34789fasdnk324789fsdkjfh238947sdf`

### Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/login` | User login (returns token) | `X-App-Secret` |
| `POST` | `/api/sync` | Delta Sync (Push/Pull changes) | `Bearer Token` |
| `POST` | `/api/upload` | Upload Backup File (Multipart) | `Bearer Token` |
| `GET` | `/api/list` | List detailed backups | `Bearer Token` |
| `GET` | `/api/backup/:id/download` | Download specific backup | `Bearer Token` |

## 🚀 Deployment

To deploy changes to production:

```bash
npx wrangler deploy
```

## 📂 Project Structure

*   `src/index.js`: Main application logic (Routing, Auth, Sync, R2).
*   `schema.sql`: Database structure (Tables & Triggers).
*   `wrangler.toml`: Cloudflare configuration (Bindings).

## 🔒 Security Note

The `APP_SECRET` is currently hardcoded for simplicity. For higher security, consider using `wrangler secret put APP_SECRET`.
