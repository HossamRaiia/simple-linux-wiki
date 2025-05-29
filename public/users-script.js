document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('usersTable') ||
        !document.getElementById('addUserBtn') ||
        !document.getElementById('pageHeader') 
    ) {
        console.warn("User management script (users-script.js) is loaded on a page missing its core elements. Aborting initialization.");
        return; 
    }

    const usersTableBody = document.querySelector('#usersTable tbody');
    const addUserBtn = document.getElementById('addUserBtn');
    const logoutButtonUsersPage = document.getElementById('logoutButtonUsersPage');

    const addUserModal = document.getElementById('addUserModal');
    const editUserModal = document.getElementById('editUserModal');
    const resetPasswordModal = document.getElementById('resetPasswordModal');

    const addUserForm = document.getElementById('addUserForm');
    const editUserForm = document.getElementById('editUserForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    const notificationBar = document.getElementById('notificationBar');
    const notificationMessage = document.getElementById('notificationMessage');
    let notificationTimeout;

    function showNotification(message, type = 'success', duration = 3500) {
        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (!notificationBar || !notificationMessage) {
            console.warn("Notification elements missing on users page. Using alert.");
            alert(message); return;
        }
        notificationMessage.textContent = message;
        notificationBar.className = 'notification-bar ' + type;
        notificationBar.classList.add('show');
        notificationTimeout = setTimeout(() => notificationBar.classList.remove('show'), duration);
    }

    async function apiCallUsers(endpoint, method = 'GET', body = null) {
        const options = { method, headers: {} };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        try {
            const response = await fetch(endpoint, options);
            const responseData = await response.json().catch(() => ({ message: response.statusText || `HTTP ${response.status}` }));

            if (!response.ok) {
                const errorMessage = `API Error: ${responseData.message || `HTTP ${response.status}`}`;
                console.error(`API Call Error to ${endpoint}:`, errorMessage, responseData);
                if (response.status === 401) {
                    showNotification("Session expired or unauthorized. Redirecting to login...", "error", 2000);
                    setTimeout(() => window.location.href = '/login.html', 2000);
                } else {
                    showNotification(errorMessage, 'error', 5000);
                }
                throw new Error(errorMessage);
            }
            return responseData;
        } catch (error) {
            if (!error.message.startsWith('API Error:')) {
                const networkErrorMsg = `Network/Script Error: ${error.message || 'Unknown problem'}`;
                console.error(`Error in API call to ${endpoint}:`, networkErrorMsg, error);
                showNotification(networkErrorMsg, 'error', 5000);
            }
            throw error;
        }
    }
    
    window.closeModal = function(modalId) { // Make globally accessible for inline onclick
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'block';
    }

    async function fetchAndRenderUsers() {
        try {
            const users = await apiCallUsers('/api/users');
            if (!usersTableBody) return;
            usersTableBody.innerHTML = ''; 

            if (users && users.length > 0) {
                users.forEach(user => {
                    const row = usersTableBody.insertRow();
                    row.insertCell().textContent = user.username;
                    row.insertCell().textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
                    
                    const statusCell = row.insertCell();
                    statusCell.textContent = user.enabled ? 'Enabled' : 'Disabled';
                    statusCell.className = user.enabled ? 'status-enabled' : 'status-disabled';
                    
                    row.insertCell().textContent = new Date(user.createdAt).toLocaleDateString();

                    const actionsCell = row.insertCell();
                    actionsCell.className = 'actions-cell';

                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '✏️ Edit'; editBtn.title = "Edit Role/Status";
                    editBtn.onclick = () => openEditUserModal(user);
                    actionsCell.appendChild(editBtn);

                    const resetPassBtn = document.createElement('button');
                    resetPassBtn.innerHTML = '🔑 Reset Pass'; resetPassBtn.title = "Reset Password";
                    resetPassBtn.onclick = () => openResetPasswordModal(user);
                    actionsCell.appendChild(resetPassBtn);
                    
                    if (user.username === 'admin') { // Simplified client-side visual cue
                        const delBtn = document.createElement('button');
                        delBtn.innerHTML = '🗑️ Delete'; delBtn.title = "Cannot delete default admin";
                        delBtn.disabled = true; delBtn.style.opacity = 0.5;
                         actionsCell.appendChild(delBtn);
                    } else {
                        const delBtn = document.createElement('button');
                        delBtn.innerHTML = '🗑️ Delete'; delBtn.title = "Delete User";
                        delBtn.classList.add('delete-btn');
                        delBtn.onclick = () => handleDeleteUser(user._id, user.username);
                        actionsCell.appendChild(delBtn);
                    }
                });
            } else {
                usersTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
            if (usersTableBody) usersTableBody.innerHTML = '<tr><td colspan="5">Error loading users.</td></tr>';
        }
    }

    if (addUserBtn) addUserBtn.onclick = () => openModal('addUserModal');
    if (addUserForm) {
        addUserForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('addUsername').value;
            const password = document.getElementById('addPassword').value;
            const role = document.getElementById('addRole').value;
            const enabled = document.getElementById('addEnabled').checked;
            try {
                const result = await apiCallUsers('/api/users', 'POST', { username, password, role, enabled });
                showNotification(result.message, 'success');
                closeModal('addUserModal'); addUserForm.reset();
                fetchAndRenderUsers();
            } catch (error) { /* Handled by apiCallUsers */ }
        };
    }

    function openEditUserModal(user) {
        document.getElementById('editUserId').value = user._id;
        document.getElementById('editUsernameDisplay').textContent = user.username;
        document.getElementById('editRole').value = user.role;
        document.getElementById('editEnabled').checked = user.enabled;
        const roleSelect = document.getElementById('editRole');
        const enabledCheckbox = document.getElementById('editEnabled');
        
        roleSelect.disabled = (user.username === 'admin'); 
        enabledCheckbox.disabled = (user.username === 'admin'); 
        openModal('editUserModal');
    }
    if (editUserForm) {
        editUserForm.onsubmit = async (e) => {
            e.preventDefault();
            const userId = document.getElementById('editUserId').value;
            const role = document.getElementById('editRole').value;
            const enabled = document.getElementById('editEnabled').checked;
            try {
                const result = await apiCallUsers(`/api/users/${userId}`, 'PUT', { role, enabled });
                showNotification(result.message, 'success');
                closeModal('editUserModal'); fetchAndRenderUsers();
            } catch (error) { /* Handled */ }
        };
    }

    function openResetPasswordModal(user) {
        document.getElementById('resetPasswordUserId').value = user._id;
        document.getElementById('resetPasswordUsernameDisplay').textContent = user.username;
        document.getElementById('newPassword').value = '';
        openModal('resetPasswordModal');
    }
    if (resetPasswordForm) {
        resetPasswordForm.onsubmit = async (e) => {
            e.preventDefault();
            const userId = document.getElementById('resetPasswordUserId').value;
            const newPassword = document.getElementById('newPassword').value;
            try {
                const result = await apiCallUsers(`/api/users/${userId}/reset-password`, 'PUT', { newPassword });
                showNotification(result.message, 'success');
                closeModal('resetPasswordModal');
            } catch (error) { /* Handled */ }
        };
    }

    async function handleDeleteUser(userId, username) {
        if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) return;
        try {
            const result = await apiCallUsers(`/api/users/${userId}`, 'DELETE');
            showNotification(result.message, 'success');
            fetchAndRenderUsers();
        } catch (error) { /* Handled */ }
    }
    
    async function handleLogoutUsersPage() {
        try {
            await apiCallUsers('/api/auth/logout', 'POST');
            window.location.href = '/login.html';
        } catch (error) { /* Handled by apiCallUsers */ }
    }

    if (logoutButtonUsersPage) logoutButtonUsersPage.addEventListener('click', handleLogoutUsersPage);

    apiCallUsers('/api/auth/status').then(authData => {
        if (!authData || !authData.isAuthenticated || authData.user.role !== 'admin') {
            showNotification("Access denied. Admins only.", "error", 3000);
            setTimeout(() => window.location.href = '/login.html', 3000);
        } else {
            fetchAndRenderUsers();
        }
    }).catch(() => { /* apiCallUsers already handles notifications and redirection for critical auth failures */ });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal('addUserModal'); closeModal('editUserModal'); closeModal('resetPasswordModal');
        }
    });
});