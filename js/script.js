const API_BASE_URL = "https://api.carriot.online";

// Definición de las 8 acciones
// op_id: 3 -> detener
// op_id: 10 -> 360 derecha
// op_id: 11 -> 360 izquierda
const ACTIONS = [
    { op_id: 1, name: "adelante", text: "Adelante" },
    { op_id: 4, name: "vuelta_adelante_derecha", text: "V. Adelante Derecha" },
    { op_id: 8, name: "giro_90_derecha", text: "90° Derecha" },
    { op_id: 6, name: "vuelta_atras_derecha", text: "V. Atrás Derecha" },
    { op_id: 2, name: "atras", text: "Atrás" },
    { op_id: 7, name: "vuelta_atras_izquierda", text: "V. Atrás Izquierda" },
    { op_id: 9, name: "giro_90_izquierda", text: "90° Izquierda" },
    {
        op_id: 5,
        name: "vuelta_adelante_izquierda",
        text: "V. Adelante Izquierda",
    },
];

// ID del dispositivo por defecto
let device_id = 1;

// --- VARIABLES DE ANIMACIÓN (Nuevas) ---
let hoveredIndex = -1; // -1 significa que el mouse no está sobre ninguna
let segmentStates = new Array(ACTIONS.length).fill(0); // Estado de animación (0.0 a 1.0)

let userData = null;
let currentSpeed = 2; // ID de velocidad por defecto (Normal)
let demoSteps = null;

const client_info = {
    ip: "0.0.0.0",
    country: "WebClient",
    city: "Browser",
    lat: 0,
    long: 0,
};

const SPEED_MAP = {
    3: { name: "rapido", id: 1 },
    2: { name: "normal", id: 2 },
    1: { name: "lento", id: 3 },
    0: { name: "reversa", id: 4 },
};

// Constantes de cálculo
const NUM_ACTIONS = ACTIONS.length;
const SEGMENT_ANGLE = 360 / NUM_ACTIONS; // 360 / 8 = 45 grados
const ANGLE_OFFSET = -90; // Desplazamiento para que 0° (Adelante) esté arriba.

// Conversión de grados a radianes
const degToRad = (degrees) => degrees * (Math.PI / 180);

// --- LÓGICA DE ANIMACIÓN Y DIBUJO ---

/**
 * Actualiza progresivamente los valores de animación (Interpolación Lineal).
 */
function updateAnimations() {
    const speed = 0.12; // Velocidad de la animación (suavidad)

    for (let i = 0; i < NUM_ACTIONS; i++) {
        const target = i === hoveredIndex ? 1 : 0;
        const dist = target - segmentStates[i];

        if (Math.abs(dist) > 0.001) {
            segmentStates[i] += dist * speed;
        } else {
            segmentStates[i] = target;
        }
    }
}

/**
 * Función principal de dibujo (Render Loop)
 */
function drawCanvas(ctx, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const center = { x: W / 2, y: H / 2 };

    // Ajustes visuales de script2.js
    const baseInnerRadius = 50;
    const baseOuterRadius = 200;

    ctx.clearRect(0, 0, W, H);

    // --- PASO 1: Dibujar segmentos NO seleccionados (Fondo) ---
    ACTIONS.forEach((action, index) => {
        if (index === hoveredIndex) return; // Saltamos el activo para dibujarlo luego
        drawSegment(
            ctx,
            index,
            segmentStates[index],
            center,
            baseInnerRadius,
            baseOuterRadius,
            false
        );
    });

    // --- PASO 2: Dibujar el segmento ACTIVO (Primer plano) ---
    if (hoveredIndex !== -1) {
        drawSegment(
            ctx,
            hoveredIndex,
            segmentStates[hoveredIndex],
            center,
            baseInnerRadius,
            baseOuterRadius,
            true
        );
    }
}

/**
 * Dibuja un segmento individual con transformaciones
 */
