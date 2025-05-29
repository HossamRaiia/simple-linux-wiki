const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const fs = require('fs'); // For checking if static files exist

const app = express();
const port = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- MongoDB Configuration ---
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'simpleWikiDB';
const itemsCollectionName = 'wikiItems';
const usersCollectionName = 'users';
let db;
let itemsCollection;
let usersCollection;

// --- Session Configuration ---
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-very-strong-session-secret-key-CHANGE-ME-PLEASE';
if (SESSION_SECRET === 'your-very-strong-session-secret-key-CHANGE-ME-PLEASE' && process.env.NODE_ENV === 'production') {
    console.warn('\x1b[31m%s\x1b[0m', 'WARNING: Default SESSION_SECRET is used in production. Please generate and set a strong, unique secret in your environment variables!');
}

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoUri,
        dbName: dbName,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60 // Session TTL: 14 days
    }),
    cookie: {
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        sameSite: 'lax'
    }
}));

async function connectToMongoAndSetup() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db(dbName);
        itemsCollection = db.collection(itemsCollectionName);
        usersCollection = db.collection(usersCollectionName);
        console.log('Successfully connected to MongoDB.');

        await itemsCollection.createIndex({ path: 1 }, { unique: true });
        await itemsCollection.createIndex({ parentPath: 1 });
        await usersCollection.createIndex({ username: 1 }, { unique: true });

        await ensureWelcomePage();
        await ensureDefaultAdmin();

    } catch (err) {
        console.error('Failed to connect to MongoDB or setup initial data:', err);
        process.exit(1);
    }
}

async function ensureDefaultAdmin() {
    const adminUsername = 'admin';
    try {
        const existingAdmin = await usersCollection.findOne({ username: adminUsername });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            await usersCollection.insertOne({
                username: adminUsername, password: hashedPassword, role: 'admin',
                enabled: true, createdAt: new Date()
            });
            console.log('Default admin user (admin/admin) created.');
        }
    } catch (error) { console.error('Error ensuring default admin user:', error); }
}

async function ensureWelcomePage() {
    const welcomePagePath = 'welcome.md';
    try {
        const existingWelcomePage = await itemsCollection.findOne({ path: welcomePagePath });
        if (!existingWelcomePage) {
            await itemsCollection.insertOne({
                path: welcomePagePath, name: 'welcome.md', title: 'Welcome to Your Wiki!',
                description: 'The first page of your new wiki. Click to edit!',
                content: "# Welcome to Your Wiki!\n\nThis is the first page. You can edit its content, title, or description if you are an admin.\n\n## Features\n\n*   Create, edit, and delete pages and folders (Admin).\n*   Read-only access for Students.\n*   Organize items hierarchically.\n*   User authentication and roles.\n*   Data is stored in MongoDB.\n\nUse the controls in the sidebar to manage your wiki structure.",
                type: 'file', parentPath: '.', createdAt: new Date(), updatedAt: new Date(),
            });
            console.log("Created default welcome.md in database.");
        }
    } catch (error) { console.error("Error ensuring welcome page:", error); }
}

const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    // For API calls, send JSON. For browser navigation, redirect (handled by app.get('*'))
    if (req.accepts('html')) { // Check if the request prefers HTML (browser navigation)
        return res.redirect('/login');
    }
    res.status(401).json({ message: 'Unauthorized. Please log in.' });
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).json({ message: 'Forbidden. Admin access required.' });
};

