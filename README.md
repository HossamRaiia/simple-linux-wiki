# Simple Wiki (Server-Side Saving)

A basic wiki website built with HTML, CSS, and vanilla JavaScript for the frontend, and a Node.js/Express backend for file management. Wiki pages are stored as `.md` (Markdown) files in the `wikis/` folder on the server.

## How it Works

-   **Client-Server:** The frontend (HTML, CSS, JS in `public/`) communicates with a Node.js backend.
-   **Backend:** The Node.js server (`server.js`) handles:
    -   Serving the static frontend files.
    -   Listing available wiki pages by reading the `wikis/` directory.
    -   Providing content for individual wiki pages.
    -   Saving new or updated wiki pages directly to the `wikis/` folder on the server.
-   **Markdown:** Pages are written in Markdown. The `marked.js` library (client-side) is used to render Markdown as HTML.
-   **Page Titles:** The server attempts to extract page titles from the first H1 tag (e.g., `# My Page Title`) in the Markdown file. If not found, it uses the filename.

## Project Structure