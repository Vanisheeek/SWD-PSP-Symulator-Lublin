// --- STAŁA WERSJI APLIKACJI SWDST ---
const APP_VERSION = "SWDST 0.35 (Lublin i Powiat Lubelski - OSRM Routing)";

// --- MODUŁ AUDIO ---
const audioSelekt = new Audio('selekt.wav');
const audioCpr = new Audio('nowe zdarzenie odbierz.mp3');
const audioMotorola = new Audio('motorola.ogg');

function playSound(type) {
    if (type === 'cpr') { audioCpr.currentTime = 0; audioCpr.play().catch(() => {}); }
    else if (type === 'motorola') { audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {}); }
}

function playOspAlarmRepeated(ospCount) {
    if (ospCount <= 0) return;
    let played = 0;
    function playNext() {
        if (played < ospCount) {
            audioSelekt.currentTime = 0;
            audioSelekt.play().then(() => {
                played++;
                if (played < ospCount) setTimeout(playNext, 3000);
            }).catch(() => {});
        }
    }
    playNext();
}

// --- KLUCZE API ---
const _k = {
    g: "Z3NrX2dEQkRQMWhzenZtVjBQc010OWlXR2d5YjNGWUhzYW5FZ2twUEg2anNIWnY2WGFyY2o0QzM=",
    m: "QVEuQWI4Uk46SlNrZnU5ODBDQnBJUUZ0cnAtTEUxYkJYdU94ZzI0NmZmZUJXTmFSZUZkZ1E=",
    o: "c2stcHJvai1wRHZBV05wbDRnUzRzWlpFUkVSeWMtcGdqVGdXZEp1d3E5Y3pCMnhsc0JQZWd3Z3prbi16OEtidFVlQ2NxMHVlV2lnb0dhWDNpS1QzMmxia0ZKNk55MjJtWjMwTm41NnhjTlpZTYUzM3FUM3BtcUF6aGRfb3E4S2N1MTdCenRLVHQ="
};
function decodeKey(b64) { try { return atob(b64); } catch(e) { return ""; } }

// --- BEZPIECZNY SILNIK AI ---
async function callUniversalAI(systemPrompt, userPrompt, jsonMode = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.8,
                jsonMode: jsonMode
            })
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content.trim();
        }
    } catch (err) {}

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${decodeKey(_k.g)}` },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.8,
                max_tokens: 180,
                ...(jsonMode ? { response_format: { type: "json_object" } } : {})
            })
        });
        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content.trim();
    } catch (e) {}

    throw new Error("AI Offline");
}

// --- ZOPTYMALIZOWANY DEKOMPRESOR PROFILI POWIATÓW ---
function unpackProfile(raw) {
    const locationsDatabase = {}, gpsCoords = {}, realStreetsByTown = {}, unitExactLocations = {};
    raw.towns.forEach(([tName, regionDesc, lat, lng, streets]) => {
        locationsDatabase[tName] = `${regionDesc}, ${raw.countyName}, woj. ${raw.voivodeship}`;
        gpsCoords[tName] = [lat, lng];
        realStreetsByTown[tName] = streets;
    });
    const mapUnitList = (list) => list.map(([uName, town, addr, lat, lng, locked, vehs]) => {
        unitExactLocations[uName] = { town, address: addr, lat, lng, locked: !!locked };
        return {
            name: uName,
            vehicles: vehs.map(([id, name, obsada]) => ({ id, name, status: "green", obsada: obsada ?? 6 }))
        };
    });
    return {
        id: raw.id, name: raw.name, radioCallsign: raw.radioCallsign, desc: raw.desc,
        voivodeship: raw.voivodeship, countyName: raw.countyName, mapCenter: raw.mapCenter,
        bbox: raw.bbox, jrgList: raw.jrgList, defaultTown: raw.defaultTown,
        locationsDatabase, gpsCoords, realStreetsByTown, unitExactLocations,
        unitsPSP: mapUnitList(raw.psp), unitsOSP: mapUnitList(raw.osp)
    };
}

// INICJALIZACJA PROFILU — LUBLIN JEST DOMYŚLNYM I JEDYNYM REJONEM

// --- PROFIL LUBLIN / POWIAT LUBELSKI ---
const LUBLIN_PROFILE = {
    id: "lublin",
    name: "KM PSP Lublin — Lublin i Powiat Lubelski",
    radioCallsign: "Lublin 998",
    desc: "Miasto Lublin i Powiat Lubelski",
    voivodeship: "lubelskie",
    countyName: "Lublin i powiat lubelski",
    mapCenter: [51.2465, 22.5684],
    bbox: "22.20,51.05,22.85,51.45",
    jrgList: ["JRG 1 Lublin", "JRG 2 Lublin", "JRG 3 Lublin"],
    defaultTown: "Lublin",
    towns: [
        ["Lublin", "miasto na prawach powiatu", 51.2465, 22.5684, ["ul. Krakowskie Przedmieście", "ul. Lipowa", "ul. Narutowicza", "ul. Lubartowska", "ul. Kunickiego", "ul. Zamojska", "ul. Głęboka", "ul. Jana Pawła II", "ul. Mełgiewska", "al. Solidarności"]],
        ["Borzechów", "gmina Borzechów", 51.0900, 22.2800, ["ul. Główna", "ul. Szkolna"]],
        ["Wysokie", "gmina Wysokie", 50.9120, 22.6670, ["ul. Partyzantów", "ul. Szkolna"]],
        ["Zakrzew", "gmina Zakrzew", 50.9160, 22.5900, ["ul. Główna", "ul. Szkolna"]],
        ["Jastków", "gmina Jastków", 51.3040, 22.4350, ["ul. Lubelska", "ul. Szkolna", "ul. Polna"]],
        ["Moszenki", "gmina Jastków", 51.3150, 22.4260, ["ul. Strażacka", "ul. Główna"]],
        ["Płouszowice", "gmina Jastków", 51.2920, 22.4430, ["ul. Płouszowicka", "ul. Główna"]],
        ["Tomaszowice", "gmina Jastków", 51.2860, 22.4050, ["ul. Nałęczowska", "ul. Główna"]],
        ["Dąbrowica", "gmina Jastków", 51.2700, 22.4700, ["ul. Dąbrowicka", "ul. Główna"]],
        ["Snopków", "gmina Jastków", 51.2850, 22.4850, ["ul. Główna", "ul. Szkolna"]],
        ["Panieńszczyzna", "gmina Jastków", 51.3000, 22.4500, ["ul. Lubelska", "ul. Główna"]],
        ["Garbow", "gmina Garbów", 51.3550, 22.3290, ["ul. Krakowskie Przedmieście", "ul. Warszawska"]],
        ["Niemce", "gmina Niemce", 51.3610, 22.6380, ["ul. Lubelska", "ul. Różana"]],
        ["Wólka", "gmina Wólka", 51.2700, 22.6500, ["ul. Lubelska", "ul. Turystyczna"]],
        ["Konopnica", "gmina Konopnica", 51.2180, 22.4400, ["ul. Lipowa", "ul. Raszyńska"]],
        ["Wojciechów", "gmina Wojciechów", 51.2350, 22.2450, ["ul. Lubelska", "ul. Szkolna"]],
        ["Bełżyce", "gmina Bełżyce", 51.1740, 22.2800, ["ul. Lubelska", "ul. Bychawska"]],
        ["Bychawa", "gmina Bychawa", 51.0160, 22.5320, ["ul. Piłsudskiego", "ul. Lubelska"]],
        ["Strzyżewice", "gmina Strzyżewice", 51.0600, 22.4300, ["ul. Główna", "ul. Leśna"]],
        ["Niedrzwica Duża", "gmina Niedrzwica Duża", 51.1130, 22.3890, ["ul. Lubelska", "ul. Kraśnicka"]],
        ["Głusk", "gmina Głusk", 51.1830, 22.6000, ["ul. Głuska", "ul. Wesoła"]],
        ["Jabłonna", "gmina Jabłonna", 51.0830, 22.5900, ["ul. Lubelska", "ul. Szkolna"]],
        ["Krzczonów", "gmina Krzczonów", 51.0110, 22.7100, ["ul. Żeromskiego", "ul. Główna"]],
        ["Garbów", "gmina Garbów", 51.3550, 22.3290, ["ul. Warszawska", "ul. Krakowskie Przedmieście"]]
    ],
    // Dane pojazdów wpisane na podstawie wcześniej podanych informacji.
    psp: [
        ["KM PSP Lublin", "Lublin", "ul. Władysława Kunickiego", 51.2300, 22.5650, true,
            [["LF 301-25", "GCBA 5/32 MAN TGM 18.320/MotoTruck", 6],
             ["LF 301-21", "GBARt 2,5/16 Renault D16/MotoTruck", 6]]]
    ],
    osp: [
        ["OSP Płouszowice", "Płouszowice", "Płouszowice", 51.2920, 22.4430, true,
            [["LF 339-66", "GBARt 3/16 Renault D16", 6]]],
        ["OSP Moszenki", "Moszenki", "Moszenki", 51.3150, 22.4260, true,
            [["LF 339-24", "GBARt 2,5/16 Mercedes-Benz Atego", 6]]]
    ]
};

const _sourceProfiles = (typeof RAW_PROFILES !== "undefined" && Array.isArray(RAW_PROFILES)) ? RAW_PROFILES : [];
const _lublinProfiles = [..._sourceProfiles.filter(p => p.id !== "lublin"), LUBLIN_PROFILE];

const COUNTY_PROFILES = {};
_lublinProfiles.forEach(rp => { COUNTY_PROFILES[rp.id] = unpackProfile(rp); });

// --- ZMIENNE AKTYWNEGO POWIATU I ZALOGOWANEGO UŻYTKOWNIKA ---
let currentCountyId = "lublin";
let currentCountyCallsign = "Lublin 998";
let currentUserRank = "asp.";
let currentUserName = "";

let locationsDatabase = COUNTY_PROFILES.lublin ? { ...COUNTY_PROFILES.lublin.locationsDatabase } : {};
let townsList = Object.keys(locationsDatabase);
let realStreetsByTown = COUNTY_PROFILES.lublin ? { ...COUNTY_PROFILES.lublin.realStreetsByTown } : {};
let gpsCoords = COUNTY_PROFILES.lublin ? { ...COUNTY_PROFILES.lublin.gpsCoords } : {};
let unitExactLocations = COUNTY_PROFILES.lublin ? JSON.parse(JSON.stringify(COUNTY_PROFILES.lublin.unitExactLocations)) : {};
let unitsPSP = COUNTY_PROFILES.lublin ? JSON.parse(JSON.stringify(COUNTY_PROFILES.lublin.unitsPSP)) : [];
let unitsOSP = COUNTY_PROFILES.lublin ? JSON.parse(JSON.stringify(COUNTY_PROFILES.lublin.unitsOSP)) : [];

function getStorageKeyForCounty(countyId) { return `SWDST_SAVED_SHIFT_STATE_${countyId}_V2`; }

function getFormattedOperatorName() {
    return (currentUserName && currentUserName.trim() !== "")
        ? `${currentUserRank} ${currentUserName.trim()}`
        : "Nazwa Użytkownika (Niezalogowany)";
}

function updateStatusBarUserDisplay() {
    const firstSpan = document.querySelector('.status-bar span');
    if (!firstSpan || !COUNTY_PROFILES[currentCountyId]) return;
    const pName = COUNTY_PROFILES[currentCountyId].name;
    firstSpan.innerHTML = (currentUserName && currentUserName.trim() !== "")
        ? `Zalogowano jako: <b>${currentUserRank} ${currentUserName.trim()}</b> <span style="color:#0a246a; font-weight:bold; margin-left:6px;">[${pName}]</span>`
        : `Zalogowano jako: <b style="color:#777; font-style:italic;">Nazwa Użytkownika</b> <span style="color:#0a246a; font-weight:bold; margin-left:6px;">[${pName}]</span>`;
}

function updateJrgSelectOptions() {
    if (!COUNTY_PROFILES[currentCountyId]) return;
    const jrgList = COUNTY_PROFILES[currentCountyId].jrgList;
    ['inp-ev-jrg', 'inp-ev-lead', 'inp-ev-area'].forEach(selId => {
        const el = document.getElementById(selId);
        if (el) el.innerHTML = jrgList.map(j => `<option value="${j}">${j}</option>`).join('');
    });
}

// --- EKRAN LOGOWANIA / INFORMACJA O REJONIE ---
function ensureLauncherModalExists() {
    if (document.getElementById('modal-launcher')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-launcher';
    modal.style.cssText = 'display:flex; background:rgba(10, 36, 106, 0.45); z-index:12000;';

    const rawProf = [LUBLIN_PROFILE];
    const radiosHtml = rawProf.map((rp, idx) => `
        <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1.5px solid #0a246a; background: ${idx === 0 ? '#f0f5ff' : '#ffffff'}; cursor: pointer; border-radius: 3px;">
            <input type="radio" name="launcher-county" value="${rp.id}" ${idx === 0 ? 'checked' : ''}>
            <div>
                <div style="font-weight: bold; color: #0a246a; font-size: 12px;">${rp.name}</div>
                <div style="font-size: 10px; color: #444;">${rp.desc} • Kryptonim: <b>${rp.radioCallsign}</b></div>
            </div>
        </label>
    `).join('');

    modal.innerHTML = `
        <div class="modal-window" style="width: 520px; background: #ece9d8; border: 2px solid #0a246a; box-shadow: 0 6px 25px rgba(0,0,0,0.6);">
            <div class="modal-header" style="background: linear-gradient(90deg, #0a246a, #1d4f91); color: #fff; padding: 6px 10px; font-size: 13px;">
                <span>🚒 ${APP_VERSION} — Logowanie Dyspozytora KM PSP Lublin</span>
            </div>
            <div class="modal-body" style="padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">1. Dane Dyspozytora Stanowiska Kierowania</div>
                    <div style="display: flex; gap: 8px;">
                        <div class="form-group" style="width: 135px;">
                            <label>Stopień służbowy:</label>
                            <select id="launcher-rank" style="padding: 4px;">
                                <option value="str.">strażak</option><option value="st. str.">st. strażak</option>
                                <option value="sekc.">sekcyjny</option><option value="st. sekc.">st. sekcyjny</option>
                                <option value="mł. ogn.">mł. ogniomistrz</option><option value="ogn.">ogniomistrz</option>
                                <option value="st. ogn.">st. ogniomistrz</option><option value="mł. asp.">mł. aspirant</option>
                                <option value="asp." selected>aspirant</option><option value="st. asp.">st. aspirant</option>
                                <option value="asp. szt.">asp. sztabowy</option><option value="mł. kpt.">mł. kapitan</option>
                                <option value="kpt.">kapitan</option><option value="st. kpt.">st. kapitan</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Identyfikator / Nazwa operatora:</label>
                            <input type="text" id="launcher-username" placeholder="Nazwa Użytkownika" style="padding: 4px 8px; font-size: 12px; font-weight: bold;" onkeypress="if(event.key==='Enter') confirmLauncherLogin()">
                        </div>
                    </div>
                </div>
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">2. Wybór Rejonu Operacyjnego</div>
                    <div style="display: flex; flex-direction: column; gap: 5px; max-height: 270px; overflow-y: auto; padding-right: 4px;">
                        ${radiosHtml}
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-win" style="padding: 6px 18px; font-weight: bold; font-size: 12px; background: #e2f0d9; border: 1.5px solid #155724; color: #155724;" onclick="confirmLauncherLogin()">🚀 Rozpocznij służbę w SWD ➔</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openLauncherModal() {
    ensureLauncherModalExists();
    const inpUser = document.getElementById('launcher-username');
    const selRank = document.getElementById('launcher-rank');
    if (inpUser) inpUser.value = currentUserName;
    if (selRank) selRank.value = currentUserRank;
    const rad = document.querySelector(`input[name="launcher-county"][value="${currentCountyId}"]`);
    if (rad) rad.checked = true;
    document.getElementById('modal-launcher').style.display = 'flex';
}

function confirmLauncherLogin() {
    const inpUser = document.getElementById('launcher-username');
    const selRank = document.getElementById('launcher-rank');
    const chosenCountyRadio = document.querySelector('input[name="launcher-county"]:checked');

    currentUserRank = selRank ? selRank.value : "asp.";
    currentUserName = inpUser ? inpUser.value.trim() : "";
    const newCountyId = chosenCountyRadio ? chosenCountyRadio.value : "lublin";

    localStorage.setItem('SWDST_USER_SESSION', JSON.stringify({
        rank: currentUserRank, username: currentUserName, countyId: newCountyId
    }));

    applyCountyProfile(newCountyId);
    updateStatusBarUserDisplay();

    const modal = document.getElementById('modal-launcher');
    if (modal) modal.style.display = 'none';
}

