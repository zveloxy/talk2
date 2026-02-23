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
// Voice Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let soundEnabled = localStorage.getItem('talk2_sound') !== 'false';
let autoTranslate = localStorage.getItem('talk2_autotranslate') === 'true'; // Default OFF
let translateTargetLang = localStorage.getItem('talk2_translateLang') || null; // Persisted translation target
let replyingTo = null;
let notificationSound = null;
let pendingTranslations = new Set(); // Track messages being translated

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
let autoTranslateBtn;

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
async function applyLanguage(lang) {
    await loadLanguage(lang);
    // Update language display after translations are loaded
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
    if (currentFlag && langData[lang]) {
        currentFlag.src = langData[lang].flag;
    }
    if (currentLangText && langData[lang]) {
        currentLangText.textContent = langData[lang].text;
    }
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === lang);
    });
}

// --- Core Functions ---
function setNickname(name) {
    nickname = name;
    localStorage.setItem('antigravity_nickname', name);
    if (modal) modal.style.display = 'none';
    joinRoom();
}

function joinRoom() {
    socket.emit('join', roomId, nickname, userId, currentLang);
}

function sendMessage(content, type, extra = {}) {
    
    const msgData = {
        room: roomId,
        nickname: nickname,
        content: content,
        type: type,
        image_path: (type === 'image' || type === 'spoiler_image') ? content : null,
        video_path: (type === 'video' || type === 'spoiler_video') ? content : null,
        audio_path: type === 'audio' ? content : null,
        spoiler: extra.spoiler || false,
        replyTo: replyingTo ? { id: replyingTo.id, nickname: replyingTo.nickname, text: replyingTo.text } : null
    };
    
    socket.emit('message', msgData);
    cancelReply();
}

function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing', false);
    }
    clearTimeout(typingTimeout);
}

// --- Reply System ---

function startReply(msgId, msgNickname, msgText) {
    replyingTo = { id: msgId, nickname: msgNickname, text: msgText };
    if (replyPreview) replyPreview.classList.remove('hidden');
    if (replyToName) replyToName.textContent = msgNickname;
    if (replyToText) replyToText.textContent = msgText.length > 50 ? msgText.substring(0, 50) + '...' : msgText;
    if (messageInput) messageInput.focus();
}

function cancelReply() {
    replyingTo = null;
    if (replyPreview) replyPreview.classList.add('hidden');
}

window.startReply = startReply;

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

// --- Translation Functions ---
let pendingTranslateData = null; // Store msgId and text while user selects language

function showTranslateModal(msgId, text) {
    // If user already has a preferred translation language, use it directly
    if (translateTargetLang) {
        requestTranslation(msgId, text, translateTargetLang);
        return;
    }
    
    // Store pending data and open the dropdown
    pendingTranslateData = { msgId, text };
    const translateDropdownMenu = document.getElementById('translate-dropdown-menu');
    if (translateDropdownMenu) {
        translateDropdownMenu.classList.add('show');
    }
}

function hideTranslateModal() {
    const translateOverlay = document.getElementById('translate-overlay');
    if (translateOverlay) {
        translateOverlay.classList.add('hidden');
        translateOverlay.style.display = 'none';
    }
    pendingTranslateData = null;
}

function setTranslateTargetLang(lang) {
    translateTargetLang = lang;
    localStorage.setItem('talk2_translateLang', lang);
    updateTranslateLangDisplay();
    
    // Re-translate all existing messages with translate buttons
    retranslateAllMessages(lang);
}

function retranslateAllMessages(targetLang) {
    // Find all translate buttons and trigger re-translation
    const translateBtns = document.querySelectorAll('.translate-btn');
    translateBtns.forEach(btn => {
        const msgId = btn.dataset.msgId;
        const text = btn.dataset.text;
        if (msgId && text && !pendingTranslations.has(msgId)) {
            requestTranslation(msgId, text, targetLang);
        }
    });
}

function clearTranslateTargetLang() {
    translateTargetLang = null;
    localStorage.removeItem('talk2_translateLang');
    updateTranslateLangDisplay();
}

