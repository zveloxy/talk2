const socket = io();

// State
let nickname = localStorage.getItem('antigravity_nickname');
let userId = localStorage.getItem('antigravity_userid');
let currentLang = localStorage.getItem('antigravity_lang') || 'en'; // Changed default to 'en'

// Generate User ID if not exists
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('antigravity_userid', userId);
}

const roomId = window.location.pathname.replace('/', '') || 'general';

// Translations
const translations = {
    tr: {
        modalTitle: 'Boşluğa Girin',
        modalText: 'odasına katılmak için bir takma ad seçin:',
        placeholderNickname: 'örn. KozmikGezgin',
        btnConnect: 'Bağlan',
        btnRandom: 'Rastgele Oluştur',
        systemBanner: 'Bu odadaki veriler her 24 saatte bir silinir.',
        placeholderMessage: 'Bir mesaj yazın...',
        sidebarTitle: 'Çevrimiçi',
        btnClearMyMsgs: 'Mesajlarımı Temizle',
        confirmClear: 'Sadece kendi mesajlarını silmek istediğine emin misin?',
        confirmDelete: 'Bu mesajı silmek istiyor musunuz?',
        msgJoined: 'odaya katıldı',
        msgLeft: 'odadan ayrıldı',
        you: '(sen)',
        typing1: 'yazıyor...',
        typingSomeone: 'Biri yazıyor...',
        typingMany: 'Birkaç kişi yazıyor...',
        myMsgsCleared: 'Kendi mesajların temizlendi.',
        cleared: 'temizlendi',
        uploadError: 'Yükleme hatası',
        fileTooBig: 'Dosya çok büyük (max 5MB)'
    },
    en: {
        modalTitle: 'Enter the Void',
        modalText: 'Choose an alias to join:',
        placeholderNickname: 'e.g. CosmicTraveler',
        btnConnect: 'Connect',
        btnRandom: 'Generate Random',
        systemBanner: 'Data in this room is cleared every 24 hours.',
        placeholderMessage: 'Type a message...',
        sidebarTitle: 'Online',
        btnClearMyMsgs: 'Clear My Messages',
        confirmClear: 'Are you sure you want to clear ONLY your messages?',
        confirmDelete: 'Do you want to delete this message?',
        msgJoined: 'joined the room',
        msgLeft: 'left the room',
        you: '(you)',
        typing1: 'is typing...',
        typingSomeone: 'Someone is typing...',
        typingMany: 'Several people are typing...',
        myMsgsCleared: 'Your messages have been cleared.',
        cleared: 'cleared',
        uploadError: 'Upload failed',
        myMsgsCleared: 'Your messages have been cleared.',
        cleared: 'cleared',
        uploadError: 'Upload failed',
        fileTooBig: 'File too large (max 5MB)',
        confirmTitle: 'Are you sure?',
        btnCancel: 'Cancel',
        btnConfirm: 'Yes, Delete'
    }
};

// Elements
const modal = document.getElementById('nickname-overlay');
const confirmModal = document.getElementById('confirm-overlay');
const confirmTitle = document.getElementById('confirm-title');
const confirmText = document.getElementById('confirm-text');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');
const randomBtn = document.getElementById('random-nickname');
const messagesList = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const imageInput = document.getElementById('image-input');
const uploadBtn = document.getElementById('upload-btn');
const roomNameHeader = document.getElementById('room-name-header');
const roomDisplay = document.getElementById('room-display');
const userCount = document.getElementById('user-count');
const sidebarUserCount = document.getElementById('sidebar-user-count');
const usersList = document.getElementById('users-list');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const logoutBtn = document.getElementById('logout-btn');
const usersSidebar = document.getElementById('users-sidebar');
const typingIndicator = document.getElementById('typing-indicator');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const clearMsgsBtn = document.getElementById('clear-msgs-btn');
const langToggleBtn = document.getElementById('lang-toggle');