function applyCountyProfile(countyId) {
    const profile = COUNTY_PROFILES[countyId] || COUNTY_PROFILES.lublin;
    if (!profile) return;
    
    currentCountyId = profile.id;
    currentCountyCallsign = profile.radioCallsign;

    locationsDatabase = { ...profile.locationsDatabase };
    townsList = Object.keys(locationsDatabase);
    realStreetsByTown = { ...profile.realStreetsByTown };
    gpsCoords = { ...profile.gpsCoords };
    unitExactLocations = JSON.parse(JSON.stringify(profile.unitExactLocations));
    unitsPSP = JSON.parse(JSON.stringify(profile.unitsPSP));
    unitsOSP = JSON.parse(JSON.stringify(profile.unitsOSP));

    unitsOSP.forEach(u => {
        u.vehicles.forEach(v => { v.obsada = Math.floor(Math.random() * 4) + 3; });
    });

    events = []; selectedEvIdForRadio = null; activeEditingId = null;
    mainRadioLogs = []; cprCounter = 101;
    shiftStats = { cprTotalGenerated: 0, cprAccepted: 0, cprRefused: 0, refusalReasons: {} };
    Object.keys(openRadioWindows).forEach(k => closeRadioWindow(k));

    loadSimulationState();
    updateJrgSelectOptions();
    renderUnits(); renderEvents(); renderSelectedEventDetails();

    const mainHdr = document.querySelector('#main-radio-modal .main-radio-header span');
    if (mainHdr) mainHdr.innerText = `📻 Główne Radio SKKP (${currentCountyCallsign})`;
    updateMainRadioChat();

    stationsGeocoded = false;
    geocodeAllFireStationsExact();
    if (leafletMap) {
        leafletMap.setView(profile.mapCenter, 11);
        updateMapMarkers();
    }
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- SILNIK ROUTINGU OSRM Z PEŁNĄ GEOMETRIĄ TRASY (DROGI) ---
async function getRoadRouting(lat1, lon1, lat2, lon2, withGeometry = true) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const geomParam = withGeometry ? '?overview=full&geometries=geojson' : '?overview=false';
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}${geomParam}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                if (route && typeof route.distance === 'number' && typeof route.duration === 'number') {
                    let coordinates = null;
                    if (withGeometry && route.geometry && route.geometry.coordinates) {
                        // OSRM zwraca [lng, lat], zamieniamy na [lat, lng] dla Leafleta
                        coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);
                    }
                    return {
                        distanceKm: route.distance / 1000,
                        durationSec: route.duration,
                        coordinates: coordinates
                    };
                }
            }
        }
    } catch (e) {}
    return null;
}

async function getUnitProximityAsync(unitName, city, targetLat = null, targetLng = null) {
    const firstUnitKey = Object.keys(unitExactLocations)[0];
    const unitLoc = unitExactLocations[unitName] || unitExactLocations[firstUnitKey];
    const defaultTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const targetTown = Object.keys(gpsCoords).find(c => c.toLowerCase() === (city || "").trim().toLowerCase()) || defaultTown;
    const tCoords = (targetLat && targetLng) ? [targetLat, targetLng] : (gpsCoords[targetTown] || COUNTY_PROFILES[currentCountyId].mapCenter);

    let kmRounded = 1.5;
    let travelSec = 10;
    let routeCoords = null;

    if (unitLoc && tCoords) {
        const roadRoute = await getRoadRouting(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1], true);
        if (roadRoute && !isNaN(roadRoute.durationSec) && roadRoute.durationSec > 0) {
            kmRounded = Math.max(1.0, Math.round(roadRoute.distanceKm * 10) / 10);
            travelSec = Math.max(8, Math.round(roadRoute.durationSec * 0.85));
            routeCoords = roadRoute.coordinates;
        } else {
            const fallbackDist = haversineKm(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1]) * 1.25;
            kmRounded = Math.max(1.2, Math.round(fallbackDist * 10) / 10);
            travelSec = Math.max(10, Math.round(kmRounded * 45));
        }
    }
    return { sec: travelSec, kmNum: kmRounded, km: `${kmRounded.toFixed(1)} km`, coordinates: routeCoords };
}

function getUnitProximity(unitName, city) {
    const firstUnitKey = Object.keys(unitExactLocations)[0];
    const unitLoc = unitExactLocations[unitName] || unitExactLocations[firstUnitKey];
    const defaultTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const targetTown = Object.keys(gpsCoords).find(c => c.toLowerCase() === (city || "").trim().toLowerCase()) || defaultTown;
    const tCoords = gpsCoords[targetTown] || COUNTY_PROFILES[currentCountyId].mapCenter;

    const dist = unitLoc ? haversineKm(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1]) * 1.25 : 2.5;
    const kmRounded = Math.max(1.2, Math.round(dist * 10) / 10);
    return { sec: Math.max(10, Math.round(kmRounded * 45)), kmNum: kmRounded, km: `${kmRounded.toFixed(1)} km` };
}

function generateDeparturePrepSeconds(unitName) {
    const isPSP = unitName.includes("JRG") || unitName.includes("KP PSP") || unitName.includes("KM PSP");
    return isPSP ? (Math.floor(Math.random() * 5) + 1) : (Math.floor(Math.random() * 10) + 1);
}

function calculateActionDurationSeconds(desc, subtype, type) {
    if (type === 'PZR') return -1;
    const text = ((desc || "") + " " + (subtype || "")).toLowerCase();
    const isBig = /poszukiwan|zaginion|hala|hali|magazyn|zakład|produkcyjn|las|leśn|mieszkan|kamienic|budynk|dach|poddasz|gospodarcz|stodoł|tartak|szkoł|składowisk/.test(text);
    if (isBig) return Math.floor(Math.random() * 601) + 300;
    if (/wypadek|zderzenie|chemiczn/.test(text)) return Math.floor(Math.random() * 181) + 240;
    return Math.floor(Math.random() * 121) + 150;
}

function autoSelectJRGByCity(city) {
    if (!COUNTY_PROFILES[currentCountyId]) return;
    const jrgList = COUNTY_PROFILES[currentCountyId].jrgList;
    let bestJrg = jrgList[0];
    if (jrgList.length > 1) {
        let bestSec = 999999;
        jrgList.forEach(jName => {
            const p = getUnitProximity(jName, city);
            if (p.sec < bestSec) { bestSec = p.sec; bestJrg = jName; }
        });
    }
    ['inp-ev-jrg', 'inp-ev-lead', 'inp-ev-area'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = bestJrg;
    });
}

// --- PODRODZAJE ZDARZEŃ ---
const subtypesData = {
    "P": [
        "P - Inne pożary", "P - Instytucje, obiekty użyteczności publicznej", "P - Obiekty gospodarcze i inne rolnicze",
        "P - Obiekty magazynowe, place składowe", "P - Obiekty mieszkalne", "P - Obiekty produkcyjne, instalacje technologiczne",
        "P - Śmietniska, wysypiska", "P - Środki transportu drogowego (np. autobus)", "P - Środki transportu kolejowego",
        "P - Środki transportu lotniczego", "P - Środki transportu wodnego", "P - Trawy, torfowiska, lasy, pola, stogi"
    ],
    "MZ": [
        "Inne MZ", "MZ - Atmosferyczne", "MZ - Budowlane", "MZ - Chemiczne", "MZ - Drogowe", "MZ - Kolejowe",
        "MZ - Kolizja", "MZ - Lotnicze", "MZ - Wodne", "MZ - Palenie ognisk w miejscach niedozwolonych",
        "MZ - Podejrzenie podłożenia ładunku", "MZ - Pomoc innym służbom", "MZ - Pomoc Policji", "MZ - Pomoc PRM",
        "MZ - Pomoc w otwarciu mieszkania, podejrzenie zgonu", "MZ - Poszukiwanie osób zaginionych", "MZ - Próba samobójcza",
        "MZ - Sanitarno-epidemiologiczne", "MZ - Topienie się", "MZ - Wypadek", "MZ - Zabezpieczenie ładunku", "MZ - Zwierzęta"
    ],
    "AF": ["AF - Fałszywy z instalacji", "AF - Złośliwy", "AF - W dobrej wierze"],
    "CW": ["CW - Zagrożenie chemiczne", "CW - Zagrożenie ekologiczne"],
    "WG": ["WG - Wybuch gazu", "WG - Inne zagrożenie wybuchem"],
    "BL": ["BL - Budynek zagrożony zawaleniem"],
    "ZPR": ["ZPR - Zagrożenie promieniotwórcze"],
    "PZR": []
};

function updateSubtypes(type) {
    const select = document.getElementById('inp-ev-subtype');
    const group = document.getElementById('subtype-group');
    if(!select) return;
    select.innerHTML = '';
    if (group) {
        if (type === 'PZR') { group.style.display = 'none'; return; }
        else { group.style.display = 'flex'; }
    }
    (subtypesData[type] || ["Brak"]).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub; opt.innerText = sub;
        select.appendChild(opt);
    });
}

let events = [], activeEditingId = null, selectedEvIdForRadio = null, selectedVehicles = [];
let servicesState = { prm: false, police: false }, currentCPRData = null, cprCounter = 101;
let openRadioWindows = {}, mainRadioLogs = [], mainRadioModalEl = null;
let simSpeed = 1, simIntervalId = null, autoCprTimeoutId = null;
let shiftStats = { cprTotalGenerated: 0, cprAccepted: 0, cprRefused: 0, refusalReasons: {} };

// --- MODUŁ ZAPISYWANIA I WCZYTYWANIA STANU SŁUŻBY ---
function saveSimulationState() {
    try {
        const stateObj = {
            version: APP_VERSION, countyId: currentCountyId, savedAt: new Date().toISOString(),
            events, unitsPSP, unitsOSP, unitExactLocations, shiftStats, cprCounter,
            mainRadioLogs: mainRadioLogs.slice(-100)
        };
        localStorage.setItem(getStorageKeyForCounty(currentCountyId), JSON.stringify(stateObj));
    } catch (e) {}
}

function loadSimulationState() {
    try {
        const raw = localStorage.getItem(getStorageKeyForCounty(currentCountyId));
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.events)) return false;

        events = data.events;
        if (Array.isArray(data.unitsPSP) && data.unitsPSP.length > 0) unitsPSP = data.unitsPSP;
        if (Array.isArray(data.unitsOSP) && data.unitsOSP.length > 0) unitsOSP = data.unitsOSP;
        if (data.unitExactLocations) {
            Object.keys(data.unitExactLocations).forEach(k => {
                if (!unitExactLocations[k]) unitExactLocations[k] = data.unitExactLocations[k];
            });
        }
        if (data.shiftStats) shiftStats = data.shiftStats;
        if (typeof data.cprCounter === 'number') cprCounter = data.cprCounter;
        if (Array.isArray(data.mainRadioLogs)) mainRadioLogs = data.mainRadioLogs;

        if (events.length > 0) {
            selectedEvIdForRadio = events[events.length - 1].id;
            const btnOpen = document.getElementById('btn-open-radio');
            if (btnOpen) btnOpen.style.display = 'block';
        }
        return true;
    } catch (e) { return false; }
}

function exportShiftStateToFile() {
    saveSimulationState();
    const raw = localStorage.getItem(getStorageKeyForCounty(currentCountyId)) || "{}";
    const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SWDST_${currentCountyId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importShiftStateFromFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed || !Array.isArray(parsed.events)) { alert("Nieprawidłowy plik zapisu służby!"); return; }
                if (parsed.countyId && COUNTY_PROFILES[parsed.countyId]) currentCountyId = parsed.countyId;
                localStorage.setItem(getStorageKeyForCounty(currentCountyId), JSON.stringify(parsed));
                applyCountyProfile(currentCountyId);
                alert("✅ Pomyślnie wczytano zapis służby z pliku!");
            } catch (err) { alert("Błąd podczas odczytu pliku zapisu!"); }
        };
        reader.readAsText(file);
    };
    inp.click();
}

function resetShiftState() {
    if (!confirm("Czy na pewno chcesz zresetować obecną służbę w wybranym rejonie?")) return;
    localStorage.removeItem(getStorageKeyForCounty(currentCountyId));
    applyCountyProfile(currentCountyId);
    const sisBody = document.getElementById('details-sis-body');
    if (sisBody) sisBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">Brak wybranego zdarzenia</td></tr>';
}

function setSimulationSpeed(speed) {
    simSpeed = speed;
    [1, 2, 5].forEach(s => {
        const btn = document.getElementById(`btn-speed-${s}x`);
        if (btn) {
            btn.style.background = s === speed ? '#0a246a' : '#e1e1e1';
            btn.style.color = s === speed ? '#ffffff' : '#000000';
        }
    });
    startSimulationLoop();
    scheduleNextAutoCPR();
}

function injectSpeedAndSaveControls() {
    if (document.getElementById('swd-speed-controls')) return;
    const btnOpenRadio = document.getElementById('btn-open-radio');
    if (btnOpenRadio && btnOpenRadio.parentElement) {
        const bar = btnOpenRadio.parentElement;
        bar.style.flexWrap = 'wrap';
        const speedBox = document.createElement('div');
        speedBox.id = 'swd-speed-controls';
        speedBox.style.cssText = 'display: inline-flex; align-items: center; gap: 3px; background: #d4d0c8; border: 1px solid #808080; padding: 2px 6px; border-radius: 2px; margin-left: auto;';
        speedBox.innerHTML = `
            <span style="font-weight:bold; color:#000; margin-right:2px;">⏩ Tempo:</span>
            <button id="btn-speed-1x" class="btn-win" style="padding: 1px 7px; font-weight: bold; background: #0a246a; color: #fff;" onclick="setSimulationSpeed(1)">1x</button>
            <button id="btn-speed-2x" class="btn-win" style="padding: 1px 7px; font-weight: bold;" onclick="setSimulationSpeed(2)">2x</button>
            <button id="btn-speed-5x" class="btn-win" style="padding: 1px 7px; font-weight: bold;" onclick="setSimulationSpeed(5)">5x</button>
            <span style="margin: 0 3px; color:#777;">|</span>
            <button class="btn-win" style="padding: 1px 6px; font-weight: bold; background:#eef4ff; color:#0a246a;" onclick="openLauncherModal()">👤 Komenda / Login</button>
            <button class="btn-win" style="padding: 1px 6px; font-weight: bold;" onclick="exportShiftStateToFile()">💾 Eksportuj</button>
            <button class="btn-win" style="padding: 1px 6px;" onclick="importShiftStateFromFile()">📂 Wczytaj</button>
            <button class="btn-win" style="padding: 1px 6px; background:#ffe6e6; color:#800000;" onclick="resetShiftState()">🗑️ Reset</button>
        `;
        bar.appendChild(speedBox);
    }
}

function injectPzrStyles() {
    if (document.getElementById('swd-pzr-styles')) return;
    const style = document.createElement('style');
    style.id = 'swd-pzr-styles';
    style.innerHTML = `
        .status-dot.yellow { background-color: #f1c40f !important; box-shadow: 0 0 4px #d4ac0d; }
        .vehicle-row.pzr-active { background-color: #fff8c4 !important; border-left: 3px solid #f1c40f !important; }
        .unit-box.unit-on-pzr { border: 1.5px solid #d4ac0d !important; background-color: #fffdf0 !important; }
        .unit-header.header-on-pzr { background-color: #ffe875 !important; color: #000000 !important; }
    `;
    document.head.appendChild(style);
}

function getActivePzrForVehicle(vehId) {
    let foundPzrEv = null;
    events.forEach(ev => {
        if (ev.status === 'ACTIVE' && ev.type === 'PZR') {
            if (ev.vehicles && ev.vehicles.some(v => v.id === vehId)) foundPzrEv = ev;
        }
    });
    return foundPzrEv;
}

function isVehicleInCombatAction(vehId) {
    return events.some(ev => {
        if (ev.type === 'PZR') return false;
        if (ev.status === 'ACTIVE') return ev.vehicles.some(v => v.id === vehId && v.phase !== 'DONE');
        if (ev.status === 'FINISHED') return ev.vehicles.some(v => v.id === vehId && v.phase === 'RETURN' && v.returnTime > 0);
        return false;
    });
}

