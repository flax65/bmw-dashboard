// ═══════════════════════════════════════════════
//  BLE + APP STATE
// ═══════════════════════════════════════════════

const SERVICE_UUID        = '5bc1a100-36e1-4b13-9bbf-8547cb834f11';
const CHARACTERISTIC_UUID = '5bc1a101-36e1-4b13-9bbf-8547cb834f11';
const DEVICE_NAME         = 'BMW_R1100S_Dashboard';
const NUM_PAGES           = 2;

let data = { rpm:0, spd:0, iat:0, clt:0, lmd:0, bat:0, gear:'-', tot:0, trip:0, page:0 };
let currentPage  = 0;
let pollInterval = null;
let bleDevice    = null;
let retryTimer   = null;
let retryCount   = 0;

const st = document.getElementById('st');
const pi = document.getElementById('pi');

// ── Page management ──
function switchPage(n) {
    const target = ((n % NUM_PAGES) + NUM_PAGES) % NUM_PAGES;
    if (target === currentPage) return;
    document.getElementById('page'+currentPage).classList.remove('active');
    currentPage = target;
    document.getElementById('page'+currentPage).classList.add('active');
    document.body.className = currentPage===1 ? 'mapActive' : '';
    updatePageIndicator();
    if (currentPage===1) initMap();
    else resizeAndDraw();
}

function updatePageIndicator() {
    let s='';
    for (let i=0; i<NUM_PAGES; i++) s += (i===currentPage?'●':'○');
    pi.textContent = s;
}

// ── BLE ──
async function setupConnection(device) {
    bleDevice = device;
    st.textContent = 'CONNECTING...'; st.className = '';
    if (retryTimer) { clearTimeout(retryTimer); retryTimer=null; }

    try {
        const server  = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const charct  = await service.getCharacteristic(CHARACTERISTIC_UUID);

        const readData = async () => {
            try {
                const value  = await charct.readValue();
                const parsed = JSON.parse(new TextDecoder().decode(value));
                if (parsed.page!==undefined && parsed.page!==currentPage) switchPage(parsed.page);
                Object.assign(data, parsed);
                if (currentPage===0) draw();
                else updateMapOverlay();
                st.textContent='LIVE'; st.className='ok';
            } catch(e) {}
        };

        await readData();
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(readData, 250);

        device.addEventListener('gattserverdisconnected', () => {
            if (pollInterval) clearInterval(pollInterval);
            st.textContent='RECONNECTING...'; st.className='err';
            scheduleRetry(device);
        });

        st.textContent='LIVE'; st.className='ok';
    } catch(e) {
        st.textContent='ERROR'; st.className='err';
        scheduleRetry(device);
    }
}

function scheduleRetry(device) {
    if (retryTimer) clearTimeout(retryTimer);
    if (retryCount >= 20) {
        retryCount=0; st.textContent='TAP TO CONNECT'; st.className='err'; bleDevice=null; return;
    }
    retryCount++;
    retryTimer = setTimeout(() => setupConnection(device), 2000);
}

async function connectBLE() {
    if (!navigator.bluetooth) { st.textContent='BT NOT SUPPORTED'; st.className='err'; return; }
    try {
        st.textContent='SCANNING...'; st.className='';
        let device = await tryKnownDevice();
        if (!device) {
            device = await navigator.bluetooth.requestDevice({
                filters:[{name:DEVICE_NAME}], optionalServices:[SERVICE_UUID]
            });
        }
        retryCount=0;
        await setupConnection(device);
    } catch(e) { st.textContent='TAP TO CONNECT'; st.className='err'; }
}

async function tryKnownDevice() {
    if (!navigator.bluetooth.getDevices) return null;
    try {
        const devices = await navigator.bluetooth.getDevices();
        return devices.find(d => d.name===DEVICE_NAME) || null;
    } catch(e) { return null; }
}

// ── Init ──
window.addEventListener('load', async () => {
    const tBtn = document.getElementById('btnTheme');
    tBtn.textContent = theme==='dark' ? '☾ DARK' : '☀ LIGHT';
    tBtn.classList.toggle('active', theme==='dark');

    resizeAndDraw();
    setTimeout(resizeAndDraw,100);
    setTimeout(resizeAndDraw,300);
    setTimeout(resizeAndDraw,800);

    const device = await tryKnownDevice();
    if (device) { st.textContent='AUTO CONNECT...'; retryCount=0; await setupConnection(device); }
});

// ── User interactions ──
document.getElementById('c').addEventListener('click', () => {
    if (!bleDevice?.gatt?.connected) connectBLE();
});

document.getElementById('btnTheme').addEventListener('click', () => {
    theme = theme==='light' ? 'dark' : 'light';
    localStorage.setItem('dashTheme', theme);
    const btn = document.getElementById('btnTheme');
    btn.textContent = theme==='dark' ? '☾ DARK' : '☀ LIGHT';
    btn.classList.toggle('active', theme==='dark');
    if (currentPage===0) draw();
});

document.getElementById('btnNext').addEventListener('click', () => {
    switchPage((currentPage+1) % NUM_PAGES);
});
