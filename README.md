# Simple Wiki (MongoDB with Authentication)

A dynamic and secure wiki application featuring a Node.js/Express backend and a vanilla JavaScript frontend. All wiki content, user credentials, and session information are robustly stored and managed within a MongoDB database.

## Key Features

*   **Hierarchical Content Organization:** Structure information intuitively with "Subjects" (acting as folders) containing multiple "Chapters" (wiki pages).
*   **Markdown-Powered Content:** Authors create and edit Chapters using Markdown, which is rendered on the client-side using the `marked.js` library for a rich reading experience.
*   **MongoDB Data Persistence:**
    *   Wiki items (Subjects and Chapters) are stored in a dedicated MongoDB collection.
    *   User accounts and their associated roles are managed in a separate users collection.
    *   User sessions are persisted in MongoDB for enhanced reliability and scalability, facilitated by `connect-mongo`.
*   **Secure User Authentication:**
    *   Robust login system implemented with `express-session`.
    *   Passwords are securely hashed using `bcryptjs` before database storage.
*   **Role-Based Access Control (RBAC):**
    *   **Admin Role:** Possesses full administrative privileges, including:
        *   Complete CRUD (Create, Read, Update, Delete) operations on all Subjects and Chapters.
        *   Ability to move and reorder wiki items via drag-and-drop in the sidebar.
        *   Comprehensive user management capabilities through a dedicated admin interface.
    *   **Student Role:** Granted read-only access to the wiki. Students can:
        *   Navigate through the Subject/Chapter hierarchy.
        *   View and read Chapter content.
        *   Cannot modify any wiki content or user data.
*   **Dedicated User Management Interface:**
    *   Admins can access a `/admin/users` page to:
        *   View all registered users.
        *   Add new users (assigning username, password, and role).
        *   Edit existing users (modify role and enabled/disabled status).
        *   Reset user passwords.
        *   Delete users (with safeguards for the primary admin account).
*   **Interactive Sidebar Navigation:**
    *   Displays a tree-like structure of Subjects and Chapters.
    *   Subjects can be expanded/collapsed to show or hide their Chapters.
    *   Context-sensitive action menus (via a "three-dots" icon) provide admins with quick access to manage items.
    *   Visual cues for selected items and hover states.
    *   Tooltip display for full item names if truncated by sidebar width.
*   **Dynamic UI based on User Role:**
    *   Administrative controls (e.g., "Edit Page" button, item action menus, root creation buttons, "Manage Users" link) are dynamically shown or hidden based on the logged-in user's role.
*   **Non-Blocking Notifications:** Success and error messages are displayed in a temporary notification bar in the header, providing feedback without interrupting user flow with alert dialogs.

## How it Works

*   **Client-Server Architecture:** The application follows a standard client-server model. The frontend, built with HTML, CSS, and vanilla JavaScript, resides in the `public/` directory and interacts with the backend via API calls.
*   **Backend (`server.js`):**
    *   Built with Node.js and the Express.js framework.
    *   Serves all static frontend assets (`index.html` for the main wiki, `login.html` for authentication, `users.html` for admin user management, along with their respective CSS and client-side JavaScript files).
    *   Manages user authentication, including login, logout, and session persistence using `express-session` and `connect-mongo`.
    *   Provides a RESTful API for:
        *   **Authentication:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/status`.
        *   **Wiki Content Management:** Endpoints for listing all items (`/api/pages`), fetching specific page content (`/api/page/:filepath`), creating/updating pages (`/api/save`), creating directories (`/api/directory`), deleting items (`/api/item/:filepath`), and renaming/moving items (`/api/rename`). These are protected by authentication, with write operations restricted to admins.
        *   **User Management:** Endpoints for listing users (`/api/users`), creating users (`/api/users`), updating user details (`/api/users/:userId`), resetting passwords (`/api/users/:userId/reset-password`), and deleting users (`/api/users/:userId`). These are exclusively accessible to admin users.
*   **Database (MongoDB):**
    *   **`wikiItems` Collection:** This collection stores the actual wiki content. Each document represents either a "Subject" (directory) or a "Chapter" (file/page) and includes fields such as:
        *   `path`: A unique, slash-separated string identifying the item's location in the hierarchy (e.g., `introduction/getting-started.md`).
        *   `name`: The generated filename or folder name part of the path (e.g., `getting-started.md`).
        *   `title`: The human-readable title displayed in the UI.
        *   `description` (optional): A brief summary of the item.
        *   `content` (for Chapters): The Markdown source of the page.
        *   `type`: Either 'file' (for Chapters) or 'directory' (for Subjects).
        *   `parentPath`: The `path` of the parent Subject, or `.` for root-level items.
        *   `createdAt`, `updatedAt`: Timestamps for record creation and last modification.
    *   **`users` Collection:** This collection manages user accounts. Each document contains:
        *   `username`: The unique login identifier for the user.
        *   `password`: The user's password, securely hashed using `bcryptjs`.
        *   `role`: A string indicating the user's role ('admin' or 'student').
        *   `enabled`: A boolean flag to activate or deactivate the user account.
        *   `createdAt`: Timestamp of user account creation.
    *   **`sessions` Collection:** Automatically managed by `connect-mongo` to store active user session data, enabling persistence across server restarts.
*   **Markdown Storage & Rendering:** The Markdown content for each Chapter is stored directly as a string within the `content` field of its corresponding document in the `wikiItems` MongoDB collection. Client-side JavaScript fetches this content and uses the `marked.js` library to parse and render it as HTML for display.

## Project Structure

simple-wiki-server/
├── public/ # Contains all client-side static assets</br>
│ ├── images/</br>
│ │ └── Redhat_logo.png # Logo image</br>
│ ├── index.html # Main Single Page Application (SPA) for the wiki</br>
│ ├── login.html # User login page</br>
│ ├── users.html # User management interface (for admins)</br>
│ ├── style.css # Global styles and styles for index.html</br>
│ ├── login-style.css # Specific styles for login.html</br>
│ ├── users-style.css # Specific styles for users.html</br>
│ ├── script.js # Client-side JavaScript for index.html (main wiki logic)</br>
│ ├── users-script.js # Client-side JavaScript for users.html (user management logic)</br>
│ └── login-script.js # Client-side JavaScript for login.html (login form handling)</br>
├── server.js # The core Node.js/Express backend application</br>
├── package.json # Project metadata and dependencies</br>
├── package-lock.json # Exact versions of installed dependencies</br>
└── README.md # This file</br>

## Prerequisites & Setup

To run this project locally, you will need:

1.  **Node.js and npm:** Install the latest LTS version of Node.js from [nodejs.org](https://nodejs.org/), which includes npm (Node Package Manager).
2.  **MongoDB:**
    *   Install MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community).
    *   Ensure your MongoDB instance is running (typically `mongod` service).
    *   The application defaults to connecting to `mongodb://localhost:27017` and uses a database named `simpleWikiDB`. This can be configured via the `MONGODB_URI` environment variable.
