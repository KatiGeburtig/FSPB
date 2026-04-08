// =====================================================
// STATUS & UI ELEMENTS
// =====================================================

//Default-Werte
let currentElement = -1;// Aktuell ausgewähltes Objekt (-1 = keines)
let buildingsTileset = null;
let sceneModels = [];
let isDragging = false;
let dragIndex = -1;
let dragStartLonLat = null;
let dragStartLon = 0;
let dragStartLat = 0;
let buttonHoldInterval = null;

// Objekte, die von Anfang an in der Anwendung sein sollen
const sceneObjects = [
    //{
    //    name: 'Duck Bank',
    //    url: "./assets/Duck.glb",
    //    lon: 13.4050,
    //    lat: 52.5200,
    //    height: 1.8,  // Street level
    //    scale: 10.0,
    //    headingDeg: 0,
    //    id: 0
    //}
];

// UI Buttons
const moveForwardBtn = document.getElementById('moveForwardBtn');
const moveBackwardBtn = document.getElementById('moveBackwardBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const updateBtn = document.getElementById('updateBtn');
const zoomTargetSelect = document.getElementById('zoomTargetSelect');
const zoomToObjBtn = document.getElementById('zoomToObjBtn');

// =====================================================
// CESIUM INTIALISIEREN
// =====================================================

// Einmal beim Setup aufrufen
updateUIControlsEnabled();
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYWE5ZDIyMy0yZjkyLTRmOTAtYmViNC1lY2E4ZWExMTk5OGEiLCJpZCI6MzgyMjMxLCJpYXQiOjE3NjkwOTg2OTN9.oMHO1hKG93R0omwJMmtKxsNfr8HJHI6tWlbz3hcuXfI";

const viewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    baseLayerPicker: true,  // Clean street view
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false
});

const controller = viewer.scene.screenSpaceCameraController;
controller.minimumZoomDistance = 1.0;
controller.enableCollisionDetection = true;
controller.enableLook = true;
controller.enableZoom = true;
const camera = viewer.camera;
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

// Cesium OpenStreetMaps Gebäude hinzufügen
async function addOSMBuildings() {
    try {
        buildingsTileset = await Cesium.createOsmBuildingsAsync();
        console.log("BUILD");
        console.log(!(buildingsTileset == null));
        viewer.scene.primitives.add(buildingsTileset);
        console.log("Buildings loaded");
    } catch (e) {
        console.log("Probleme beim Laden der Gebäude");
    }
}

// =====================================================
// FUNKTIONEN DER UI
// =====================================================

//Funktion für SteetView Modus
async function flyCameraToStreetView(lon, lat) {
    try {
        const carto = Cesium.Cartographic.fromDegrees(lon, lat);
        const [updated] = await Cesium.sampleTerrainMostDetailed(
            viewer.terrainProvider, [carto]
        );
        const groundHeight = updated.height || 0;

        const targetPos = Cesium.Cartesian3.fromDegrees(lon, lat, groundHeight + 1.5);
        const cameraPos = Cesium.Cartesian3.fromDegrees(lon, lat, groundHeight + 2.0);

        viewer.camera.lookAt(targetPos, new Cesium.HeadingPitchRange(
            0, Cesium.Math.toRadians(-15), 8
        ));
        viewer.camera.zoomOut(100)
    } catch (error) {
        // Fallback if terrain fails
        console.log("Using flat street view");
        viewer.camera.lookAt(
            Cesium.Cartesian3.fromDegrees(lon, lat, 37),  // Berlin street level
            new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 8)
        );
    }
}
//Objekte an Koordinaten verschieben
function teleportElement(lon, lat, heading) {
    const state = sceneModels[currentElement].state;
    state.lon = parseFloat(lon);
    state.lat = parseFloat(lat);
    state.headingDeg = parseFloat(heading);

    if (!canMoveTo(lon, lat)) {
        console.log("Blocked");
    }

    Cesium.sampleTerrainMostDetailed(viewer.terrainProvider,
        [Cesium.Cartographic.fromDegrees(state.lon, state.lat)])
        .then(([updated]) => {
            state.terrainHeight = updated.height || 0;
            state.finalHeight = state.terrainHeight;
            updateAllModels();
            flyCameraToStreetView(state.lon, state.lat);
            console.log(`Element teleported to ${lon}, ${lat}`);
        })
        .catch(err => {
            console.warn("Terrain failed, using default height");
            state.finalHeight = 1.8;
            updateAllModels();
        });

    followCurrentElement();
}