function drawSegment(ctx, index, animValue, center, innerR, outerR, isHovered) {
    const action = ACTIONS[index];

    // Cálculos de Geometría
    const startAngle =
        index * SEGMENT_ANGLE + (ANGLE_OFFSET - SEGMENT_ANGLE / 2);
    const endAngle =
        (index + 1) * SEGMENT_ANGLE + (ANGLE_OFFSET - SEGMENT_ANGLE / 2);
    const midAngleDeg = startAngle + SEGMENT_ANGLE / 2;
    const startRad = degToRad(startAngle);
    const endRad = degToRad(endAngle);
    const midAngleRad = degToRad(midAngleDeg);

    // --- MAGIA DE LA ANIMACIÓN ---
    // Desplazamiento y crecimiento basado en animValue (0.0 a 1.0)
    const shiftDistance = animValue * 25;
    const radiusExpansion = animValue * 10;

    // Calculamos coordenadas de desplazamiento
    const dx = Math.cos(midAngleRad) * shiftDistance;
    const dy = Math.sin(midAngleRad) * shiftDistance;

    ctx.save();
    ctx.translate(dx, dy);

    // Dibujamos la rebanada
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, outerR + radiusExpansion, startRad, endRad);
    ctx.closePath();

    // Estilos
    if (isHovered) {
        ctx.fillStyle = "#fe8019"; // Naranja Gruvbox
        // Sombra para efecto 3D "flotante"
        ctx.shadowColor = "rgba(0,0,0, 0.6)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
    } else {
        // Colores normales alternados
        ctx.fillStyle = index % 2 === 0 ? "#3c3836" : "#504945";
        ctx.shadowColor = "transparent";
    }

    ctx.fill();

    // Borde
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#282828";
    ctx.stroke();

    // Resetear sombra para el texto
    ctx.shadowColor = "transparent";

    // --- TEXTO ---
    ctx.fillStyle = isHovered ? "#282828" : "#ebdbb2";
    // El texto también crece ligeramente
    ctx.font = `bold ${11 + 3 * animValue}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const currentOuterR = outerR + radiusExpansion;
    const textRadius = innerR + (currentOuterR - innerR) * 0.65;

    const textX = center.x + textRadius * Math.cos(midAngleRad);
    const textY = center.y + textRadius * Math.sin(midAngleRad);

    ctx.save();
    ctx.translate(textX, textY);
    ctx.rotate(midAngleRad + degToRad(90));

    const lines = action.text.split(" ");
    lines.forEach((line, i) => {
        ctx.fillText(line, 0, i * 14 - (lines.length - 1) * 7);
    });

    ctx.restore(); // Restaurar rotación texto
    ctx.restore(); // Restaurar traslación segmento
}

/**
 * Determina sobre qué índice de acción está el mouse.
 */
function getHoveredIndex(x, y, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const center = { x: W / 2, y: H / 2 };
    const innerRadius = 50; // Sincronizado con drawCanvas

    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Zona muerta central o fuera del límite máximo de expansión
    if (distance <= innerRadius || distance > 240) {
        return -1;
    }

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    let normalizedAngle = angle - ANGLE_OFFSET;
    if (normalizedAngle < 0) normalizedAngle += 360;

    const segmentStartAngle = SEGMENT_ANGLE / 2;
    const adjustedForIndex = (normalizedAngle + segmentStartAngle) % 360;

    return Math.floor(adjustedForIndex / SEGMENT_ANGLE) % NUM_ACTIONS;
}

// --- Lógica de la API y Funciones Auxiliares (Original de script.js) ---

/**
 * Petición POST a la API y registrar un movimiento.
 * @param {string} action - ID del movimiento a registrar
 * @param {string} speed - ID de la velocidad actual
 */
async function registerMovement(action, speed) {
    console.log(`📡 Enviando acción: ${action} a velocidad: ${speed}...`);

    try {
        const response = await fetch(`${API_BASE_URL}/api/movement`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                device_id: device_id,
                op_id: action,
                speed_id: speed,
                client_info: client_info,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Registro exitoso:", data);

        // Después de un registro exitoso, actualizamos el historial
        await loadMovementHistory();
        // Actualizar la etiqueta
    } catch (error) {
        console.error("❌ Fallo al registrar movimiento:", error);
    }
}

/**
 * Obtener el historial de movimientos de la API.
 */
async function loadMovementHistory() {
    const historyList = document.getElementById("movement-history");
    historyList.innerHTML = "";

    try {
        let response = await fetch(
            `${API_BASE_URL}/api/movements/last10/${device_id}`
        );

        if (!response.ok) {
            throw new Error(
                "Error solicitando últimos movimientos: ",
                response.status
            );
        }

        let data = await response.json();
        data = data.slice(0, 5);

        data.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = `${
                item.event_time
            } - Acción: ${item.operacion.toUpperCase()} - Velocidad: ${item.velocidad.toUpperCase()}`;
            historyList.appendChild(li);
        });
    } catch (error) {
        console.error("❌ Fallo al cargar historial:", error);
        historyList.innerHTML = "<li>Error al cargar el historial.</li>";
    }
}

async function getUserData() {
    try {
        let response = await fetch("https://ipapi.co/json");
        if (!response.ok) throw new Error("API IP Error");
        const data = await response.json();
        client_info.ip = data.ip;
        client_info.country = data.country_name;
        client_info.city = data.city;
        client_info.lat = data.latitude;
        client_info.long = data.longitude;
    } catch (e) {
        console.warn("Usando datos por defecto para ubicación.");
    }
}

async function loadDevices() {
    const devicesList = document.getElementById("devices-select");

    const response = await fetch(`${API_BASE_URL}/api/devices`);

    if (!response.ok) {
        throw new Error(
            `Error al cargar los dispositivos. Usando 1 por defecto. ${response.status}`
        );
    }

    const data = await response.json();

    data.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.device_id;
        option.text = device.device_name;
        if (device.device_id == 1) {
            option.selected = true;
        }
        devicesList.appendChild(option);
    });
    updateSelectedDevice();
}

function updateSelectedDevice() {
    const devicesList = document.getElementById("devices-select");
    device_id = devicesList.value;
}

async function loadDemos() {
    const demosList = document.getElementById("demos-select");
    demosList.innerHTML = "";

    const response = await fetch(`${API_BASE_URL}/api/demos`);

    if (!response.ok) {
        throw new Error(`Error al cargar demos. ${response.status}`);
    }

    const data = await response.json();

    data.forEach((demo) => {
        const option = document.createElement("option");
        option.value = demo.demo_id;
        option.text = demo.demo_name;
        if (demo.demo_id == 1) {
            option.selected = true;
        }
        demosList.appendChild(option);
    });
}

async function loadDemoSteps() {
    const response = await fetch(`${API_BASE_URL}/api/demos/steps`);

    if (!response.ok) {
        throw new Error(`Error cargando los pasos. ${response.status}`);
    }

    demoSteps = await response.json();
}

function loadStepsIntoSelect(id) {
    const stepstList = document.getElementById(id);

    demoSteps.forEach((step) => {
        const option = document.createElement("option");
        option.value = step.op_id;
        option.text = step.description;
        option.selected = option.value == 3;

        stepstList.appendChild(option);
    });
}

async function addStepToDemo() {
    const container = document.getElementById("steps-container");
    const id = container.childElementCount + 1;
    const div = document.createElement("div");

    div.classList.add(
        "steps-wrapper",
        "d-flex",
        "gap-3",
        "justify-content-center",
        "w-100"
    );
    div.id = `steps-wrapper-${id}`;

    const select = document.createElement("select");
    select.classList.add("steps-select", "devices-select");
    select.name = "steps-select";
    select.id = `steps-select-${id}`;

    const input = document.createElement("input");
    input.type = "text";
    input.value = "1s";
    input.classList.add("form-control");

    const speedSelect = document.createElement("select");
    speedSelect.classList.add("devices-select");
    speedSelect.setAttribute("name", "speed-select");
    speedSelect.setAttribute("id", "speed-select");

    speedSelect.innerHTML = `<option value='0'>Reversa</option>
        <option value='1'>Lento</option>
        <option value='2' selected>Normal</option>
        <option value='3'>Rápido</option>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
  <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