function generateNameFromTitle(title, type) {
    if (!title || typeof title !== 'string' || title.trim() === '') title = (type === 'file' ? 'untitled_page' : 'new_folder');
    let name = title.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '');
    if (name === '.' || name === '..' || name === '') name = (type === 'file' ? 'untitled_page' : 'new_folder');
    if (type === 'file') { if (!name.endsWith('.md')) name += '.md'; } 
    else { if (name.endsWith('.md')) name = name.substring(0, name.length - 3); }
    return name.substring(0, 100); 
}
function isValidDbPathSegment(segment) {
    if (!segment || typeof segment !== 'string') return false;
    if (segment === '.' || segment === '..') return false; 
    if (segment.length > 100) return false;
    const validPattern = /^[a-z0-9_.-]+$/; 
    if (!validPattern.test(segment)) return false;
    if (segment === ".md" && segment.length === 3) return false;
    return true;
}
function constructItemPath(parentPath, itemName) {
    if (parentPath === '.' || parentPath === '/' || !parentPath) return itemName;
    return `${parentPath.replace(/\/$/, '')}/${itemName}`;
}

app.use(bodyParser.json());
app.use(express.static(PUBLIC_DIR)); // Serve static files from public directory first

// --- Auth API ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
    try {
        const user = await usersCollection.findOne({ username });
        if (!user || !user.enabled || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid username or password, or account disabled.' });
        }
        req.session.regenerate(err => {
            if (err) { console.error("Session regeneration error:", err); return res.status(500).json({ message: "Login error."}); }
            req.session.user = { id: user._id.toString(), username: user.username, role: user.role };
            res.json({ message: 'Login successful.', user: { username: user.username, role: user.role }});
        });
    } catch (error) { console.error('Login error:', error); res.status(500).json({ message: 'Server error during login.' }); }
});
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { console.error('Logout error:', err); return res.status(500).json({ message: 'Logout failed.' }); }
        res.clearCookie('connect.sid'); res.json({ message: 'Logout successful.' });
    });
});
app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.user) res.json({ isAuthenticated: true, user: { username: req.session.user.username, role: req.session.user.role }});
    else res.json({ isAuthenticated: false, user: null });
});

// --- User Management API ---
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        res.json(users);
    } catch (error) { console.error("Error fetching users:", error); res.status(500).json({ message: "Error fetching users." }); }
});
app.post('/api/users', isAuthenticated, isAdmin, async (req, res) => { 
    const { username, password, role, enabled } = req.body;
    if (!username || !password || !role || !['admin', 'student'].includes(role)) return res.status(400).json({ message: "Valid username, password, and role are required." });
    try {
        if (await usersCollection.findOne({ username })) return res.status(409).json({ message: "Username already exists." });
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await usersCollection.insertOne({ username, password: hashedPassword, role, enabled: typeof enabled === 'boolean' ? enabled : true, createdAt: new Date() });
        const createdUser = await usersCollection.findOne({ _id: result.insertedId }, { projection: { password: 0 } });
        res.status(201).json({ message: "User created successfully.", user: createdUser });
    } catch (error) { console.error("Error creating user:", error); res.status(500).json({ message: "Error creating user." }); }
});
app.put('/api/users/:userId', isAuthenticated, isAdmin, async (req, res) => { 
    const { userId } = req.params; const { role, enabled } = req.body;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ message: "Invalid user ID."});
    const updateData = {};
    if (role !== undefined) { if (!['admin', 'student'].includes(role)) return res.status(400).json({ message: "Invalid role." }); updateData.role = role; }
    if (enabled !== undefined && typeof enabled === 'boolean') updateData.enabled = enabled;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ message: "No valid fields to update." });
    updateData.updatedAt = new Date();
    try {
        const userToUpdate = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!userToUpdate) return res.status(404).json({ message: "User not found." });
        if ((userToUpdate.username === 'admin' || userToUpdate._id.toString() === req.session.user.id) && (updateData.role === 'student' || updateData.enabled === false) ) {
            const adminCount = await usersCollection.countDocuments({ role: 'admin', enabled: true });
             if (adminCount <= 1) {
                return res.status(403).json({ message: "Cannot disable or demote the last enabled admin." });
            }
        }
        const result = await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: updateData });
        if (result.matchedCount === 0) return res.status(404).json({ message: "User not found." });
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } });
        res.json({ message: "User updated.", user: updatedUser });
    } catch (error) { console.error("Error updating user:", error); res.status(500).json({ message: "Error updating user." }); }
});
app.put('/api/users/:userId/reset-password', isAuthenticated, isAdmin, async (req, res) => {
    const { userId } = req.params; const { newPassword } = req.body;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ message: "Invalid user ID."});
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const result = await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { password: hashedPassword, updatedAt: new Date() } });
        if (result.matchedCount === 0) return res.status(404).json({ message: "User not found." });
        res.json({ message: "Password reset." });
    } catch (error) { console.error("Error resetting password:", error); res.status(500).json({ message: "Error resetting password." }); }
});
app.delete('/api/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const { userId } = req.params;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ message: "Invalid user ID."});
    try {
        const userToDelete = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!userToDelete) return res.status(404).json({ message: "User not found." });
        if ((userToDelete.username === 'admin' || userToDelete._id.toString() === req.session.user.id) ) {
             const adminCount = await usersCollection.countDocuments({ role: 'admin', enabled: true });
             if (adminCount <= 1 && userToDelete.role === 'admin') { // Only restrict if it's an admin and the last one
                return res.status(403).json({ message: "Cannot delete the last enabled admin." });
             }
        }
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
        if (result.deletedCount === 0) return res.status(404).json({ message: "User not found." });
        res.json({ message: "User deleted." });
    } catch (error) { console.error("Error deleting user:", error); res.status(500).json({ message: "Error deleting user." }); }
});

