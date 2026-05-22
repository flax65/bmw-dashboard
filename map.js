// ═══════════════════════════════════════════════
//  MAP – Leaflet + GPS + Navigation
// ═══════════════════════════════════════════════

let leafletMap     = null;
let mapMarker      = null;
let watchId        = null;
let headingUp      = false;
let autoZoom       = true;
let zoomManTimer   = null;
let routeLayer     = null;
let routeCoords    = [];
let navSteps       = [];
let currentStep    = 0;
let offRouteLayer  = null;
let offRoutePoints = [];
let gpsSpeed       = 0;
let gpsHeading     = 0;

const OFFROUTE_DIST = 80;

const markerHtml = `<div style="
    width:20px;height:20px;background:#ffa500;
    border-radius:50%;border:3px solid #fff;
    box-shadow:0 0 10px rgba(255,165,0,0.8);
"></div>`;

function initMap() {
    if (leafletMap) { leafletMap.invalidateSize(); return; }

    leafletMap = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        tap: true
    }).setView([45.65, 13.77], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd'
    }).addTo(leafletMap);

    const markerIcon = L.divIcon({ className:'', html:markerHtml, iconSize:[20,20], iconAnchor:[10,10] });

    leafletMap.on('zoomstart', () => {
        if (autoZoom) {
            autoZoom = false;
            document.getElementById('btnZoom').textContent = 'MAN';
            document.getElementById('btnZoom').classList.remove('active');
        }
        clearTimeout(zoomManTimer);
        zoomManTimer = setTimeout(() => {
            autoZoom = true;
            document.getElementById('btnZoom').textContent = 'AUTO';
            document.getElementById('btnZoom').classList.add('active');
        }, 10000);
    });

    if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(pos => {
            const lat  = pos.coords.latitude;
            const lng  = pos.coords.longitude;
            gpsSpeed   = pos.coords.speed   ? pos.coords.speed * 3.6 : 0;
            gpsHeading = pos.coords.heading || 0;

            document.getElementById('mapSpd').textContent = Math.round(gpsSpeed);

            if (!mapMarker) {
                mapMarker = L.marker([lat,lng], { icon: markerIcon }).addTo(leafletMap);
            } else {
                mapMarker.setLatLng([lat,lng]);
            }

            if (headingUp && gpsHeading !== null) {
                leafletMap.getContainer().style.transform = `rotate(${-gpsHeading}deg) scale(1.5)`;
                leafletMap.getContainer().style.transformOrigin = '50% 50%';
            } else {
                leafletMap.getContainer().style.transform = '';
            }

            if (autoZoom) {
                let z = 16;
                if      (gpsSpeed > 130) z = 12;
                else if (gpsSpeed > 90)  z = 13;
                else if (gpsSpeed > 50)  z = 14;
                else if (gpsSpeed > 10)  z = 15;
                if (leafletMap.getZoom() !== z) leafletMap.setZoom(z, { animate:true });
            }

            leafletMap.panTo([lat,lng], { animate:true, duration:0.5 });
            updateNavigation(lat, lng);

        }, null, { enableHighAccuracy:true, maximumAge:1000 });
    }

    loadRoute();

    setInterval(() => {
        if (!mapMarker || !routeCoords.length) return;
        const pos = mapMarker.getLatLng();
        updateNavigation(pos.lat, pos.lng);
    }, 3000);

    document.getElementById('btnNorth').addEventListener('click', () => {
        headingUp = !headingUp;
        const btn = document.getElementById('btnNorth');
        btn.textContent = headingUp ? 'HDG' : 'N↑';
        btn.classList.toggle('active', headingUp);
        if (!headingUp) leafletMap.getContainer().style.transform = '';
    });

    document.getElementById('btnZoom').addEventListener('click', () => {
        autoZoom = !autoZoom;
        const btn = document.getElementById('btnZoom');
        btn.textContent = autoZoom ? 'AUTO' : 'MAN';
        btn.classList.toggle('active', autoZoom);
        clearTimeout(zoomManTimer);
    });
    document.getElementById('btnZoom').classList.add('active');

    document.getElementById('btnNextMap').addEventListener('click', () => switchPage(0));
}

// ── Route loading ──
async function loadRoute() {
    const noRouteEl = document.getElementById('noRoute');
    try {
        const url  = `https://flax65.github.io/bmw-dashboard/route.json?t=${Date.now()}`;
        const res  = await fetch(url);
        const json = await res.json();
        if (!json.route) { noRouteEl.classList.add('show'); return; }
        noRouteEl.classList.remove('show');
        drawRoute(json.route);
    } catch(e) {
        noRouteEl.classList.add('show');
    }
}

function drawRoute(route) {
    if (routeLayer) { routeLayer.remove(); routeLayer = null; }
    navSteps = []; currentStep = 0;

    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
    routeCoords = coords;
    routeLayer = L.polyline(coords, { color:'#ffa500', weight:5, opacity:0.8 }).addTo(leafletMap);

    route.legs.forEach(leg => leg.steps.forEach(step => {
        if (step.maneuver) navSteps.push(step);
    }));

    if (navSteps.length) currentStep = findNearestStep();
}

