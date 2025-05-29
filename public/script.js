document.addEventListener('DOMContentLoaded', () => {
    // Critical DOM elements check for the MAIN WIKI page
    if (!document.getElementById('pageList') || 
        !document.getElementById('welcomeMessage') ||
        !document.getElementById('viewArea') ||
        !document.getElementById('editorArea') ||
        !document.getElementById('pageHeader') 
    ) {
        console.warn("Main wiki script (script.js) is loaded on a page missing its core elements. Aborting initialization for this page.");
        return; 
    }

    const pageListElement = document.getElementById('pageList');
    const welcomeMessagePanel = document.getElementById('welcomeMessage');
    const viewAreaPanel = document.getElementById('viewArea');
    const editorAreaPanel = document.getElementById('editorArea');
    const viewPageTitleElement = document.getElementById('viewPageTitle');
    const viewPageDescriptionElement = document.getElementById('viewPageDescription');
    const viewPageContentElement = document.getElementById('viewPageContent');
    const editPageButton = document.getElementById('editPageButton'); 
    const itemPathToUpdateInput = document.getElementById('itemPathToUpdate');
    const itemParentPathInput = document.getElementById('itemParentPath');
    const pageTitleInput = document.getElementById('pageTitleInput');
    const pageDescriptionInput = document.getElementById('pageDescriptionInput');
    const pageContentInput = document.getElementById('pageContent');
    const previewContentDiv = document.getElementById('previewContent');

    const newItemModal = document.getElementById('newItemModal');
    const newItemModalTitle = document.getElementById('newItemModalTitle');
    const newItemParentPathModalInput = document.getElementById('newItemParentPathModal');
    const newItemTypeModalInput = document.getElementById('newItemTypeModal');
    const newItemTitleInput = document.getElementById('newItemTitleInput');
    const newItemDescriptionInput = document.getElementById('newItemDescriptionInput');

    const editItemModal = document.getElementById('editItemModal');
    const editItemModalTitle = document.getElementById('editItemModalTitle');
    const editItemOldPathModalInput = document.getElementById('editItemOldPathModal');
    const editItemTypeModalInput = document.getElementById('editItemTypeModal');
    const editItemNewTitleInput = document.getElementById('editItemNewTitleInput');
    const editItemNewDescriptionInput = document.getElementById('editItemNewDescriptionInput');
    const editItemNewParentPathInput = document.getElementById('editItemNewParentPathInput');

    const moveItemModal = document.getElementById('moveItemModal');
    const moveItemModalTitle = document.getElementById('moveItemModalTitle');
    const moveItemPathModalInput = document.getElementById('moveItemPathModal');
    const moveItemOriginalTitleModalInput = document.getElementById('moveItemOriginalTitleModal');
    const moveItemOriginalDescriptionModalInput = document.getElementById('moveItemOriginalDescriptionModal');
    const moveItemNewParentPathInput = document.getElementById('moveItemNewParentPathInput');

    const notificationBar = document.getElementById('notificationBar');
    const notificationMessage = document.getElementById('notificationMessage');
    let notificationTimeout;

    const logoutButton = document.getElementById('logoutButton');
    const userInfoDisplay = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const manageUsersLink = document.getElementById('manageUsersLink');
    const newRootChapterBtn = document.getElementById('newRootChapterBtn');
    const newRootSubjectBtn = document.getElementById('newRootSubjectBtn');

    let currentLoadedItemPath = null;
    let currentPageData = null;
    let expandedFolders = new Set();
    let currentSelectedItemContainer = null;
    let draggedItemData = null;
    let contextMenuElement = null;
    let fullNameTooltipElement = null;
    let currentUser = null;

    function showNotification(message, type = 'success', duration = 3500) {
        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (!notificationBar || !notificationMessage) {
            console.error("Notification elements not found in DOM!");
            alert(message); return;
        }
        notificationMessage.textContent = message;
        notificationBar.className = 'notification-bar ' + type;
        notificationBar.classList.add('show');
        notificationTimeout = setTimeout(() => notificationBar.classList.remove('show'), duration);
    }

    async function apiCall(endpoint, method = 'GET', body = null) {
        const options = { method, headers: {} };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                let errorData = { message: `HTTP error! Status: ${response.status}` };
                try { errorData = await response.json(); } 
                catch (e) { errorData.message = response.statusText || errorData.message; }
                
                const errorMessage = `API Error: ${errorData.message}`;
                console.error(`API Call Error to ${endpoint}:`, errorMessage, errorData);
                
                if (response.status === 401 && !endpoint.includes('/api/auth/status')) {
                     if (window.location.pathname !== '/login.html') {
                        showNotification("Session expired or unauthorized. Redirecting to login...", "error", 2000);
                        setTimeout(() => window.location.href = '/login.html', 2000);
                     } else {
                        showNotification(errorMessage, 'error', 5000);
                     }
                } else {
                    showNotification(errorMessage, 'error', 5000);
                }
                throw new Error(errorMessage);
            }
            if (response.status === 204 || response.headers.get("content-length") === "0") return null;
            return response.json();
        } catch (error) {
            if (!(error.message && error.message.startsWith('API Error:'))) {
                const networkErrorMsg = `Network/Script Error: ${error.message || 'Unknown problem occurred'}`;
                console.error(`Network/Script Error in API call to ${endpoint}:`, networkErrorMsg, error);
                showNotification(networkErrorMsg, 'error', 5000);
            }
            throw error;
        }
    }

    function setSelectedItemContainer(containerElement) {
        if (currentSelectedItemContainer) currentSelectedItemContainer.classList.remove('selected-item');
        if (containerElement) {
            containerElement.classList.add('selected-item');
            if (containerElement.classList.contains('item-type-directory')) {
                containerElement.classList.add('selected-subject-item'); // Specific class for selected subject
            } else if (containerElement.classList.contains('item-type-file')) {
                containerElement.classList.remove('selected-subject-item'); // Ensure it's not misapplied
            }
            currentSelectedItemContainer = containerElement;
        } else { currentSelectedItemContainer = null; }
    }

    function updateEditButtonVisibility() {
        if (editPageButton) {
            if (currentUser && currentUser.role === 'admin' && viewAreaPanel.style.display === 'block') {
                editPageButton.style.display = 'inline-block';
            } else {
                editPageButton.style.display = 'none';
            }
        }
    }

    function switchToWelcomeView() {
        if(welcomeMessagePanel) welcomeMessagePanel.style.display = 'block'; 
        if(viewAreaPanel) viewAreaPanel.style.display = 'none'; 
        if(editorAreaPanel) editorAreaPanel.style.display = 'none';
        currentPageData = null; currentLoadedItemPath = null; setSelectedItemContainer(null);
        updateEditButtonVisibility();
    }

    function switchToPageView() {
        if (!currentPageData) { switchToWelcomeView(); return; }
        if(viewPageTitleElement) viewPageTitleElement.textContent = currentPageData.title;
        if(viewPageDescriptionElement) viewPageDescriptionElement.textContent = currentPageData.description || "No description provided.";
        if(viewPageContentElement) viewPageContentElement.innerHTML = window.marked && typeof window.marked.parse === 'function' ? window.marked.parse(currentPageData.content) : currentPageData.content;
        if(viewAreaPanel) viewAreaPanel.style.display = 'block'; 
        if(welcomeMessagePanel) welcomeMessagePanel.style.display = 'none'; 
        if(editorAreaPanel) editorAreaPanel.style.display = 'none';
        updateEditButtonVisibility();
    }

    function switchToEditorView() {
        if (!currentPageData || !(currentUser && currentUser.role === 'admin')) {
            showNotification("You do not have permission to edit.", "error");
            if (viewAreaPanel && viewAreaPanel.style.display === 'block') switchToPageView(); else switchToWelcomeView();
            return;
        }
        if(itemPathToUpdateInput) itemPathToUpdateInput.value = currentPageData.path; 
        if(itemParentPathInput) itemParentPathInput.value = currentPageData.parentPath || '.';
        if(pageTitleInput) pageTitleInput.value = currentPageData.title; 
        if(pageDescriptionInput) pageDescriptionInput.value = currentPageData.description || '';
        if(pageContentInput) pageContentInput.value = currentPageData.content; 
        updatePreview(currentPageData.content);
        if(editorAreaPanel) editorAreaPanel.style.display = 'block'; 
        if(viewAreaPanel) viewAreaPanel.style.display = 'none'; 
        if(welcomeMessagePanel) welcomeMessagePanel.style.display = 'none';
    }

    function closeItemContextMenu() {
        if (contextMenuElement) {
            contextMenuElement.remove(); contextMenuElement = null;
            document.removeEventListener('click', handleClickOutsideContextMenu, true);
        }
    }

    function handleClickOutsideContextMenu(event) {
        if (contextMenuElement && !contextMenuElement.contains(event.target)) closeItemContextMenu();
    }

    function showItemContextMenu(event, item, triggerElement) {
        event.preventDefault(); event.stopPropagation();
        closeItemContextMenu();

        contextMenuElement = document.createElement('div');
        contextMenuElement.className = 'item-context-menu';
        const ul = document.createElement('ul');
        const actions = [];

        if (item.type === 'directory') {
            actions.push({ label: 'Add Chapter', icon: '📝', action: () => showNewItemDialog(item.path, 'file') });
            actions.push({ label: 'Add Sub-Subject', icon: '📚', action: () => showNewItemDialog(item.path, 'directory') });
        }
        actions.push({ label: 'Move', icon: '⇄', action: () => showMoveItemDialog(item) });
        actions.push({ label: 'Edit/Rename', icon: '✏️', action: () => showEditItemDialog(item) });
        actions.push({ label: 'Delete', icon: '🗑️', action: () => deleteItem(item.path, item.title || item.name || 'Untitled Item') });

        actions.forEach(actionItem => {
            const li = document.createElement('li');
            if (actionItem.icon) {
                const iconSpan = document.createElement('span'); iconSpan.className = 'menu-icon';
                iconSpan.innerHTML = actionItem.icon; li.appendChild(iconSpan);
            }
            li.appendChild(document.createTextNode(actionItem.label));
            li.addEventListener('click', (e) => { e.stopPropagation(); actionItem.action(); closeItemContextMenu(); });
            ul.appendChild(li);
        });

        contextMenuElement.appendChild(ul); document.body.appendChild(contextMenuElement);
        const rect = triggerElement.getBoundingClientRect();
        let top = rect.bottom + window.scrollY; let left = rect.left + window.scrollX;
        const menuRect = contextMenuElement.getBoundingClientRect();
        if (top + menuRect.height > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - menuRect.height;
        if (left + menuRect.width > window.innerWidth + window.scrollX) left = rect.right + window.scrollX - menuRect.width;
        if (top < window.scrollY) top = window.scrollY; if (left < window.scrollX) left = window.scrollX;
        contextMenuElement.style.top = `${top}px`; contextMenuElement.style.left = `${left}px`;
        setTimeout(() => document.addEventListener('click', handleClickOutsideContextMenu, true), 0);
    }

    function showFullNameTooltip(event, text) {
        removeFullNameTooltip();
        fullNameTooltipElement = document.createElement('div');
        fullNameTooltipElement.className = 'item-full-name-tooltip';
        fullNameTooltipElement.textContent = text;
        document.body.appendChild(fullNameTooltipElement);
        let top = event.clientY + 15 + window.scrollY; let left = event.clientX + 10 + window.scrollX;
        const tooltipRect = fullNameTooltipElement.getBoundingClientRect();
        if (left + tooltipRect.width > window.innerWidth + window.scrollX - 5) left = window.innerWidth + window.scrollX - tooltipRect.width - 5;
        if (top + tooltipRect.height > window.innerHeight + window.scrollY - 5) top = event.clientY - tooltipRect.height - 10 + window.scrollY;
        if (left < window.scrollX + 5) left = window.scrollX + 5; if (top < window.scrollY + 5) top = window.scrollY + 5;
        fullNameTooltipElement.style.top = `${top}px`; fullNameTooltipElement.style.left = `${left}px`;
        fullNameTooltipElement.offsetHeight; fullNameTooltipElement.classList.add('visible');
    }
    function removeFullNameTooltip() {
        if (fullNameTooltipElement) { fullNameTooltipElement.remove(); fullNameTooltipElement = null; }
    }

    function renderTree(items, parentUlElement) {
        if (!parentUlElement) { console.error("renderTree called with null parentUlElement"); return; }
        parentUlElement.innerHTML = '';
        if (!Array.isArray(items)) {
            console.error("renderTree expects 'items' to be an array, received:", items);
            if (items === null && parentUlElement === pageListElement) showNotification("Could not load wiki structure.", "error");
            return;
        }

        items.forEach(item => {
            if (!item || typeof item.path !== 'string' || typeof item.type !== 'string') {
                console.warn("Skipping invalid item in renderTree:", item); return;
            }
            const li = document.createElement('li');
            const itemContainer = document.createElement('div');
            itemContainer.className = 'item-container';
            itemContainer.classList.add(`item-type-${item.type}`); // Add class for type-specific styling
            itemContainer.dataset.itemPath = item.path; itemContainer.dataset.itemType = item.type;
            itemContainer.dataset.itemTitle = item.title || item.name || 'Untitled';
            itemContainer.dataset.itemDescription = item.description || '';
            itemContainer.dataset.itemParentPath = item.parentPath || '.';

            const nameSpanClickable = document.createElement('span');
            nameSpanClickable.className = 'item-name-clickable';
            
            itemContainer.addEventListener('mouseenter', (event) => {
                if (nameSpanClickable.scrollWidth > nameSpanClickable.clientWidth) {
                    showFullNameTooltip(event, itemContainer.dataset.itemTitle);
                }
            });
            itemContainer.addEventListener('mouseleave', removeFullNameTooltip);

            if (currentUser && currentUser.role === 'admin') {
                itemContainer.setAttribute('draggable', true);
                itemContainer.addEventListener('dragstart', (event) => handleDragStart(event, itemContainer));
                itemContainer.addEventListener('dragend', handleDragEnd);
                if (item.type === 'directory') {
                    itemContainer.addEventListener('dragover', handleDragOver);
                    itemContainer.addEventListener('dragleave', handleDragLeave);
                    itemContainer.addEventListener('drop', (event) => handleDrop(event, itemContainer));
                }
            } else { itemContainer.setAttribute('draggable', false); }

            let iconElement = null;
            if (item.type === 'directory') { // Subject / Folder
                iconElement = document.createElement('span'); iconElement.className = 'item-icon';
                iconElement.innerHTML = expandedFolders.has(item.path) ? '▼' : '►'; // Down for expanded, Right for collapsed
                if (expandedFolders.has(item.path)) iconElement.classList.add('expanded');
                nameSpanClickable.appendChild(iconElement);
            } else { // Chapter / File - no icon by default, class for padding adjustment
                nameSpanClickable.classList.add('no-icon'); 
            }
            
            nameSpanClickable.appendChild(document.createTextNode(item.title || item.name || 'Untitled Item'));
            
            if (item.type === 'file') {
                nameSpanClickable.onclick = () => loadPage(item.path);
            } else { // Directory
                nameSpanClickable.onclick = () => { toggleFolderExpansion(item, li, itemContainer, iconElement); setSelectedItemContainer(itemContainer); };
            }
            itemContainer.appendChild(nameSpanClickable);

            if (currentUser && currentUser.role === 'admin') {
                const actionsTrigger = document.createElement('button');
                actionsTrigger.className = 'item-actions-trigger'; actionsTrigger.innerHTML = '⋮'; actionsTrigger.title = "Actions";
                actionsTrigger.addEventListener('click', (event) => showItemContextMenu(event, item, actionsTrigger));
                itemContainer.appendChild(actionsTrigger);
            }
            li.appendChild(itemContainer);

            if (item.type === 'directory') {
                const childrenWrapperUl = document.createElement('ul');
                childrenWrapperUl.style.display = expandedFolders.has(item.path) ? 'block' : 'none';
                if (item.children && item.children.length > 0) {
                    const tempUlForChildren = document.createElement('ul');
                    tempUlForChildren.style.cssText = 'padding:0; margin:0; list-style:none;';
                    renderTree(item.children, tempUlForChildren);
                    while (tempUlForChildren.firstChild) childrenWrapperUl.appendChild(tempUlForChildren.firstChild);
                }
                if ((item.children && item.children.length > 0) || expandedFolders.has(item.path)) {
                     li.appendChild(childrenWrapperUl);
                }
            }
            parentUlElement.appendChild(li);
        });
    }

    function toggleFolderExpansion(item, liElement, containerElement, iconElement) {
        const ul = liElement.querySelector('ul:not(.item-context-menu ul)');
        if (ul) {
            if (ul.style.display === 'none') {
                ul.style.display = 'block'; expandedFolders.add(item.path); 
                if (iconElement) { iconElement.innerHTML = '▼'; iconElement.classList.add('expanded');}
            } else {
                ul.style.display = 'none'; expandedFolders.delete(item.path); 
                if (iconElement) { iconElement.innerHTML = '►'; iconElement.classList.remove('expanded');}
            }
        } else if (item.type === 'directory' && !ul) {
            const childrenWrapperUl = document.createElement('ul');
            childrenWrapperUl.style.display = 'block'; liElement.appendChild(childrenWrapperUl);
            expandedFolders.add(item.path); 
            if (iconElement) { iconElement.innerHTML = '▼'; iconElement.classList.add('expanded');}
        }
    }

    function setSelectedItemByPath(path) {
        const foundContainer = Array.from(pageListElement.querySelectorAll('.item-container')).find(c => c.dataset.itemPath === path);
        setSelectedItemContainer(foundContainer);
    }

    async function loadPageList() {
        try {
            const pages = await apiCall('/api/pages');
            if (pages) {
                renderTree(pages, pageListElement);
                if (currentLoadedItemPath) setSelectedItemByPath(currentLoadedItemPath);
                else if (currentSelectedItemContainer?.dataset.itemPath) setSelectedItemByPath(currentSelectedItemContainer.dataset.itemPath);
            } else { renderTree(null, pageListElement); }
        } catch (error) {
            if (error.message && !error.message.includes("Unauthorized")) {
                if(pageListElement) pageListElement.innerHTML = '<li>Error loading page list.</li>';
            }
            console.error("Failed to load page list:", error);
        }
    }

    async function loadPage(itemPath) {
        try {
            const pageDataFromServer = await apiCall(`/api/page/${itemPath}`);
            if (!pageDataFromServer) { switchToWelcomeView(); return; }
            currentPageData = pageDataFromServer; currentLoadedItemPath = itemPath;
            switchToPageView(); setSelectedItemByPath(itemPath);
        } catch (error) { switchToWelcomeView(); }
    }

    if (pageContentInput) {
        pageContentInput.addEventListener('input', (e) => updatePreview(e.target.value));
    }
    function updatePreview(markdownContent) {
        if (previewContentDiv) {
            previewContentDiv.innerHTML = window.marked && typeof window.marked.parse === 'function' ? window.marked.parse(markdownContent) : "Marked.js library not loaded.";
        }
    }

    window.savePage = async function() {
        if (!(currentUser && currentUser.role === 'admin')) {
            showNotification("You do not have permission to save.", "error"); return;
        }
        const path = itemPathToUpdateInput.value; const parentPathForNew = itemParentPathInput.value || '.';
        const title = pageTitleInput.value.trim(); const description = pageDescriptionInput.value.trim();
        const content = pageContentInput.value;
        if (!title) { showNotification('Title is required.', 'error'); return; }
        try {
            const result = await apiCall('/api/save', 'POST', { itemPathToUpdate: path, parentPath: path ? null : parentPathForNew, title, description, content });
            if (!result) throw new Error("Save operation did not return a result.");
            showNotification(result.message, 'success'); await loadPageList();
            if (result.path) loadPage(result.path); else if (path) loadPage(path);
        } catch (error) { /* Handled by apiCall */ }
    }
    window.cancelEdit = function() {
        if (currentLoadedItemPath && currentPageData) switchToPageView(); else switchToWelcomeView();
        if(pageTitleInput) pageTitleInput.value = ''; 
        if(pageDescriptionInput) pageDescriptionInput.value = ''; 
        if(pageContentInput) pageContentInput.value = ''; 
        if(previewContentDiv) previewContentDiv.innerHTML = '';
    }
    window.closeModal = function(modalId) { 
        const modal = document.getElementById(modalId); if (modal) modal.style.display = 'none'; 
    }
    window.showNewItemDialog = function(parentPath, type) {
        if (!(currentUser && currentUser.role === 'admin')) {
            showNotification("You do not have permission to create items.", "error"); return;
        }
        if(newItemParentPathModalInput) newItemParentPathModalInput.value = parentPath; 
        if(newItemTypeModalInput) newItemTypeModalInput.value = type;
        if(newItemModalTitle) newItemModalTitle.textContent = type === 'file' ? 'Create New Chapter' : 'Create New Subject';
        if(newItemTitleInput) newItemTitleInput.value = ''; 
        if(newItemDescriptionInput) newItemDescriptionInput.value = '';
        if(newItemModal) {newItemModal.style.display = 'block'; if(newItemTitleInput) newItemTitleInput.focus();}
    }
    window.handleCreateItem = async function() {
        const parentPath = newItemParentPathModalInput.value; const type = newItemTypeModalInput.value;
        const title = newItemTitleInput.value.trim(); const description = newItemDescriptionInput.value.trim();
        if (!title) { showNotification('Title is required.', 'error'); return; }
        try {
            let result;
            if (type === 'file') {
                const initialContent = `# ${title}\n\nStart writing your content here.`;
                result = await apiCall('/api/save', 'POST', { parentPath, title, description, content: initialContent });
            } else { result = await apiCall('/api/directory', 'POST', { parentPath, title, description }); }
            if (!result) throw new Error("Create operation did not return a result.");
            showNotification(result.message, 'success'); closeModal('newItemModal');
            if (type === 'directory' && result.path) expandedFolders.add(result.path);
            await loadPageList();
            if (type === 'file' && result.path) loadPage(result.path);
            else if (type === 'directory' && result.path) setSelectedItemByPath(result.path);
        } catch (error) { /* Handled by apiCall */ }
    }
    window.showEditItemDialog = function(item) {
        if (!item) { console.error("showEditItemDialog called with null item"); return; }
        if(!(currentUser && currentUser.role === 'admin')) { showNotification("Permission denied.", "error"); return;}
        if(editItemOldPathModalInput) editItemOldPathModalInput.value = item.path; 
        if(editItemTypeModalInput) editItemTypeModalInput.value = item.type;
        if(editItemModalTitle) editItemModalTitle.textContent = `Edit: ${item.title || item.name || 'Untitled'}`;
        if(editItemNewTitleInput) editItemNewTitleInput.value = item.title || ''; 
        if(editItemNewDescriptionInput) editItemNewDescriptionInput.value = item.description || '';
        if(editItemNewParentPathInput) editItemNewParentPathInput.value = item.parentPath || '.';
        if(editItemModal) {editItemModal.style.display = 'block'; if(editItemNewTitleInput) editItemNewTitleInput.focus();}
    }
    window.handleRenameItem = async function() {
        const oldPath = editItemOldPathModalInput.value; const newTitle = editItemNewTitleInput.value.trim();
        const newDescription = editItemNewDescriptionInput.value.trim(); const newParentPath = editItemNewParentPathInput.value.trim() || '.';
        if (!newTitle) { showNotification('New title is required.', 'error'); return; }
        if (!newParentPath) { showNotification('New parent path is required.', 'error'); return; }
        try {
            const result = await apiCall('/api/rename', 'PUT', { oldPath, newParentPath, newTitle, newDescription });
            if (!result) throw new Error("Rename operation did not return a result.");
            showNotification(result.message, 'success'); closeModal('editItemModal');
            await loadPageList();
            if (currentLoadedItemPath === oldPath && result.newPath) loadPage(result.newPath);
            else if (currentLoadedItemPath?.startsWith(oldPath + '/')) switchToWelcomeView();
            else if (currentLoadedItemPath === result.newPath) loadPage(result.newPath);
            else if (result.newPath) setSelectedItemByPath(result.newPath);
        } catch (error) { /* Handled by apiCall */ }
    }
    window.showMoveItemDialog = function(item) {
        if (!item) { console.error("showMoveItemDialog called with null item"); return; }
        if(!(currentUser && currentUser.role === 'admin')) { showNotification("Permission denied.", "error"); return;}
        if(moveItemPathModalInput) moveItemPathModalInput.value = item.path; 
        if(moveItemOriginalTitleModalInput) moveItemOriginalTitleModalInput.value = item.title || item.name || 'Untitled';
        if(moveItemOriginalDescriptionModalInput) moveItemOriginalDescriptionModalInput.value = item.description || '';
        if(moveItemModalTitle) moveItemModalTitle.textContent = `Move "${item.title || item.name || 'Untitled'}"`;
        if(moveItemNewParentPathInput) moveItemNewParentPathInput.value = item.parentPath || '.';
        if(moveItemModal) {moveItemModal.style.display = 'block'; if(moveItemNewParentPathInput) moveItemNewParentPathInput.focus();}
    }
    window.handleMoveItemConfirm = async function() {
        const itemPath = moveItemPathModalInput.value; const newParentPath = moveItemNewParentPathInput.value.trim() || '.';
        const originalTitle = moveItemOriginalTitleModalInput.value; const originalDescription = moveItemOriginalDescriptionModalInput.value;
        if (!newParentPath) { showNotification('New parent path is required.', 'error'); return; }
        const itemBeingMoved = Array.from(pageListElement.querySelectorAll('.item-container')).find(el => el.dataset.itemPath === itemPath);
        const currentParentPath = itemBeingMoved ? itemBeingMoved.dataset.itemParentPath : '.';
        if (newParentPath === currentParentPath) { showNotification("Item is already in this folder/subject.", 'error', 2000); closeModal('moveItemModal'); return; }
        if (itemPath === newParentPath || newParentPath.startsWith(itemPath + '/')) { showNotification("Cannot move an item into itself or one of its sub-items.", 'error'); return; }
        try {
            const result = await apiCall('/api/rename', 'PUT', { oldPath: itemPath, newParentPath: newParentPath, newTitle: originalTitle, newDescription: originalDescription });
            if (!result) throw new Error("Move operation did not return a result.");
            showNotification(result.message, 'success'); closeModal('moveItemModal');
            await loadPageList();
            if (currentLoadedItemPath === itemPath && result.newPath) loadPage(result.newPath);
            else if (result.newPath) setSelectedItemByPath(result.newPath);
        } catch (error) { /* Handled by apiCall */ }
    }
    window.deleteItem = async function(itemPath, itemName) {
        if(!(currentUser && currentUser.role === 'admin')) { showNotification("Permission denied.", "error"); return;}
        if (!confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) return;
        try {
            const result = await apiCall(`/api/item/${itemPath}`, 'DELETE');
            if (!result) throw new Error("Delete operation did not return a result.");
            showNotification(result.message, 'success');
            await loadPageList();
            if (currentLoadedItemPath === itemPath || currentLoadedItemPath?.startsWith(itemPath + '/')) switchToWelcomeView();
        } catch (error) { /* Handled by apiCall */ }
    }

    function handleDragStart(event, itemContainerElement) {
        if (!itemContainerElement) return;
        draggedItemData = { path: itemContainerElement.dataset.itemPath, title: itemContainerElement.dataset.itemTitle, description: itemContainerElement.dataset.itemDescription, type: itemContainerElement.dataset.itemType, parentPath: itemContainerElement.dataset.itemParentPath };
        event.dataTransfer.setData('text/plain', draggedItemData.path); event.dataTransfer.effectAllowed = 'move';
        itemContainerElement.classList.add('dragging-item');
    }
    function handleDragEnd(event) {
        const container = event.target.closest('.item-container');
        if(container) container.classList.remove('dragging-item');
        document.querySelectorAll('.drag-over-folder').forEach(el => el.classList.remove('drag-over-folder'));
        draggedItemData = null; removeFullNameTooltip();
    }
    function handleDragOver(event) {
        event.preventDefault();
        const targetContainer = event.target.closest('.item-container');
        if (!targetContainer || !draggedItemData) return;
        const targetPath = targetContainer.dataset.itemPath; const targetType = targetContainer.dataset.itemType;
        if (targetType !== 'directory') { event.dataTransfer.dropEffect = 'none'; return; }
        if (draggedItemData.path === targetPath || targetPath.startsWith(draggedItemData.path + '/')) { event.dataTransfer.dropEffect = 'none'; return; }
        if (draggedItemData.parentPath === targetPath) { event.dataTransfer.dropEffect = 'none'; return; }
        event.dataTransfer.dropEffect = 'move'; targetContainer.classList.add('drag-over-folder');
    }
    function handleDragLeave(event) {
        const targetContainer = event.target.closest('.item-container');
        if (targetContainer) targetContainer.classList.remove('drag-over-folder');
    }
    async function handleDrop(event, targetContainerElement) {
        event.preventDefault(); 
        if (!targetContainerElement) return;
        targetContainerElement.classList.remove('drag-over-folder');
        if (!draggedItemData) return;
        const targetFolderPath = targetContainerElement.dataset.itemPath; const targetFolderType = targetContainerElement.dataset.itemType;
        if (targetFolderType !== 'directory') { draggedItemData = null; return; }
        if (draggedItemData.path === targetFolderPath || targetFolderPath.startsWith(draggedItemData.path + '/')) { showNotification("Cannot move an item into itself or one of its sub-items.", 'error'); draggedItemData = null; return; }
        if (draggedItemData.parentPath === targetFolderPath) { draggedItemData = null; return; }
        try {
            const result = await apiCall('/api/rename', 'PUT', { oldPath: draggedItemData.path, newParentPath: targetFolderPath, newTitle: draggedItemData.title, newDescription: draggedItemData.description });
            if (!result) throw new Error("Drop (move) operation did not return a result.");
            showNotification(result.message, 'success');
            await loadPageList();
            if (currentLoadedItemPath === draggedItemData.path && result.newPath) loadPage(result.newPath);
            else if (result.newPath) setSelectedItemByPath(result.newPath);
        } catch (error) { /* apiCall handles error notification */ }
        draggedItemData = null;
    }

    async function checkAuthStatus() {
        try {
            const data = await apiCall('/api/auth/status');
            if (data && data.isAuthenticated) {
                currentUser = data.user;
                if (userInfoDisplay) userInfoDisplay.style.display = 'inline';
                if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
                if (userRoleDisplay) userRoleDisplay.textContent = currentUser.role;
                if (logoutButton) logoutButton.style.display = 'inline-block';

                const isAdminUser = currentUser.role === 'admin';
                if (manageUsersLink) manageUsersLink.style.display = isAdminUser ? 'inline-block' : 'none';
                if (newRootChapterBtn) newRootChapterBtn.style.display = isAdminUser ? 'flex' : 'none';
                if (newRootSubjectBtn) newRootSubjectBtn.style.display = isAdminUser ? 'flex' : 'none';
                
                updateEditButtonVisibility();
                loadPageList();
            } else {
                currentUser = null;
                if (window.location.pathname !== '/login.html') window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error checking auth status on main page:', error);
            currentUser = null;
             if (window.location.pathname !== '/login.html' && !(error.message && error.message.includes("Unauthorized"))) {
                 // showNotification("Could not verify authentication status. Please try logging in.", "error");
                 // setTimeout(() => window.location.href = '/login.html', 2500);
             } else if (!error.message.includes("Unauthorized") && window.location.pathname === '/login.html') {
                showNotification("Could not verify authentication status.", "error");
             }
        }
    }

    async function handleLogout() {
        try {
            await apiCall('/api/auth/logout', 'POST');
            currentUser = null;
            window.location.href = '/login.html';
        } catch (error) { /* apiCall handles error notification */ }
    }
    
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    else console.warn("Logout button not found in main wiki page.");

    if (editPageButton) editPageButton.addEventListener('click', switchToEditorView);
    else console.warn("Edit page button not found in main wiki page.");

    checkAuthStatus();
});