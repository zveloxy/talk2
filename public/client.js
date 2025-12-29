// Talk2 Chat Client - Cleaned Version

// Socket with reconnection options for cPanel reliability
const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

// Socket connection error handling
socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
});

socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    // Re-join room on reconnect if we have nickname
    if (nickname && roomId) {
        socket.emit('join', roomId, nickname, userId);
    }
});

// State
let nickname = localStorage.getItem('antigravity_nickname');
let userId = localStorage.getItem('antigravity_userid');
let currentLang = localStorage.getItem('talk2_lang') || 'en';

// Generate User ID if not exists
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('antigravity_userid', userId);
}

// Toast notification function
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) {
        alert(message); // Fallback
        return;
    }
    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

const roomId = window.location.pathname.replace('/', '') || 'general';

// Translations Cache
const loadedTranslations = {};

// State Variables
let pendingConfirmAction = null;
let typingTimeout = null;
let isTyping = false;
let typingUsers = {};
// Video Upload Variables
// Voice variables removed
let soundEnabled = localStorage.getItem('talk2_sound') !== 'false';
let replyingTo = null;
let notificationSound = null;

// DOM Elements (assigned in DOMContentLoaded)
let modal, confirmModal, confirmTitle, confirmText, confirmYesBtn, confirmCancelBtn;
let nicknameForm, nicknameInput, randomBtn;
let chatForm, messageInput, sendBtn;
let messagesList, roomNameHeader;
let roomDisplay, userCount, sidebarUserCount, usersList, toggleSidebarBtn, logoutBtn, usersSidebar, typingIndicator;
let emojiBtn, emojiPicker, clearMsgsBtn, langToggleBtn;
let shareLinkBtn, soundToggleBtn, replyPreview, replyToName, replyToText, cancelReplyBtn, toast;
let expiryBtn, expiryOverlay, expiryCloseBtn, expiryOptions;
let uploadBtn, imageInput;

// --- Language Detection & Loading ---
async function detectLanguage() {
    let storedLang = localStorage.getItem('talk2_lang');
    
    if (!storedLang) {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.country_code === 'TR') storedLang = 'tr';
            else if (['DE', 'AT', 'CH'].includes(data.country_code)) storedLang = 'de';
            else if (data.country_code === 'RU') storedLang = 'ru';
            else if (data.country_code === 'PH') storedLang = 'ph';
            else if (['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE'].includes(data.country_code)) storedLang = 'es';
            else if (['FR', 'BE', 'CA'].includes(data.country_code)) storedLang = 'fr';
            else if (data.country_code === 'IT') storedLang = 'it';
            else if (['BR', 'PT'].includes(data.country_code)) storedLang = 'pt';
            else storedLang = 'en';
        } catch (e) {
            const nav = navigator.language.toLowerCase();
            if (nav.startsWith('tr')) storedLang = 'tr';
            else if (nav.startsWith('de')) storedLang = 'de';
            else if (nav.startsWith('ru')) storedLang = 'ru';
            else if (nav.startsWith('fil') || nav.startsWith('tl')) storedLang = 'ph';
            else if (nav.startsWith('es')) storedLang = 'es';
            else if (nav.startsWith('fr')) storedLang = 'fr';
            else if (nav.startsWith('it')) storedLang = 'it';
            else if (nav.startsWith('pt')) storedLang = 'pt';
            else storedLang = 'en';
        }
        localStorage.setItem('talk2_lang', storedLang);
    }
    
    currentLang = storedLang;
    if (!['en', 'tr', 'de', 'ru', 'ph', 'es', 'fr', 'it', 'pt'].includes(currentLang)) currentLang = 'en';
    
    // Initial Load
    await loadLanguage(currentLang);
    
    // Show nickname modal after language is applied
    const nicknameModal = document.getElementById('nickname-modal');
    if (nicknameModal) nicknameModal.style.opacity = '1';
}

async function loadLanguage(lang) {
    if (loadedTranslations[lang]) {
        applyTranslations(lang, loadedTranslations[lang]);
        return;
    }

    try {
        const res = await fetch(`/locales/${lang}.json`);
        if (!res.ok) throw new Error(`Failed to load ${lang}`);
        const translations = await res.json();
        loadedTranslations[lang] = translations;
        applyTranslations(lang, translations);
    } catch (e) {
        console.error('Translation load error:', e);
        // Fallback to English if not already English
        if (lang !== 'en') loadLanguage('en');
    }
}