//Sucht das Element bei Index
function zoomToElementByIndex(idx) {
    if (idx < 0 || !sceneModels[idx]) return;

    const state = sceneModels[idx].state;

    const height = state.finalHeight || state.height || 10.0;
    const center = Cesium.Cartesian3.fromDegrees(state.lon, state.lat, height);

    const heading = Cesium.Math.toRadians(state.headingDeg || 0);
    const pitch = Cesium.Math.toRadians(-20);
    const range = 20.0;

    // Position camera 10m behind, 3m above, looking at element
    viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(
        0, Cesium.Math.toRadians(-15),                             // slight downward angle
        12                                                       // 12m distance
    ));
    viewer.camera.zoomOut(100);
}

// =====================================================
// OBJEKTE IN UMGEBUNG LADEN
// =====================================================

async function loadSceneObjects() {
    for (const obj of sceneObjects) {
        try {
            // Sample terrain height at exact coordinates
            const carto = Cesium.Cartographic.fromDegrees(obj.lon, obj.lat);
            const [updated] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
            const terrainHeight = updated.height || 0;

            // Add safety offset ABOVE terrain (3m total)
            const finalHeight = terrainHeight;

            const pos = Cesium.Cartesian3.fromDegrees(obj.lon, obj.lat, finalHeight);
            const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(obj.headingDeg), 0, 0);
            const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

            const model = await Cesium.Model.fromGltfAsync({
                url: obj.url,
                modelMatrix,
                scale: obj.scale,
                show: true,
                id: sceneModels.length
            });

            viewer.scene.primitives.add(model);
            sceneModels.push({
                model,
                state: {
                    ...obj,
                    terrainHeight,  // Store for updates
                    finalHeight     // Store corrected height
                }
            });
            console.log(`${obj.name}: terrain=${terrainHeight.toFixed(1)}m, placed=${finalHeight.toFixed(1)}m`);
        } catch (error) {
            console.error(`${obj.name}:`, error.message);
        }
    }
}

// =====================================================
// HILFSFUNKTIONEN ZUM UPDATEN
// =====================================================

//Anzahl der Auszuwählenden Elemetnte
function refreshZoomTargetList() {
    // Clear
    zoomTargetSelect.innerHTML = '';
    zoomTargetSelect.disabled = false;
    zoomTargetSelect.style.opacity = '1.0';
    zoomTargetSelect.style.cursor = 'pointer';
    zoomToObjBtn.disabled = false;
    zoomToObjBtn.style.opacity = '1.0';
    zoomToObjBtn.style.cursor = 'pointer';
    sceneModels.forEach((entry, index) => {
        const opt = document.createElement('option');
        const name = entry.state && entry.state.name ? entry.state.name : `Object ${index + 1}`;
        opt.value = index;
        opt.textContent = `${index + 1}: ${name}`;
        zoomTargetSelect.appendChild(opt);
    });
}

function updateUIControlsEnabled() {
    const hasElement = currentElement >= 0 && sceneModels[currentElement];

    const buttons = [
        moveForwardBtn,
        moveBackwardBtn,
        rotateLeftBtn,
        rotateRightBtn,
        updateBtn,
        zoomToObjBtn,
        zoomTargetSelect
    ];

    buttons.forEach(btn => {
        if (!btn) return;
        btn.disabled = !hasElement;
        btn.style.opacity = hasElement ? '1.0' : '0.5';
        btn.style.cursor = hasElement ? 'pointer' : 'not-allowed';
    });
}

//Aktualisiert die Objekt (Nach Hinzufügen etc.)
function updateAllModels() {
    sceneModels.forEach(({ model, state }) => {
        if (!model || !model.show) return;

        const useHeight = state.finalHeight || state.height || 3.0;
        const pos = Cesium.Cartesian3.fromDegrees(state.lon, state.lat, useHeight);
        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(state.headingDeg), 0, 0
        );
        model.modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);
    });
    updateCoordDisplay();
}