// --- GŁÓWNE RADIO OGÓLNOPOWIATOWE SKKP ---
function ensureMainRadioWindow() {
    if (mainRadioModalEl) return mainRadioModalEl;
    const modal = document.createElement('div');
    modal.id = 'main-radio-modal';
    modal.style.cssText = 'position:fixed; z-index:1045; width:460px; right:20px; bottom:35px;';
    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 6px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="main-radio-header" style="background: linear-gradient(90deg, #800000, #b30000); color: #ffffff; padding: 4px 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span>📻 Główne Radio SKKP (${currentCountyCallsign})</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="minimizeMainRadio()">_</button>
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeMainRadio()">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #c0c0c0;">
                <div style="font-size:10px; color:#222; margin-bottom:3px; font-weight:bold;">Meldunki wyjazdów, dojazdów, zakończenia działań i powrotów do bazy:</div>
                <div id="main-radio-chat" style="background: #111111; color: #ffffff; font-family: 'Consolas', 'Courier New', monospace; font-weight: bold; font-size: 12px; height: 210px; padding: 6px; overflow-y: auto; border: 2px solid #808080; box-sizing: border-box; line-height: 1.35;"></div>
                <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
                    <button style="padding: 4px 8px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color:#000;" onclick="sendMainRadioDispatchMsg(currentCountyCallsign + ', przyjąłem.')">✔ Przyjąłem</button>
                    <input type="text" id="inp-main-radio" placeholder="Nadaj komunikat ogólny..." style="flex: 1; padding: 4px 6px; font-size: 12px; background: #ffffff; color:#000; border: 2px solid #808080; outline: none;" onkeypress="if(event.key==='Enter') sendMainRadioCustom()">
                    <button style="padding: 4px 10px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color:#000;" onclick="sendMainRadioCustom()">Nadaj</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    makeDraggable(modal, modal.querySelector('.main-radio-header'));
    mainRadioModalEl = modal;
    updateMainRadioChat();
    return modal;
}

function openMainRadio() {
    const modal = ensureMainRadioWindow();
    modal.style.display = 'block';
    const minItem = document.getElementById('min-main-radio');
    if (minItem) minItem.remove();
    updateMainRadioChat();
}

function closeMainRadio() { if (mainRadioModalEl) mainRadioModalEl.style.display = 'none'; }

function minimizeMainRadio() {
    if (mainRadioModalEl) mainRadioModalEl.style.display = 'none';
    const bar = document.getElementById('minimized-bar');
    if (bar && !document.getElementById('min-main-radio')) {
        const item = document.createElement('div');
        item.className = 'minimized-item'; item.id = 'min-main-radio';
        item.innerHTML = `📻 Główne Radio SKKP`;
        item.onclick = () => openMainRadio();
        bar.appendChild(item);
    }
}

function logToMainRadio(callsign, messageText, color = '#7CFC00', playBeep = true) {
    ensureMainRadioWindow();
    if (playBeep) { audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {}); }
    const timeStr = new Date().toLocaleTimeString();
    mainRadioLogs.push(`<div style="margin-bottom: 6px; color: ${color}; border-bottom: 1px dashed #333; padding-bottom: 3px;"><span style="color:#cccccc;">[${timeStr}]</span> <b>${callsign}:</b><br>"${messageText}"</div>`);
    updateMainRadioChat();
    saveSimulationState();
}

function updateMainRadioChat() {
    const chat = document.getElementById('main-radio-chat');
    if (chat) {
        chat.innerHTML = mainRadioLogs.length > 0
            ? mainRadioLogs.join('')
            : `<div style="color:#aaa; font-style:italic;">[System] Kanał główny SKKP (${currentCountyCallsign}) aktywny. Nasłuch statusów SiS...</div>`;
        chat.scrollTop = chat.scrollHeight;
    }
}

function sendMainRadioDispatchMsg(text) {
    if (!text) return;
    logToMainRadio(`${currentCountyCallsign} ➔ WSZYSCY`, text, '#00ffff', true);
}

function sendMainRadioCustom() {
    const inp = document.getElementById('inp-main-radio');
    if (!inp || !inp.value.trim()) return;
    sendMainRadioDispatchMsg(inp.value.trim());
    inp.value = '';
}

// --- GEOKODER ADRESÓW ---
async function resolveExactCoordinates(streetAddress, townName) {
    const profile = COUNTY_PROFILES[currentCountyId];
    if (!profile) return null;
    const cleanTown = (townName || profile.defaultTown).trim();
    let cleanedStreet = (streetAddress || "")
        .replace(/^(Przystanek Autobusowy|Kamienica|Blok mieszkalny|Hala Magazynowa|Tartak \/ Skład Drzewny)[,\s-]*/i, '')
        .split('/')[0].trim();

    const fullQuery = cleanedStreet
        ? `${cleanedStreet}, ${cleanTown}, ${profile.voivodeship}, Polska`
        : `${cleanTown}, ${profile.voivodeship}, Polska`;

    try {
        const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(fullQuery)}&countryCode=POL&searchExtent=${profile.bbox}&maxLocations=1`;
        const res = await fetch(arcUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.candidates && data.candidates.length > 0) {
                const loc = data.candidates[0].location;
                if (loc && loc.y && loc.x) return { lat: parseFloat(loc.y), lng: parseFloat(loc.x) };
            }
        }
    } catch (e) {}

    try {
        const streetNoPrefix = cleanedStreet.replace(/\b(ul\.|ulica|al\.|aleja|pl\.|plac)\s*/gi, '').trim();
        const center = profile.mapCenter;
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(streetNoPrefix + ' ' + cleanTown)}&lat=${center[0]}&lon=${center[1]}&limit=1`;
        const res = await fetch(photonUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const coords = data.features[0].geometry?.coordinates;
                if (coords && coords.length === 2) return { lat: parseFloat(coords[1]), lng: parseFloat(coords[0]) };
            }
        }
    } catch (e) {}

    return null;
}

let stationsGeocoded = false;
async function geocodeAllFireStationsExact() {
    if (stationsGeocoded) return;
    stationsGeocoded = true;

    const cacheKey = `SWD_EXACT_STATIONS_${currentCountyId}_V8`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            Object.keys(parsed).forEach(uName => {
                if (unitExactLocations[uName] && !unitExactLocations[uName].locked && parsed[uName].lat && parsed[uName].lng) {
                    unitExactLocations[uName].lat = parsed[uName].lat;
                    unitExactLocations[uName].lng = parsed[uName].lng;
                }
            });
            updateMapMarkers();
            return;
        }
    } catch (e) {}

    const unitNames = Object.keys(unitExactLocations).filter(u => !unitExactLocations[u].locked);
    const cacheToSave = {};

    await Promise.all(unitNames.map(async (uName) => {
        const info = unitExactLocations[uName];
        const coords = await resolveExactCoordinates(info.address, info.town);
        if (coords) {
            info.lat = coords.lat; info.lng = coords.lng;
            cacheToSave[uName] = { lat: info.lat, lng: info.lng };
        }
    }));

    try {
        if (Object.keys(cacheToSave).length > 2) localStorage.setItem(cacheKey, JSON.stringify(cacheToSave));
    } catch (e) {}

    updateMapMarkers();
}

async function geocodeEventAddress(ev) {
    const rawStreet = (ev.street || "").trim();
    const coords = await resolveExactCoordinates(rawStreet, ev.city);
    if (coords) { ev.lat = coords.lat; ev.lng = coords.lng; }
    else if (!ev.lat || !ev.lng) {
        const fallback = gpsCoords[ev.city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        ev.lat = fallback[0]; ev.lng = fallback[1];
    }
    updateMapMarkers();
    saveSimulationState();
}

function focusEventOnMap(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    switchMainView('map');
    setTimeout(async () => {
        if (!ev.geocodedOnce) { ev.geocodedOnce = true; await geocodeEventAddress(ev); }
        if (leafletMap && ev.lat && ev.lng) leafletMap.setView([ev.lat, ev.lng], 17);
    }, 250);
}

// --- MAPA OPERACYJNA LEAFLET Z RUCHEM PO DROGACH (OSRM GEOMETRY) ---
let leafletMap = null, mapMarkersLayer = null;

function ensureLeafletLoaded(callback) {
    if (window.L) { callback(); return; }
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = callback;
    document.head.appendChild(script);
}

function initLeafletMap() {
    ensureLeafletLoaded(() => {
        const mapEl = document.getElementById('leaflet-map');
        if (!mapEl) return;
        const center = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].mapCenter : [50.0919, 18.2198];
        if (!leafletMap) {
            leafletMap = L.map('leaflet-map').setView(center, 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
            mapMarkersLayer = L.layerGroup().addTo(leafletMap);
            geocodeAllFireStationsExact();
        }
        leafletMap.invalidateSize();
        updateMapMarkers();
    });
}

function updateMapMarkers() {
    if (!leafletMap || !mapMarkersLayer || !window.L) return;
    mapMarkersLayer.clearLayers();

    // 1. Markery stacjonarne jednostek (koszary)
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const firstKey = Object.keys(unitExactLocations)[0];
        const loc = unitExactLocations[u.name] || unitExactLocations[firstKey];
        if (!loc) return;

        const isPSP = u.name.includes("JRG") || u.name.includes("KP PSP") || u.name.includes("KM PSP");
        const hasPzrVeh = u.vehicles.some(v => v.status === 'yellow');
        const borderColor = hasPzrVeh ? "#d4ac0d" : (isPSP ? "#b30000" : "#0a246a");
        const bgBadge = hasPzrVeh ? "#ffe875" : (isPSP ? "#ffe6e6" : "#ffffff");
        
        const vehListHtml = u.vehicles.map(v => {
            const color = v.status === 'green' ? '#1e8449' : (v.status === 'yellow' ? '#d4ac0d' : (v.status === 'orange' ? '#d68910' : '#c0392b'));
            return `<div style="font-size:11px; color:#000;"><span style="color:${color}; font-weight:bold;">●</span> <b>${v.id}</b> - ${v.name}</div>`;
        }).join('');

        const marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%, -50%); background:${bgBadge}; color:#000000; border:2px solid ${borderColor}; border-radius:4px; padding:2px 6px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.45); cursor:pointer;">🚒 ${u.name}</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            })
        });
        marker.bindPopup(`<div style="min-width:220px; color:#000;"><div style="font-weight:bold; color:${borderColor}; font-size:12px;">${u.name}</div><div style="font-size:10px; color:#222; border-bottom:1px solid #ccc; margin-bottom:4px; padding-bottom:3px;">📍 <b>Adres:</b> ${loc.address}</div>${vehListHtml}</div>`);
        mapMarkersLayer.addLayer(marker);
    });

    // 2. Aktywne zdarzenia oraz poruszające się po drogach zastępy
    events.forEach(ev => {
        if (ev.status !== 'ACTIVE') return;
        const fallback = gpsCoords[ev.city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        const evLat = ev.lat || fallback[0], evLng = ev.lng || fallback[1];

        ev.vehicles.forEach(v => {
            if ((v.phase === 'TRAVEL' || v.phase === 'RETURN') && v.baseRouteSeconds > 0) {
                const unitLoc = unitExactLocations[v.unitName] || Object.values(unitExactLocations)[0];
                if (!unitLoc) return;

                let progress = 0;
                let currLat = evLat, currLng = evLng;

                if (v.phase === 'TRAVEL') {
                    progress = Math.max(0, Math.min(1, 1 - (v.travelTime / v.baseRouteSeconds)));
                    
                    if (v.travelGeometry && v.travelGeometry.length > 0) {
                        const idx = Math.min(v.travelGeometry.length - 1, Math.floor(progress * (v.travelGeometry.length - 1)));
                        currLat = v.travelGeometry[idx][0];
                        currLng = v.travelGeometry[idx][1];
                    } else {
                        currLat = unitLoc.lat + (evLat - unitLoc.lat) * progress;
                        currLng = unitLoc.lng + (evLng - unitLoc.lng) * progress;
                    }

                    const movingMarker = L.marker([currLat, currLng], {
                        icon: L.divIcon({
                            className: '',
                            html: `<div style="transform:translate(-50%, -50%); background:#e74c3c; color:#ffffff; border:2px solid #78281f; border-radius:12px; padding:2px 8px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.6);">🚒 ${v.id} (Dojazd)</div>`,
                            iconSize: [0, 0], iconAnchor: [0, 0]
                        })
                    });
                    movingMarker.bindPopup(`<div style="color:#000;"><b>Zastęp:</b> ${v.id}<br><b>Jednostka:</b> ${v.unitName}<br><b>Kierunek:</b> Dojazd drogą do ${ev.city}</div>`);
                    mapMarkersLayer.addLayer(movingMarker);

                } else if (v.phase === 'RETURN') {
                    progress = Math.max(0, Math.min(1, 1 - (v.returnTime / v.baseRouteSeconds)));

                    if (v.returnGeometry && v.returnGeometry.length > 0) {
                        const idx = Math.min(v.returnGeometry.length - 1, Math.floor(progress * (v.returnGeometry.length - 1)));
                        currLat = v.returnGeometry[idx][0];
                        currLng = v.returnGeometry[idx][1];
                    } else {
                        currLat = evLat + (unitLoc.lat - evLat) * progress;
                        currLng = evLng + (unitLoc.lng - evLng) * progress;
                    }

                    const returnMarker = L.marker([currLat, currLng], {
                        icon: L.divIcon({
                            className: '',
                            html: `<div style="transform:translate(-50%, -50%); background:#3498db; color:#ffffff; border:2px solid #1b4f72; border-radius:12px; padding:2px 8px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.6);">🚒 ${v.id} (Powrót)</div>`,
                            iconSize: [0, 0], iconAnchor: [0, 0]
                        })
                    });
                    returnMarker.bindPopup(`<div style="color:#000;"><b>Zastęp:</b> ${v.id}<br><b>Jednostka:</b> ${v.unitName}<br><b>Kierunek:</b> Powrót drogą do bazy</div>`);
                    mapMarkersLayer.addLayer(returnMarker);
                }
            }
        });

        // 3. Marker samego zdarzenia
        const isPZR = ev.type === 'PZR';
        const bgEv = isPZR ? '#fff3a1' : '#ffcccc';
        const borderEv = isPZR ? '#d4ac0d' : '#b30000';
        const iconEv = isPZR ? '🛡️ [PZR]' : `🚨 [ID:${ev.id}]`;

        const marker = L.marker([evLat, evLng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%, -50%); background:${bgEv}; color:#000000; border:2.5px solid ${borderEv}; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.5); cursor:pointer;">${iconEv} ${ev.city}${ev.street ? ', ' + ev.street : ''}</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            })
        });

        const sisList = ev.vehicles.map(v => {
            if (v.phase === 'PREP') return `${v.id} (Wyjazd z bazy za: ${v.prepTime}s)`;
            if (v.phase === 'TRAVEL') return `${v.id} (Dojazd: ${formatMMSS(v.travelTime)})`;
            if (v.phase === 'ONSITE') return `${v.id} (${isPZR ? 'Zabezpieczenie rejonu' : 'Na miejscu akcji'})`;
            if (v.phase === 'RETURN') return `${v.id} (Powrót: ${formatMMSS(v.returnTime)})`;
            return `${v.id}`;
        }).join('<br>');

        marker.bindPopup(`
            <div style="min-width:230px; color:#000;">
                <b style="color:${borderEv};">ZDARZENIE ID: ${ev.id}/2026 (${ev.type})</b><br>
                <b>Dokładny adres:</b> ${ev.city}, ${ev.street || 'Rejon operacyjny'}<br>
                <b>Opis:</b> ${ev.desc || 'Zabezpieczenie operacyjne rejonu'}<br>
                <b>Zadysponowane SiS (${ev.vehicles.length}):</b><br>${sisList || 'Brak'}<br>
                <div style="margin-top:6px; display:flex; gap:4px;">
                    <button class="btn-win" onclick="openEditEventModal(${ev.id})">Edytuj kartę</button>
                    <button class="btn-win" onclick="openRadioForEvent(${ev.id})">📻 Radio zdarzenia</button>
                </div>
            </div>
        `);
        mapMarkersLayer.addLayer(marker);
    });
}