function applyTranslations(lang, t) {
    console.log('Applying language:', lang);
    currentLang = lang;
    localStorage.setItem('talk2_lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });
    
    // Update system banner
    const systemBanner = document.querySelector('.system-message');
    if (systemBanner && t.systemBanner) systemBanner.textContent = t.systemBanner;
    
    // Update sidebar title
    const sidebarTitle = document.querySelector('.sidebar-title');
    if (sidebarTitle && t.sidebarTitle) sidebarTitle.textContent = t.sidebarTitle;
    
    // Update clear messages button
    const clearBtn = document.querySelector('#clear-messages-btn');
    if (clearBtn && t.btnClearMyMsgs) clearBtn.textContent = t.btnClearMyMsgs;
    
    if (langToggleBtn) langToggleBtn.textContent = lang.toUpperCase();
}

// Wrapper for existing applyLanguage calls from dropdown
function applyLanguage(lang) {
    loadLanguage(lang);
}

// --- Core Functions ---
function setNickname(name) {
    nickname = name;
    localStorage.setItem('antigravity_nickname', name);
    if (modal) modal.style.display = 'none';
    joinRoom();
}

function joinRoom() {
    socket.emit('join', roomId, nickname, userId);
}

function sendMessage(content, type) {
    if (type === 'video') {
        console.warn('Video upload disabled');
        return;
    }
    
    const msgData = {
        room: roomId,
        nickname: nickname,
        content: content,
        type: type,
        image_path: type === 'image' ? content : null
    };
    
    socket.emit('message', msgData);
}

function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing', false);
    }
    clearTimeout(typingTimeout);
}

// Reply feature removed

function deleteMessage(id, fileUrl = null) {
    const t = (loadedTranslations && loadedTranslations[currentLang]) || (loadedTranslations && loadedTranslations['en']) || {};
    const confirmMsg = t.confirmDelete || 'Are you sure you want to delete this message?';
    
    // Fallback if modal is missing or check fails
    if (!confirmModal || !showConfirm) {
        if (confirm(confirmMsg)) {
            socket.emit('deleteMessage', id);
            // Delete file from storage if exists
            if (fileUrl) deleteFileFromStorage(fileUrl);
        }
        return;
    }
    
    showConfirm(confirmMsg, () => {
        socket.emit('deleteMessage', id);
        // Delete file from storage if exists
        if (fileUrl) deleteFileFromStorage(fileUrl);
    });
}

// Delete file from PHP storage
function deleteFileFromStorage(url) {
    console.log('Attempting to delete file:', url);
    if (!url || url.startsWith('/uploads/')) {
        console.log('Skipping deletion - legacy upload or empty');
        return;
    }
    
    fetch('/delete.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
    })
    .then(res => res.json())
    .then(data => console.log('Delete response:', data))
    .catch(err => console.error('File deletion failed:', err));
}

window.deleteMessage = deleteMessage;

function showConfirm(message, onConfirm) {
    const t = (loadedTranslations && loadedTranslations[currentLang]) || (loadedTranslations && loadedTranslations['en']) || {};
    
    if (confirmText) confirmText.textContent = message;
    if (confirmTitle) confirmTitle.textContent = t.confirmTitle || 'Confirm';
    if (confirmYesBtn) confirmYesBtn.textContent = t.btnConfirm || 'Yes';
    if (confirmCancelBtn) confirmCancelBtn.textContent = t.btnCancel || 'Cancel';
    
    pendingConfirmAction = onConfirm;
    if (confirmModal) {
        confirmModal.classList.remove('hidden');
        confirmModal.style.display = 'flex';
    } else {
        // Fallback to native confirm if modal fails
        if(confirm(message)) {
             onConfirm();
        }
    }
}

function showToast(message, duration = 2000) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function playNotificationSound() {
    if (!soundEnabled) return;
    if (!notificationSound) {
        notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2FgYWFe3BrbXV8gYKChHpwbm10eoCAhIN6cXFvdHqAgIODeXJycHR6gH+DgnhycnB0eoB/goF3c3Jwc3p/f4KBd3NycHN6gH+CgHdzc3Bzent/gn93c3Nwc3l6f4GAd3NzcXN5e36Bf3dzcnFzeHt+gX93c3JxdHh7foB+d3RycXR4e35/fnZ0cnF0eHt9fn52dHJxdHh7fX5+dnRycXR4e31+fnZ1c3F0d3t9fn52dHNxdHd7fH5+dnV0cXR3e3x+fnZ1dHF1eHt9fn53dXRxdXh7fX5+d3V0cXV4e31+fnZ1dHF1eHt8fn52dXRxdXh7fX5+d3V0cnd4e31+f3Z1dHJ2eHt9fn92dXRydnh7fX5/dnV0cnZ4e31+f3Z1dHJ2eHt8fn92dXRydnh7fX5/dnV0cnZ4e31+f3Z1dHJ2eHt9fn92dXRydnh7fX5/dnV0cnZ5e31+f3Z1dHJ3eXt9fn92dXVydnl7fH5/dnV1cnd5e3x+f3Z1dXJ3eXt9fn93dXVyd3l7fX5/d3V1cnh5e31+f3d1dXJ4eXt9fn93dXVyeHl7fX9/d3V1cnh5fH1+f3d2dXJ4eXx9fn93dnVyeHl8fX9/d3Z1cnh5fH1/f3d2dXJ4eXx9f393dnVzeHl9fX9/d3Z1c3h5fX1/f3d2dXN4eX19f393dnVzeHl9fX9/d3Z2c3h5fX1/f3d2dnN4eX19f393dnZzeHl9fX9/d3Z2c3h5fX1/f3d2dnN4eX19f393dnd0eHl9fX9/d3Z3dHh5fX1/f3d2');
    }
    notificationSound.currentTime = 0;
    notificationSound.volume = 0.5;
    notificationSound.play().catch(() => {});
}

