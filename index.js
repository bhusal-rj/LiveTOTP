// Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

let timerInterval;

// Generate random Base32 secret
function generateSecret(length = 32) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytesToBase32(bytes);
}

// Convert bytes to Base32
function bytesToBase32(bytes) {
    let result = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;

        while (bits >= 5) {
            result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return result;
}

// Convert Base32 to bytes
function base32ToBytes(base32) {
    const bytes = [];
    let bits = 0;
    let value = 0;

    for (let i = 0; i < base32.length; i++) {
        const char = base32.charAt(i).toUpperCase();
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) continue;

        value = (value << 5) | index;
        bits += 5;

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return new Uint8Array(bytes);
}

// HMAC-SHA1
async function hmacSha1(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Uint8Array(signature);
}

// Calculate TOTP with detailed computation steps
async function calculateTOTP(secret, timeStep = 30, returnDetails = false) {
    const key = base32ToBytes(secret);
    const currentTime = Date.now();
    const time = Math.floor(currentTime / 1000 / timeStep);
    const timeBytes = new ArrayBuffer(8);
    const view = new DataView(timeBytes);
    view.setUint32(4, time >>> 0, false);
    view.setUint32(0, (time / 0x100000000) >>> 0, false);

    const hmac = await hmacSha1(key, new Uint8Array(timeBytes));
    const offset = hmac[19] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    const otp = (code % 1000000).toString().padStart(6, '0');
    const formattedOtp = otp.slice(0, 3) + ' ' + otp.slice(3);

    if (returnDetails) {
        return {
            otp: formattedOtp,
            currentTime: currentTime,
            unixTime: Math.floor(currentTime / 1000),
            timeCounter: time,
            secretBytes: key.length,
            hmac: Array.from(hmac).map(b => b.toString(16).padStart(2, '0')).join(''),
            offset: offset,
            truncatedCode: code,
            rawOtp: otp
        };
    }

    return formattedOtp;
}

// Generate QR code
function generateQR(secret) {
    const otpauth = `otpauth://totp/LiveTOTP?secret=${secret}&issuer=LiveTOTP`;
    const qrcodeDiv = document.getElementById('qrcode');
    qrcodeDiv.innerHTML = '';
    new QRCode(qrcodeDiv, {
        text: otpauth,
        width: 160,
        height: 160,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Update TOTP display
async function updateTOTP() {
    const secret = document.getElementById('secretKey').textContent;
    if (secret) {
        const totp = await calculateTOTP(secret);
        document.getElementById('totpCode').textContent = totp;
    }
}

// Update timer
function updateTimer() {
    const now = Date.now() / 1000;
    const seconds = 30 - (Math.floor(now) % 30);
    document.getElementById('timer').textContent = seconds;
    
    // Update SVG ring
    const circle = document.getElementById('timerRing');
    const circumference = 2 * Math.PI * 28; // r=28
    const offset = circumference - (seconds / 30) * circumference;
    circle.style.strokeDashoffset = offset;

    if (seconds === 30) {
        updateTOTP();
    }
}

// Welcome screen transition
function showMainApp() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const appContainer = document.getElementById('appContainer');
    
    // Fade out welcome screen
    welcomeScreen.style.transition = 'opacity 0.6s ease-out';
    welcomeScreen.style.opacity = '0';
    
    setTimeout(() => {
        welcomeScreen.style.display = 'none';
        appContainer.classList.add('active');
    }, 600);
}

// Copy to clipboard
document.getElementById('copyBtn').addEventListener('click', () => {
    const secret = document.getElementById('secretKey').textContent;
    navigator.clipboard.writeText(secret).then(() => {
        const btn = document.getElementById('copyBtn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        btn.style.color = '#10b981';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.color = '';
        }, 2000);
    });
});

// Get Started button - transition to main app
document.getElementById('getStartedBtn').addEventListener('click', () => {
    showMainApp();
});

// Generate button - create new TOTP secret
document.getElementById('generateBtn').addEventListener('click', async () => {
    const secret = generateSecret();
    document.getElementById('secretKey').textContent = secret;
    generateQR(secret);
    
    const displaySection = document.getElementById('displaySection');
    displaySection.style.display = 'flex';
    
    await updateTOTP();
    
    if (timerInterval) clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
});

// Modal controls
const modal = document.getElementById('totpModal');
const howItWorksBtn = document.getElementById('howItWorksBtn');
const closeModalBtn = document.getElementById('closeModal');

// Open modal and populate with computation details
howItWorksBtn.addEventListener('click', async () => {
    const secret = document.getElementById('secretKey').textContent;
    if (!secret) return;

    // Get detailed computation
    const details = await calculateTOTP(secret, 30, true);

    // Populate modal with live data
    document.getElementById('modalCurrentTime').textContent = details.currentTime.toLocaleString();
    document.getElementById('modalUnixTime').textContent = details.unixTime.toLocaleString();
    document.getElementById('modalTimeCounter').textContent = details.timeCounter;
    document.getElementById('modalSecret').textContent = secret;
    document.getElementById('modalSecretBytes').textContent = details.secretBytes;
    document.getElementById('modalHmac').textContent = details.hmac;
    document.getElementById('modalOffset').textContent = details.offset;
    document.getElementById('modalTruncated').textContent = details.truncatedCode.toLocaleString();
    document.getElementById('modalCodeCalc').textContent = details.truncatedCode.toLocaleString();
    document.getElementById('modalFinalCode').textContent = details.otp;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
});

// Close modal
closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
});

// Close modal on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
});