3.  **Clone the Repository (Optional):** If you have the project files from a Git repository:
    ```bash
    git clone <repository-url>
    cd simple-wiki-server
    ```
4.  **Install Project Dependencies:** Navigate to the project's root directory in your terminal and run:
    ```bash
    npm install
    ```
    This will install all necessary packages defined in `package.json` (Express, MongoDB driver, session management, bcrypt, etc.).
5.  **Environment Variables (Highly Recommended, Especially for Production):**
    Create a `.env` file in the root of the project (and ensure it's in your `.gitignore`) or set these variables directly in your deployment environment:
    *   `MONGODB_URI`: (Optional) Your full MongoDB connection string if it's different from the default (e.g., includes authentication or a remote host). Example: `MONGODB_URI=mongodb://user:password@yourhost:27017/yourdbname`
    *   `SESSION_SECRET`: **This is critical for security.** Replace the default placeholder in `server.js` with a long, complex, and random string. This secret is used to sign session ID cookies.
    ```
    # Example .env file content:
    MONGODB_URI=mongodb://localhost:27017/simpleWikiDB
    SESSION_SECRET=replace_this_with_a_very_long_and_random_secure_string_for_production
    ```
    If using a `.env` file, you might need a package like `dotenv` (`npm install dotenv`) and require it at the top of `server.js`: `require('dotenv').config();`.

## Running the Application

*   **For Development (recommended):** Uses `nodemon` to automatically restart the server when file changes are detected.
    ```bash
    npm run dev
    ```
*   **For Production:**
    ```bash
    npm start
    ```

Once started, the application will be accessible at `http://localhost:3000`.

## Default Administrator Account

Upon its first successful startup and connection to MongoDB, the application will automatically create a default administrator account if one doesn't already exist:
*   **Username:** `admin`
*   **Password:** `admin`

**Security Note:** It is imperative to log in with these default credentials immediately and then use the user management interface (`/admin/users`) to change this default password to something strong and unique.

## User Roles and Permissions

*   **Admin:**
    *   Can view all wiki content.
    *   Can create new Subjects (folders) and Chapters (pages).
    *   Can edit the title, description, and Markdown content of existing Chapters.
    *   Can edit the title and description of Subjects.
    *   Can move Subjects and Chapters within the hierarchy (including via drag-and-drop).
    *   Can delete Subjects (which also deletes all nested content) and Chapters.
    *   Can access the User Management page (`/admin/users`).
    *   Can create new users (admin or student).
    *   Can edit existing users (change role, enable/disable account).
    *   Can reset passwords for other users.
    *   Can delete users (with a safeguard against deleting the last active admin).
*   **Student:**
    *   Can view all wiki content (Subjects and Chapters).
    *   Can navigate the wiki structure.
    *   Cannot create, edit, delete, or move any wiki content.
    *   Cannot access the User Management page or perform any user administration tasks.