// New elements for features
const shareLinkBtn = document.getElementById('share-link-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const replyPreview = document.getElementById('reply-preview');
const replyToName = document.getElementById('reply-to-name');
const replyToText = document.getElementById('reply-to-text');
const cancelReplyBtn = document.getElementById('cancel-reply');
const toast = document.getElementById('toast');

// Confirm Modal State
let pendingConfirmAction = null;

// Typing state
let typingTimeout = null;
let isTyping = false;
let typingUsers = {};

// New feature states
let soundEnabled = localStorage.getItem('talk2_sound') !== 'false';
let replyingTo = null; // { id, nickname, text }
let notificationSound = null;

// --- Initialization ---
if (roomNameHeader) roomNameHeader.textContent = roomId;
if (roomDisplay) roomDisplay.textContent = '#' + roomId;

// IP & Language Detection
async function detectLanguage() {
    // Check localStorage first
    let storedLang = localStorage.getItem('antigravity_lang');
    
    if (!storedLang) {
        try {
            // Fetch IP info
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.country_code === 'TR') {
                storedLang = 'tr';
            } else {
                storedLang = 'en';
            }
        } catch (e) {
            console.error("IP check failed, defaulting to EN/TR based on browser");
            storedLang = navigator.language.startsWith('tr') ? 'tr' : 'en';
        }
        localStorage.setItem('antigravity_lang', storedLang);
    }
    
    currentLang = storedLang;
    const supportedLangs = ['en', 'tr'];
    if (!supportedLangs.includes(currentLang)) {
        currentLang = 'en';
    }
    applyLanguage(currentLang);
}

// Initial detection call
detectLanguage();


applyLanguage(currentLang);

// Check nickname
if (nickname) {
    modal.style.display = 'none';
    joinRoom();
} else {
    modal.style.display = 'flex';
}

// --- Event Listeners ---

// Confirm Modal Listeners
if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        pendingConfirmAction = null;
    });
}

if (confirmYesBtn) {
    confirmYesBtn.addEventListener('click', () => {
        if (pendingConfirmAction) {
            pendingConfirmAction();
        }
        confirmModal.classList.add('hidden');
        pendingConfirmAction = null;
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm(currentLang === 'tr' ? 'Çıkış yapmak istiyor musunuz?' : 'Do you want to logout?')) {
            localStorage.removeItem('antigravity_nickname');
            localStorage.removeItem('antigravity_userid');
            window.location.href = '/';
        }
    });
}

// Language Toggle
if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        localStorage.setItem('antigravity_lang', currentLang);
        applyLanguage(currentLang);
    });
}

// Nickname Form
nicknameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = nicknameInput.value.trim();
    if (val) {
        setNickname(val);
    }
});

randomBtn.addEventListener('click', () => {
    if (currentLang === 'tr') {
        const adjectives = ['Kozmik', 'Yildiz', 'Ay', 'Bulutsu', 'Kuantum', 'Siber', 'Neon'];
        const nouns = ['Gezgin', 'Serseri', 'Pilot', 'Hayalet', 'Anka', 'Kuzgun'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        nicknameInput.value = adj + noun + Math.floor(Math.random() * 100);
    } else {
        const adjectives = ['Cosmic', 'Stellar', 'Lunar', 'Nebula', 'Quantum', 'Cyber', 'Neon'];
        const nouns = ['Voyager', 'Drifter', 'Pilot', 'Ghost', 'Phoenix', 'Raven'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        nicknameInput.value = adj + noun + Math.floor(Math.random() * 100);
    }
});

// Chat Form
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content) {
        sendMessage(content, 'text');
        messageInput.value = '';
        stopTyping();
    }
});

// Typing indicator
messageInput.addEventListener('input', () => {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing', true);
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 1500);
});

function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing', false);
    }
    clearTimeout(typingTimeout);
}