// --- Wiki Content API ---
app.get('/api/pages', isAuthenticated, async (req, res) => { 
    try {
        const allItems = await itemsCollection.find({}).sort({ parentPath: 1, type: 1, name: 1 }).toArray();
        const tree = []; const map = {}; 
        allItems.forEach(item => { const dI = { ...item, id: item._id.toString() }; map[dI.path] = dI; dI.children = []; });
        allItems.forEach(item => { const dI=map[item.path]; if(item.parentPath&&item.parentPath!=='.'&&map[item.parentPath])map[item.parentPath].children.push(dI);else if(item.parentPath==='.'||!item.parentPath)tree.push(dI);});
        const sortFn=(i)=>{i.sort((a,b)=>(a.type===b.type?(a.title||a.name).localeCompare(b.title||b.name):(a.type==='directory'?-1:1)));i.forEach(it=>{if(it.children.length>0)sortFn(it.children)})};sortFn(tree);
        res.json(tree);
    } catch (e) { console.error("Error listing wiki tree:", e); res.status(500).json({ message: 'Error listing structure' }); }
});
app.get('/api/page/:filepath(*)', isAuthenticated, async (req, res) => { 
    const p=req.params.filepath; if(!p)return res.status(400).json({message:'Filepath required.'}); // Corrected 'm' to 'message'
    try{const i=await itemsCollection.findOne({path:p,type:'file'});if(!i)return res.status(404).json({message:'Page not found.'});res.json({path:i.path,title:i.title,description:i.description,content:i.content,parentPath:i.parentPath});}
    catch(e){console.error(`Error reading page ${p}:`, e); res.status(500).json({message:'Error reading page.'});} // Corrected 'm' to 'message'
});
app.post('/api/save', isAuthenticated, isAdmin, async (req, res) => { 
    const{itemPathToUpdate:iPU,parentPath:pP,title:t,description:d,content:c}=req.body;if(typeof c!=='string')return res.status(400).json({message:'Content required.'});if(!t||typeof t!=='string'||t.trim()==='')return res.status(400).json({message:'Title required.'});if(!iPU&&(pP===undefined||typeof pP!=='string'))return res.status(400).json({message:'parentPath required.'});
    const iN=generateNameFromTitle(t,'file');const fIP=iPU?iPU:constructItemPath(pP,iN);const pS=fIP.split('/');for(const s of pS){if(!isValidDbPathSegment(s))return res.status(400).json({message:`Invalid path: '${s}'`});}
    const eP=iPU?(fIP.includes('/')?path.dirname(fIP):'.'):(pP||'.');try{const r=await itemsCollection.updateOne({path:fIP},{$set:{name:path.basename(fIP),title:t.trim(),description:d?d.trim():'',content:c,type:'file',parentPath:eP,updatedAt:new Date()}, $setOnInsert:{path:fIP,createdAt:new Date()}},{upsert:true});if(r.upsertedCount>0||r.matchedCount>0){const sI=await itemsCollection.findOne({path:fIP});res.json({message:`Page '${fIP}' saved.`,path:fIP,title:sI.title,name:sI.name});}else{throw new Error("Save op no change.");}}catch(e){console.error(`Error saving page ${fIP}:`, e);if(e.code===11000)return res.status(409).json({message:`Item '${fIP}' exists.`});res.status(500).json({message:'Error saving.'});}
});
app.post('/api/directory', isAuthenticated, isAdmin, async (req, res) => { 
    const{parentPath:pP,title:t,description:d}=req.body;if(!t||typeof t!=='string'||t.trim()==='')return res.status(400).json({message:'Title required.'});if(pP===undefined||typeof pP!=='string')return res.status(400).json({message:'parentPath required.'});
    const dN=generateNameFromTitle(t,'directory');const dP=constructItemPath(pP,dN);const pS=dP.split('/');for(const s of pS){if(!isValidDbPathSegment(s))return res.status(400).json({message:`Invalid path: '${s}'`});}
    try{if(await itemsCollection.findOne({path:dP}))return res.status(409).json({message:`Item '${dP}' exists.`});await itemsCollection.insertOne({path:dP,name:dN,title:t.trim(),description:d?d.trim():'',type:'directory',parentPath:pP.trim()||'.',createdAt:new Date(),updatedAt:new Date()});res.json({message:`Dir '${dP}' created.`,path:dP,title:t.trim(),name:dN});}catch(e){console.error(`Error creating directory ${dP}:`, e);if(e.code===11000)return res.status(409).json({message:`Item '${dP}' exists.`});res.status(500).json({message:'Error creating dir.'});}
});
app.delete('/api/item/:filepath(*)', isAuthenticated, isAdmin, async (req, res) => { 
    const p=req.params.filepath;if(!p)return res.status(400).json({message:'Filepath required.'});if(p==='.'||p==='/')return res.status(403).json({message:'Cannot delete root.'});
    try{const iTD=await itemsCollection.findOne({path:p});if(!iTD)return res.status(404).json({message:'Not found.'});if(iTD.path==='welcome.md'&&(await itemsCollection.countDocuments({type:'file'}))===1)return res.status(403).json({message:"Cannot delete last page 'welcome.md'."});if(iTD.type==='directory'){const r=await itemsCollection.deleteMany({$or:[{path:p},{path:{$regex:`^${p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/`}}]});res.json({message:`Dir '${p}' & ${r.deletedCount-1} contents deleted.`});}else{await itemsCollection.deleteOne({path:p});res.json({message:`File '${p}' deleted.`});}}catch(e){console.error(`Error deleting item ${p}:`, e); res.status(500).json({message:'Error deleting.'});}
});
app.put('/api/rename', isAuthenticated, isAdmin, async (req, res) => { 
    const{oldPath:oP,newParentPath:nPP,newTitle:nT,newDescription:nD}=req.body;if(!oP||!nPP||!nT)return res.status(400).json({message:'Required fields missing.'});if(oP==='.'||oP==='/')return res.status(403).json({message:'Cannot mod root.'});
    try{const iTR=await itemsCollection.findOne({path:oP});if(!iTR)return res.status(404).json({message:`'${oP}' not found.`});const nN=generateNameFromTitle(nT,iTR.type);const nP=constructItemPath(nPP,nN);const nPS=nP.split('/');for(const s of nPS){if(!isValidDbPathSegment(s))return res.status(400).json({message:`Invalid new path: '${s}'`});}
    if(oP===nP){await itemsCollection.updateOne({path:oP},{$set:{title:nT.trim(),description:nD!==undefined?nD.trim():iTR.description,updatedAt:new Date()}});return res.json({message:`Item '${oP}' meta updated.`,newPath:oP,oldPath:oP,title:nT.trim()});} // Corrected 't' to 'title'
    if(await itemsCollection.findOne({path:nP}))return res.status(409).json({message:`Item '${nP}' exists.`});if(iTR.type==='directory'){const c=await itemsCollection.find({path:{$regex:`^${oP.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/`}}).toArray();const bO=c.map(ch=>({updateOne:{filter:{_id:ch._id},update:{$set:{path:ch.path.replace(oP,nP),parentPath:path.dirname(ch.path.replace(oP,nP)),updatedAt:new Date()}}}}));if(bO.length>0)await itemsCollection.bulkWrite(bO);}
    await itemsCollection.updateOne({path:oP},{$set:{path:nP,name:nN,parentPath:nPP.trim()||'.',title:nT.trim(),description:nD!==undefined?nD.trim():iTR.description,updatedAt:new Date()}});res.json({message:`Item '${oP}' to '${nP}'.`,newPath:nP,oldPath:oP,title:nT.trim()});}catch(e){console.error(`Error rename/move from ${oP} to ${nP}:`, e);if(e.code===11000)return res.status(409).json({message:`Path '${nP}' exists.`});res.status(500).json({message:`Error rename/move: ${e.message}`});}
});