function updateSoundButtonIcon() {
    if (!soundToggleBtn) return;
    const icon = soundToggleBtn.querySelector('i');
    if (icon) {
        icon.className = soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        soundToggleBtn.classList.toggle('muted', !soundEnabled);
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str || '';
    return div.innerHTML;
}

function scrollToBottom() {
    if (messagesList) messagesList.scrollTop = messagesList.scrollHeight;
}

function updateUserList(users) {
    if (!usersList) return;
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const li = document.createElement('li');
        const isMe = user.nickname === nickname;
        const t = loadedTranslations[currentLang] || loadedTranslations['en'];
        li.innerHTML = `<i class="fas fa-user"></i> ${escapeHtml(user.nickname)} ${isMe ? t.you : ''}`;
        if (isMe) li.classList.add('self');
        usersList.appendChild(li);
    });
    
    if (userCount) userCount.textContent = users.length;
    if (sidebarUserCount) sidebarUserCount.textContent = users.length;
}

function updateTypingIndicator() {
    if (!typingIndicator) return;
    const names = Object.keys(typingUsers);
    const t = loadedTranslations[currentLang] || loadedTranslations['en'];
    
    if (names.length === 0) {
        typingIndicator.textContent = '';
        typingIndicator.classList.add('hidden');
    } else if (names.length === 1) {
        typingIndicator.textContent = `${names[0]} ${t.typing1}`;
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.textContent = t.typingMany;
        typingIndicator.classList.remove('hidden');
    }
}

function addMessageToDOM(msg) {
    // Debug video messages
    if (msg.type === 'video') {
        console.log('VIDEO MESSAGE RECEIVED:', JSON.stringify(msg));
        console.log('video_path:', msg.video_path);
        console.log('content:', msg.content);
    }
    if (!messagesList) return;
    
    const div = document.createElement('div');
    const isSelf = msg.nickname === nickname;
    div.className = `message ${isSelf ? 'self' : 'other'}`;
    div.id = `msg-${msg.id}`;
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let contentHtml = '';
    let msgTextForReply = '';
    
    if (msg.type === 'image') {
        const imgPath = msg.image_path || msg.content;
        contentHtml = `<img src="${imgPath}" alt="Image" class="lightbox-trigger" loading="lazy" />`;
        msgTextForReply = '[Image]';
    } else if (msg.type === 'audio') {
        contentHtml = `<audio controls src="${msg.content}"></audio>`;
        msgTextForReply = '[Audio]';
    } else if (msg.type === 'video') {
        // Try multiple fallbacks including _data serialized backup
        let videoPath = msg.video_path || msg.media_url || msg.content;
        if (!videoPath && msg._data) {
            try {
                const parsed = JSON.parse(msg._data);
                videoPath = parsed.v || parsed.c;
            } catch(e) {}
        }
        videoPath = videoPath || null;
        const videoId = `video-${msg.id}`;
        contentHtml = `
            <div class="custom-video-player" id="player-${videoId}">
                <video id="${videoId}" src="${videoPath}" playsinline></video>
                <div class="video-overlay">
                    <button class="play-btn"><i class="fas fa-play"></i></button>
                </div>
                <div class="video-controls">
                    <button class="control-btn play-toggle"><i class="fas fa-play"></i></button>
                    <div class="progress-bar-container">
                        <div class="progress-bar"><div class="progress-fill"></div></div>
                    </div>
                    <span class="time-display">0:00 / 0:00</span>
                    <button class="control-btn seek-btn" data-skip="-10" title="-10s"><i class="fas fa-undo"></i> 10</button>
                    <button class="control-btn seek-btn" data-skip="10" title="+10s"><i class="fas fa-redo"></i> 10</button>
                    <button class="control-btn fullscreen-toggle"><i class="fas fa-expand"></i></button>
                </div>
            </div>
        `;
        msgTextForReply = '[Video]';
        
        // Initialize player after adding to DOM
        requestAnimationFrame(() => initVideoPlayer(videoId));
    } else {
        msgTextForReply = msg.content || '';
        contentHtml = escapeHtml(msgTextForReply);
    }

    const t = loadedTranslations[currentLang] || loadedTranslations['en'];
    const displayName = isSelf ? (t.you || '(you)') : escapeHtml(msg.nickname);
    const deleteTitle = t.btnConfirm ? t.btnConfirm.split(',')[0] : 'Delete';

    div.innerHTML = `
        <div class="meta">
            ${isSelf 
                ? `<span class="time">${time}</span>
                   <span class="nickname">${displayName}</span>
                   <button class="delete-msg-btn" data-delete-id="${msg.id}" data-file-url="${msg.image_path || msg.video_path || ''}" title="${deleteTitle}"><i class="fas fa-times"></i></button>
                   <span class="read-status" id="read-${msg.id}"></span>`
                : `<span class="nickname">${displayName}</span>
                   <span class="time">${time}</span>`
            }
        </div>
        <div class="body">${contentHtml}</div>
    `;
    
    messagesList.appendChild(div);

    // Scroll handling for images/videos
    const media = div.querySelector('img, video');
    if (media) {
        media.onload = scrollToBottom;
        media.onloadeddata = scrollToBottom;
    }

    if (!isSelf && window.msgObserver) {
        window.msgObserver.observe(div);
    }
}