// Image Upload
uploadBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert(translations[currentLang].fileTooBig);
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    uploadBtn.disabled = true;

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        sendMessage(data.url, 'image');
        
        imageInput.value = '';
    } catch (err) {
        console.error(err);
        alert(translations[currentLang].uploadError);
    } finally {
        uploadBtn.innerHTML = '<i class="fas fa-image"></i>';
        uploadBtn.disabled = false;
    }
});

// Clear My Messages
if (clearMsgsBtn) {
    clearMsgsBtn.addEventListener('click', () => {
        const t = translations[currentLang] || translations['en'];
        showConfirm(t.confirmClear, () => {
            socket.emit('clearUserMessages');
        });
    });
}

// --- NEW FEATURES ---

// Share Link Button
if (shareLinkBtn) {
    shareLinkBtn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            showToast(currentLang === 'tr' ? 'Link kopyalandı!' : 'Link copied!');
        }).catch(() => {
            showToast(currentLang === 'tr' ? 'Kopyalama başarısız' : 'Copy failed');
        });
    });
}

// Sound Toggle Button
if (soundToggleBtn) {
    updateSoundButtonIcon();
    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('talk2_sound', soundEnabled);
        updateSoundButtonIcon();
        showToast(soundEnabled 
            ? (currentLang === 'tr' ? 'Ses açık' : 'Sound on') 
            : (currentLang === 'tr' ? 'Ses kapalı' : 'Sound off'));
    });
}

function updateSoundButtonIcon() {
    if (soundToggleBtn) {
        const icon = soundToggleBtn.querySelector('i');
        if (soundEnabled) {
            icon.className = 'fas fa-volume-up';
            soundToggleBtn.classList.remove('muted');
        } else {
            icon.className = 'fas fa-volume-mute';
            soundToggleBtn.classList.add('muted');
        }
    }
}

// Cancel Reply
if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', () => {
        cancelReply();
    });
}

function cancelReply() {
    replyingTo = null;
    if (replyPreview) replyPreview.classList.add('hidden');
}

function setReply(msgId, msgNickname, msgText) {
    replyingTo = { id: msgId, nickname: msgNickname, text: msgText };
    if (replyToName) replyToName.textContent = msgNickname;
    if (replyToText) replyToText.textContent = msgText.substring(0, 50) + (msgText.length > 50 ? '...' : '');
    if (replyPreview) replyPreview.classList.remove('hidden');
    messageInput.focus();
}

// Expose to window
window.setReply = setReply;

// Toast Notification
function showToast(message, duration = 2000) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

// Notification Sound
function playNotificationSound() {
    if (!soundEnabled) return;
    if (!notificationSound) {
        notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2FgYWFe3BrbXV8gYKChHpwbm10eoCAhIN6cXFvdHqAgIODeXJycHR6gH+DgnhycnB0eoB/goF3c3Jwc3p/f4KBd3NycHN6gH+CgHdzc3Bzent/gn93c3Nwc3l6f4GAd3NzcXN5e36Bf3dzcnFzeHt+gX93c3JxdHh7foB+d3RycXR4e35/fnZ0cnF0eHt9fn52dHJxdHh7fX5+dnRycXR4e31+fnZ1c3F0d3t9fn52dHNxdHd7fH5+dnV0cXR3e3x+fnZ1dHF1eHt9fn53dXRxdXh7fX5+d3V0cXV4e31+fnZ1dHF1eHt8fn52dXRxdXh7fX5+d3V0cnd4e31+f3Z1dHJ2eHt9fn92dXRydnh7fX5/dnV0cnZ4e31+f3Z1dHJ2eHt8fn92dXRydnh7fX5/dnV0cnZ4e31+f3Z1dHJ2eHt9fn92dXRydnh7fX5/dnV0cnZ5e31+f3Z1dHJ3eXt9fn92dXVydnl7fH5/dnV1cnd5e3x+f3Z1dXJ3eXt9fn93dXVyd3l7fX5/d3V1cnh5e31+f3d1dXJ4eXt9fn93dXVyeHl7fX9/d3V1cnh5fH1+f3d2dXJ4eXx9fn93dnVyeHl8fX9/d3Z1cnh5fH1/f3d2dXJ4eXx9f393dnVzeHl9fX9/d3Z1c3h5fX1/f3d2dXN4eX19f393dnVzeHl9fX9/d3Z2c3h5fX1/f3d2dnN4eX19f393dnZzeHl9fX9/d3Z2c3h5fX1/f3d2dnN4eX19f393dnd0eHl9fX9/d3Z3dHh5fX1/f3d2');
    }
    notificationSound.currentTime = 0;
    notificationSound.volume = 0.5;
    notificationSound.play().catch(() => {});
}