function switchMainView(viewType) {
    let mapContainer = document.getElementById('view-map-container');
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    const btnPsp = document.getElementById('btn-tab-psp');
    const btnOsp = document.getElementById('btn-tab-osp');
    const btnMap = document.getElementById('btn-tab-map');

    if (viewType === 'map') {
        if (pspGrid) pspGrid.style.display = 'none';
        if (ospGrid) ospGrid.style.display = 'none';
        if (mapContainer) mapContainer.style.display = 'block';
        if (btnPsp) btnPsp.classList.remove('active');
        if (btnOsp) btnOsp.classList.remove('active');
        if (btnMap) btnMap.classList.add('active');
        setTimeout(() => initLeafletMap(), 100);
    } else {
        if (mapContainer) mapContainer.style.display = 'none';
        if (btnMap) btnMap.classList.remove('active');
        switchTab('PSP');
    }
}

function makeDraggable(elmnt, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (header) header.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
        if (e.target.closest('.modal-close, .modal-min, button')) return;
        e.preventDefault();
        pos3 = e.clientX; pos4 = e.clientY;
        const rect = elmnt.getBoundingClientRect();
        elmnt.style.position = 'fixed';
        elmnt.style.left = rect.left + 'px'; elmnt.style.top = rect.top + 'px';
        elmnt.style.margin = '0'; elmnt.style.right = 'auto'; elmnt.style.bottom = 'auto';
        document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
        pos3 = e.clientX; pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + 'px';
        elmnt.style.left = (elmnt.offsetLeft - pos1) + 'px';
    }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

function ensureVersionBadgeInStatusBar() {
    let badge = document.getElementById('swdst-version-badge');
    if (!badge) {
        const clockBox = document.getElementById('clock-box');
        if (clockBox && clockBox.parentElement) {
            badge = document.createElement('div');
            badge.id = 'swdst-version-badge';
            badge.style.cssText = 'display: inline-block; padding: 2px 6px; font-size: 11px; font-weight: bold; color: #000; background: #ece9d8; border: 1px solid #7f9db9; margin-left: 4px; vertical-align: middle; cursor: pointer;';
            badge.title = "Kliknij, aby zmienić dane operatora";
            badge.onclick = () => openLauncherModal();
            badge.innerText = `${APP_VERSION} (${simSpeed}x)`;
            clockBox.parentElement.insertBefore(badge, clockBox);
        }
    } else {
        badge.innerText = `${APP_VERSION} (${simSpeed}x)`;
    }
}

function ensureSubtypeDOMIntegration() {
    const radios = document.querySelectorAll('input[name="ev-type"]');
    radios.forEach(r => { r.onclick = () => updateSubtypes(r.value); });
    if (!document.getElementById('inp-ev-subtype') && radios.length > 0) {
        const radioRow = radios[0].closest('.form-row');
        if (radioRow && radioRow.parentElement) {
            const subGroup = document.createElement('div');
            subGroup.className = 'form-group'; subGroup.id = 'subtype-group'; subGroup.style.marginTop = '4px';
            subGroup.innerHTML = `<label>Podrodzaj:</label><select id="inp-ev-subtype"></select>`;
            radioRow.insertAdjacentElement('afterend', subGroup);
        }
    }
    updateSubtypes('P');
}

window.addEventListener('DOMContentLoaded', () => {
    injectPzrStyles();

    try {
        const savedSession = localStorage.getItem('SWDST_USER_SESSION');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed.rank) currentUserRank = parsed.rank;
            if (typeof parsed.username === 'string') currentUserName = parsed.username;
        }
    } catch (e) {}

    applyCountyProfile("lublin");
    updateStatusBarUserDisplay();
    ensureMainRadioWindow();
    ensureVersionBadgeInStatusBar();
    ensureSubtypeDOMIntegration();
    ensureLauncherModalExists();

    document.querySelectorAll('.top-menu .menu-item').forEach(item => {
        const txt = item.innerText.trim().toLowerCase();
        if (txt.includes('system')) item.onclick = () => openLauncherModal();
        else if (txt.includes('siły i środki')) item.onclick = () => openSiSModal();
        else if (txt.includes('mapy')) item.onclick = () => switchMainView('map');
        else if (txt.includes('podział bojowy') || txt.includes('widok')) item.onclick = () => switchMainView('table');
        else if (txt.includes('zestawienia') || txt.includes('raporty') || txt.includes('rejestr')) item.onclick = () => openReportsModal();
        else if (txt.includes('komunikator') || txt.includes('urządzenia')) item.onclick = () => openMainRadio();
    });

    const tabsBar = document.querySelector('.workspace .tabs-bar');
    if (tabsBar && !document.getElementById('btn-tab-map')) {
        const mapTabBtn = document.createElement('button');
        mapTabBtn.className = 'tab-btn'; mapTabBtn.id = 'btn-tab-map';
        mapTabBtn.innerHTML = '🗺️ Mapa Operacyjna';
        mapTabBtn.onclick = () => switchMainView('map');
        tabsBar.appendChild(mapTabBtn);

        const repTabBtn = document.createElement('button');
        repTabBtn.className = 'tab-btn';
        repTabBtn.innerHTML = '📊 Zestawienia i Raporty';
        repTabBtn.onclick = () => openReportsModal();
        tabsBar.appendChild(repTabBtn);
    }

    const btnOpenRadio = document.getElementById('btn-open-radio');
    if (btnOpenRadio && btnOpenRadio.parentElement && !document.getElementById('btn-open-main-radio')) {
        const mainRadBtn = document.createElement('button');
        mainRadBtn.className = 'btn-win'; mainRadBtn.id = 'btn-open-main-radio';
        mainRadBtn.style.cssText = 'background: #fff0f0; border-color: #800000; font-weight: bold; color: #800000;';
        mainRadBtn.innerHTML = '📻 Główne Radio SKKP';
        mainRadBtn.onclick = () => openMainRadio();
        btnOpenRadio.parentElement.appendChild(mainRadBtn);
    }

    injectSpeedAndSaveControls();

    const pspGrid = document.getElementById('grid-psp');
    if (pspGrid && !document.getElementById('view-map-container')) {
        const mapWrap = document.createElement('div');
        mapWrap.id = 'view-map-container';
        mapWrap.style.cssText = 'flex: 1; display: none; width: 100%; min-height: 260px; border: 1px solid #7f9db9; position: relative;';
        mapWrap.innerHTML = '<div id="leaflet-map" style="width: 100%; height: 100%;"></div>';
        pspGrid.parentNode.insertBefore(mapWrap, pspGrid);
    }

    ensureSiSModalExists();
    ensureReportsModalExists();

    const eventModal = document.querySelector('#modal-event .modal-window');
    if (eventModal) makeDraggable(eventModal, document.querySelector('#modal-event .modal-header'));

    const cprModal = document.getElementById('cpr-modal');
    if (cprModal) makeDraggable(cprModal, cprModal.querySelector('.cpr-header'));
});

function ensureSiSModalExists() {
    let sisModal = document.getElementById('modal-sis');
    if (!sisModal) {
        sisModal = document.createElement('div');
        sisModal.className = 'modal-overlay'; sisModal.id = 'modal-sis';
        document.body.appendChild(sisModal);
    }
    sisModal.innerHTML = `
        <div class="modal-window" style="width: 780px; height: 500px;">
            <div class="modal-header">
                <span>🚒 Zarządzanie Siłami i Środkami (Podział Bojowy)</span>
                <div class="modal-close" onclick="closeModal('modal-sis')">×</div>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:8px;">
                <div style="display: flex; gap: 8px;">
                    <div class="form-box" style="flex:1;">
                        <div class="form-title">Państwowa Straż Pożarna (JRG)</div>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button class="btn-win" onclick="addCustomUnit('PSP')">➕ Dodaj jednostkę PSP</button>
                            <button class="btn-win" onclick="addCustomVehicle('PSP')">🚒 Dodaj pojazd PSP</button>
                        </div>
                    </div>
                    <div class="form-box" style="flex:1;">
                        <div class="form-title">Ochotnicza Straż Pożarna (OSP)</div>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button class="btn-win" onclick="addCustomUnit('OSP')">➕ Dodaj jednostkę OSP</button>
                            <button class="btn-win" onclick="addCustomVehicle('OSP')">🚒 Dodaj pojazd OSP</button>
                        </div>
                    </div>
                </div>
                <div class="form-box" style="flex:1; overflow-y:auto;">
                    <div class="form-title">Wykaz jednostek, oficjalnych adresów strażnic oraz statusów pojazdów:</div>
                    <div id="sis-manager-list" style="max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
            <div style="padding: 6px; background: #e1e1e1; display: flex; justify-content: flex-end;">
                <button class="btn-win" onclick="closeModal('modal-sis')">Zamknij</button>
            </div>
        </div>
    `;
    const win = sisModal.querySelector('.modal-window');
    const hdr = sisModal.querySelector('.modal-header');
    if (win && hdr) makeDraggable(win, hdr);
}

function renderSiSManagerList() {
    const container = document.getElementById('sis-manager-list');
    if (!container) return;
    let html = `<table class="sis-table"><thead><tr><th>Jednostka</th><th>Oficjalny adres strażnicy</th><th>Kryptonim</th><th>Pojazd</th><th>Status</th><th>Akcja</th></tr></thead><tbody>`;
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const addr = unitExactLocations[u.name]?.address || "";
        u.vehicles.forEach(v => {
            const stText = v.status === 'green' ? 'W bazie' : (v.status === 'yellow' ? 'Zabezpieczenie rejonu (PZR)' : (v.status === 'orange' ? 'W drodze / Powrót' : 'W akcji na miejscu'));
            const stColor = v.status === 'green' ? '#155724' : (v.status === 'yellow' ? '#b38600' : (v.status === 'orange' ? '#b36b00' : '#b30000'));
            html += `
                <tr style="${v.status === 'yellow' ? 'background:#fff8c4;' : ''}">
                    <td><b>${u.name}</b></td>
                    <td style="font-size:10px; color:#333;">${addr}</td>
                    <td><b>${v.id}</b></td>
                    <td>${v.name}</td>
                    <td style="color:${stColor}; font-weight:bold;">${stText}</td>
                    <td>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px;" onclick="setVehicleStatusManual('${v.id}', 'green')">Wolny</button>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px; background:#fff3a1;" onclick="setVehicleStatusManual('${v.id}', 'yellow')">PZR</button>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px;" onclick="setVehicleStatusManual('${v.id}', 'red')">W akcji</button>
                    </td>
                </tr>
            `;
        });
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function setVehicleStatusManual(vehId, newStatus) {
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const v = u.vehicles.find(x => x.id === vehId);
        if (v) v.status = newStatus;
    });
    renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState();
}

async function addCustomUnit(type) {
    const defTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const name = prompt(`Podaj nazwę nowej jednostki ${type}:`);
    if (!name || !name.trim()) return;
    const town = prompt(`Podaj miejscowość stacjonowania jednostki:`, defTown) || defTown;
    const address = prompt(`Podaj dokładną ulicę i numer strażnicy:`, `ul. Strażacka 1, ${town}`) || town;
    const tCoords = gpsCoords[town.trim()] || COUNTY_PROFILES[currentCountyId].mapCenter;
    unitExactLocations[name.trim()] = { town: town.trim(), address: address.trim(), lat: tCoords[0], lng: tCoords[1] };

    if (type === 'PSP') unitsPSP.push({ name: name.trim(), vehicles: [] });
    else unitsOSP.push({ name: name.trim(), vehicles: [] });

    const exact = await resolveExactCoordinates(address, town);
    if (exact) { unitExactLocations[name.trim()].lat = exact.lat; unitExactLocations[name.trim()].lng = exact.lng; }
    renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState();
}

async function addCustomVehicle(type) {
    const targetArray = type === 'PSP' ? unitsPSP : unitsOSP;
    const unitName = prompt(`Podaj dokładną nazwę jednostki ${type}:`, targetArray[0]?.name || "");
    if (!unitName) return;
    const unit = targetArray.find(u => u.name.toLowerCase() === unitName.trim().toLowerCase());
    if (!unit) { alert("Nie znaleziono takiej jednostki na liście!"); return; }
    const id = prompt("Podaj numer operacyjny pojazdu:", "569[S]99");
    const vName = prompt("Podaj typ i markę pojazdu:", "GBA 2,5/16 MAN");
    if (id && vName) {
        unit.vehicles.push({ id: id.trim(), name: vName.trim(), status: "green", obsada: 6 });
        renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState();
    }
}

