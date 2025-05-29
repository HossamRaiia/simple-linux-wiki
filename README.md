## Simple Wiki (MongoDB with Authentication)
A basic wiki website built with HTML, CSS, and vanilla JavaScript for the frontend, and a Node.js/Express backend. Wiki content, user information, and session data are stored in MongoDB.
Features
Hierarchical Wiki Structure: Organize wiki pages (Chapters) under Subjects (Folders).
Markdown Support: Pages are written in Markdown, rendered client-side using marked.js.
MongoDB Backend: All data (wiki items, users, sessions) is persisted in a MongoDB database.
User Authentication: Secure login system using express-session and bcryptjs for password hashing.
Role-Based Access Control:
Admin: Full control over wiki content (create, edit, delete Subjects/Chapters), user management (add, edit, delete, enable/disable users, reset passwords).
Student: Read-only access to wiki content. Can navigate Subjects and read Chapters.
User Management Interface: Admins have a dedicated page to manage users.
Drag & Drop: Admins can re-organize items in the sidebar using drag and drop.
Dynamic UI: Sidebar and content actions are dynamically shown/hidden based on user role.
How it Works
Client-Server: The frontend (HTML, CSS, JS in the public/ folder) communicates with a Node.js/Express backend.
Backend (server.js):
Serves static frontend files (index.html, login.html, users.html, CSS, client-side JS).
Handles user authentication (login, logout, session management).
Provides API endpoints for:
Managing wiki items (listing, creating, fetching content, saving, deleting, renaming/moving) - protected by authentication and admin roles for write operations.
Managing users (listing, creating, updating, deleting, resetting passwords) - protected by admin roles.
Database (MongoDB):
wikiItems collection: Stores wiki pages (Chapters) and folders (Subjects). Each document includes:
path: Unique identifier for the item (e.g., subject1/chapter1.md).
name: The filename or folder name (e.g., chapter1.md, subject1).
title: User-friendly title for display.
description: Optional description.
content: Markdown content for pages (files).
type: 'file' or 'directory'.
parentPath: Path of the parent item ('.' for root items).
createdAt, updatedAt: Timestamps.
users collection: Stores user credentials and roles.
username: Unique username.
password: Hashed password (using bcryptjs).
role: 'admin' or 'student'.
enabled: Boolean indicating if the account is active.
createdAt: Timestamp.
sessions collection: Stores active user sessions (managed by connect-mongo).
Markdown Content: Unlike a file-based system, the Markdown content for wiki pages is now stored directly within the content field of documents in the wikiItems collection in MongoDB.
Project Structure
simple-wiki-server/
├── public/                   # Frontend static assets
│   ├── images/
│   │   └── Redhat_logo.png
│   ├── index.html            # Main wiki SPA
│   ├── login.html            # Login page
│   ├── users.html            # User management page (for admins)
│   ├── style.css             # Main CSS for index.html
│   ├── login-style.css       # CSS for login.html
│   ├── users-style.css       # CSS for users.html
│   ├── script.js             # JavaScript for index.html
│   └── users-script.js       # JavaScript for users.html
│   └── login-script.js       # JavaScript for login.html
├── server.js                 # Node.js/Express backend server
├── package.json
├── package-lock.json
└── README.md
Use code with caution.
Prerequisites & Setup
Node.js and npm: Ensure Node.js (which includes npm) is installed on your system.
MongoDB:
Install MongoDB and ensure it is running.
The application connects to mongodb://localhost:27017 and uses a database named simpleWikiDB by default. You can change this via the MONGODB_URI environment variable.
Clone the repository (if applicable).
Install Dependencies:
npm install
Use code with caution.
Bash
Environment Variables (Recommended for Production):
MONGODB_URI: (Optional) Your MongoDB connection string if not using the default.
SESSION_SECRET: Crucial for production. Set this to a long, random, and unique string to secure user sessions. The application will warn you if you use the default secret in a production environment.
# Example for .env file (use a package like dotenv or set directly in your environment)
# MONGODB_URI=mongodb://user:pass@host:port/yourDbName
# SESSION_SECRET=a_very_long_random_and_secure_string_here
Use code with caution.
Bash
Running the Application
Development Mode (with nodemon for auto-restarts):
npm run dev
Use code with caution.
Bash
Production Mode:
npm start
Use code with caution.
Bash
The server will typically start on http://localhost:3000.
Default Admin User
On the first run, if no 'admin' user exists, a default admin account will be created with the following credentials:
Username: admin
Password: admin
It is highly recommended to log in and change this password immediately, especially in a shared or production environment.
User Roles
Admin: Can perform all actions:
Create, edit, delete, move Subjects (folders) and Chapters (files).
Manage users: add new users, edit existing users (role, enabled status), reset user passwords, delete users.
Student: Can only read wiki content:
View the list of Subjects and Chapters.
Open and read Chapters.
Cannot make any modifications to content or users.
