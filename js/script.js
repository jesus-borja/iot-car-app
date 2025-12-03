const API_BASE_URL = "api.carriot.online";

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

let hoveredAction = null;
let userData = null;
let currentSpeed = 2;
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

// --- Función de Dibujo del Canvas ---

function drawCanvas(ctx, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const center = { x: W / 2, y: H / 2 };
    const innerRadius = 60;
    const outerRadius = 200;

    ctx.clearRect(0, 0, W, H);

    ACTIONS.forEach((action, index) => {
        const startAngle =
            index * SEGMENT_ANGLE + (ANGLE_OFFSET - SEGMENT_ANGLE / 2);
        const endAngle =
            (index + 1) * SEGMENT_ANGLE + (ANGLE_OFFSET - SEGMENT_ANGLE / 2);
        const startRad = degToRad(startAngle);
        const endRad = degToRad(endAngle);

        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.arc(center.x, center.y, outerRadius, startRad, endRad);
        ctx.closePath();

        // --- LÓGICA DE COLOR (HOVER) ---
        if (action.name === hoveredAction) {
            // Si el mouse está encima, usamos el Naranja Gruvbox
            ctx.fillStyle = "#fe8019";
        } else {
            // Colores normales alternados
            ctx.fillStyle = index % 2 === 0 ? "#3c3836" : "#504945";
        }

        ctx.fill();

        // Línea de separación
        ctx.strokeStyle = "#282828";
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- TEXTO ---
        // Si está en hover, el texto cambia a oscuro para contraste, si no, claro
        ctx.fillStyle = action.name === hoveredAction ? "#282828" : "#ebdbb2";

        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const midAngleDeg = startAngle + SEGMENT_ANGLE / 2;
        const midAngleRad = degToRad(midAngleDeg);
        const textRadius = innerRadius + (outerRadius - innerRadius) * 0.7;

        const textX = center.x + textRadius * Math.cos(midAngleRad);
        const textY = center.y + textRadius * Math.sin(midAngleRad);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(midAngleRad + degToRad(90));

        const lines = action.text.split(" ");
        lines.forEach((line, i) => {
            ctx.fillText(line, 0, i * 14 - (lines.length - 1) * 7);
        });

        ctx.restore();
    });

    // Borde interior (círculo central)
    ctx.beginPath();
    ctx.arc(center.x, center.y, innerRadius, 0, degToRad(360));
    ctx.strokeStyle = "#928374";
    ctx.lineWidth = 3;
    ctx.stroke();
}

// --- Función de Detección de Clic (Hit Testing) ---

/**
 * Determina qué acción ha sido clickeada en el Canvas.
 */
function getClickedAction(x, y, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const center = { x: W / 2, y: H / 2 };
    const innerRadius = 60;

    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Si la distancia es menor al radio interior, es el botón 'Detener' (gestionado por HTML)
    if (distance <= innerRadius) {
        return null;
    }

    // 1. Calcular el ángulo (theta) en grados (-180 a 180)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // 2. Normalizar el ángulo para que 0° (UP) funcione correctamente
    // Aplicamos el desplazamiento inverso del dibujo (quitamos -90° y normalizamos 0-360)
    let normalizedAngle = angle - ANGLE_OFFSET; // Angle + 90

    if (normalizedAngle < 0) {
        normalizedAngle += 360;
    }

    // 3. Encontrar el índice del segmento
    // El ángulo central de cada segmento es: SEGMENT_ANGLE * index + SEGMENT_ANGLE/2

    // Ajuste fino: Para que la línea divisoria esté justo en el límite,
    // desplazamos el ángulo de detección a la mitad del segmento.
    const segmentStartAngle = SEGMENT_ANGLE / 2;
    const adjustedForIndex = (normalizedAngle + segmentStartAngle) % 360;

    const index = Math.floor(adjustedForIndex / SEGMENT_ANGLE);

    // El índice 8 (si ocurre por un clic en el límite) se ajusta a 0.
    return ACTIONS[index % NUM_ACTIONS];
}

// --- Lógica de la API y Inicialización ---

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
    } catch (error) {
        console.error("❌ Fallo al registrar movimiento:", error);
    }
}

/**
 * Obtener el historial de movimientos de la API.
 */