function scrollToBottom() {
    if (messagesList) {
        // Use requestAnimationFrame to ensure DOM paint is complete
        requestAnimationFrame(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        });
        // Double check a bit later for slow rendering elements
        setTimeout(() => {
            if(messagesList) messagesList.scrollTop = messagesList.scrollHeight;
        }, 100);
    }
}

function addSystemMessage(data) {
    if (!messagesList) return;
    
    const div = document.createElement('div');
    div.className = `system-message ${data.type || 'info'}`;
    
    const t = loadedTranslations[currentLang] || loadedTranslations['en'];
    let text = data.content || '';
    
    if (data.type === 'join') text = `${data.nickname} ${t.msgJoined}`;
    else if (data.type === 'leave') text = `${data.nickname} ${t.msgLeft}`;
    
    let icon = 'info-circle';
    if (data.type === 'join') icon = 'arrow-right-to-bracket';
    else if (data.type === 'leave') icon = 'arrow-right-from-bracket';
    
    div.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
    messagesList.appendChild(div);
}

// --- DOMContentLoaded: Initialize Everything ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Talk2 Client Initializing...");
    
    // Assign all DOM elements
    modal = document.getElementById('nickname-overlay');
    confirmModal = document.getElementById('confirm-overlay');
    confirmTitle = document.getElementById('confirm-title');
    confirmText = document.getElementById('confirm-text');
    confirmYesBtn = document.getElementById('confirm-yes-btn');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    
    nicknameForm = document.getElementById('nickname-form');
    nicknameInput = document.getElementById('nickname-input');
    randomBtn = document.getElementById('random-nickname');
    

    
    chatForm = document.getElementById('chat-form');
    messageInput = document.getElementById('message-input');
    sendBtn = document.getElementById('send-btn');
    
    messagesList = document.getElementById('messages');
    roomNameHeader = document.getElementById('room-name-header');
    roomDisplay = document.getElementById('room-display');

    // Event delegation for delete, image preview, etc.
    if (messagesList) {
        messagesList.addEventListener('click', (e) => {
            // Delete Message
            const delBtn = e.target.closest('.delete-msg-btn');
            if (delBtn) {
                const msgId = delBtn.dataset.deleteId;
                if (msgId) deleteMessage(msgId);
                return;
            }
            // Image Preview logic...
        });
    }
    userCount = document.getElementById('user-count');
    sidebarUserCount = document.getElementById('sidebar-user-count');
    usersList = document.getElementById('users-list');
    toggleSidebarBtn = document.getElementById('toggle-sidebar');
    logoutBtn = document.getElementById('logout-btn');
    usersSidebar = document.getElementById('users-sidebar');
    typingIndicator = document.getElementById('typing-indicator');
    
    emojiBtn = document.getElementById('emoji-btn');
    emojiPicker = document.getElementById('emoji-picker');
    clearMsgsBtn = document.getElementById('clear-msgs-btn');
    langToggleBtn = document.getElementById('lang-toggle');
    
    shareLinkBtn = document.getElementById('share-link-btn');
    soundToggleBtn = document.getElementById('sound-toggle-btn');
    replyPreview = document.getElementById('reply-preview');
    replyToName = document.getElementById('reply-to-name');
    replyToText = document.getElementById('reply-to-text');
    cancelReplyBtn = document.getElementById('cancel-reply');
    toast = document.getElementById('toast');
    
    expiryBtn = document.getElementById('expiry-btn');
    expiryOverlay = document.getElementById('expiry-overlay');
    expiryCloseBtn = document.getElementById('expiry-close-btn');
    expiryOptions = document.querySelectorAll('.expiry-option');
    
    // Lightbox elements
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.querySelector('.lightbox-close');
    
    // Zoom & Pan state
    let currentZoom = 1;
    let panX = 0, panY = 0;
    let isDragging = false;
    let lastX = 0, lastY = 0;
    const minZoom = 0.5;
    const maxZoom = 5;
    
    function updateTransform() {
        if (lightboxImage) {
            lightboxImage.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
        }
    }
    
    function resetZoom() {
        currentZoom = 1;
        panX = 0;
        panY = 0;
        updateTransform();
    }
    
    // Lightbox event handlers
    if (lightboxModal && lightboxImage && lightboxClose) {
        // Close on X button click
        lightboxClose.addEventListener('click', () => {
            lightboxModal.classList.add('hidden');
            resetZoom();
        });
        
        // Close on background click (only if not dragging)
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal && !isDragging) {
                lightboxModal.classList.add('hidden');
                resetZoom();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !lightboxModal.classList.contains('hidden')) {
                lightboxModal.classList.add('hidden');
                resetZoom();
            }
        });
        
        // Scroll wheel zoom (zoom to cursor position)
        lightboxImage.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = lightboxImage.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            
            const oldZoom = currentZoom;
            const delta = e.deltaY > 0 ? -0.3 : 0.3;
            currentZoom = Math.min(maxZoom, Math.max(minZoom, currentZoom + delta));
            
            // Adjust pan to zoom toward cursor
            const zoomRatio = currentZoom / oldZoom;
            panX = mouseX - (mouseX - panX) * zoomRatio;
            panY = mouseY - (mouseY - panY) * zoomRatio;
            
            updateTransform();
        }, { passive: false });
        
        // Mouse drag for panning
        lightboxImage.addEventListener('mousedown', (e) => {
            if (currentZoom > 1) {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                lightboxImage.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                panX += e.clientX - lastX;
                panY += e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;
                updateTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (lightboxImage) lightboxImage.style.cursor = currentZoom > 1 ? 'grab' : 'zoom-in';
        });
        
        // Touch pinch-to-zoom & pan
        let initialDistance = 0;
        let initialZoom = 1;
        let touchStartX = 0, touchStartY = 0;
        let initialPanX = 0, initialPanY = 0;
        
        lightboxImage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialZoom = currentZoom;
            } else if (e.touches.length === 1 && currentZoom > 1) {
                isDragging = true;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                initialPanX = panX;
                initialPanY = panY;
            }
        }, { passive: true });
        
        lightboxImage.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const scale = currentDistance / initialDistance;
                currentZoom = Math.min(maxZoom, Math.max(minZoom, initialZoom * scale));
                updateTransform();
            } else if (e.touches.length === 1 && isDragging) {
                e.preventDefault();
                panX = initialPanX + (e.touches[0].clientX - touchStartX);
                panY = initialPanY + (e.touches[0].clientY - touchStartY);
                updateTransform();
            }
        }, { passive: false });
        
        lightboxImage.addEventListener('touchend', () => {
            isDragging = false;
        });
        
        // Double-click to toggle zoom
        lightboxImage.addEventListener('dblclick', (e) => {
            if (currentZoom !== 1) {
                resetZoom();
            } else {
                // Zoom to clicked position
                const rect = lightboxImage.getBoundingClientRect();
                const clickX = e.clientX - rect.left - rect.width / 2;
                const clickY = e.clientY - rect.top - rect.height / 2;
                
                currentZoom = 2.5;
                panX = -clickX * 1.5;
                panY = -clickY * 1.5;
                updateTransform();
            }
        });
    }
    
    // Event delegation for image clicks (to show lightbox) AND delete button
    if (messagesList) {
        messagesList.addEventListener('click', (e) => {
            // Lightbox trigger
            const img = e.target.closest('.lightbox-trigger');
            if (img && lightboxModal && lightboxImage) {
                lightboxImage.src = img.src;
                lightboxModal.classList.remove('hidden');
                return;
            }
            
            // Delete button
            const deleteBtn = e.target.closest('.delete-msg-btn');
            if (deleteBtn) {
                const msgId = deleteBtn.getAttribute('data-delete-id');
                const fileUrl = deleteBtn.getAttribute('data-file-url');
                // Only pass fileUrl if it looks like a file path (not text content)
                const isFile = fileUrl && (fileUrl.includes('/file.php') || fileUrl.includes('.enc') || fileUrl.includes('/uploads/'));
                deleteMessage(msgId, isFile ? fileUrl : null);
            }
        });
        
        // Scroll event for scroll-to-bottom button visibility
        const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
        if (scrollBottomBtn) {
            messagesList.addEventListener('scroll', () => {
                const isNearBottom = messagesList.scrollHeight - messagesList.scrollTop - messagesList.clientHeight < 200;
                scrollBottomBtn.classList.toggle('hidden', isNearBottom);
            });
            
            scrollBottomBtn.addEventListener('click', () => {
                messagesList.scrollTo({ top: messagesList.scrollHeight, behavior: 'smooth' });
            });
        }
    }
    
    uploadBtn = document.getElementById('upload-btn');
    imageInput = document.getElementById('image-input');
    
    // Set room display
    if (roomNameHeader) roomNameHeader.textContent = roomId;
    if (roomDisplay) roomDisplay.textContent = '#' + roomId;
    
    // Detect language
    detectLanguage();
    
    // Check if already logged in
    if (nickname) {
        if (modal) modal.style.display = 'none';
        joinRoom();
    } else {
        if (modal) modal.style.display = 'flex';
    }
    
    // --- Event Listeners ---
    
    // Nickname Form
    if (nicknameForm) {
        nicknameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = nicknameInput ? nicknameInput.value.trim() : '';
            if (val) setNickname(val);
            return false;
        });
    }
    
    // Random Nickname
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            const adjectives = currentLang === 'tr' 
                ? ['Kozmik', 'Yildiz', 'Ay', 'Bulutsu', 'Kuantum', 'Siber', 'Neon']
                : ['Cosmic', 'Stellar', 'Lunar', 'Nebula', 'Quantum', 'Cyber', 'Neon'];
            const nouns = currentLang === 'tr' 
                ? ['Gezgin', 'Serseri', 'Pilot', 'Hayalet', 'Anka', 'Kuzgun']
                : ['Voyager', 'Drifter', 'Pilot', 'Ghost', 'Phoenix', 'Raven'];
            if (nicknameInput) {
                nicknameInput.value = adjectives[Math.floor(Math.random() * adjectives.length)] + 
                                      nouns[Math.floor(Math.random() * nouns.length)] + 
                                      Math.floor(Math.random() * 100);
            }
        });
    }
    
    // Chat Form
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const content = messageInput ? messageInput.value.trim() : '';
            if (content) {
                sendMessage(content, 'text');
                messageInput.value = '';
                stopTyping();
            }
            return false;
        });
    }
    
    // Typing indicator
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (!isTyping) {
                isTyping = true;
                socket.emit('typing', true);
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(stopTyping, 1500);
        });
    }
    
    // Image Upload
    if (uploadBtn && imageInput) {
        uploadBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Only allow images
            if (file.type.startsWith('video/') || 
                ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(file.name.split('.').pop().toLowerCase())) {
                const t = loadedTranslations[currentLang] || loadedTranslations['en'];
                showToast(t.videoNotSupported || 'Video yükleme şu an desteklenmiyor. Sadece resim yükleyebilirsiniz.');
                imageInput.value = '';
                return;
            }
            
            const type = 'image';

            if (file.size > 10 * 1024 * 1024) { // 10MB limit for images
                const t = loadedTranslations[currentLang] || loadedTranslations['en'];
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
                showToast(`${t.fileTooBig || 'Dosya boyutu çok büyük!'} (${fileSizeMB}MB / Max: 10MB)`);
                return;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            uploadBtn.disabled = true;
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload.php', true); // PHP handler in public_html root
            xhr.timeout = 120000; // 2m timeout

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    uploadBtn.innerHTML = `<span style="font-size: 10px; font-weight: 800; line-height: 1;">${percentComplete}%</span>`;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        console.log('UPLOAD SUCCESS - Response:', data);
                        console.log('UPLOAD SUCCESS - URL:', data.url);
                        console.log('UPLOAD SUCCESS - Type:', type);
                        sendMessage(data.url, type);
                        imageInput.value = '';
                    } catch (e) {
                        console.error('JSON Parse error', e);
                        alert(loadedTranslations[currentLang].uploadError);
                    }
                } else {
                    console.error('Upload failed', xhr.statusText);
                    alert(loadedTranslations[currentLang].uploadError);
                }
                uploadBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
                uploadBtn.disabled = false;
            };

            xhr.onerror = () => {
                console.error('Upload network error');
                alert(loadedTranslations[currentLang].uploadError);
                uploadBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
                uploadBtn.disabled = false;
            };

            xhr.ontimeout = () => {
                console.error('Upload timed out');
                alert("Upload timed out");
                uploadBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
                uploadBtn.disabled = false;
            };

            xhr.send(formData);
        });
    }

    // Voice recording logic removed

    // Confirm Modal
    
    // Confirm Modal
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            if (confirmModal) confirmModal.classList.add('hidden');
            pendingConfirmAction = null;
        });
    }
    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            if (pendingConfirmAction) pendingConfirmAction();
            if (confirmModal) confirmModal.classList.add('hidden');
            pendingConfirmAction = null;
        });
    }
    
    // Clear Messages
    if (clearMsgsBtn) {
        clearMsgsBtn.addEventListener('click', () => {
            const t = loadedTranslations[currentLang] || loadedTranslations['en'];
            showConfirm(t.confirmClear, () => socket.emit('clearUserMessages'));
        });
    }
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm(currentLang === 'tr' ? 'Çıkış yapmak istiyor musunuz?' : 'Do you want to logout?')) {
                localStorage.removeItem('antigravity_nickname');
                localStorage.removeItem('antigravity_userid');
                window.location.href = '/';
            }
        });
    }
    
    // Toggle Sidebar
    if (toggleSidebarBtn && usersSidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                usersSidebar.classList.toggle('visible');
            } else {
                usersSidebar.classList.toggle('hidden');
            }
        });

        // Close button logic
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => {
                usersSidebar.classList.remove('visible');
                usersSidebar.classList.add('hidden'); // Ensure hidden on desktop too if needed, though 'visible' deals with mobile
            });
        }

        // Click outside to close (Mobile mainly)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                usersSidebar.classList.contains('visible') && 
                !usersSidebar.contains(e.target) && 
                e.target !== toggleSidebarBtn && 
                !toggleSidebarBtn.contains(e.target)) {
                
                usersSidebar.classList.remove('visible');
            }
        });
    }
    
    // Share Link
    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showToast(currentLang === 'tr' ? 'Link kopyalandı!' : 'Link copied!');
            }).catch(() => {
                showToast(currentLang === 'tr' ? 'Kopyalama başarısız' : 'Copy failed');
            });
        });
    }
    
    // Sound Toggle
    if (soundToggleBtn) {
        updateSoundButtonIcon();
        soundToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('talk2_sound', soundEnabled);
            updateSoundButtonIcon();
            showToast(soundEnabled ? (currentLang === 'tr' ? 'Ses açık' : 'Sound on') : (currentLang === 'tr' ? 'Ses kapalı' : 'Sound off'));
        });
    }
    
    // Reply feature removed
    
    // Emoji Picker
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPicker.classList.toggle('hidden');
        });
        emojiPicker.addEventListener('click', (e) => {
            if (e.target.tagName === 'SPAN' && messageInput) {
                messageInput.value += e.target.textContent;
                messageInput.focus();
                emojiPicker.classList.add('hidden');
            }
        });
        document.addEventListener('click', (e) => {
            if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
                emojiPicker.classList.add('hidden');
            }
        });
    }
    
    // Expiry Modal
    if (expiryBtn && expiryOverlay) {
        expiryBtn.addEventListener('click', () => {
            expiryOverlay.classList.remove('hidden');
            expiryOverlay.style.display = 'flex';
        });
        if (expiryCloseBtn) {
            expiryCloseBtn.addEventListener('click', () => {
                expiryOverlay.classList.add('hidden');
                expiryOverlay.style.display = 'none';
            });
        }
        expiryOverlay.addEventListener('click', (e) => {
            if (e.target === expiryOverlay) {
                expiryOverlay.classList.add('hidden');
                expiryOverlay.style.display = 'none';
            }
        });
        expiryOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                expiryOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                socket.emit('setExpiry', parseInt(opt.getAttribute('data-value')));
                setTimeout(() => {
                    expiryOverlay.classList.add('hidden');
                    expiryOverlay.style.display = 'none';
                }, 300);
            });
        });
    }
    
    // Language Dropdown
    const langDropdown = document.getElementById('lang-dropdown');
    const langDropdownBtn = document.getElementById('lang-dropdown-btn');
    const langDropdownMenu = document.getElementById('lang-dropdown-menu');
    const currentFlag = document.getElementById('current-flag');
    const currentLangText = document.getElementById('current-lang-text');
    
    const langData = {
        en: { flag: '/flags/us.svg', text: 'EN' },
        tr: { flag: '/flags/tr.svg', text: 'TR' },
        de: { flag: '/flags/de.svg', text: 'DE' },
        ru: { flag: '/flags/ru.svg', text: 'RU' },
        ph: { flag: '/flags/ph.svg', text: 'PH' },
        es: { flag: '/flags/es.svg', text: 'ES' },
        fr: { flag: '/flags/fr.svg', text: 'FR' },
        it: { flag: '/flags/it.svg', text: 'IT' },
        pt: { flag: '/flags/br.svg', text: 'PT' }
    };
    
    function updateLangDisplay(lang) {
        if (currentFlag && langData[lang]) {
            currentFlag.src = langData[lang].flag;
        }
        if (currentLangText && langData[lang]) {
            currentLangText.textContent = langData[lang].text;
        }
        // Update active state in menu
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.lang === lang);
        });
    }
    
    // Function to update existing messages when language changes
    function updateExistingMessages() {
        const t = loadedTranslations[currentLang] || loadedTranslations['en'];
        const selfMessages = document.querySelectorAll('.message.self .nickname');
        selfMessages.forEach(el => {
            el.textContent = t.you || '(you)';
        });
    }
    
    if (langDropdownBtn) {
        updateLangDisplay(currentLang);
        
        langDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('open');
        });
        
        document.addEventListener('click', () => {
            langDropdown.classList.remove('open');
        });
        
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const lang = opt.dataset.lang;
                currentLang = lang;
                localStorage.setItem('talk2_lang', currentLang);
                applyLanguage(currentLang);
                updateLangDisplay(lang);
                updateExistingMessages(); // Update (sen)/(you) on existing messages
                langDropdown.classList.remove('open');
            });
        });
    }
    
    // Read Receipts Observer
    window.msgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && document.visibilityState === 'visible') {
                const msgId = entry.target.id.replace('msg-', '');
                socket.emit('markRead', msgId);
                window.msgObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    console.log("Talk2 Client Ready!");
});