</svg>`;
    btn.id = `step-remove-${id}`;
    btn.classList.add("btn", "btn-secondary");
    btn.addEventListener("click", () => {
        div.remove();
    });

    div.appendChild(select);
    div.appendChild(speedSelect);
    div.appendChild(input);
    div.appendChild(btn);
    container.appendChild(div);
    loadStepsIntoSelect(select.id);
}

async function executeDemo() {
    const demosList = document.getElementById("demos-select");
    const response = await fetch(`${API_BASE_URL}/api/demos/play`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            demo_id: demosList.value,
            device_id: device_id,
            client_ip: client_info.ip,
        }),
    });

    if (!response.ok) {
        throw new Error(`Error al ejecutar demo. ${response.status}`);
    }

    const data = await response.json();
    console.log("Demo ejecutada correctamente!");
    await loadMovementHistory();
}

async function saveDemo() {
    const demoName = document.getElementById("demo-name");
    if (!demoName.value) {
        alert("Agrega un nombre a la demo.");
        return;
    }
    const container = document.getElementById("steps-container");
    const wrappers = container.children;
    let demoStepsArr = [];

    for (let i = 0; i < wrappers.length; ++i) {
        let div = wrappers.item(i);
        let values = div.children; // select, speed, input, btn

        let operation = values.item(0);
        let speed = values.item(1);
        let time = values.item(2);

        let timeValue = time.value.replace(/[a-zA-Z]/g, "");
        if (timeValue === "") {
            alert("El tiempo debe ser un número entero válido");
            return;
        }

        demoStepsArr.push({
            op: operation.value,
            speed: speed.value,
            sec: timeValue,
        });
    }

    const payload = {
        demo_name: demoName.value,
        demo_steps: demoStepsArr,
    };

    const response = await fetch(`${API_BASE_URL}/api/demos`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Error al guardar demo. ${response.status}`);
    }
    const result = await response.json();
    if (result.status === "success") {
        alert("Demo guardada exitosamente!");
        resetStepsContainer();
        await loadDemos();
    } else {
        alert("Hubo un error al guardar la demo.");
    }
}