// --- Serve SPA, User Management, and Login Page ---
app.get('/admin/users', isAuthenticated, isAdmin, (req, res) => { // Serve users.html for admins
    res.sendFile(path.join(PUBLIC_DIR, 'users.html'));
});
app.get('/login', (req, res) => { // Serve login.html
    if (req.session && req.session.user) return res.redirect('/');
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// Main app catch-all
app.get('*', (req, res, next) => {
    // API calls should have been handled by now
    if (req.path.startsWith('/api/')) return next();

    // If not authenticated
    if (!req.session || !req.session.user) {
        // Allow access to login page and its specific assets without redirect loop
        if (req.path === '/login.html' || req.path === '/login-style.css' || req.path === '/login-script.js' || req.path.startsWith('/images/')) {
            // express.static will handle these from PUBLIC_DIR if they exist
            return next(); 
        }
        // For any other path, redirect to login
        return res.redirect('/login');
    }

    // If authenticated, try to serve specific HTML files for admin routes first
    if (req.session.user.role === 'admin') {
        if (req.path === '/admin/users.html' || req.path === '/users.html') return res.redirect('/admin/users'); // Correct route for users.html
        // Allow access to users.html assets if already on /admin/users or related paths
        if (req.path === '/users-style.css' || req.path === '/users-script.js') {
            return next(); // express.static will handle
        }
    }
    
    // For all other authenticated requests, serve the main SPA (index.html)
    // Let express.static handle specific assets like /style.css, /script.js, /images/*
    // If it's not a known static file, it should fall through to serving index.html
    const potentialFilePath = path.join(PUBLIC_DIR, req.path);
    if (req.path !== '/' && fs.existsSync(potentialFilePath) && fs.lstatSync(potentialFilePath).isFile()) {
        return res.sendFile(potentialFilePath); // Serve existing static file directly
    }
    
    // Default to serving index.html for SPA routing
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});


connectToMongoAndSetup().then(() => {
    app.listen(port, () => {
        console.log(`Simple Wiki server (MongoDB with Auth) running at http://localhost:${port}`);
        console.log(`Serving static files from: ${PUBLIC_DIR}`);
    });
}).catch(err => {
    console.error("Failed to initialize server with MongoDB:", err);
});