// --- Socket Events ---
socket.on('history', (messages) => {
    if (messagesList) messagesList.innerHTML = '';
    messages.forEach(addMessageToDOM);
    scrollToBottom();
});

socket.on('message', (msg) => {
    addMessageToDOM(msg);
    scrollToBottom();
    if (msg.nickname !== nickname) playNotificationSound();
});

socket.on('messageDeleted', (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.remove();
});

socket.on('userMessagesCleared', (clearedNickname) => {
    document.querySelectorAll('.message').forEach(msgDiv => {
        if (clearedNickname === nickname && msgDiv.classList.contains('self')) {
            msgDiv.remove();
        } else {
            const nicknameSpan = msgDiv.querySelector('.nickname');
            if (nicknameSpan && nicknameSpan.textContent === clearedNickname) {
                msgDiv.remove();
            }
        }
    });
    if (clearedNickname === nickname) {
        addSystemMessage({type: 'info', content: translations[currentLang].myMsgsCleared});
    }
});

socket.on('system', (data) => {
    addSystemMessage(data);
    scrollToBottom();
});

socket.on('userList', updateUserList);

socket.on('userTyping', (data) => {
    if (data.isTyping) typingUsers[data.nickname] = true;
    else delete typingUsers[data.nickname];
    updateTypingIndicator();
});