async function loadMovementHistory() {
    const historyList = document.getElementById("movement-history");
    historyList.innerHTML = ""; // Limpiar lista

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
        data = data = data.slice(0, 5);

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
    let response = await fetch("https://ipapi.co/json");
    if (!response.ok) {
        console.error(
            `No se pudieron cargar los datos del usuario: ${response.status}. Usando datos por defecto.`
        );
    }

    const data = await response.json();

    client_info.ip = data.ip;
    client_info.country = data.country_name;
    client_info.city = data.city;
    client_info.lat = data.latitude;
    client_info.long = data.longitude;
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
        const parent = document.getElementById(div.id);
        parent.remove();
    });

    div.appendChild(select);
    div.appendChild(speedSelect);
    div.appendChild(input);
    div.appendChild(btn);
    container.appendChild(div);
    await loadStepsIntoSelect(select.id);
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

    if (demoName.value === "" || demoName.value == null) {
        alert("Agrega un nombre a la demo antes de guardarla.");
        return;
    }
    const container = document.getElementById("steps-container");
    const wrappers = container.children;
    let demoSteps = [];
    for (let i = 0; i < wrappers.length; ++i) {
        let div = wrappers.item(i);
        let values = div.children;

        let operation = values.item(0);
        let speed = values.item(1);
        let time = values.item(2);

        let timeValue = time.value.replace(/[a-zA-Z]/g, "");
        if (timeValue === "") {
            alert("El tiempo debe ser un número entero válido");
            return;
        }

        step = {
            op: operation.value,
            speed: speed.value,
            sec: timeValue,
        };
        demoSteps.push(step);
    }
    let payload = {
        demo_name: demoName.value,
        demo_steps: demoSteps,
    };
    console.log(payload);

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
        alert(
            "Hubo un error al guardar la demo. Revise los datos colocados y vuelva a intentar"
        );
    }
}

function resetStepsContainer() {
    const container = document.getElementById("steps-container");
    const demoName = document.getElementById("demo-name");

    demoName.value = "";
    // Limpiar contenido actual
    container.innerHTML = "";

    // Recrear la estructura original
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
            <button disabled type="button" class="btn btn-secondary" id="step-remove">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
                    <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
                </svg>
            </button>
        </div>
    `;
    loadStepsIntoSelect("steps-select");
    // reassignEventListeners();
}
/**
 * Inicializa los eventos y la carga de datos al cargar la página.
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

    // 1. Configuración de Velocidades
    const inputSpeed = document.getElementById("speedInput");
    const labels = document.querySelectorAll(".label-item");

    function updateSpeedInput() {
        const val = parseInt(inputSpeed.value);
        const setting = SPEED_MAP[val];

        // 1. Actualizar variable global para la API
        currentSpeed = setting.id;

        // 2. Actualizar color de la palanca (Thumb) si es reversa
        if (val === 0) {
            inputSpeed.classList.add("reversa-active");
        } else {
            inputSpeed.classList.remove("reversa-active");
        }

        // 3. Destacar la etiqueta correspondiente a la derecha
        labels.forEach((lbl) => {
            lbl.classList.remove("active");
            if (parseInt(lbl.dataset.val) === val) {
                lbl.classList.add("active");
            }
        });
    }

    // Evento: Al mover el slider
    inputSpeed.addEventListener("input", updateSpeedInput);

    // Evento: Clic en las etiquetas de texto para mover la palanca
    labels.forEach((label) => {
        label.addEventListener("click", () => {
            inputSpeed.value = label.dataset.val;
            updateSpeedInput();
        });
    });

    // Inicializar visualmente
    updateSpeedInput();

    // 2. Configuración del Botón DETENER
    stopButton.addEventListener("click", () => {
        // op_id: 3 -> detener
        registerMovement(3, currentSpeed);
    });

    // 3. Manejo de Clics en el CANVAS
    canvas.addEventListener("click", (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const action = getClickedAction(x, y, canvas);

        if (action) {
            registerMovement(action.op_id, currentSpeed);
        }
    });

    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();

        // Calcular escala por si el CSS redimensionó el canvas en móviles
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Detectar sobre qué acción estamos
        const newHoveredAction = getClickedAction(x, y, canvas).name;

        // Cambiar el cursor: 'pointer' si hay acción, 'default' si está en el centro o fuera
        canvas.style.cursor = newHoveredAction ? "pointer" : "default";

        // Solo redibujar si cambiamos de sección (optimización de rendimiento)
        if (newHoveredAction !== hoveredAction) {
            hoveredAction = newHoveredAction;
            drawCanvas(ctx, canvas);
        }
    });

    // Cuando el mouse sale del canvas, limpiamos el hover
    canvas.addEventListener("mouseleave", () => {
        if (hoveredAction !== null) {
            hoveredAction = null;
            drawCanvas(ctx, canvas);
        }
    });

    // 4. Dibujar el Canvas inicialmente y manejar redimensionamiento
    drawCanvas(ctx, canvas);
    window.addEventListener("resize", () => drawCanvas(ctx, canvas));

    // 5. Carga Inicial del Historial
    loadMovementHistory();

    // 6. Configuración de Botones 360
    const btnSpinLeft = document.getElementById("spinLeft");
    const btnSpinRight = document.getElementById("spinRight");

    btnSpinLeft.addEventListener("click", () => {
        // Enviamos la acción y la velocidad actual definida por la palanca/slider
        // op_id: 11 -> 360 izquierda
        registerMovement(11, currentSpeed);
    });

    btnSpinRight.addEventListener("click", () => {
        // op_id: 10 -> 360 izquierda
        registerMovement(10, currentSpeed);
    });

    devicesList.addEventListener("change", updateSelectedDevice);

    playDemoBtn.addEventListener("click", () => {
        executeDemo();
    });

    addStepBtn.addEventListener("click", () => {
        addStepToDemo();
    });

    addDemoBtn.addEventListener("click", () => {
        saveDemo();
    });
}

// Ejecutar la función de inicialización
document.addEventListener("DOMContentLoaded", initializeApp);