function updateTranslateLangDisplay() {
    const btn = document.getElementById('translate-dropdown-btn');
    const textSpan = document.getElementById('translate-lang-text');
    
    if (btn && textSpan) {
        if (translateTargetLang) {
            const langName = TRANSLATE_LANGS[translateTargetLang]?.name || translateTargetLang.toUpperCase();
            textSpan.textContent = langName.length > 8 ? langName.substring(0, 6) + '...' : langName;
            btn.classList.add('active');
        } else {
            textSpan.textContent = '--';
            btn.classList.remove('active');
        }
    }
    
    // Update selected state in dropdown options
    document.querySelectorAll('.translate-lang-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.lang === translateTargetLang);
    });
}

function requestTranslation(msgId, text, targetLang) {
    if (pendingTranslations.has(msgId)) return; // Already translating
    
    pendingTranslations.add(msgId);
    
    // Show loading state on translate button
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (msgEl) {
        const translateBtn = msgEl.querySelector('.translate-btn');
        if (translateBtn) {
            translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            translateBtn.disabled = true;
        }
    }
    
    // Source language is auto-detected, target language is user's choice
    console.log('=== CLIENT TRANSLATION REQUEST ===');
    console.log('Sending targetLang:', targetLang);
    console.log('translateTargetLang variable is:', translateTargetLang);
    socket.emit('translateMessage', { msgId, text, sourceLang: 'auto', targetLang });
}

function updateAutoTranslateButton() {
    if (!autoTranslateBtn) return;
    const icon = autoTranslateBtn.querySelector('i');
    if (icon) {
        autoTranslateBtn.classList.toggle('auto-translate-active', autoTranslate);
        autoTranslateBtn.title = autoTranslate 
            ? (loadedTranslations[currentLang]?.autoTranslateOn || 'Auto-translate enabled')
            : (loadedTranslations[currentLang]?.autoTranslateOff || 'Auto-translate disabled');
    }
}

