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

const roomId = window.location.pathname.replace('/', '') || 'general';

// Translations
const translations = {
    tr: {
        modalTitle: 'Talk2\'ya Girin',
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
        fileTooBig: 'Dosya çok büyük (max 5MB)',
        confirmTitle: 'Emin misin?',
        btnCancel: 'İptal',
        btnConfirm: 'Evet, Sil',
        expiryTitle: 'Mesaj Süresi',
        expiryDesc: 'Bu odadaki mesajların silinme süresini seçin.'
    },
    en: {
        modalTitle: 'Enter Talk2',
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
        fileTooBig: 'File too large (max 5MB)',
        confirmTitle: 'Are you sure?',
        btnCancel: 'Cancel',
        btnConfirm: 'Yes, Delete',
        expiryTitle: 'Message Expiry',
        expiryDesc: 'Choose how long messages last in this room.'
    },
    de: {
        modalTitle: 'Talk2 Betreten',
        modalText: 'Wählen Sie einen Namen zum Beitreten:',
        placeholderNickname: 'z.B. KosmosReiser',
        btnConnect: 'Verbinden',
        btnRandom: 'Zufällig Generieren',
        systemBanner: 'Daten in diesem Raum werden alle 24 Stunden gelöscht.',
        placeholderMessage: 'Nachricht eingeben...',
        sidebarTitle: 'Online',
        btnClearMyMsgs: 'Meine Nachrichten Löschen',
        confirmClear: 'Sind Sie sicher, dass Sie NUR Ihre Nachrichten löschen möchten?',
        confirmDelete: 'Möchten Sie diese Nachricht löschen?',
        msgJoined: 'ist beigetreten',
        msgLeft: 'hat den Raum verlassen',
        you: '(du)',
        typing1: 'tippt...',
        typingSomeone: 'Jemand tippt...',
        typingMany: 'Mehrere Personen tippen...',
        myMsgsCleared: 'Ihre Nachrichten wurden gelöscht.',
        cleared: 'gelöscht',
        uploadError: 'Upload fehlgeschlagen',
        fileTooBig: 'Datei zu groß (max 5MB)',
        confirmTitle: 'Sind Sie sicher?',
        btnCancel: 'Abbrechen',
        btnConfirm: 'Ja, Löschen',
        expiryTitle: 'Nachrichtenablauf',
        expiryDesc: 'Wählen Sie, wie lange Nachrichten gespeichert bleiben.'
    },
    ru: {
        modalTitle: 'Войти в Talk2',
        modalText: 'Выберите псевдоним для входа:',
        placeholderNickname: 'напр. КосмоПутник',
        btnConnect: 'Подключиться',
        btnRandom: 'Случайный Ник',
        systemBanner: 'Данные в этой комнате очищаются каждые 24 часа.',
        placeholderMessage: 'Введите сообщение...',
        sidebarTitle: 'Онлайн',
        btnClearMyMsgs: 'Удалить Мои Сообщения',
        confirmClear: 'Вы уверены, что хотите удалить ТОЛЬКО свои сообщения?',
        confirmDelete: 'Хотите удалить это сообщение?',
        msgJoined: 'присоединился',
        msgLeft: 'покинул комнату',
        you: '(вы)',
        typing1: 'печатает...',
        typingSomeone: 'Кто-то печатает...',
        typingMany: 'Несколько человек печатают...',
        myMsgsCleared: 'Ваши сообщения удалены.',
        cleared: 'очищено',
        uploadError: 'Ошибка загрузки',
        fileTooBig: 'Файл слишком большой (макс 5МБ)',
        confirmTitle: 'Вы уверены?',
        btnCancel: 'Отмена',
        btnConfirm: 'Да, Удалить'
    },
    ph: {
        modalTitle: 'Pumasok sa Talk2',
        modalText: 'Pumili ng palayaw para sumali:',
        placeholderNickname: 'hal. KosmikManlalakbay',
        btnConnect: 'Kumonekta',
        btnRandom: 'Random na Pangalan',
        systemBanner: 'Nililinis ang data sa room na ito tuwing 24 oras.',
        placeholderMessage: 'Mag-type ng mensahe...',
        sidebarTitle: 'Online',
        btnClearMyMsgs: 'Burahin ang Aking Mga Mensahe',
        confirmClear: 'Sigurado ka bang gusto mong burahin LAMANG ang iyong mga mensahe?',
        confirmDelete: 'Gusto mo bang burahin ang mensaheng ito?',
        msgJoined: 'sumali sa room',
        msgLeft: 'umalis sa room',
        you: '(ikaw)',
        typing1: 'nagta-type...',
        typingSomeone: 'May nagta-type...',
        typingMany: 'Maraming nagta-type...',
        myMsgsCleared: 'Nabura na ang iyong mga mensahe.',
        cleared: 'na-clear',
        uploadError: 'Nabigo ang upload',
        fileTooBig: 'Masyadong malaki ang file (max 5MB)',
        confirmTitle: 'Sigurado ka ba?',
        btnCancel: 'Kanselahin',
        btnConfirm: 'Oo, Burahin',
        expiryTitle: 'Tagal ng Mensahe',
        expiryDesc: 'Pumili kung gaano katagal mananatili ang mga mensahe.'
    }
};