//Aktualisiert die Koordinaten
function updateCoordDisplay() {
    if (!sceneModels[currentElement]) return;
    const state = sceneModels[currentElement].state;
    document.getElementById('currentLon').textContent = state.lon.toFixed(6);
    document.getElementById('currentLat').textContent = state.lat.toFixed(6);
    document.getElementById('currentHeading').textContent = Math.round(state.headingDeg) + '°';
    document.getElementById('newLon').value = state.lon.toFixed(6);
    document.getElementById('newLat').value = state.lat.toFixed(6);
    document.getElementById('newHeading').value = Math.round(state.headingDeg);
}

// =====================================================
// KOLLISIONSSCHUTZ
// =====================================================

function isOnBuilding(lon, lat) {
    const scene = viewer.scene;
    const origin = Cesium.Cartesian3.fromDegrees(lon, lat, 500.0);
    const ground = Cesium.Cartesian3.fromDegrees(lon, lat, 0.0);
    const dirVec = Cesium.Cartesian3.subtract(ground, origin, new Cesium.Cartesian3());
    const direction = Cesium.Cartesian3.normalize(dirVec, new Cesium.Cartesian3());
    const ray = new Cesium.Ray(origin, direction);
    const result = scene.pickFromRay(ray, sceneModels.map(e => e.model));
    if (!result || !result.object) return false;

    // ✅ Check primitive property (standard for 3D Tiles)
    const primitive = result.object.primitive;
    const isBuildingHit = primitive === buildingsTileset;

    return isBuildingHit;
}

// Update Position, falls ok
function canMoveTo(lon, lat) {
    const onBuilding = isOnBuilding(lon, lat);
    if (onBuilding) {
        console.log("blocked: would move into a building");
        return false;
    } else {
        return true;
    }
}

// =====================================================
// AKTIONEN BEI BUTTON
// =====================================================

document.getElementById('streetViewBtn').addEventListener('click', () => flyCameraToStreetView(13.4050, 52.5200));
document.getElementById('updateBtn').addEventListener('click', () => {
    const lon = document.getElementById('newLon').value;
    const lat = document.getElementById('newLat').value;
    const heading = document.getElementById('newHeading').value;
    teleportElement(lon, lat, heading);
});
document.getElementById('zoomInBtn').addEventListener('click', () => viewer.camera.zoomIn(50));
document.getElementById('zoomOutBtn').addEventListener('click', () => viewer.camera.zoomOut(50));
document.getElementById('rotateLeftBtn').addEventListener('click', () => moveElementRotate(currentElement, -1));
document.getElementById('rotateRightBtn').addEventListener('click', () => moveElementRotate(currentElement, 1));
document.getElementById('moveForwardBtn').addEventListener('click', () => moveElementForNBack(currentElement, 1));
document.getElementById('moveBackwardBtn').addEventListener('click', () => moveElementForNBack(currentElement, -1));

zoomToObjBtn.addEventListener('click', () => {
    if (zoomTargetSelect.options.length === 0) return;

    const idx = parseInt(zoomTargetSelect.value, 10);
    zoomToElementByIndex(idx);
});

//Tastenfunktionen 
window.addEventListener("keydown", (e) => {
    const hasCurrent = currentElement >= 0 && sceneModels[currentElement];
    console.log("Key event:", {
        key: e.key,
        code: e.code,
        which: e.which,
        ctrl: e.ctrlKey,
        shift: e.shiftKey
    });

    if (!hasCurrent) {
        if (e.key === 'w' || e.key === 'W') panCameraForward(10);
        if (e.key === 's' || e.key === 'S') panCameraBackward(10);
        if (e.key === 'a' || e.key === 'A') panCameraLeft(10);
        if (e.key === 'd' || e.key === 'D') panCameraRight(10);
        return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        moveElementForNBack(currentElement, e.key === 'ArrowUp' ? 1 : -1);
    }
    // Arrow Left/Right = Rotate
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        moveElementRotate(currentElement, e.key === 'ArrowRight' ? 1 : -1);
    }
});

//Bei gehaltender Tasten
setupRepeatButton(moveForwardBtn, tickMoveForward);
setupRepeatButton(moveBackwardBtn, tickMoveBackward);
setupRepeatButton(rotateLeftBtn, tickRotateLeft);
setupRepeatButton(rotateRightBtn, tickRotateRight);