// --- OKNO RAPORTÓW I STATYSTYK ---
function ensureReportsModalExists() {
    if (document.getElementById('modal-reports')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay'; modal.id = 'modal-reports';
    modal.innerHTML = `
        <div class="modal-window" style="width: 920px; height: 660px; background: #d4d0c8; border: 2px solid #0a246a;">
            <div class="modal-header" style="background: #0a246a; color: #fff; padding: 4px 8px;">
                <span>Raporty — Statystyka</span>
                <div class="modal-close" onclick="closeModal('modal-reports')">×</div>
            </div>
            <div class="modal-body" style="padding: 8px; background: #d4d0c8; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <b>Zakres:</b>
                        <button class="btn-win" style="background: #eef4ff; font-weight: bold;">Dzień</button>
                        <button class="btn-win">Miesiąc</button>
                        <button class="btn-win">Rok</button>
                        <button class="btn-win">Wszystkie</button>
                        <span id="rep-date-sub" style="color: #444; margin-left: 6px;">Statystyka z bieżącej służby</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn-win" style="padding: 4px 10px; font-weight: bold;" onclick="exportShiftStateToFile()">💾 Eksportuj JSON</button>
                        <button class="btn-win" style="padding: 4px 10px;" onclick="importShiftStateFromFile()">📂 Wczytaj JSON</button>
                        <button class="btn-win" style="padding: 4px 14px; font-weight: bold;" onclick="window.print()">Drukuj</button>
                    </div>
                </div>
                <div style="background: #ece9d8; border: 1px solid #999; padding: 6px 8px;">
                    <b>Tryb statystyk:</b> Zapis automatyczny w przeglądarce (localStorage) + obsługa plików .json.
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zgłoszenia ogółem</div><div id="rep-total" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Aktywne</div><div id="rep-active" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zakończone</div><div id="rep-finished" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Średni czas obsługi</div><div id="rep-avg-time" style="font-size: 16px; font-weight: bold; margin-top: 6px; color:#000;">00:08:30</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Odmowy / Anulowane CPR</div><div id="rep-refused" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zdarzenia powiązane (CPR)</div><div id="rep-cpr-linked" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Nowe powyżej 2 min</div><div id="rep-over-2m" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Komenda</div><div id="rep-range-box" style="font-size: 12px; font-weight: bold; margin-top: 6px; color:#000;">KP PSP</div></div>
                </div>
                <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;">
                    <div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 6px;">SŁUŻBY — PRM / PSP / POLICJA</div>
                    <table class="sis-table" style="background: #fff;">
                        <thead><tr><th>Służba</th><th style="text-align:right;">Zadysponowano</th><th style="text-align:right;">Oczekuje (Dojazd)</th><th style="text-align:right;">Obsługa (Na miejscu)</th><th style="text-align:right;">Zakończono</th><th style="text-align:right;">Śr. reakcja</th><th style="text-align:right;">Śr. obsługa</th></tr></thead>
                        <tbody>
                            <tr><td>PRM / ZRM</td><td id="rep-prm-disp" style="text-align:right;">0</td><td id="rep-prm-wait" style="text-align:right;">0</td><td id="rep-prm-act" style="text-align:right;">0</td><td id="rep-prm-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:20</td><td style="text-align:right;">00:08:00</td></tr>
                            <tr><td>PSP / OSP</td><td id="rep-psp-disp" style="text-align:right;">0</td><td id="rep-psp-wait" style="text-align:right;">0</td><td id="rep-psp-act" style="text-align:right;">0</td><td id="rep-psp-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:15</td><td style="text-align:right;">00:08:30</td></tr>
                            <tr><td>Policja</td><td id="rep-pol-disp" style="text-align:right;">0</td><td id="rep-pol-wait" style="text-align:right;">0</td><td id="rep-pol-act" style="text-align:right;">0</td><td id="rep-pol-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:45</td><td style="text-align:right;">00:08:00</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">STATUSY CPR</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-cpr-statuses"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">OPERATORZY</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-operators"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">TOP KATEGORIE</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-top-cats"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">TOP PODKATEGORIE</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-top-subcats"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">POWODY ODMÓW / ANULOWAŃ</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-refusals-body"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">MIEJSCOWOŚCI / ADRESY</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-locations-body"></tbody></table></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const win = modal.querySelector('.modal-window');
    const hdr = modal.querySelector('.modal-header');
    if (win && hdr) makeDraggable(win, hdr);
}

function openReportsModal() {
    ensureReportsModalExists();
    const total = events.length;
    const active = events.filter(e => e.status === 'ACTIVE').length;
    const finished = events.filter(e => e.status === 'FINISHED').length;

    safeSetElementText('rep-total', total);
    safeSetElementText('rep-active', active);
    safeSetElementText('rep-finished', finished);
    safeSetElementText('rep-refused', shiftStats.cprRefused);
    safeSetElementText('rep-cpr-linked', shiftStats.cprAccepted);
    safeSetElementText('rep-over-2m', events.filter(e => e.vehicles.length >= 2).length);
    safeSetElementText('rep-range-box', COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].name : "KP PSP");

    let prmDisp = 0, prmWait = 0, prmAct = 0, prmFin = 0;
    let pspDisp = 0, pspWait = 0, pspAct = 0, pspFin = 0;
    let polDisp = 0, polWait = 0, polAct = 0, polFin = 0;
    const catMap = {}, subcatMap = {}, locMap = {};

    events.forEach(ev => {
        const isWaiting = ev.status === 'ACTIVE' && !ev.firstArrived;
        const isOnSite = ev.status === 'ACTIVE' && ev.firstArrived;
        const isDone = ev.status === 'FINISHED';

        if (ev.services && ev.services.prm) { prmDisp++; if (isWaiting) prmWait++; else if (isOnSite) prmAct++; else if (isDone) prmFin++; }
        if (ev.services && ev.services.police) { polDisp++; if (isWaiting) polWait++; else if (isOnSite) polAct++; else if (isDone) polFin++; }
        if (ev.vehicles && ev.vehicles.length > 0) {
            pspDisp += ev.vehicles.length;
            ev.vehicles.forEach(v => {
                if (ev.status === 'FINISHED' && v.phase === 'DONE') pspFin++;
                else if (v.phase === 'PREP' || v.phase === 'TRAVEL') pspWait++;
                else pspAct++;
            });
        }
        const catKey = ev.type || 'P'; catMap[catKey] = (catMap[catKey] || 0) + 1;
        const subKey = ev.subtype || 'Brak podkategorii'; subcatMap[subKey] = (subcatMap[subKey] || 0) + 1;
        const locKey = `${ev.city}${ev.street ? ', ' + ev.street : ''}`; locMap[locKey] = (locMap[locKey] || 0) + 1;
    });

    safeSetElementText('rep-prm-disp', prmDisp); safeSetElementText('rep-prm-wait', prmWait); safeSetElementText('rep-prm-act', prmAct); safeSetElementText('rep-prm-fin', prmFin);
    safeSetElementText('rep-psp-disp', pspDisp); safeSetElementText('rep-psp-wait', pspWait); safeSetElementText('rep-psp-act', pspAct); safeSetElementText('rep-psp-fin', pspFin);
    safeSetElementText('rep-pol-disp', polDisp); safeSetElementText('rep-pol-wait', polWait); safeSetElementText('rep-pol-act', polAct); safeSetElementText('rep-pol-fin', polFin);

    const cprStatBody = document.getElementById('rep-cpr-statuses');
    if (cprStatBody) {
        cprStatBody.innerHTML = (shiftStats.cprTotalGenerated === 0 && total === 0)
            ? `<tr><td colspan="2" style="color:#666;">Brak statusów</td></tr>`
            : `<tr><td>Wygenerowane zgłoszenia 112</td><td style="text-align:right;">${shiftStats.cprTotalGenerated}</td></tr>
               <tr><td>Przyjęte do obsługi (Karty SWD)</td><td style="text-align:right;">${shiftStats.cprAccepted}</td></tr>
               <tr><td>Odrzucone / Zamknięte formatki</td><td style="text-align:right;">${shiftStats.cprRefused}</td></tr>`;
    }

    const opBody = document.getElementById('rep-operators');
    if (opBody) {
        opBody.innerHTML = total === 0
            ? `<tr><td colspan="2" style="color:#666;">Brak danych operatorów</td></tr>`
            : `<tr><td>${getFormattedOperatorName()} (Dyspozytor SKKP)</td><td style="text-align:right;">${total}</td></tr>`;
    }

    const fillTable = (tbodyId, dataObj, emptyLabel) => {
        const el = document.getElementById(tbodyId);
        if (!el) return;
        const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
        el.innerHTML = entries.length === 0
            ? `<tr><td colspan="2" style="color:#666;">${emptyLabel}</td></tr>`
            : entries.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right;">${v}</td></tr>`).join('');
    };

    fillTable('rep-top-cats', catMap, 'Brak kategorii');
    fillTable('rep-top-subcats', subcatMap, 'Brak podkategorii');
    fillTable('rep-refusals-body', shiftStats.refusalReasons, 'Brak odmów w wybranym zakresie');
    fillTable('rep-locations-body', locMap, 'Brak danych adresowych');

    const modal = document.getElementById('modal-reports');
    if (modal) modal.style.display = 'flex';
}