socket.on('roomConfig', (config) => {
    if (config.expiry && expiryOptions) {
        expiryOptions.forEach(opt => {
            opt.classList.toggle('active', parseInt(opt.getAttribute('data-value')) === config.expiry);
        });
    }
});

socket.on('messageRead', (data) => {
    const statusEl = document.getElementById(`read-${data.msgId}`);
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-check-double" style="color: #4ade80;"></i>';
});

// Custom Video Player Logic
function initVideoPlayer(videoId) {
    const video = document.getElementById(videoId);
    if (!video) return;
    
    const container = video.parentElement;
    const overlay = container.querySelector('.video-overlay');
    const playBtn = overlay.querySelector('.play-btn');
    const controls = container.querySelector('.video-controls');
    const playToggle = controls.querySelector('.play-toggle');
    const progressBarContainer = controls.querySelector('.progress-bar-container');
    const progressBar = controls.querySelector('.progress-bar');
    const progressFill = controls.querySelector('.progress-fill');
    const timeDisplay = controls.querySelector('.time-display');
    const fullscreenToggle = controls.querySelector('.fullscreen-toggle');
    const seekBtns = controls.querySelectorAll('.seek-btn');
    
    function togglePlay() {
        if (video.paused) {
            video.play().catch(err => {
                console.error('Video play error:', err);
                console.log('Video source:', video.src);
                showToast('Video oynatılamıyor. Dosya yüklenemedi.');
            });
            overlay.style.opacity = '0';
            playToggle.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            video.pause();
            overlay.style.opacity = '1';
            playToggle.innerHTML = '<i class="fas fa-play"></i>';
        }
    }
    
    // ... helper functions ...

    seekBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent playing/pausing if bubbling to container
            const skip = parseFloat(btn.dataset.skip);
            video.currentTime += skip;
        });
    });
    
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    function updateProgress() {
        if (!video.duration) return;
        const percent = (video.currentTime / video.duration) * 100;
        progressFill.style.width = `${percent}%`;
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    }
    
    playBtn.addEventListener('click', togglePlay);
    playToggle.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', () => {
        timeDisplay.textContent = `0:00 / ${formatTime(video.duration)}`;
    });
    
    video.addEventListener('ended', () => {
        overlay.style.opacity = '1';
        playToggle.innerHTML = '<i class="fas fa-play"></i>';
        progressFill.style.width = '0%';
    });
    
    progressBarContainer.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    });
    
    fullscreenToggle.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            fullscreenToggle.innerHTML = '<i class="fas fa-expand"></i>';
        } else {
            container.requestFullscreen();
            fullscreenToggle.innerHTML = '<i class="fas fa-compress"></i>';
        }
    });

}