// =====================================================
// ELEMENT AUSWÄHLEN UND HINZUFÜGEN
// =====================================================

const selectBtn = document.getElementById('selectFileBtn');
const fileInput = document.getElementById('fileInput');

selectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    for (const file of files) {
        console.log(`Selected: ${file.name} (${file.size} bytes)`);

        const url = URL.createObjectURL(file);
        const index = sceneModels.length;
        console.log(url);

        try {
            // Default Position: Berlin Alexanderplatz
            const lon = 13.4050;
            const lat = 52.5200;
            const height = 1.8;
            const carto = Cesium.Cartographic.fromDegrees(lon, lat);
            const [updated] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
            const terrainHeight = updated.height || 0;
            const finalHeight = terrainHeight + 1.0;

            const position = Cesium.Cartesian3.fromDegrees(lon, lat, finalHeight);
            const headingDeg = 0;  //keine Richtung
            const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(headingDeg), 0, 0);
            const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(position, hpr);

            const model = await Cesium.Model.fromGltfAsync({
                url: url,
                modelMatrix,
                scale: 10.0,
                show: true,
                id: index,
                enableModelExperimental: true
            });

            viewer.scene.primitives.add(model);
            sceneModels.push({
                model,
                state: {
                    name: file.name,
                    lon,
                    lat,
                    headingDeg,
                    terrainHeight,
                    finalHeight,
                    height: finalHeight,
                    scale: 10.0
                }
            });
            console.log('Model loaded and added!');
            //Zur Auswahl hinzufügen
            refreshZoomTargetList();
            // Fly camera zum hinzugefügtem Objekt
            flyCameraToStreetView(lon, lat);
        } catch (e) {
            console.error('Failed to load model:', e);
        }
    }
    fileInput.value = '';
});

// =====================================================
// AKTUELLES ELEMENT AUSWÄHLEN
// =====================================================

handler.setInputAction(function (movement) {
    const picked = viewer.scene.pick(movement.position);
    if (!Cesium.defined(picked)) return;
    const idx = picked.id;
    if (typeof idx === 'number' && sceneModels[idx]) {
        currentElement = idx;
        updateUIControlsEnabled();
        console.log('currentElement =', currentElement, sceneModels[idx].state.name);
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// =====================================================
// DRAG AND DROP MECHANISMUS
// =====================================================

// Hilfsfunktion, die die Koordinaten der Maus verfolgt
function screenToLonLat(windowPosition) {
    const scene = viewer.scene;
    let cartesian = undefined;
    if (scene.pickPositionSupported) {
        cartesian = scene.pickPosition(windowPosition);
    }
    if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);
    }
    if (!cartesian) return null;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    return {
        lon: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude)
    };
}

// Mouse down: Drag and Drop beginnt
const dragHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

dragHandler.setInputAction(function (click) {
    const picked = viewer.scene.pick(click.position);
    if (!Cesium.defined(picked)) return;
    const idx = picked.id;
    if (typeof idx === 'number' && sceneModels[idx]) {
        currentElement = idx;
        console.log("ELement selected for movement")
    } else {
        console.log("Element not found");
        return;
    }

    const lonlat = screenToLonLat(click.position);

    if (!lonlat) return;

    isDragging = true;
    dragIndex = idx;
    currentElement = idx;                 // also update your currentElement
    dragStartLat = sceneModels[idx].state.lat;
    dragStartLon = sceneModels[idx].state.lon;
    dragStartLonLat = { ...sceneModels[idx].state };  // copy current state lon/lat

    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;

}, Cesium.ScreenSpaceEventType.LEFT_DOWN);