function evaluateTacticalForces(ev) {
    const text = ((ev.desc || "") + " " + (ev.subtype || "")).toLowerCase();
    const vehicles = ev.vehicles || [];
    const totalCount = vehicles.length;
    const hasJRG = vehicles.some(v => v.unitName && v.unitName.includes("JRG"));
    const onlyOSP = totalCount > 0 && !hasJRG;
    const hasLadder = vehicles.some(v => /SH-|SD-|SHD-|53|51/.test(v.name + " " + v.id));
    const gcbaCount = vehicles.filter(v => v.name.includes("GCBA")).length;

    if (/hala|hali|magazyn|zakład|produkcyjn|składowisk|tartak/.test(text)) {
        let missing = [];
        if (!hasJRG) missing.push("zastępy gaśnicze z JRG PSP");
        if (gcbaCount < 2) missing.push("co najmniej dwa ciężkie zastępy GCBA");
        if (!hasLadder) missing.push("drabina mechaniczna lub podnośnik (SH/SD)");
        if (totalCount < 4) missing.push(`dodatkowe zastępy gaśnicze (obecnie tylko ${totalCount}, potrzeba min. 4-5)`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są ZDECYDOWANIE NIEWYSTARCZAJĄCE jak na pożar hali/zakładu! Pilnie potrzebne: ${missing.join(", ")}.` };
    }
    if (/mieszkan|kamienic|balkon|klatce|dach|poddasz|szkoł|urząd|budynk|komin|sadz/.test(text)) {
        let missing = [];
        if (onlyOSP) missing.push("wsparcie z JRG PSP (samo OSP na pożarze budynku mieszkalnego to za mało)");
        if (!hasLadder) missing.push("podnośnik lub drabina mechaniczna (SH/SD)");
        if (totalCount < 3) missing.push(`minimum jeszcze ${3 - totalCount} zastęp(y) GBA/GCBA do pracy w aparatach ODO`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są NIEWYSTARCZAJĄCE! Na pożar w obiekcie mieszkalnym/budynku konieczne: ${missing.join(", ")}.` };
    }
    if (/las|leśn|traw|stog|stodoł|gospodarcz|rolnicz/.test(text)) {
        let missing = [];
        if (onlyOSP && totalCount < 3) missing.push("wsparcie z JRG PSP oraz sąsiednich OSP");
        if (gcbaCount < 1) missing.push("ciężki samochód gaśniczy GCBA do dowożenia wody");
        if (totalCount < 3) missing.push(`dodatkowe zastępy gaśnicze (obecnie tylko ${totalCount})`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są NIEWYSTARCZAJĄCE! Prosimy o zadysponowanie: ${missing.join(", ")}.` };
    }
    if (/wypadek|zderzenie|czołow|zakleszcz/.test(text) && (totalCount < 2 || onlyOSP)) {
        return { sufficient: false, reason: `Siły i środki są niewystarczające na wypadek komunikacyjny – potrzebujemy wsparcia zastępu ratownictwa technicznego z JRG PSP oraz ZRM i Policji.` };
    }
    if (/poszukiwan|zaginion/.test(text) && totalCount < 3) {
        return { sufficient: false, reason: `Siły i środki są niewystarczające do przeszukania terenu – prosimy o zadysponowanie dodatkowych zastępów OSP/PSP.` };
    }
    if (totalCount <= 1 && (ev.type === 'P' || onlyOSP) && !/śmietnik|os|szerszeni|konar/.test(text)) {
        return { sufficient: false, reason: `Jeden zastęp na miejscu to za mało ze względów bezpieczeństwa taktycznego – prosimy o zadysponowanie jeszcze jednego zastępu GBA/GCBA.` };
    }
    return { sufficient: true, reason: `Siły i środki zadysponowane na miejsce (${totalCount} zast.) są w tej chwili wystarczające do opanowania sytuacji.` };
}

function generateSmartKdrResponse(kdrCallsign, userQuestion, ev) {
    const q = userQuestion.toLowerCase();
    const desc = (ev.desc || "").toLowerCase();
    const tactical = evaluateTacticalForces(ev);
    const isSmall = /śmietnik|os|szerszeni|konar/.test(desc);
    const hasPrm = /pogotow|zrm|karetk|medyczn/.test(q);
    const hasPol = /policj|patrol/.test(q);
    const hasSis = /dodatkow|siły|środki|srodki|zastęp|podnośnik|drabin|wystarcz/.test(q);

    if (hasSis) return `${currentCountyCallsign}, tu ${kdrCallsign}. ${tactical.reason} Bez odbioru.`;
    if (hasPrm && hasPol) return `${currentCountyCallsign}, tu ${kdrCallsign}. Przyda się u nas zarówno ZRM, jak i patrol Policji do zabezpieczenia miejsca. Bez odbioru.`;
    if (hasPrm) return isSmall ? `${currentCountyCallsign}, tu ${kdrCallsign}. Nie ma osób poszkodowanych, ZRM nie jest potrzebny. Bez odbioru.` : `${currentCountyCallsign}, tu ${kdrCallsign}. Tak, mamy osobę wymagającą przebadania, poproszę ZRM na miejsce. Bez odbioru.`;
    if (hasPol) return `${currentCountyCallsign}, tu ${kdrCallsign}. Tak, przyda się patrol Policji na miejscu. Bez odbioru.`;
    if (/przyjąłem|zrozumiałem/.test(q)) return `${currentCountyCallsign}, tu ${kdrCallsign}. Zrozumiałem, działamy dalej na miejscu. Bez odbioru.`;
    if (!tactical.sufficient) return `${currentCountyCallsign}, tu ${kdrCallsign}. Prowadzimy działania pod adresem ${ev.street || ev.city}, ale ${tactical.reason.charAt(0).toLowerCase() + tactical.reason.slice(1)} Bez odbioru.`;
    return `${currentCountyCallsign}, tu ${kdrCallsign}. Sytuacja na miejscu pod kontrolą, prowadzimy działania pod adresem ${ev.street || ev.city}. Bez odbioru.`;
}

// --- OKNO RADIA ZDARZENIA ---
function createRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].style.display = 'block';
        return openRadioWindows[evId];
    }
    const ev = events.find(e => e.id === evId);
    if (!ev) return null;

    const modal = document.createElement('div');
    modal.id = `radio-modal-${evId}`;
    const offset = (Object.keys(openRadioWindows).length * 25) % 150;
    modal.style.cssText = `position:fixed; z-index:1050; width:440px; left:calc(50% - 220px + ${offset}px); top:calc(50% - 210px + ${offset}px);`;

    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="radio-win-header" style="background: linear-gradient(90deg, #004080, #1060b0); color: #ffffff; padding: 3px 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span id="radio-title-${evId}">🖵 Korespondencja Radiowa - ID: ${ev.id} (${ev.city}, ${ev.street || ''})</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="minimizeRadioWindow(${ev.id})">_</button>
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeRadioWindow(${ev.id})">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #c0c0c0;">
                <div id="radio-chat-${evId}" style="background: #000000; color: #ffcc00; font-family: 'Courier New', monospace; font-weight: bold; font-size: 12px; height: 195px; padding: 6px; overflow-y: auto; border: 2px solid #808080; box-sizing: border-box; line-height: 1.3;"></div>
                <div style="display: flex; gap: 4px; margin-top: 6px; justify-content: space-between;">
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, 'Przyjąłem.')"><span style="color: green;">✔</span> Przyjąłem</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy na miejscu wymagany jest zespół ZRM?')"><span style="color: red;">🚑</span> Wymagany ZRM?</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy potrzebny jest patrol Policji?')"><span style="color: blue;">🚔</span> Potrzebna Policja?</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy potrzebne są dodatkowe siły i środki?')"><span style="color: darkred;">🚒</span> Dodatkowe SiS?</button>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
                    <input type="text" id="inp-radio-reply-${ev.id}" placeholder="Wpisz treść wiadomości radiowej..." style="flex: 1; padding: 5px 8px; font-size: 12px; background: #ffffff; border: 2px solid #808080; outline: none;" onkeypress="if(event.key==='Enter') sendCustomInputRadio(${ev.id})">
                    <button style="padding: 5px 12px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold;" onclick="sendCustomInputRadio(${ev.id})">Nadaj</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    makeDraggable(modal, modal.querySelector('.radio-win-header'));
    openRadioWindows[evId] = modal;
    updateRadioChatDynamic(evId);
    return modal;
}

function updateRadioChatDynamic(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const chat = document.getElementById(`radio-chat-${evId}`);
    if (chat) { chat.innerHTML = (ev.radioLogs || []).join(''); chat.scrollTop = chat.scrollHeight; }
}

function closeRadioWindow(evId) {
    if (openRadioWindows[evId]) { openRadioWindows[evId].remove(); delete openRadioWindows[evId]; }
}

function minimizeRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].style.display = 'none';
        const bar = document.getElementById('minimized-bar');
        if (bar) {
            const item = document.createElement('div');
            item.className = 'minimized-item'; item.id = `min-radio-${evId}`;
            item.innerHTML = `📻 Radio (ID: ${evId})`;
            item.onclick = () => { if (openRadioWindows[evId]) openRadioWindows[evId].style.display = 'block'; item.remove(); };
            bar.appendChild(item);
        }
    }
}

function openRadioForEvent(evId) {
    selectedEvIdForRadio = evId;
    createRadioWindow(evId);
    const btnOpen = document.getElementById('btn-open-radio');
    if (btnOpen) btnOpen.style.display = 'block';
}

function openRadioForSelectedEvent() {
    if (selectedEvIdForRadio !== null) openRadioForEvent(selectedEvIdForRadio);
    else if (events.length > 0) openRadioForEvent(events[0].id);
    else alert('Brak aktywnych zdarzeń.');
}

function sendCustomInputRadio(evId) {
    const input = document.getElementById(`inp-radio-reply-${evId}`);
    if (!input || !input.value.trim()) return;
    const val = input.value.trim();
    input.value = '';
    sendRadioReplyDynamic(evId, val);
}

function getCommandRank(vehicle) {
    const uName = (vehicle.unitName || "").toUpperCase();
    const vId = (vehicle.id || "").toUpperCase();
    if (uName.includes("KP PSP") || uName.includes("KM PSP")) return 4.0;
    if (uName.includes("JRG")) {
        if (vId.includes("90")) return 3.3;
        if (vId.includes("21")) return 3.2;
        if (vId.includes("25")) return 3.1;
        return 3.0;
    }
    if (uName.includes("KSRG")) return 2.0;
    return 1.0;
}

async function triggerArrivalRadioReport(ev, vehicle) {
    if (!ev.radioLogs) ev.radioLogs = [];
    if (ev.type === 'PZR') return;

    createRadioWindow(ev.id);
    const newRank = getCommandRank(vehicle);
    const prevRank = ev.kdrRank || 0;
    let takeoverText = "";

    if (!ev.kdrVehicleId) {
        ev.kdrVehicleId = vehicle.id; ev.kdrUnitName = vehicle.unitName; ev.kdrRank = newRank;
    } else if (newRank > prevRank) {
        takeoverText = ` Dowodzenie na miejscu zdarzenia przejmuje przybyły zastęp ${vehicle.id} (${vehicle.unitName}).`;
        ev.kdrVehicleId = vehicle.id; ev.kdrUnitName = vehicle.unitName; ev.kdrRank = newRank;
    }

    const vehiclesListStr = ev.vehicles.map(v => `${v.id} (${v.unitName})`).join(', ');
    const sysPrompt = `Jesteś dowódcą zastępu straży pożarnej (${vehicle.id} z jednostki ${vehicle.unitName}). Dojechałeś na miejsce w miejscowości ${ev.city}, adres: ${ev.street || ''}.
Zdarzenie: "${ev.desc}". Zadysponowane siły: ${vehiclesListStr}.
KOMUNIKAT O PRZEJĘCIU DOWODZENIA: ${takeoverText || 'Brak zmiany KDR.'}
Rozpocznij od: "${currentCountyCallsign}, tu ${vehicle.id}." Zakończ: "Bez odbioru."`;

    let reportText = "";
    try {
        reportText = await callUniversalAI(sysPrompt, "Podaj meldunek z dojazdu i informację o dowodzeniu.", false);
        reportText = reportText.replace(/^["']|["']$/g, '');
    } catch (e) {}

    if (!reportText) {
        reportText = takeoverText
            ? `${currentCountyCallsign}, tu ${vehicle.id}. Dotarliśmy na miejsce (${ev.city}).${takeoverText} Prowadzimy działania. Bez odbioru.`
            : `${currentCountyCallsign}, tu ${vehicle.id}. Jesteśmy na miejscu (${ev.city}, ${ev.street || ''}) – potwierdzam dojazd, prowadzimy działania. Bez odbioru.`;
    }

    audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    const timeStr = new Date().toLocaleTimeString();
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #ffcc00;">[${timeStr}] ${vehicle.id} ➔ ${currentCountyCallsign}:<br>"${reportText}"</div>`);
    updateRadioChatDynamic(ev.id);
    saveSimulationState();

    if (takeoverText) {
        logToMainRadio(`${vehicle.id} ➔ SKKP`, `Przejęcie dowodzenia na zdarzeniu ID ${ev.id} (${ev.city}):${takeoverText}`, '#ffaa00', false);
    }
}

async function sendRadioReplyDynamic(evId, text) {
    if (!text) return;
    const ev = events.find(e => e.id === evId);
    if (!ev) return;

    audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    const kdrName = ev.kdrVehicleId || (ev.vehicles[0] ? ev.vehicles[0].id : 'KDR');
    const timeStr = new Date().toLocaleTimeString();
    if (!ev.radioLogs) ev.radioLogs = [];
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #00ff00;">[${timeStr}] ${currentCountyCallsign} ➔ ${kdrName}:<br>"${text}"</div>`);

    const chatBox = document.getElementById(`radio-chat-${evId}`);
    if (chatBox) {
        chatBox.innerHTML = ev.radioLogs.join('') + `<div id="ai-typing-${evId}" style="color:#aaa; font-style:italic; padding:2px;">⏳ ${kdrName} nadaje...</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const qLower = text.toLowerCase();
    const tactical = evaluateTacticalForces(ev);
    const asksForSis = /siły|środki|srodki|dodatkow|zastęp|potrzeb|wystarcz/.test(qLower);

    let aiReply = "";
    if (asksForSis && !tactical.sufficient) {
        aiReply = `${currentCountyCallsign}, tu ${kdrName}. ${tactical.reason} Bez odbioru.`;
    } else {
        const vehiclesListStr = ev.vehicles.map(v => `${v.id} (${v.unitName} - ${v.name})`).join(', ');
        const systemPrompt = `Jesteś dowódcą akcji straży pożarnej (${kdrName}) na miejscu w miejscowości ${ev.city}, adres: ${ev.street || ''}.
Opis zdarzenia: "${ev.desc}". Zadysponowane wozy: ${vehiclesListStr}.
OCENA TAKTYCZNA SIŁ I ŚRODKÓW: ${tactical.reason}
Dyspozytor (${currentCountyCallsign}) mówi do Ciebie przez radio: "${text}".
Format: "${currentCountyCallsign}, tu ${kdrName}. [Krótka, konkretna odpowiedź]. Bez odbioru."`;
        try {
            aiReply = await callUniversalAI(systemPrompt, text, false);
            aiReply = aiReply.replace(/^["']|["']$/g, '');
        } catch (err) {}
        if (!aiReply) aiReply = generateSmartKdrResponse(kdrName, text, ev);
    }

    audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #ffcc00;">[${new Date().toLocaleTimeString()}] ${kdrName} ➔ ${currentCountyCallsign}:<br>"${aiReply}"</div>`);
    updateRadioChatDynamic(evId);
    saveSimulationState();
}

function safeSetElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// --- BAZA IMION I NAZWISK ZGŁASZAJĄCYCH ---
const callersMaleFirst = ["Jan", "Piotr", "Tomasz", "Michał", "Krzysztof", "Andrzej", "Paweł", "Marek", "Adam", "Łukasz", "Marcin", "Jakub", "Mateusz", "Wojciech", "Henryk", "Dawid", "Szymon", "Kamil", "Robert", "Rafał", "Jacek", "Grzegorz", "Dariusz", "Mariusz", "Zbigniew", "Sławomir", "Jarosław", "Mirosław", "Ryszard", "Tadeusz", "Artur", "Sebastian", "Patryk", "Damian", "Przemysław", "Maciej", "Bartosz", "Dominik", "Karol", "Filip", "Hubert", "Kacper", "Mikołaj", "Błażej", "Cezary", "Leszek", "Waldemar", "Roman", "Kazimierz", "Wiesław"];
const callersMaleLast = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Wojciechowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski", "Zając", "Pawłowski", "Michalski", "Król", "Wieczorek", "Jabłoński", "Wróbel", "Nowakowski", "Majewski", "Olszewski", "Stępień", "Malinowski", "Jaworski", "Adamczyk", "Dudek", "Nowicki", "Pawlak", "Górski", "Witkowski", "Walczak", "Sikora", "Baran", "Rutkowski", "Michalak", "Szewczyk", "Ostrowski", "Tomaszewski", "Pietrzak", "Zalewski", "Wróblewski"];
const callersFemaleFirst = ["Anna", "Katarzyna", "Magdalena", "Agnieszka", "Małgorzata", "Krystyna", "Barbara", "Ewa", "Elżbieta", "Zofia", "Teresa", "Joanna", "Monika", "Danuta", "Natalia", "Karolina", "Marta", "Beata", "Dorota", "Halina", "Jadwiga", "Aleksandra", "Irena", "Alicja", "Paulina", "Justyna", "Renata", "Bożena", "Urszula", "Weronika", "Sylwia", "Agata", "Patrycja", "Izabela", "Aneta", "Emilia", "Ewelina", "Kinga", "Martyna", "Klaudia", "Dominika", "Julia", "Zuzanna", "Maja", "Hanna", "Oliwia", "Wiktoria", "Kamila", "Edyta", "Marzena"];
const callersFemaleLast = ["Kowalska", "Nowak", "Wiśniewska", "Wójcik", "Kowalczyk", "Kamińska", "Lewandowska", "Zielińska", "Szymańska", "Woźniak", "Dąbrowska", "Kozłowska", "Jankowska", "Mazur", "Kwiatkowska", "Wojciechowska", "Krawczyk", "Kaczmarek", "Piotrowska", "Grabowska", "Zając", "Pawłowska", "Michalska", "Król", "Wieczorek", "Jabłońska", "Wróbel", "Nowakowska", "Majewska", "Olszewska", "Stępień", "Malinowska", "Jaworska", "Adamczyk", "Dudek", "Nowicka", "Pawlak", "Górska", "Witkowska", "Walczak", "Sikora", "Baran", "Rutkowska", "Michalak", "Szewczyk", "Ostrowska", "Tomaszewska", "Pietrzak", "Zalewska", "Wróblewska"];

function generateRandomPolishCaller() {
    const isFemale = Math.random() < 0.48;
    const first = isFemale ? callersFemaleFirst[Math.floor(Math.random() * callersFemaleFirst.length)] : callersMaleFirst[Math.floor(Math.random() * callersMaleFirst.length)];
    const last = isFemale ? callersFemaleLast[Math.floor(Math.random() * callersFemaleLast.length)] : callersMaleLast[Math.floor(Math.random() * callersMaleLast.length)];
    const prefixes = ["50", "51", "53", "57", "60", "66", "69", "72", "78", "79", "88"];
    const numStr = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${Math.floor(Math.random() * 9000000 + 1000000)}`;
    return `${first} ${last} (tel. ${numStr.slice(0, 3)}-${numStr.slice(3, 6)}-${numStr.slice(6, 9)})`;
}

// --- DYNAMICZNE GENEROWANIE ZGŁOSZEŃ Z CPR PRZEZ AI ---
async function simulateIncomingCPR() {
    audioCpr.currentTime = 0; audioCpr.play().catch(() => {});
    shiftStats.cprTotalGenerated++;
    saveSimulationState();

    const newCprId = `WCPR-2026-${cprCounter++}`;
    const randomTown = townsList[Math.floor(Math.random() * townsList.length)] || "Lublin";
    const chosenType = Math.random() < 0.5 ? "P" : "MZ";

    const townStreets = realStreetsByTown[randomTown] || ["ul. Długa", "ul. Szkolna"];
    const baseStreet = townStreets[Math.floor(Math.random() * townStreets.length)];
    const houseNum = Math.floor(Math.random() * 25) + 1;
    const verifiedStreetAddress = `${baseStreet} ${houseNum}`;

    safeSetElementText('cpr-id', newCprId);
    safeSetElementText('cpr-city', randomTown);
    safeSetElementText('cpr-street', verifiedStreetAddress);
    safeSetElementText('cpr-caller', "Łączenie z operatorem 112...");
    safeSetElementText('cpr-desc', "🤖 AI generuje unikalną treść formatki ze zgłoszenia...");
    
    const cprModal = document.getElementById('cpr-modal');
    if (cprModal) cprModal.style.display = 'flex';

    let generatedDesc = "";
    try {
        const aiPrompt = `Wygeneruj krótką, w 100% realistyczną i unikalną treść zgłoszenia od świadka dla operatora numeru 112 w Polsce.
Typ zdarzenia: ${chosenType === 'P' ? 'Pożar' : 'Zagrożenie miejscowe / Wypadek / Awaria'}, miejscowość: ${randomTown}, adres: ${verifiedStreetAddress}.
Zwróć TYLKO treść powiadomienia po polsku, bez cudzysłowów, maksymalnie 12 słów.`;
        generatedDesc = await callUniversalAI("Jesteś operatorem CPR (112), zapisujesz zgłoszenia od obywateli w systemie.", aiPrompt, false);
        generatedDesc = generatedDesc.replace(/^["']|["']$/g, '').trim();
    } catch (e) {}

    if (!generatedDesc) {
        const phrasesP = [
            "Pali się sadza w kominie, z komina lecą iskry na dach", "Mieszkaniec zgłasza gęsty czarny dym z budynku gospodarczego",
            "Widzę płomienie wydostające się przez dach pustostanu", "Właściciel zgłasza pożar trawy i suchego ścierniska blisko lasu",
            "Pożar samochodu osobowego na poboczu drogi, ogień pod maską", "Pali się altana śmietnikowa przy budynku mieszkalnym",
            "Gęsty dym wydostający się spod dachu warsztatu stolarskiego", "Pożar komory silnika w autobusie komunikacji miejskiej",
            "Widoczne płomienie w oknie na poddaszu budynku mieszkalnego", "Pali się sterta opon na terenie prywatnej posesji",
            "Zgłoszenie pożaru skrzynki elektrycznej na elewacji budynku", "Pożar sadzy w przewodzie kominowym starej kamienicy",
            "Pali się składowisko palet przy magazynie handlowym", "Ogień i silne zadymienie na balkonie na trzecim piętrze bloku",
            "Pali się traktor podczas prac polowych na ściernisku", "Pożar kotłowni w budynku jednorodzinnym, dym na klatce",
            "Pali się poszycie leśne na powierzchni około 10 arów", "Płonie śmietnik kontenerowy w bliskim sąsiedztwie parkingu",
            "Pożar instalacji fotowoltaicznej na dachu domu jednorodzinnego", "Zgłoszenie zadymienia na klatce schodowej w bloku 4-piętrowym"
        ];
        const phrasesMZ = [
            "Samochód uderzył w przydrożne drzewo, kierowca zakleszczony", "Silny wiatr zerwał połowę dachu z budynku mieszkalnego",
            "Podejrzenie silnego wycieku gazu z instalacji w piwnicy", "Duże drzewo całkowicie zablokowało pas ruchu na drodze",
            "Zderzenie czołowe dwóch aut, wyciek płynów na jezdnię", "Konar drzewa zerwał linie energetyczne nad drogą",
            "Kierowca uderzył w słup oświetleniowy, auto zablokowało przejazd", "Plama oleju napędowego na skrzyżowaniu na długości 200 metrów",
            "Zalana piwnica w budynku jednorodzinnym na wysokość 50 cm", "Osoba uwięziona w uszkodzonej windzie między piętrami",
            "Podejrzenie tlenku węgla w łazience, lokator z zawrotami głowy", "Usuwanie gniazda szerszeni przy wejściu do przedszkola",
            "Zderzenie auta osobowego z motocyklem, wyciek paliwa", "Zerwana blacha z dachu zwisa niebezpiecznie nad chodnikiem",
            "Samochód wpadł do głębokiego rowu melioracyjnego", "Zablokowane drzwi do mieszkania, w środku starsza osoba nie odpowiada",
            "Zderzenie trzech samochodów osobowych na skrzyżowaniu", "Pomoc ZRM w zniesieniu ciężkiego pacjenta z 4. piętra",
            "Zabezpieczenie miejsca lądowania dla śmigłowca LPR", "Uszkodzona skrzynka gazowa przy posesji po kolizji auta"
        ];
        const arr = chosenType === 'P' ? phrasesP : phrasesMZ;
        generatedDesc = arr[Math.floor(Math.random() * arr.length)];
    }

    const finalCaller = generateRandomPolishCaller();
    currentCPRData = { id: newCprId, city: randomTown, street: verifiedStreetAddress, type: chosenType, subtype: generatedDesc, desc: generatedDesc, caller: finalCaller };

    resolveExactCoordinates(verifiedStreetAddress, randomTown).then(coords => {
        if (coords && currentCPRData && currentCPRData.id === newCprId) { currentCPRData.lat = coords.lat; currentCPRData.lng = coords.lng; }
    });

    safeSetElementText('cpr-id', currentCPRData.id);
    safeSetElementText('cpr-city', currentCPRData.city);
    safeSetElementText('cpr-street', currentCPRData.street);
    safeSetElementText('cpr-caller', currentCPRData.caller);
    safeSetElementText('cpr-desc', currentCPRData.desc);
}

function closeCPR(isAccepted = false) { 
    if (!isAccepted && currentCPRData) {
        shiftStats.cprRefused++;
        const reason = "Zamknięto formatkę CPR bez otwarcia karty";
        shiftStats.refusalReasons[reason] = (shiftStats.refusalReasons[reason] || 0) + 1;
        currentCPRData = null;
        saveSimulationState();
    }
    const modal = document.getElementById('cpr-modal');
    if(modal) modal.style.display = 'none'; 
}

function minimizeCPR() {
    if (!currentCPRData) return;
    const modal = document.getElementById('cpr-modal');
    if(modal) modal.style.display = 'none';
    const bar = document.getElementById('minimized-bar');
    if(bar) {
        const item = document.createElement('div');
        item.className = 'minimized-item';
        item.innerHTML = `🚨 Zgłoszenie CPR (${currentCPRData.city}, ${currentCPRData.street})`;
        item.onclick = () => { const m = document.getElementById('cpr-modal'); if(m) m.style.display = 'flex'; item.remove(); };
        bar.appendChild(item);
    }
}

function acceptCPRToEvent() {
    if (!currentCPRData) return;
    shiftStats.cprAccepted++;
    openNewEventModal();

    const inpRec = document.getElementById('inp-ev-received');
    const inpCity = document.getElementById('inp-ev-city');
    const inpReg = document.getElementById('inp-ev-region');
    const inpStreet = document.getElementById('inp-ev-street');
    const inpDesc = document.getElementById('inp-ev-desc');
    if(inpRec) inpRec.value = 'CPR';
    if(inpCity) inpCity.value = currentCPRData.city;
    if(inpReg) inpReg.value = locationsDatabase[currentCPRData.city] || '';
    if(inpStreet) inpStreet.value = currentCPRData.street;
    
    let cleanDesc = (currentCPRData.desc || "").replace(/^(P|MZ|AF|CW|WG|BL|ZPR)\s*-\s*/i, "").trim();
    if (inpDesc) inpDesc.value = cleanDesc;

    autoSelectJRGByCity(currentCPRData.city);

    const radioP = document.querySelector('input[name="ev-type"][value="P"]');
    if (radioP) radioP.checked = true;
    updateSubtypes('P');

    const rawCaller = currentCPRData.caller || "";
    const namePart = rawCaller.split(' (tel.')[0] || "";
    const phoneMatch = rawCaller.match(/tel\.\s*([0-9\-]+)/);
    const callerParts = namePart.trim().split(' ');
    const lastNameVal = callerParts.length > 1 ? callerParts.pop() : '';
    const firstNameVal = callerParts.join(' ');

    const nameInp = document.getElementById('inp-caller-name');
    const surInp = document.getElementById('inp-caller-surname');
    const phoneInp = document.getElementById('inp-caller-phone');
    if(nameInp) nameInp.value = firstNameVal;
    if(surInp) surInp.value = lastNameVal;
    if(phoneInp && phoneMatch) phoneInp.value = phoneMatch[1];

    closeCPR(true);
    currentCPRData = null;
    saveSimulationState();
}

function formatMMSS(sec) {
    if (isNaN(sec) || sec < 0) return "Zabezpieczenie rejonu (PZR)";
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
}

function toggleService(service) {
    servicesState[service] = !servicesState[service];
    const btn = document.getElementById(service === 'prm' ? 'btn-service-prm' : 'btn-service-police');
    if (btn) {
        if (servicesState[service]) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}

function renderUnits() {
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    if(pspGrid) pspGrid.innerHTML = unitsPSP.map(u => createUnitHTML(u)).join('');
    if(ospGrid) ospGrid.innerHTML = unitsOSP.map(u => createUnitHTML(u)).join('');
}

function createUnitHTML(unit) {
    const exactAddr = unitExactLocations[unit.name]?.address || "";
    const unitHasPzr = unit.vehicles.some(v => v.status === 'yellow' || getActivePzrForVehicle(v.id) !== null);

    let vehiclesHTML = unit.vehicles.length === 0 ? `<div style="padding: 4px; color: #888; font-style: italic;">Brak pojazdów</div>` :
        unit.vehicles.map(v => {
            const pzrEv = getActivePzrForVehicle(v.id);
            const isYellowRow = v.status === 'yellow' || pzrEv !== null;
            const pzrBadge = pzrEv ? ` <span style="background:#f1c40f; color:#000; padding:0 4px; border-radius:2px; font-weight:bold; font-size:9px;">PZR (${pzrEv.city})</span>` : '';
            return `
                <div class="vehicle-row ${isYellowRow ? 'pzr-active' : ''}">
                    <span class="status-dot ${v.status}"></span>
                    <span style="color:#000000;"><b>${v.id}</b> - ${v.name}${pzrBadge}</span>
                </div>
            `;
        }).join('');

    return `
        <div class="unit-box ${unitHasPzr ? 'unit-on-pzr' : ''}">
            <div class="unit-header ${unitHasPzr ? 'header-on-pzr' : ''}" style="color:#000000; font-weight:bold;" title="Adres: ${exactAddr}">
                ${unit.name} ${unitHasPzr ? '🛡️ [PZR]' : ''}
            </div>
            <div>${vehiclesHTML}</div>
        </div>
    `;
}

function renderEvents() {
    const tbody = document.getElementById('events-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    events.forEach(ev => {
        const tr = document.createElement('tr');
        tr.className = (ev.status === 'ACTIVE' ? 'active-ev' : 'finished-ev') + (selectedEvIdForRadio === ev.id ? ' selected-ev' : '');
        if (ev.status === 'ACTIVE' && ev.type === 'PZR' && selectedEvIdForRadio !== ev.id) tr.style.color = '#ffff00';
        tr.ondblclick = () => openEditEventModal(ev.id);
        tr.onclick = () => selectEvent(ev.id);

        let timeDisplay = "";
        if (ev.status === 'FINISHED') {
            const anyReturning = ev.vehicles.some(v => v.phase === 'RETURN' && v.returnTime > 0);
            timeDisplay = anyReturning ? "Powrót SiS..." : "0:00 min (Zakończono)";
        } else if (ev.type === 'PZR') {
            timeDisplay = !ev.firstArrived ? "Dojazd na PZR..." : "Zabezpieczenie rejonu (Aktywne)";
        } else if (!ev.firstArrived) {
            timeDisplay = `W drodze na miejsce... (Czas akcji: ${formatMMSS(ev.remainingSeconds)})`;
        } else {
            timeDisplay = `Działania: ${formatMMSS(ev.remainingSeconds)}`;
        }

        const fullPlace = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
        const rowColorStyle = (ev.status === 'ACTIVE' && ev.type === 'PZR' && selectedEvIdForRadio !== ev.id) ? 'style="color:#ffd700;"' : '';

        tr.innerHTML = `
            <td ${rowColorStyle}>${ev.id}/???/2026</td>
            <td ${rowColorStyle}>${ev.time}</td>
            <td ${rowColorStyle}>${ev.jrg}</td>
            <td ${rowColorStyle}>${ev.jrg}</td>
            <td ${rowColorStyle} title="Kliknij pinezkę, aby przybliżyć adres na mapie">${fullPlace} <span style="cursor:pointer;" onclick="event.stopPropagation(); focusEventOnMap(${ev.id});" title="Pokaż dokładny adres na mapie">📍</span></td>
            <td ${rowColorStyle}>${ev.vehicles.length}</td>
            <td ${rowColorStyle}>${ev.type}</td>
            <td ${rowColorStyle}>${ev.desc || (ev.type === 'PZR' ? 'Przekazanie na zabezpieczenie rejonu' : '')}</td>
            <td ${rowColorStyle}><b>${timeDisplay}</b></td>
            <td ${rowColorStyle}>???-0000${ev.id}</td>
        `;
        tbody.appendChild(tr);
    });
    updateMapMarkers();
}

function renderSelectedEventDetails() {
    if (selectedEvIdForRadio === null) return;
    const ev = events.find(e => e.id === selectedEvIdForRadio);
    if (!ev) return;
    const sisBody = document.getElementById('details-sis-body');
    if (!sisBody) return;

    if (ev.vehicles.length === 0) {
        sisBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">Brak zadysponowanych SiS</td></tr>';
        return;
    }

    sisBody.innerHTML = ev.vehicles.map(v => {
        let statusText = "";
        if (v.phase === 'PREP') statusText = `<span style="color: #d35400; font-weight: bold;">Alarmowanie / Wyjazd za ${v.prepTime}s</span>`;
        else if (v.phase === 'TRAVEL') statusText = `<span style="color: #b36b00; font-weight: bold;">W drodze drogą (${formatMMSS(v.travelTime)})</span>`;
        else if (v.phase === 'ONSITE') {
            statusText = ev.type === 'PZR'
                ? `<span style="color: #b38600; background:#fff8c4; padding:1px 4px; font-weight: bold;">Na zabezpieczeniu rejonu (PZR)</span>`
                : `<span style="color: #b30000; font-weight: bold;">Na miejscu działań</span>`;
        } else if (v.phase === 'RETURN') {
            const pzrEv = getActivePzrForVehicle(v.id);
            const destLabel = (pzrEv && ev.type !== 'PZR') ? `Powrót na PZR ${pzrEv.city}` : `Powrót do bazy`;
            statusText = `<span style="color: #004080; font-weight: bold;">${destLabel} (${formatMMSS(v.returnTime)})</span>`;
        } else {
            const pzrEv = getActivePzrForVehicle(v.id);
            statusText = pzrEv
                ? `<span style="color: #b38600; background:#fff8c4; padding:1px 4px; font-weight: bold;">Na PZR (${pzrEv.city})</span>`
                : `<span style="color: #155724; font-weight: bold;">W bazie (Wolny)</span>`;
        }
        return `
            <tr style="color:#000000; ${ev.type === 'PZR' ? 'background:#fffdf0;' : ''}">
                <td><b>${v.id}</b> - ${v.name}</td>
                <td>${v.obsada}</td>
                <td>${v.unitName}</td>
                <td>${statusText}</td>
            </tr>
        `;
    }).join('');
}

function selectEvent(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    selectedEvIdForRadio = ev.id;
    const btnOpen = document.getElementById('btn-open-radio');
    const detailsTitle = document.getElementById('details-title');
    if(btnOpen) btnOpen.style.display = 'block';
    if(detailsTitle) detailsTitle.innerText = `ID: ${ev.id} - ${ev.city}${ev.street ? ', ' + ev.street : ''}`;
    renderEvents();
    renderSelectedEventDetails();
}

function switchTab(tab) {
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    const mapContainer = document.getElementById('view-map-container');
    const btnPsp = document.getElementById('btn-tab-psp');
    const btnOsp = document.getElementById('btn-tab-osp');
    const btnMap = document.getElementById('btn-tab-map');

    if(mapContainer) mapContainer.style.display = 'none';
    if(btnMap) btnMap.classList.remove('active');
    if(pspGrid) pspGrid.style.display = tab === 'PSP' ? 'grid' : 'none';
    if(ospGrid) ospGrid.style.display = tab === 'OSP' ? 'grid' : 'none';
    if(btnPsp) btnPsp.className = 'tab-btn ' + (tab === 'PSP' ? 'active' : '');
    if(btnOsp) btnOsp.className = 'tab-btn ' + (tab === 'OSP' ? 'active' : '');
}

function handleCityInput(input) {
    if(!input) return;
    const val = input.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById('city-suggestions');
    if(!suggestionsBox) return;
    suggestionsBox.innerHTML = '';
    if (!val) { suggestionsBox.style.display = 'none'; return; }

    const matches = Object.keys(locationsDatabase).filter(c => c.toLowerCase().includes(val));
    if (matches.length > 0) {
        matches.forEach(c => {
            const div = document.createElement('div');
            div.className = 'suggestion-item'; div.innerText = c;
            div.onclick = () => {
                const cityInp = document.getElementById('inp-ev-city');
                const regInp = document.getElementById('inp-ev-region');
                if(cityInp) cityInp.value = c;
                if(regInp) regInp.value = locationsDatabase[c];
                autoSelectJRGByCity(c);
                suggestionsBox.style.display = 'none';
            };
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function openNewEventModal() {
    activeEditingId = null;
    selectedVehicles = [];
    servicesState = { prm: false, police: false };
    updateJrgSelectOptions();
    
    const btnPrm = document.getElementById('btn-service-prm');
    const btnPol = document.getElementById('btn-service-police');
    if(btnPrm) btnPrm.classList.remove('active');
    if(btnPol) btnPol.classList.remove('active');

    const titleEl = document.getElementById('modal-event-title');
    const timeEl = document.getElementById('inp-ev-time');
    const cityEl = document.getElementById('inp-ev-city');
    const regEl = document.getElementById('inp-ev-region');
    const streetEl = document.getElementById('inp-ev-street');
    const descEl = document.getElementById('inp-ev-desc');
    const nameEl = document.getElementById('inp-caller-name');
    const surEl = document.getElementById('inp-caller-surname');
    const phoneEl = document.getElementById('inp-caller-phone');
    const countEl = document.getElementById('lbl-selected-count');
    const modalEl = document.getElementById('modal-event');

    const defTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";

    if(titleEl) titleEl.innerText = "Nowa Karta Zdarzenia";
    if(timeEl) timeEl.value = new Date().toLocaleTimeString();
    if(cityEl) { cityEl.value = ''; cityEl.placeholder = `Wpisz np. ${defTown}...`; }
    if(regEl) regEl.value = '';
    if(streetEl) streetEl.value = '';
    if(descEl) descEl.value = '';
    if(nameEl) nameEl.value = '';
    if(surEl) surEl.value = '';
    if(phoneEl) phoneEl.value = '';
    if(countEl) countEl.innerText = "Wybrano pojazdów: 0";

    const radioP = document.querySelector('input[name="ev-type"][value="P"]');
    if (radioP) radioP.checked = true;
    updateSubtypes('P');

    switchModalTab('dane');
    if(modalEl) modalEl.style.display = 'flex';
}

function openEditEventModal(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    activeEditingId = id;
    selectedVehicles = [...ev.vehicles];
    updateJrgSelectOptions();

    const titleEl = document.getElementById('modal-event-title');
    const timeEl = document.getElementById('inp-ev-time');
    const cityEl = document.getElementById('inp-ev-city');
    const regEl = document.getElementById('inp-ev-region');
    const streetEl = document.getElementById('inp-ev-street');
    const descEl = document.getElementById('inp-ev-desc');
    const countEl = document.getElementById('lbl-selected-count');
    const modalEl = document.getElementById('modal-event');

    if(titleEl) titleEl.innerText = `Edycja zdarzenia ID: ${ev.id}`;
    if(timeEl) timeEl.value = ev.time;
    if(cityEl) cityEl.value = ev.city;
    if(regEl) regEl.value = ev.region;
    if(streetEl) streetEl.value = ev.street;
    if(descEl) descEl.value = ev.desc;
    if(countEl) countEl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;

    const radio = document.querySelector(`input[name="ev-type"][value="${ev.type}"]`);
    if (radio) radio.checked = true;
    updateSubtypes(ev.type);
    const subSel = document.getElementById('inp-ev-subtype');
    if (ev.type !== 'PZR' && subSel) subSel.value = ev.subtype || "";

    servicesState = { ...ev.services };
    const btnPrm = document.getElementById('btn-service-prm');
    const btnPol = document.getElementById('btn-service-police');
    if (btnPrm) { if (servicesState.prm) btnPrm.classList.add('active'); else btnPrm.classList.remove('active'); }
    if (btnPol) { if (servicesState.police) btnPol.classList.add('active'); else btnPol.classList.remove('active'); }

    switchModalTab('dane');
    if(modalEl) modalEl.style.display = 'flex';
}

// --- OKNO DYSPONOWANIA Z GEOMETRIĄ TRASY DROGOWEJ OSRM ---
async function openDispatchModal() {
    const container = document.getElementById('dispatch-list');
    const infoBar = document.getElementById('dispatch-info-bar');
    const cityInput = document.getElementById('inp-ev-city');
    const modalDisp = document.getElementById('modal-dispatch');
    
    if(!container) return;
    const targetCity = cityInput ? cityInput.value.trim() : "";
    
    if(infoBar) {
        infoBar.innerHTML = targetCity ? `📍 Pobieranie geometrii dróg OSRM dla: <span style="color:#b30000;">${targetCity}</span>...` : `⚠️ Brak miejscowości`;
    }

    container.innerHTML = `<div style="padding: 15px; text-align: center; color: #555; font-weight: bold;">⏳ Wyznaczanie tras drogowych dla zastępów...</div>`;
    if(modalDisp) modalDisp.style.display = 'flex';

    const allUnits = [...unitsPSP, ...unitsOSP].filter(u => u.vehicles.length > 0);
    
    const unitsWithProximity = await Promise.all(
        allUnits.map(async u => {
            const prox = await getUnitProximityAsync(u.name, targetCity);
            return { ...u, ...prox };
        })
    );

    unitsWithProximity.sort((a, b) => a.sec - b.sec);

    if(infoBar) {
        infoBar.innerHTML = targetCity ? `📍 Trasy drogowe OSRM gotowe dla: <span style="color:#b30000;">${targetCity}</span>` : `⚠️ Brak miejscowości`;
    }

    container.innerHTML = '';

    unitsWithProximity.forEach((u, index) => {
        const isClosest = index === 0 && targetCity !== "";
        const exactAddr = unitExactLocations[u.name]?.address || "";
        const isPSP = u.name.includes("JRG") || u.name.includes("KP PSP") || u.name.includes("KM PSP");
        const prepRange = isPSP ? "Wyjazd: 1-5s" : "Wyjazd: 1-10s";
        const groupDiv = document.createElement('div');
        groupDiv.className = 'dispatch-unit-group';

        groupDiv.innerHTML = `
            <div class="dispatch-unit-header ${isClosest ? 'closest' : ''}" title="${exactAddr}">
                <span>${index + 1}. ${u.name} <small style="font-weight:normal; color:#333;">(${exactAddr})</small> ${isClosest ? '⭐' : ''}</span>
                <span>${u.km} | Droga: ~${formatMMSS(u.sec)} (${prepRange})</span>
            </div>
            ${u.vehicles.map(v => {
                const pzrEv = getActivePzrForVehicle(v.id);
                const inCombat = isVehicleInCombatAction(v.id);
                const isAssignedToThisEvent = selectedVehicles.some(sv => sv.id === v.id);

                let isBlocked = false;
                let statusBadge = '';
                
                if (inCombat && !isAssignedToThisEvent) {
                    isBlocked = true;
                    statusBadge = `<span style="margin-left:auto; background:#c0392b; color:#fff; padding:1px 5px; border-radius:2px; font-weight:bold; font-size:10px;">🚨 W AKCJI</span>`;
                } else if (pzrEv) {
                    statusBadge = `<span style="margin-left:auto; background:#f1c40f; color:#000; padding:1px 5px; border-radius:2px; font-weight:bold; font-size:10px;">🛡️ PZR (${pzrEv.city})</span>`;
                }

                return `
                    <label class="dispatch-vehicle-item" style="cursor:${isBlocked ? 'not-allowed' : 'pointer'}; color:${isBlocked ? '#888888' : '#000000'}; ${isBlocked ? 'background:#f2f2f2; opacity:0.75;' : (pzrEv ? 'background:#fff8c4;' : '')}">
                        <input type="checkbox" value="${v.id}" data-unit="${u.name}" ${isAssignedToThisEvent ? 'checked' : ''} ${isBlocked ? 'disabled' : ''}>
                        <span class="status-dot ${v.status}"></span>
                        <span><b>${v.id}</b> - ${v.name}</span>
                        ${statusBadge}
                    </label>
                `;
            }).join('')}
        `;
        container.appendChild(groupDiv);
    });
}

async function confirmDispatch() {
    const checkboxes = document.querySelectorAll('#dispatch-list input:checked');
    const cityInput = document.getElementById('inp-ev-city');
    const defTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const targetCity = (cityInput && cityInput.value.trim()) ? cityInput.value.trim() : defTown;
    const newSelection = [];

    for (const cb of checkboxes) {
        const vehId = cb.value;
        const unitName = cb.getAttribute('data-unit');
        const existing = selectedVehicles.find(sv => sv.id === vehId);
        if (existing) {
            newSelection.push(existing);
        } else {
            for (const u of [...unitsPSP, ...unitsOSP]) {
                const v = u.vehicles.find(veh => veh.id === vehId);
                if (v && !isVehicleInCombatAction(v.id)) {
                    const pzrEv = getActivePzrForVehicle(v.id);
                    const prepSec = pzrEv ? (Math.floor(Math.random() * 5) + 1) : generateDeparturePrepSeconds(u.name);
                    const prox = await getUnitProximityAsync(u.name, targetCity);
                    const routeSec = prox.sec;
                    const travelCoords = prox.coordinates || [];
                    const returnCoords = [...travelCoords].reverse();

                    newSelection.push({
                        ...v, unitName: u.name, phase: 'PREP', prepTime: prepSec,
                        travelTime: routeSec, baseRouteSeconds: routeSec, returnTime: routeSec,
                        travelGeometry: travelCoords, returnGeometry: returnCoords
                    });
                    break;
                }
            }
        }
    }

    selectedVehicles = newSelection;
    const countLbl = document.getElementById('lbl-selected-count');
    if(countLbl) countLbl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;
    closeModal('modal-dispatch');
}

function saveEvent() {
    const cityInput = document.getElementById('inp-ev-city');
    const city = cityInput ? cityInput.value.trim() : "";
    if (!city) { alert('Proszę podać miejscowość!'); return; }

    const typeChecked = document.querySelector('input[name="ev-type"]:checked');
    const typeVal = typeChecked ? typeChecked.value : 'P';
    const subSel = document.getElementById('inp-ev-subtype');
    const subtypeVal = typeVal === 'PZR' ? 'Zabezpieczenie rejonu' : (subSel && subSel.value ? subSel.value : 'Zgłoszenie operacyjne');
    
    const descInput = document.getElementById('inp-ev-desc');
    let descVal = descInput ? descInput.value : '';
    descVal = descVal.replace(/^(P|MZ|AF|CW|WG|BL|ZPR)\s*-\s*/i, "").trim();
    if (typeVal === 'PZR' && !descVal) descVal = `Przekazanie na zabezpieczenie rejonu operacyjnego (${city})`;

    const streetInput = document.getElementById('inp-ev-street');
    const streetVal = streetInput ? streetInput.value.trim() : '';

    (async () => {
        for (const sv of selectedVehicles) {
            if (!sv.phase) {
                sv.phase = 'PREP';
                sv.prepTime = generateDeparturePrepSeconds(sv.unitName);
                const prox = await getUnitProximityAsync(sv.unitName, city);
                sv.travelTime = prox.sec; sv.baseRouteSeconds = prox.sec; sv.returnTime = prox.sec;
                sv.travelGeometry = prox.coordinates || [];
                sv.returnGeometry = [...sv.travelGeometry].reverse();
            }
        }

        let targetEventObj = null;

        if (activeEditingId === null) {
            let countedOspNames = [];
            selectedVehicles.forEach(sv => {
                if (!sv.unitName.includes("JRG") && !sv.unitName.includes("KP PSP") && !sv.unitName.includes("KM PSP") && !countedOspNames.includes(sv.unitName)) {
                    countedOspNames.push(sv.unitName);
                }
            });
            playOspAlarmRepeated(countedOspNames.length);

            const timeInput = document.getElementById('inp-ev-time');
            const regInput = document.getElementById('inp-ev-region');
            const jrgInput = document.getElementById('inp-ev-jrg');
            const fallback = gpsCoords[city] || COUNTY_PROFILES[currentCountyId].mapCenter;
            const calcDuration = calculateActionDurationSeconds(descVal, subtypeVal, typeVal);
            const defJrg = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].jrgList[0] : "JRG 1 Lublin";

            const newEv = {
                id: events.length + 1,
                time: timeInput && timeInput.value ? timeInput.value : new Date().toLocaleTimeString(),
                city: city,
                region: regInput ? regInput.value : (locationsDatabase[city] || ''),
                street: streetVal,
                lat: fallback[0], lng: fallback[1],
                desc: descVal, type: typeVal, subtype: subtypeVal,
                remainingSeconds: calcDuration, firstArrived: false, radioReported: false, radioLogs: [],
                jrg: jrgInput ? jrgInput.value : defJrg,
                services: { ...servicesState },
                vehicles: [...selectedVehicles],
                status: 'ACTIVE'
            };
            events.push(newEv);
            targetEventObj = newEv;
            selectEvent(newEv.id);
        } else {
            const ev = events.find(e => e.id === activeEditingId);
            if (ev) {
                ev.city = city; ev.street = streetVal; ev.desc = descVal; ev.type = typeVal;
                ev.subtype = subtypeVal; ev.services = { ...servicesState }; ev.vehicles = [...selectedVehicles];
                targetEventObj = ev;
            }
        }

        selectedVehicles.forEach(sv => {
            [...unitsPSP, ...unitsOSP].forEach(u => {
                const v = u.vehicles.find(veh => veh.id === sv.id);
                if (v) {
                    if (typeVal === 'PZR') v.status = 'yellow';
                    else if (v.status === 'green' || v.status === 'yellow') v.status = 'orange';
                }
            });
        });

        if (targetEventObj) geocodeEventAddress(targetEventObj);
        renderUnits(); renderEvents(); saveSimulationState(); closeModal('modal-event');
    })();
}

function triggerEventFinishAndReturn(ev) {
    if (!ev || ev.status === 'FINISHED') return;
    ev.status = 'FINISHED';
    ev.remainingSeconds = 0;

    ev.vehicles.forEach(sv => {
        const activePzr = (ev.type !== 'PZR') ? getActivePzrForVehicle(sv.id) : null;

        if (sv.phase === 'ONSITE' || sv.phase === 'TRAVEL') {
            sv.phase = 'RETURN';
            sv.returnTime = sv.baseRouteSeconds || getUnitProximity(sv.unitName, ev.city).sec;
            const approxMin = Math.max(1, Math.round(sv.returnTime / 60));

            [...unitsPSP, ...unitsOSP].forEach(u => {
                const veh = u.vehicles.find(vObj => vObj.id === sv.id);
                if (veh) veh.status = 'orange';
            });

            if (activePzr) {
                logToMainRadio(
                    `${sv.id} ➔ ${currentCountyCallsign}`,
                    `${currentCountyCallsign}, tu ${sv.id}. Zakończyliśmy działania w miejscowości ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, wracamy z powrotem na zabezpieczenie rejonu (${activePzr.city}). Bez odbioru.`,
                    '#ffd700', true
                );
            } else {
                logToMainRadio(
                    `${sv.id} ➔ ${currentCountyCallsign}`,
                    `${currentCountyCallsign}, tu ${sv.id}. Zakończyliśmy działania w miejscowości ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, wracamy do koszar (czas powrotu ok. ${approxMin} min). Bez odbioru.`,
                    '#ffcc00', true
                );
            }
        } else if (sv.phase === 'PREP') {
            sv.phase = 'DONE';
            sv.returnTime = 0;
            [...unitsPSP, ...unitsOSP].forEach(u => {
                const veh = u.vehicles.find(vObj => vObj.id === sv.id);
                if (veh) veh.status = activePzr ? 'yellow' : 'green';
            });
            logToMainRadio(
                `${currentCountyCallsign} ➔ ${sv.id}`,
                `${sv.id}, odwołuję alarm dla waszego zastępu, ${activePzr ? 'pozostańcie na zabezpieczeniu rejonu' : 'pozostańcie w koszarach'}.`,
                '#00ffff', false
            );
        }
    });
    saveSimulationState();
}

function finishCurrentEvent() {
    const targetId = activeEditingId !== null ? activeEditingId : selectedEvIdForRadio;
    if (targetId === null) return;
    const ev = events.find(e => e.id === targetId);
    if (ev) triggerEventFinishAndReturn(ev);
    renderUnits(); renderEvents(); closeModal('modal-event');
}

function switchModalTab(tab) {
    const daneContent = document.getElementById('modal-tab-dane-content');
    const czasyContent = document.getElementById('modal-tab-czasy-content');
    const tabDane = document.getElementById('tab-modal-dane');
    const tabCzasy = document.getElementById('tab-modal-czasy');

    if(daneContent) daneContent.style.display = tab === 'dane' ? 'block' : 'none';
    if(czasyContent) czasyContent.style.display = tab === 'czasy' ? 'block' : 'none';
    if(tabDane) tabDane.className = 'tab-btn ' + (tab === 'dane' ? 'active' : '');
    if(tabCzasy) tabCzasy.className = 'tab-btn ' + (tab === 'czasy' ? 'active' : '');
}

function openSiSModal() { 
    ensureSiSModalExists(); renderSiSManagerList();
    const modal = document.getElementById('modal-sis');
    if(modal) modal.style.display = 'flex'; 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none'; 
}

// --- GENERATOR KOMUNIKATU WYJAZDU NA GŁÓWNYM RADIU ---
function buildDepartureRadioMessage(vehicle, ev) {
    if (ev.type === 'PZR') return `${vehicle.id} zgłaszam wyjazd na zabezpieczenie rejonu (${ev.city}), odbiór.`;
    if (Math.random() < 0.10) {
        const fullAddr = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
        return `${vehicle.id} zgłaszam wyjazd do zdarzenia na adres: ${fullAddr}, odbiór.`;
    }
    const simpleVariants = [
        `${vehicle.id} zgłaszam wyjazd do zdarzenia, odbiór.`,
        `${vehicle.id} wyjazd, odbiór.`,
        `${currentCountyCallsign}, tu ${vehicle.id}, wyjeżdżamy do zdarzenia, odbiór.`,
        `${vehicle.id} w drodze do zdarzenia, odbiór.`
    ];
    return simpleVariants[Math.floor(Math.random() * simpleVariants.length)];
}

// --- GŁÓWNA PĘTLA CZASU SYMULATORA ---
function runSimulationTick() {
    let needsRender = false;

    events.forEach(ev => {
        if (ev.status === 'ACTIVE') {
            ev.vehicles.forEach(v => {
                if (v.phase === 'PREP') {
                    if (v.prepTime > 0) { v.prepTime--; needsRender = true; }
                    else {
                        v.phase = 'TRAVEL';
                        logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, buildDepartureRadioMessage(v, ev), '#7CFC00', true);
                        needsRender = true;
                    }
                }
                else if (v.phase === 'TRAVEL') {
                    if (v.travelTime > 0) { v.travelTime--; needsRender = true; }
                    else {
                        v.phase = 'ONSITE';
                        [...unitsPSP, ...unitsOSP].forEach(u => {
                            const veh = u.vehicles.find(vObj => vObj.id === v.id);
                            if (veh) {
                                if (ev.type === 'PZR') {
                                    if (!isVehicleInCombatAction(v.id)) veh.status = 'yellow';
                                } else {
                                    veh.status = 'red';
                                }
                            }
                        });

                        if (ev.type === 'PZR') {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id}. Jesteśmy na miejscu zabezpieczenia rejonu w ${ev.city}, pozostajemy w gotowości bojowej, odbiór.`, '#ffd700', true);
                        } else {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id}. Jesteśmy na miejscu zdarzenia w ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, odbiór.`, '#ffa500', true);
                        }

                        if (!ev.firstArrived) ev.firstArrived = true;
                        triggerArrivalRadioReport(ev, v);
                        needsRender = true;
                    }
                }
            });

            if (ev.type !== 'PZR' && ev.firstArrived && ev.remainingSeconds > 0) {
                ev.remainingSeconds--; needsRender = true;
            } else if (ev.type !== 'PZR' && ev.firstArrived && ev.remainingSeconds === 0) {
                triggerEventFinishAndReturn(ev); needsRender = true;
            }
        }
        else if (ev.status === 'FINISHED') {
            ev.vehicles.forEach(v => {
                if (v.phase === 'RETURN') {
                    if (v.returnTime > 0) { v.returnTime--; needsRender = true; }
                    else {
                        v.phase = 'DONE';
                        const activePzr = (ev.type !== 'PZR') ? getActivePzrForVehicle(v.id) : null;

                        [...unitsPSP, ...unitsOSP].forEach(u => {
                            const veh = u.vehicles.find(vObj => vObj.id === v.id);
                            if (veh) veh.status = activePzr ? 'yellow' : 'green';
                        });

                        if (activePzr) {
                            const pzrVehObj = activePzr.vehicles.find(pv => pv.id === v.id);
                            if (pzrVehObj) pzrVehObj.phase = 'ONSITE';
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id} (${v.unitName}). Powróciliśmy na zabezpieczenie rejonu (${activePzr.city}), w gotowości bojowej, odbiór.`, '#ffd700', true);
                        } else {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id} (${v.unitName}). Zastęp w bazie, gotowy do działań, odbiór.`, '#00ff7f', true);
                        }
                        needsRender = true;
                    }
                }
            });
        }
    });

    renderUnits(); 
    renderEvents(); 
    updateMapMarkers(); 
    saveSimulationState();

    renderSelectedEventDetails();
    ensureVersionBadgeInStatusBar();

    const clockEl = document.getElementById('clock-box');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toISOString().slice(0, 10) + ' ' + now.toLocaleTimeString();
    }
}

function startSimulationLoop() {
    if (simIntervalId) clearInterval(simIntervalId);
    const intervalMs = Math.max(200, Math.round(1000 / simSpeed));
    simIntervalId = setInterval(runSimulationTick, intervalMs);
}

function scheduleNextAutoCPR() {
    if (autoCprTimeoutId) clearTimeout(autoCprTimeoutId);
    const baseRandomTime = Math.floor(Math.random() * (90000 - 45000 + 1)) + 45000;
    const scaledTime = Math.max(8000, Math.round(baseRandomTime / simSpeed));

    autoCprTimeoutId = setTimeout(() => {
        const cprModal = document.getElementById('cpr-modal');
        const launcherModal = document.getElementById('modal-launcher');
        const isLauncherOpen = launcherModal && launcherModal.style.display === 'flex';
        if (!isLauncherOpen && (!cprModal || cprModal.style.display !== 'flex')) {
            simulateIncomingCPR();
        }
        scheduleNextAutoCPR();
    }, scaledTime);
}

startSimulationLoop();
scheduleNextAutoCPR();
renderUnits();