function showConfirm(message, onConfirm) {
    const t = translations[currentLang] || translations['en'];
    confirmText.textContent = message;
    confirmTitle.textContent = currentLang === 'tr' ? 'Onay' : 'Confirm';
    confirmYesBtn.textContent = t.btnConfirm || 'Yes, Delete';
    confirmCancelBtn.textContent = t.btnCancel || 'Cancel';
    
    pendingConfirmAction = onConfirm;
    confirmModal.classList.remove('hidden');
    confirmModal.style.display = 'flex';
}

// ... (Socket Events code remains same)

// ...

function deleteMessage(id) {
    const t = translations[currentLang] || translations['en'];
    const msg = t.confirmDelete || 'Delete this message?';
    showConfirm(msg, () => {
        socket.emit('deleteMessage', id);
    });
}

// Toggle Sidebar
toggleSidebarBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        usersSidebar.classList.toggle('visible');
    } else {
        usersSidebar.classList.toggle('hidden');
    }
});

// Emoji Picker
if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('hidden');
    });
    
    emojiPicker.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
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

// --- Socket Events ---

socket.on('history', (messages) => {
    messagesList.innerHTML = '';
    messages.forEach(addMessageToDOM);
    scrollToBottom();
});

socket.on('message', (msg) => {
    addMessageToDOM(msg);
    scrollToBottom();
    
    // Play notification sound for messages from others
    if (msg.nickname !== nickname) {
        playNotificationSound();
    }
});

socket.on('messageDeleted', (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
        el.remove();
    }
});