// Mouse move: Folgt der Maus
dragHandler.setInputAction(function (movement) {
    if (!isDragging || dragIndex < 0 || !sceneModels[dragIndex]) return;

    const mouseLonLat = screenToLonLat(movement.endPosition);
    if (!mouseLonLat) return;

    const state = sceneModels[dragIndex].state;
    state.lon = mouseLonLat.lon;
    state.lat = mouseLonLat.lat;

    if (!canMoveTo(mouseLonLat.lon, mouseLonLat.lat)) {
        sceneModels[dragIndex].state.lon = dragStartLon;
        sceneModels[dragIndex].state.lat = dragStartLat;
    }
    updateAllModels(); //Beinhaltet Kollisionsschutz
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// Mouse up: Drag and Drop beenden
dragHandler.setInputAction(function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    dragIndex = -1;
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    followCurrentElement();
}, Cesium.ScreenSpaceEventType.LEFT_UP);

// =====================================================
// EINFACHE HILFSFUNKTIONEN
// =====================================================

function setupRepeatButton(button, onTick, opts = {}) {
    const { delay = 200, interval = 50 } = opts;
    function startHold() {
        if (buttonHoldInterval) return;
        onTick(); // fire once immediately
        buttonHoldInterval = window.setInterval(onTick, interval);
    }

    function stopHold() {
        if (buttonHoldInterval) {
            clearInterval(buttonHoldInterval);
            buttonHoldInterval = null;
        }
    }

    button.addEventListener('mousedown', startHold);
    button.addEventListener('touchstart', startHold);

    button.addEventListener('mouseup', stopHold);
    button.addEventListener('mouseleave', stopHold);
    button.addEventListener('touchend', stopHold);
    button.addEventListener('touchcancel', stopHold);
}

// Arrows → move/rotate
function tickMoveForward() {
    if (currentElement >= 0 && sceneModels[currentElement]) {
        moveElementForNBack(currentElement, 1);
    }
}

function tickMoveBackward() {
    if (currentElement >= 0 && sceneModels[currentElement]) {
        moveElementForNBack(currentElement, -1);
    }
}

function tickRotateLeft() {
    if (currentElement >= 0 && sceneModels[currentElement]) {
        moveElementRotate(currentElement, -1);
    }
}

function tickRotateRight() {
    if (currentElement >= 0 && sceneModels[currentElement]) {
        moveElementRotate(currentElement, 1);
    }
}

function followCurrentElement() {
    if (currentElement < 0 || !sceneModels[currentElement]) return;

    const state = sceneModels[currentElement].state;
    const pos = Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.finalHeight || 3.0);

    // Position camera 10m behind, 3m above, looking at element
    viewer.camera.lookAt(pos, new Cesium.HeadingPitchRange(
        0, Cesium.Math.toRadians(-15),                             // slight downward angle
        12                                                       // 12m distance
    ));
    viewer.camera.zoomOut(100);
}

//forwardOrBack: 1 = vor, -1 = zurück
function moveElementForNBack(elemIdx, forwardOrBack) {
    if (sceneModels.length === 0) return;

    const state = sceneModels[elemIdx].state;  // Select object
    const moveStepMeters = 1.0;
    const headingRad = Cesium.Math.toRadians(state.headingDeg);

    const direction = forwardOrBack;
    const newLon = state.lon + direction * (Math.sin(headingRad) * moveStepMeters) / 111320.0;
    const newLat = state.lat + direction * (Math.cos(headingRad) * moveStepMeters) / 110540.0;

    if (canMoveTo(newLon, newLat)) {
        state.lon = newLon;
        state.lat = newLat;
        updateAllModels();
        followCurrentElement();
    } else {
        console.log("Element blocked!");
        document.body.classList.add('building-collision');
        setTimeout(() => document.body.classList.remove('building-collision'), 300);
    }
}

//leftOrRight: 1 = rechts, -1 = links
function moveElementRotate(elemIdx, leftOrRight) {
    if (sceneModels.length === 0) return;

    const state = sceneModels[elemIdx].state;  // Select object
    const rotStepDeg = 2.0;
    const headingRad = Cesium.Math.toRadians(state.headingDeg);

    const direction = leftOrRight;
    state.headingDeg += (direction * rotStepDeg);
    updateAllModels();
    followCurrentElement();
}

function panCameraForward(amount = 10.0) {
    camera.moveForward(amount);   // along view vector[web:31][web:37]
}

function panCameraBackward(amount = 10.0) {
    camera.moveBackward(amount);
}

function panCameraLeft(amount = 10.0) {
    camera.moveLeft(amount);      // along -right vector[web:31][web:37]
}

function panCameraRight(amount = 10.0) {
    camera.moveRight(amount);
}

// =====================================================
// INITIALISIERUNG
// =====================================================

(async function init() {
    await addOSMBuildings();
    await loadSceneObjects();
})();