function findNearestStep() {
    if (!navSteps.length) return 0;
    const pos = mapMarker ? mapMarker.getLatLng() : null;
    if (!pos) return 0;
    let bestIdx=0, bestDist=Infinity;
    navSteps.forEach((step,i) => {
        const d = haversine(pos.lat, pos.lng, step.maneuver.location[1], step.maneuver.location[0]);
        if (d < bestDist) { bestDist=d; bestIdx=i; }
    });
    return Math.min(bestIdx, navSteps.length-1);
}

// ── Navigation ──
function getApproachDist(speedKmh) {
    if (speedKmh > 100) return 500;
    if (speedKmh > 70)  return 350;
    if (speedKmh > 30)  return 200;
    return 100;
}

function updateNavigation(lat, lng) {
    if (!navSteps.length || !routeCoords.length) return;

    const box = document.getElementById('navBox');
    const minDist = distToPolyline(lat, lng, routeCoords);

    if (minDist > OFFROUTE_DIST) {
        // Fuori rotta: traccia rossa, box vuoto
        box.className = 'offroute';
        document.getElementById('navText').textContent = 'FUORI ROTTA';
        document.getElementById('navDist').textContent = formatDist(minDist);
        setNavArrow(0);

        offRoutePoints.push([lat,lng]);
        if (!offRouteLayer) {
            offRouteLayer = L.polyline(offRoutePoints, {
                color:'#f87171', weight:3, opacity:0.9, dashArray:'6,4'
            }).addTo(leafletMap);
        } else {
            offRouteLayer.setLatLngs(offRoutePoints);
        }
        return;
    }

    // In rotta: azzera traccia fuori rotta
    if (offRouteLayer) { offRouteLayer.remove(); offRouteLayer=null; }
    offRoutePoints = [];

    if (currentStep >= navSteps.length) { box.className=''; clearNavBox(); return; }

    const step = navSteps[currentStep];
    const dist = haversine(lat, lng, step.maneuver.location[1], step.maneuver.location[0]);
    if (dist < 30 && currentStep < navSteps.length-1) currentStep++;

    const APPROACH = getApproachDist(gpsSpeed);

    if (dist <= APPROACH) {
        const next = navSteps[currentStep];
        box.className = 'active';
        setNavArrow(maneuverDeg(next.maneuver.type, next.maneuver.modifier));
        document.getElementById('navText').textContent =
            next.name || formatManeuver(next.maneuver.type, next.maneuver.modifier);
        document.getElementById('navDist').textContent = formatDist(dist);
    } else {
        box.className = '';
        clearNavBox();
    }
}

function clearNavBox() {
    document.getElementById('navText').textContent = '';
    document.getElementById('navDist').textContent = '';
    setNavArrow(0);
    document.getElementById('navArrow').style.color = '#333';
}

// ── Geometry helpers ──
function haversine(lat1,lng1,lat2,lng2) {
    const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function distToPolyline(lat,lng,coords) {
    if (!coords.length) return Infinity;
    let minD=Infinity;
    for (let i=0; i<coords.length-1; i++) {
        const d=distToSegment(lat,lng,coords[i][0],coords[i][1],coords[i+1][0],coords[i+1][1]);
        if (d<minD) minD=d;
    }
    return minD;
}

function distToSegment(plat,plng,alat,alng,blat,blng) {
    const dx=blat-alat, dy=blng-alng;
    if (dx===0&&dy===0) return haversine(plat,plng,alat,alng);
    const t=Math.max(0,Math.min(1,((plat-alat)*dx+(plng-alng)*dy)/(dx*dx+dy*dy)));
    return haversine(plat,plng,alat+t*dx,alng+t*dy);
}

function getBearing(lat1,lng1,lat2,lng2) {
    const dLng=(lng2-lng1)*Math.PI/180;
    const φ1=lat1*Math.PI/180, φ2=lat2*Math.PI/180;
    const y=Math.sin(dLng)*Math.cos(φ2);
    const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(dLng);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
}

// ── Arrow helpers ──
function setNavArrow(deg) {
    const el = document.getElementById('navArrow');
    el.textContent = '▲';
    el.style.transform = `rotate(${deg}deg)`;
}

function maneuverDeg(type, mod) {
    if (type==='arrive'||type==='depart') return 0;
    if (type==='roundabout'||type==='rotary') return 45;
    const map={'straight':0,'slight right':30,'right':90,'sharp right':135,
               'uturn':180,'sharp left':225,'left':270,'slight left':330};
    return map[mod]!==undefined ? map[mod] : 0;
}

function formatManeuver(type, mod) {
    if (type==='arrive')    return 'Arrivo';
    if (type==='depart')    return 'Partenza';
    if (type==='roundabout') return 'Rotatoria';
    const labels={'left':'Sinistra','sharp left':'Brusca sin.','slight left':'Tieni sin.',
                  'right':'Destra','sharp right':'Brusca des.','slight right':'Tieni des.',
                  'straight':'Dritto','uturn':'Inversione'};
    return labels[mod] || 'Continua';
}

function formatDist(m) {
    return m>=1000 ? (m/1000).toFixed(1)+' km' : Math.round(m)+' m';
}

function updateMapOverlay() {
    document.getElementById('mapGear').textContent = data.gear;
    document.getElementById('mapRpm').textContent  = Math.round(data.rpm);
    document.getElementById('mapClt').textContent  = Number(data.clt).toFixed(1);
    document.getElementById('mapBat').textContent  = Number(data.bat).toFixed(2);
}