// State Variables
let pendingConfirmAction = null;
let typingTimeout = null;
let isTyping = false;
let typingUsers = {};
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

// --- Language Detection ---
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
            else storedLang = 'en';
        } catch (e) {
            const nav = navigator.language.toLowerCase();
            if (nav.startsWith('tr')) storedLang = 'tr';
            else if (nav.startsWith('de')) storedLang = 'de';
            else if (nav.startsWith('ru')) storedLang = 'ru';
            else if (nav.startsWith('fil') || nav.startsWith('tl')) storedLang = 'ph';
            else storedLang = 'en';
        }
        localStorage.setItem('talk2_lang', storedLang);
    }
    
    currentLang = storedLang;
    if (!['en', 'tr', 'de', 'ru', 'ph'].includes(currentLang)) currentLang = 'en';
    applyLanguage(currentLang);
    
    // Show nickname modal after language is applied
    const nicknameModal = document.getElementById('nickname-modal');
    if (nicknameModal) nicknameModal.style.opacity = '1';
}

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
    const msgData = {
        room: roomId,
        nickname: nickname,
        content: content,
        type: type
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

function deleteMessage(id) {
    const t = translations[currentLang] || translations['en'];
    showConfirm(t.confirmDelete, () => {
        socket.emit('deleteMessage', id);
    });
}
window.deleteMessage = deleteMessage;

function showConfirm(message, onConfirm) {
    const t = translations[currentLang] || translations['en'];
    if (confirmText) confirmText.textContent = message;
    if (confirmTitle) confirmTitle.textContent = t.confirmTitle || 'Confirm';
    if (confirmYesBtn) confirmYesBtn.textContent = t.btnConfirm || 'Yes';
    if (confirmCancelBtn) confirmCancelBtn.textContent = t.btnCancel || 'Cancel';
    
    pendingConfirmAction = onConfirm;
    if (confirmModal) {
        confirmModal.classList.remove('hidden');
        confirmModal.style.display = 'flex';
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
        const t = translations[currentLang] || translations['en'];
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
    const t = translations[currentLang] || translations['en'];
    
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
        contentHtml = `<img src="${imgPath}" alt="Image" onclick="window.open(this.src, '_blank')" loading="lazy" />`;
        msgTextForReply = '[Image]';
    } else {
        msgTextForReply = msg.content || '';
        contentHtml = escapeHtml(msgTextForReply);
    }

    const t = translations[currentLang] || translations['en'];
    const displayName = isSelf ? (currentLang === 'tr' ? 'Sen' : 'You') : escapeHtml(msg.nickname);
    const deleteTitle = currentLang === 'tr' ? 'Sil' : 'Delete';

    div.innerHTML = `
        <div class="meta">
            ${isSelf 
                ? `<span class="time">${time}</span>
                   <span class="nickname">${displayName}</span>
                   <button class="delete-msg-btn" onclick="deleteMessage('${msg.id}')" title="${deleteTitle}"><i class="fas fa-times"></i></button>
                   <span class="read-status" id="read-${msg.id}"></span>`
                : `<span class="nickname">${displayName}</span>
                   <span class="time">${time}</span>`
            }
        </div>
        <div class="body">${contentHtml}</div>
    `;
    
    messagesList.appendChild(div);

    if (!isSelf && window.msgObserver) {
        window.msgObserver.observe(div);
    }
}

function addSystemMessage(data) {
    if (!messagesList) return;
    
    const div = document.createElement('div');
    div.className = `system-message ${data.type || 'info'}`;
    
    const t = translations[currentLang] || translations['en'];
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
            
            if (file.size > 5 * 1024 * 1024) {
                alert(translations[currentLang].fileTooBig);
                return;
            }
            
            const formData = new FormData();
            formData.append('image', file);
            
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            uploadBtn.disabled = true;
            
            try {
                const response = await fetch('/api/upload', { method: 'POST', body: formData });
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
    }
    
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
            const t = translations[currentLang] || translations['en'];
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
    
    // Cancel Reply
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }
    
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
    
    // Language Selector
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            localStorage.setItem('talk2_lang', currentLang);
            applyLanguage(currentLang);
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