socket.on('userMessagesCleared', (clearedNickname) => {
    // We need to remove all messages from DOM that match this nickname
    const allMessages = document.querySelectorAll('.message');
    allMessages.forEach(msgDiv => {
        const nicknameSpan = msgDiv.querySelector('.nickname');
        if (clearedNickname === nickname) {
             // It's me
             if (msgDiv.classList.contains('self')) {
                 msgDiv.remove();
             }
        } else {
            // It's someone else
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

socket.on('userList', (users) => {
    updateUserList(users);
});

socket.on('userTyping', (data) => {
    if (data.isTyping) {
        typingUsers[data.nickname] = true;
    } else {
        delete typingUsers[data.nickname];
    }
    updateTypingIndicator();
});

// --- Functions ---

function applyLanguage(lang) {
    const t = translations[lang];
    if (!t) return;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });
    
    if (langToggleBtn) langToggleBtn.textContent = lang.toUpperCase();
}

function setNickname(name) {
    nickname = name;
    localStorage.setItem('antigravity_nickname', name);
    modal.style.display = 'none';
    joinRoom();
}

function joinRoom() {
    // send userId along with join
    socket.emit('join', roomId, nickname, userId);
}

function sendMessage(content, type) {
    const msgData = {
        room: roomId,
        nickname: nickname,
        content: content,
        type: type
    };
    
    // Include reply data if replying
    if (replyingTo) {
        msgData.replyTo = {
            id: replyingTo.id,
            nickname: replyingTo.nickname,
            text: replyingTo.text
        };
    }
    
    socket.emit('message', msgData);
    cancelReply(); // Clear reply after sending
}

// ... (existing code)

function deleteMessage(id) {
    const t = translations[currentLang] || translations['en'];
    const msg = t.confirmDelete || 'Delete this message?';
    showConfirm(msg, () => {
        socket.emit('deleteMessage', id);
    });
}

// Expose to window for onclick
window.deleteMessage = deleteMessage;

function addMessageToDOM(msg) {
    const div = document.createElement('div');
    const isSelf = msg.nickname === nickname;
    div.className = `message ${isSelf ? 'self' : 'other'}`;
    div.id = `msg-${msg.id}`;
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let contentHtml = '';
    if (msg.type === 'image') {
        const imgPath = msg.image_path || msg.content;
        contentHtml = `<img src="${imgPath}" alt="Image" onclick="window.open(this.src, '_blank')" loading="lazy" />`;
    } else {
        const textContent = msg.content || '';
        const safeText = document.createElement('div');
        safeText.innerText = textContent;
        contentHtml = safeText.innerHTML;
    }

    const t = translations[currentLang] || translations['en'];
    const youLabel = isSelf ? 'Sen' : escapeHtml(msg.nickname); // Default to 'Sen' for self if using TR, but better to use t.you
    
    // Fix: Use dynamic labels
    const displayNames = isSelf ? (currentLang === 'tr' ? 'Sen' : 'You') : escapeHtml(msg.nickname);
    const deleteTitle = currentLang === 'tr' ? 'Sil' : 'Delete';

    div.innerHTML = `
        <div class="meta">
            ${isSelf 
                ? `<span class="time">${time}</span>
                   <span class="nickname">${displayNames}</span>
                   <button class="delete-msg-btn" onclick="deleteMessage('${msg.id}')" title="${deleteTitle}">
                        <i class="fas fa-times"></i>
                   </button>`
                : `<span class="nickname">${displayNames}</span>
                   <span class="time">${time}</span>`
            }
        </div>
        <div class="body">${contentHtml}</div>
    `;
    
    messagesList.appendChild(div);
}

function addSystemMessage(data) {
    const div = document.createElement('div');
    div.className = `system-message ${data.type || 'info'}`;
    
    let text = data.content || '';
    const t = translations[currentLang];
    
    if (data.type === 'join') {
        text = `${data.nickname} ${t.msgJoined}`;
    } else if (data.type === 'leave') {
        text = `${data.nickname} ${t.msgLeft}`;
    }
    
    let icon = 'info-circle';
    if (data.type === 'join') icon = 'arrow-right-to-bracket';
    if (data.type === 'leave') icon = 'arrow-right-from-bracket';
    
    div.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
    messagesList.appendChild(div);
}

function updateUserList(users) {
    // Update counts
    if (userCount) userCount.textContent = users.length;
    if (sidebarUserCount) sidebarUserCount.textContent = users.length;
    
    // Update list
    if (usersList) {
        usersList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            const initials = user.nickname.slice(0, 2).toUpperCase();
            const isYou = user.nickname === nickname;
            
            const t = translations[currentLang];
            
            li.innerHTML = `
                <div class="user-avatar">${initials}</div>
                <span class="user-name">${escapeHtml(user.nickname)}${isYou ? `<span class="user-you">${t.you}</span>` : ''}</span>
                <span class="online-dot"></span>
            `;
            usersList.appendChild(li);
        });
    }
}

function updateTypingIndicator() {
    const names = Object.keys(typingUsers);
    if (names.length === 0) {
        typingIndicator.classList.add('hidden');
    } else {
        typingIndicator.classList.remove('hidden');
        const t = translations[currentLang];
        
        if (names.length === 1) {
            typingIndicator.textContent = `${names[0]} ${t.typing1}`;
        } else if (names.length <= 3) {
            typingIndicator.text = `${names.join(', ')} ...`; // simplifying
            typingIndicator.textContent = t.typingSomeone; // fallback
        } else {
            typingIndicator.textContent = t.typingMany;
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const container = document.querySelector('.chat-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}