// Supported translation languages
const TRANSLATE_LANGS = {
    'en': { name: 'English', flag: '/flags/us.svg' },
    'tr': { name: 'Türkçe', flag: '/flags/tr.svg' },
    'de': { name: 'Deutsch', flag: '/flags/de.svg' },
    'ru': { name: 'Русский', flag: '/flags/ru.svg' },
    'es': { name: 'Español', flag: '/flags/es.svg' },
    'fr': { name: 'Français', flag: '/flags/fr.svg' },
    'it': { name: 'Italiano', flag: '/flags/it.svg' },
    'pt': { name: 'Português', flag: '/flags/br.svg' },
    'zh': { name: '中文', flag: '/flags/cn.svg' },
    'ja': { name: '日本語', flag: '/flags/jp.svg' },
    'ko': { name: '한국어', flag: '/flags/kr.svg' },
    'ar': { name: 'العربية', flag: '/flags/sa.svg' },
    'hi': { name: 'हिन्दी', flag: '/flags/in.svg' },
    'nl': { name: 'Nederlands', flag: '/flags/nl.svg' },
    'pl': { name: 'Polski', flag: '/flags/pl.svg' },
    'sv': { name: 'Svenska', flag: '/flags/se.svg' },
    'da': { name: 'Dansk', flag: '/flags/dk.svg' },
    'no': { name: 'Norsk', flag: '/flags/no.svg' },
    'fi': { name: 'Suomi', flag: '/flags/fi.svg' },
    'el': { name: 'Ελληνικά', flag: '/flags/gr.svg' },
    'cs': { name: 'Čeština', flag: '/flags/cz.svg' },
    'ro': { name: 'Română', flag: '/flags/ro.svg' },
    'hu': { name: 'Magyar', flag: '/flags/hu.svg' },
    'uk': { name: 'Українська', flag: '/flags/ua.svg' },
    'th': { name: 'ไทย', flag: '/flags/th.svg' },
    'vi': { name: 'Tiếng Việt', flag: '/flags/vn.svg' },
    'id': { name: 'Indonesia', flag: '/flags/id.svg' },
    'ms': { name: 'Melayu', flag: '/flags/my.svg' },
    'tl': { name: 'Filipino', flag: '/flags/ph.svg' },
    'he': { name: 'עברית', flag: '/flags/il.svg' }
};

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
        li.innerHTML = `<span class="status-dot online"></span> ${escapeHtml(user.nickname)} ${isMe ? t.you : ''}`;
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
    } else if (msg.type === 'spoiler_image') {
        const imgPath = msg.image_path || msg.content;
        contentHtml = `<div class="spoiler-container" id="spoiler-${msg.id}">
            <div class="spoiler-cover" onclick="document.getElementById('spoiler-${msg.id}').classList.add('revealed')">
                <i class="fas fa-eye-slash"></i> Fotoğraf
            </div>
            <img src="${imgPath}" alt="Image" class="lightbox-trigger" loading="lazy" style="display:none" />
        </div>`;
        msgTextForReply = '[Spoiler Image]';
    } else if (msg.type === 'audio') {
        const audioId = `audio-${msg.id}`;
        contentHtml = `<div class="custom-audio-player" id="aplayer-${audioId}">
            <button class="audio-play-btn" data-audio-id="${audioId}"><i class="fas fa-play"></i></button>
            <div class="audio-waveform-bars" data-audio-id="${audioId}">
                ${Array.from({length: 20}, () => `<div class="audio-bar" style="height:${Math.random() * 60 + 20}%"></div>`).join('')}
            </div>
            <span class="audio-time" id="atime-${audioId}">0:00</span>
            <audio id="${audioId}" src="${msg.content}" preload="metadata"></audio>
        </div>`;
        msgTextForReply = '[Audio]';
        
        // Initialize custom audio player after DOM insert
        requestAnimationFrame(() => initAudioPlayer(audioId));
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
    } else if (msg.type === 'spoiler_video') {
        let videoPath = msg.video_path || msg.media_url || msg.content;
        const videoId = `video-${msg.id}`;
        contentHtml = `<div class="spoiler-container" id="spoiler-${msg.id}">
            <div class="spoiler-cover" onclick="document.getElementById('spoiler-${msg.id}').classList.add('revealed'); setTimeout(function(){ initVideoPlayer('${videoId}'); }, 100);">
                <i class="fas fa-eye-slash"></i> Video
            </div>
            <div class="custom-video-player" id="player-${videoId}" style="display:none">
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
        </div>`;
        msgTextForReply = '[Spoiler Video]';
    } else {
        msgTextForReply = msg.content || '';
        contentHtml = escapeHtml(msgTextForReply);
    }

    // Reply quote bubble
    let replyHtml = '';
    if (msg.replyTo && msg.replyTo.nickname) {
        const replyText = msg.replyTo.text ? escapeHtml(msg.replyTo.text.length > 60 ? msg.replyTo.text.substring(0, 60) + '...' : msg.replyTo.text) : '';
        replyHtml = `<div class="quoted-reply">
            <strong>${escapeHtml(msg.replyTo.nickname)}</strong>
            <span>${replyText || '[Medya]'}</span>
        </div>`;
    }

    const t = loadedTranslations[currentLang] || loadedTranslations['en'];
    const displayName = isSelf ? (t.you || '(you)') : escapeHtml(msg.nickname);
    const deleteTitle = t.btnConfirm ? t.btnConfirm.split(',')[0] : 'Delete';
    const translateTitle = t.translateBtn || 'Translate';
    
    // Only show translate button for text messages from others
    const showTranslateBtn = !isSelf && msg.type === 'text' && msg.content;

    // Reply button data
    const replyBtnText = msg.type === 'text' ? escapeHtml(msg.content || '') : `[${msg.type}]`;

    div.innerHTML = `
        <div class="meta">
            ${isSelf 
                ? `<span class="time">${time}</span>
                   <span class="nickname">${displayName}</span>
                   <button class="delete-msg-btn" data-delete-id="${msg.id}" data-file-url="${msg.image_path || msg.video_path || ''}" title="${deleteTitle}"><i class="fas fa-times"></i></button>
                   <span class="read-status" id="read-${msg.id}"></span>`
                : `<span class="nickname">${displayName}</span>
                   <span class="time">${time}</span>
                   <button class="reply-msg-btn" onclick="startReply('${msg.id}', '${escapeHtml(msg.nickname)}', '${replyBtnText.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" title="Yanıtla"><i class="fas fa-reply"></i></button>
                   ${showTranslateBtn ? `<button class="translate-btn" data-msg-id="${msg.id}" data-text="${escapeHtml(msg.content)}" title="${translateTitle}"><i class="fas fa-language"></i></button>` : ''}`
            }
        </div>
        ${replyHtml}
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
    
    // Auto-translate if enabled and it's a text message from another user
    if (autoTranslate && showTranslateBtn) {
        requestTranslation(msg.id, msg.content, translateTargetLang || currentLang);
    }
}

function scrollToBottom() {
    if (messagesList) {
        const container = messagesList.parentElement;
        // Use requestAnimationFrame to ensure DOM paint is complete
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
        // Double check a bit later for slow rendering elements
        setTimeout(() => {
            if(container) container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

function addSystemMessage(data) {
    if (!messagesList) return;
    
    const div = document.createElement('div');
    div.className = `system-message ${data.type || 'info'}`;
    
    const t = loadedTranslations[currentLang] || loadedTranslations['en'] || {};
    let text = data.content || '';
    
    if (data.type === 'join') text = `${data.nickname} ${t.msgJoined || 'joined the room'}`;
    else if (data.type === 'leave') text = `${data.nickname} ${t.msgLeft || 'left the room'}`;
    else if (data.type === 'expiry') {
        const hours = data.hours;
        if (hours === 1) {
            text = (t.expiryChanged1h || '{nickname} set message expiry to 1 hour').replace('{nickname}', data.nickname);
        } else if (hours === 168) {
            text = (t.expiryChanged7d || '{nickname} set message expiry to 7 days').replace('{nickname}', data.nickname);
        } else {
            text = (t.expiryChangedHours || '{nickname} set message expiry to {hours} hours').replace('{nickname}', data.nickname).replace('{hours}', hours);
        }
    }
    
    let icon = 'info-circle';
    if (data.type === 'join') icon = 'arrow-right-to-bracket';
    else if (data.type === 'leave') icon = 'arrow-right-from-bracket';
    else if (data.type === 'expiry') icon = 'clock';
    
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
            // The scrollable element is the container, not the messages list itself
            const scrollContainer = messagesList.parentElement; // .chat-container
            
            scrollContainer.addEventListener('scroll', () => {
                // Show button only if we are more than 50px away from bottom
                const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 50;
                scrollBottomBtn.classList.toggle('hidden', isNearBottom);
            });
            
            scrollBottomBtn.addEventListener('click', () => {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
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
            
            // If there's a pending image upload, send that instead of text
            if (pendingUploadFile) {
                const isSpoiler = spoilerCheckbox ? spoilerCheckbox.checked : false;
                const uploadType = isSpoiler ? ('spoiler_' + pendingUploadType) : pendingUploadType;
                console.log('Sending pending file, type:', uploadType);
                doUpload(pendingUploadFile, uploadType, false);
                return false;
            }
            
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
    
    // Image/Video Upload
    let pendingUploadFile = null;
    let pendingUploadType = null;
    const spoilerBar = document.getElementById('spoiler-toggle-bar');
    const spoilerCheckbox = document.getElementById('spoiler-checkbox');
    const uploadFilenameEl = document.getElementById('upload-filename');
    
    function doUpload(file, type, isSpoiler) {
        const formData = new FormData();
        formData.append('file', file);
        
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        uploadBtn.disabled = true;
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload.php', true);
        xhr.timeout = 120000;

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
                    console.log('UPLOAD SUCCESS:', data.url, 'Type:', type, 'Spoiler:', isSpoiler);
                    sendMessage(data.url, type, { spoiler: isSpoiler });
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
            // Hide spoiler bar
            if (spoilerBar) spoilerBar.classList.add('hidden');
            pendingUploadFile = null;
            pendingUploadType = null;
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
    }
    
    if (uploadBtn && imageInput) {
        uploadBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Determine file type
            const isVideo = file.type.startsWith('video/') || 
                ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(file.name.split('.').pop().toLowerCase());
            const isImage = file.type.startsWith('image/');
            
            const type = isVideo ? 'video' : 'image';
            const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;

            if (file.size > maxSize) {
                const t = loadedTranslations[currentLang] || loadedTranslations['en'];
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
                const maxMB = Math.round(maxSize / (1024 * 1024));
                showToast(`${t.fileTooBig || 'Dosya boyutu çok büyük!'} (${fileSizeMB}MB / Max: ${maxMB}MB)`);
                imageInput.value = '';
                return;
            }
            
            // Show spoiler toggle for images and videos
            pendingUploadFile = file;
            pendingUploadType = type;
            if (spoilerBar) spoilerBar.classList.remove('hidden');
            if (uploadFilenameEl) uploadFilenameEl.textContent = file.name;
            if (spoilerCheckbox) spoilerCheckbox.checked = false;
            showToast('Dosya hazır — göndermek için ✈️ butonuna basın');
        });
    }
    


    // ===== Voice Recording Logic =====
    const micBtn = document.getElementById('mic-btn');
    const recordingBar = document.getElementById('recording-bar');
    const recordingTimeEl = document.getElementById('recording-time');
    const cancelRecordingBtn = document.getElementById('cancel-recording');
    const sendRecordingBtn = document.getElementById('send-recording');
    const waveformCanvas = document.getElementById('recording-waveform');
    let audioContext = null;
    let analyser = null;
    let waveformAnimId = null;
    
    function formatRecordTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    function drawWaveform() {
        if (!analyser || !waveformCanvas) return;
        const ctx = waveformCanvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function draw() {
            waveformAnimId = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);
            
            const w = waveformCanvas.width;
            const h = waveformCanvas.height;
            ctx.clearRect(0, 0, w, h);
            
            // Draw waveform bars
            const barCount = 40;
            const barWidth = w / barCount - 1;
            const step = Math.floor(bufferLength / barCount);
            
            for (let i = 0; i < barCount; i++) {
                const val = dataArray[i * step];
                const barHeight = Math.max(2, ((val - 128) / 128) * h * 0.8 + h * 0.1);
                const x = i * (barWidth + 1);
                const y = (h - barHeight) / 2;
                
                ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + Math.abs(val - 128) / 128 * 0.6})`;
                ctx.fillRect(x, y, barWidth, barHeight);
            }
        }
        draw();
    }
    
    function stopWaveform() {
        if (waveformAnimId) {
            cancelAnimationFrame(waveformAnimId);
            waveformAnimId = null;
        }
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
            analyser = null;
        }
        if (waveformCanvas) {
            const ctx = waveformCanvas.getContext('2d');
            ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        }
    }
    
    function startRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunks = [];
                recordingSeconds = 0;
                
                // Setup AudioContext for waveform
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };
                
                mediaRecorder.onstop = () => {
                    stream.getTracks().forEach(t => t.stop());
                };
                
                mediaRecorder.start();
                
                // Show recording UI
                if (recordingBar) recordingBar.classList.remove('hidden');
                if (micBtn) micBtn.classList.add('recording');
                if (recordingTimeEl) recordingTimeEl.textContent = '0:00';
                
                // Start waveform visualization
                drawWaveform();
                
                // Start timer
                recordingTimer = setInterval(() => {
                    recordingSeconds++;
                    if (recordingTimeEl) recordingTimeEl.textContent = formatRecordTime(recordingSeconds);
                    if (recordingSeconds >= 120) {
                        stopAndSendRecording();
                    }
                }, 1000);
            })
            .catch(err => {
                console.error('Mic access denied:', err);
                showToast('Mikrofon erişimi reddedildi');
            });
    }
    
    function cancelRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        clearInterval(recordingTimer);
        stopWaveform();
        audioChunks = [];
        if (recordingBar) recordingBar.classList.add('hidden');
        if (micBtn) micBtn.classList.remove('recording');
    }
    
    function stopAndSendRecording() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        
        clearInterval(recordingTimer);
        stopWaveform();
        
        mediaRecorder.onstop = () => {
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
            
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            
            if (recordingBar) recordingBar.classList.add('hidden');
            if (micBtn) micBtn.classList.remove('recording');
            
            // Upload audio
            const formData = new FormData();
            formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
            
            showToast('Ses gönderiliyor...');
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload.php', true);
            xhr.timeout = 30000;
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        sendMessage(data.url, 'audio');
                    } catch (e) {
                        console.error('Audio upload parse error:', e);
                        showToast('Ses yükleme hatası');
                    }
                } else {
                    showToast('Ses yükleme başarısız');
                }
            };
            
            xhr.onerror = () => showToast('Ses yükleme ağ hatası');
            xhr.ontimeout = () => showToast('Ses yükleme zaman aşımı');
            xhr.send(formData);
        };
        
        mediaRecorder.stop();
    }
    
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopAndSendRecording();
            } else {
                startRecording();
            }
        });
    }
    
    if (cancelRecordingBtn) {
        cancelRecordingBtn.addEventListener('click', cancelRecording);
    }
    
    if (sendRecordingBtn) {
        sendRecordingBtn.addEventListener('click', stopAndSendRecording);
    }

    // Confirm Modal
    
    // Confirm Modal
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            if (confirmModal) {
                confirmModal.classList.add('hidden');
                confirmModal.style.display = '';
            }
            pendingConfirmAction = null;
        });
    }
    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            console.log('Confirm YES clicked, pendingAction:', !!pendingConfirmAction);
            if (pendingConfirmAction) pendingConfirmAction();
            if (confirmModal) {
                confirmModal.classList.add('hidden');
                confirmModal.style.display = '';
            }
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
    
    // Cancel Reply
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
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
    
    // Auto-Translate Toggle
    autoTranslateBtn = document.getElementById('auto-translate-btn');
    if (autoTranslateBtn) {
        updateAutoTranslateButton();
        autoTranslateBtn.addEventListener('click', () => {
            autoTranslate = !autoTranslate;
            localStorage.setItem('talk2_autotranslate', autoTranslate);
            updateAutoTranslateButton();
            const t = loadedTranslations[currentLang] || loadedTranslations['en'] || {};
            showToast(autoTranslate 
                ? (t.autoTranslateOn || 'Otomatik çeviri açık') 
                : (t.autoTranslateOff || 'Otomatik çeviri kapalı'));
        });
    }
    
    // --- Mobile Sidebar Button Handlers ---
    const shareBtnMobile = document.getElementById('share-btn-mobile');
    if (shareBtnMobile) {
        shareBtnMobile.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showToast(currentLang === 'tr' ? 'Link kopyalandı!' : 'Link copied!');
            }).catch(() => {
                showToast(currentLang === 'tr' ? 'Kopyalama başarısız' : 'Copy failed');
            });
        });
    }
    
    const soundToggleMobile = document.getElementById('sound-toggle-mobile');
    if (soundToggleMobile) {
        soundToggleMobile.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('talk2_sound', soundEnabled);
            updateSoundButtonIcon();
            showToast(soundEnabled ? (currentLang === 'tr' ? 'Ses açık' : 'Sound on') : (currentLang === 'tr' ? 'Ses kapalı' : 'Sound off'));
        });
    }
    
    const expiryBtnMobile = document.getElementById('expiry-btn-mobile');
    if (expiryBtnMobile) {
        expiryBtnMobile.addEventListener('click', () => {
            if (expiryOverlay) {
                expiryOverlay.classList.remove('hidden');
                expiryOverlay.style.display = 'flex';
            }
        });
    }
    
    const autoTranslateBtnMobile = document.getElementById('auto-translate-btn-mobile');
    if (autoTranslateBtnMobile) {
        autoTranslateBtnMobile.addEventListener('click', () => {
            autoTranslate = !autoTranslate;
            localStorage.setItem('talk2_autotranslate', autoTranslate);
            updateAutoTranslateButton();
            const t = loadedTranslations[currentLang] || loadedTranslations['en'] || {};
            showToast(autoTranslate 
                ? (t.autoTranslateOn || 'Otomatik çeviri açık') 
                : (t.autoTranslateOff || 'Otomatik çeviri kapalı'));
        });
    }
    
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', () => {
            sessionStorage.removeItem('talk2_nickname');
            sessionStorage.removeItem('talk2_room');
            window.location.href = '/';
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
                
                // Update expiry description to show selected time
                const hours = parseInt(opt.getAttribute('data-value'));
                const expiryDesc = document.querySelector('[data-i18n="expiryDesc"]');
                if (expiryDesc) {
                    const t = loadedTranslations[currentLang] || loadedTranslations['en'] || {};
                    if (hours === 1) {
                        expiryDesc.textContent = t.expirySelected1h || 'Messages will be deleted in 1 hour.';
                    } else if (hours === 168) {
                        expiryDesc.textContent = t.expirySelected7d || 'Messages will be deleted in 7 days.';
                    } else {
                        expiryDesc.textContent = (t.expirySelectedHours || 'Messages will be deleted in {hours} hours.').replace('{hours}', hours);
                    }
                }
                
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
            opt.addEventListener('click', async () => {
                const lang = opt.dataset.lang;
                currentLang = lang;
                localStorage.setItem('talk2_lang', currentLang);
                await applyLanguage(currentLang);
                updateExistingMessages(); // Update (sen)/(you) on existing messages
                updateTranslateLangDisplay(); // Ensure translation dropdown display stays correct
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
    
    // Prevent right-click context menu on images
    document.addEventListener('contextmenu', (e) => {
        if (e.target.tagName === 'IMG' && (e.target.classList.contains('lightbox-trigger') || e.target.id === 'lightbox-image')) {
            e.preventDefault();
            return false;
        }
    });
    
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
    console.log('messageDeleted received for:', msgId);
    const el = document.getElementById(`msg-${msgId}`);
    console.log('Found element:', !!el);
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

socket.on('userList', (users) => {
    // Update sidebar user list
    if (usersList) {
        usersList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-user"></i> ${escapeHtml(user.nickname)}${user.nickname === nickname ? ' (sen)' : ''}`;
            usersList.appendChild(li);
        });
    }
    
    // Update user count badges
    const count = users.length;
    if (userCount) userCount.textContent = count;
    if (sidebarUserCount) sidebarUserCount.textContent = count;
});

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