function resetStepsContainer() {
    const container = document.getElementById("steps-container");
    const demoName = document.getElementById("demo-name");
    demoName.value = "";
    container.innerHTML = `
        <div class="steps-wrapper d-flex gap-3 justify-content-center w-100" id="steps-wrapper">
            <select class="steps-select devices-select" name="steps-select" id="steps-select"></select>
            <select class="devices-select" name="speed-select" id="speed-select">
                <option value="0">Reversa</option>
                <option value="1">Lento</option>
                <option value="2" selected>Normal</option>
                <option value="3">Rápido</option>
            </select>
            <input type="text" class="form-control" value="1s" pattern="[0-1]+s?">
            <button disabled type="button" class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
                    <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
                </svg>
            </button>
        </div>
    `;
    loadStepsIntoSelect("steps-select");
}

/**
 * Inicializa los eventos y la carga de datos.
 */
async function initializeApp() {
    const stopButton = document.querySelector(".stop-btn");
    const devicesList = document.getElementById("devices-select");
    const playDemoBtn = document.getElementById("play-demo");
    const addStepBtn = document.getElementById("add-step-to-demo");
    const addDemoBtn = document.getElementById("add-demo-btn");
    const canvas = document.getElementById("controlCanvas");
    const ctx = canvas.getContext("2d");

    await getUserData();
    await loadDevices();
    await loadDemos();
    await loadDemoSteps();
    loadStepsIntoSelect("steps-select");

    // --- LOOP DE ANIMACIÓN ---
    function animate() {
        updateAnimations(); // Calcular frames intermedios
        drawCanvas(ctx, canvas); // Dibujar
        requestAnimationFrame(animate); // Repetir
    }
    // Iniciar el loop
    requestAnimationFrame(animate);

    // --- EVENTOS DEL CANVAS (ANIMADOS) ---
    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();
        // Escala por si el CSS cambia el tamaño
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Actualizamos el índice global para la animación
        hoveredIndex = getHoveredIndex(x, y, canvas);

        // Cambiar cursor
        canvas.style.cursor = hoveredIndex !== -1 ? "pointer" : "default";
    });

    canvas.addEventListener("mouseleave", () => {
        hoveredIndex = -1;
    });

    canvas.addEventListener("click", () => {
        // Usamos el índice de animación para saber qué acción se presionó
        if (hoveredIndex !== -1) {
            const action = ACTIONS[hoveredIndex];
            // Llamamos a la API con el op_id real
            registerMovement(action.op_id, currentSpeed);
        }
    });

    // 1. Configuración de Velocidades
    const inputSpeed = document.getElementById("speedInput");
    const labels = document.querySelectorAll(".label-item");

    function updateSpeedInput() {
        const val = parseInt(inputSpeed.value);
        const setting = SPEED_MAP[val];
        currentSpeed = setting.id;

        if (val === 0) {
            inputSpeed.classList.add("reversa-active");
        } else {
            inputSpeed.classList.remove("reversa-active");
        }

        labels.forEach((lbl) => {
            lbl.classList.remove("active");
            if (parseInt(lbl.dataset.val) === val) {
                lbl.classList.add("active");
            }
        });
    }

    inputSpeed.addEventListener("input", updateSpeedInput);
    labels.forEach((label) => {
        label.addEventListener("click", () => {
            inputSpeed.value = label.dataset.val;
            updateSpeedInput();
        });
    });
    updateSpeedInput();

    // 2. Botones de Control
    stopButton.addEventListener("click", () => {
        registerMovement(3, currentSpeed); // op_id: 3 -> detener
    });

    const btnSpinLeft = document.getElementById("spinLeft");
    const btnSpinRight = document.getElementById("spinRight");

    btnSpinLeft.addEventListener("click", () => {
        registerMovement(11, currentSpeed); // op_id: 11
    });

    btnSpinRight.addEventListener("click", () => {
        registerMovement(10, currentSpeed); // op_id: 10
    });

    devicesList.addEventListener("change", updateSelectedDevice);
    playDemoBtn.addEventListener("click", executeDemo);
    addStepBtn.addEventListener("click", addStepToDemo);
    addDemoBtn.addEventListener("click", saveDemo);

    // 5. Carga Inicial del Historial
    loadMovementHistory();
}

document.addEventListener("DOMContentLoaded", initializeApp);