// --- Translation Response Handler ---
socket.on('translatedMessage', (data) => {
    const { msgId, translated, error } = data;
    
    // Remove from pending
    pendingTranslations.delete(msgId);
    
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;
    
    // Update translate button
    const translateBtn = msgEl.querySelector('.translate-btn');
    if (translateBtn) {
        translateBtn.innerHTML = '<i class="fas fa-language"></i>';
        translateBtn.disabled = false;
        if (!error) {
            translateBtn.classList.add('translated');
        }
    }
    
    // Add translated text to message body
    const body = msgEl.querySelector('.body');
    if (body && !error) {
        // Remove any existing translation
        const existingTranslation = body.querySelector('.translated-text');
        if (existingTranslation) existingTranslation.remove();
        
        // Add new translation
        const translatedDiv = document.createElement('div');
        translatedDiv.className = 'translated-text';
        translatedDiv.textContent = translated;
        body.appendChild(translatedDiv);
    }
});

// --- Translation Button Click Handler (Event Delegation) ---
document.addEventListener('click', (e) => {
    const translateBtn = e.target.closest('.translate-btn');
    if (translateBtn && !translateBtn.disabled) {
        const msgId = translateBtn.dataset.msgId;
        const text = translateBtn.dataset.text;
        if (msgId && text) {
            // Show language selector modal
            showTranslateModal(msgId, text);
        }
    }
});

// --- Translation Dropdown Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    const translateDropdownBtn = document.getElementById('translate-dropdown-btn');
    const translateDropdownMenu = document.getElementById('translate-dropdown-menu');
    
    // Toggle dropdown on button click
    if (translateDropdownBtn && translateDropdownMenu) {
        translateDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            translateDropdownMenu.classList.toggle('show');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (translateDropdownMenu && !e.target.closest('.translate-dropdown')) {
            translateDropdownMenu.classList.remove('show');
        }
    });
    
    // Language option click handlers
    document.querySelectorAll('.translate-lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const targetLang = opt.dataset.lang;
            if (targetLang) {
                setTranslateTargetLang(targetLang);
                translateDropdownMenu.classList.remove('show');
                
                // If there's a pending translation, do it
                if (pendingTranslateData) {
                    requestTranslation(pendingTranslateData.msgId, pendingTranslateData.text, targetLang);
                    pendingTranslateData = null;
                }
            }
        });
    });
    
    // Initialize display on load
    updateTranslateLangDisplay();
});

// Custom Audio Player Logic
function initAudioPlayer(audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    
    const container = document.getElementById(`aplayer-${audioId}`);
    if (!container) return;
    
    const playBtn = container.querySelector('.audio-play-btn');
    const timeDisplay = container.querySelector('.audio-time');
    const bars = container.querySelectorAll('.audio-bar');
    const barsWrap = container.querySelector('.audio-waveform-bars');
    
    function formatTime(s) {
        if (isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }
    
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            document.querySelectorAll('.custom-audio-player audio').forEach(a => {
                if (a !== audio && !a.paused) a.pause();
            });
            audio.play().catch(err => console.error('Audio play error:', err));
        } else {
            audio.pause();
        }
    });
    
    audio.addEventListener('play', () => {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        container.classList.add('playing');
    });
    
    audio.addEventListener('pause', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        container.classList.remove('playing');
    });
    
    audio.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        container.classList.remove('playing');
        bars.forEach(bar => bar.classList.remove('active'));
    });
    
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        
        const activeCount = Math.floor((pct / 100) * bars.length);
        bars.forEach((bar, i) => {
            bar.classList.toggle('active', i < activeCount);
        });
    });
    
    audio.addEventListener('loadedmetadata', () => {
        timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });
    
    // Seek by clicking waveform bars
    barsWrap.addEventListener('click', (e) => {
        const rect = barsWrap.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = pos * audio.duration;
    });
}

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
