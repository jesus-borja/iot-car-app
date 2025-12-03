// Configuración
const API_BASE_URL = "https://api.carriot.online";
const socket = io(API_BASE_URL);

// Mapeos para textos amigables
const OP_MAP = {
    1: { text: "Adelante", icon: "⬆️" },
    2: { text: "Atrás", icon: "⬇️" },
    3: { text: "Detener", icon: "⏹️" },
    4: { text: "Vuelta Ad. Der", icon: "↗️" },
    5: { text: "Vuelta Ad. Izq", icon: "↖️" },
    6: { text: "Vuelta At. Der", icon: "↘️" },
    7: { text: "Vuelta At. Izq", icon: "↙️" },
    8: { text: "Giro 90° Der", icon: "↪️" },
    9: { text: "Giro 90° Izq", icon: "↩️" },
    10: { text: "Giro 360° Der", icon: "🔄" },
    11: { text: "Giro 360° Izq", icon: "🔄" },
};

const OBS_MAP = {
    1: "Obstáculo Adelante",
    2: "Obs. Adelante-Izq",
    3: "Obs. Adelante-Der",
    4: "Bloqueo Total (Izq-Der)",
    5: "Retroceso",
};

// ID del dispositivo a monitorear (Por defecto 1)
const TARGET_DEVICE_ID = 1;

socket.on("connect", () => {
    console.log("Conectado al Monitor");
    socket.emit("join_monitor_room");

    // CARGA INICIAL DE DATOS
    fetchInitialData();
});

// ==========================================
// 1. INICIALIZACIÓN Y SOCKETS
// ==========================================

socket.on("connect", () => {
    console.log("Conectado al Monitor");
    // Unirse a la sala de monitoreo global
    socket.emit("join_monitor_room");

    // Cargar datos iniciales desde la API (si existen endpoints)
    fetchInitialData(); // Descomenta si implementas endpoints GET para todos los historiales
});

// A. EVENTO: Nuevo Movimiento
socket.on("monitor_update", (payload) => {
    // payload.data trae { op_id, speed_id, geo... }
    if (payload.type === "mov") {
        const data = payload.data;
        updateMovementCard(data);
        addToList("move-history-list", formatMovementItem(data), 10);
    }
});

// B. EVENTO: Nuevo Obstáculo
socket.on("alert_obstacle", (data) => {
    // data trae { device_id, obs_id }
    updateObstacleCard(data);
    addToList("obs-history-list", formatObstacleItem(data), 10);
    triggerAlertEffect();
});

async function fetchInitialData() {
    try {
        // 1. Cargar Movimientos
        const resMov = await fetch(
            `${API_BASE_URL}/api/movements/last10/${TARGET_DEVICE_ID}`
        );
        if (resMov.ok) {
            const movs = await resMov.json();

            // Llenar la lista
            movs.forEach((m) =>
                addToList(
                    "move-history-list",
                    formatMovementItem(mapDbMovement(m)),
                    10
                )
            );

            // Actualizar tarjeta grande con el MÁS RECIENTE (índice 0)
            if (movs.length > 0) {
                updateMovementCard(mapDbMovement(movs[0]));
            }
        }

        // 2. Cargar Obstáculos
        const resObs = await fetch(
            `${API_BASE_URL}/api/obstacles/last10/${TARGET_DEVICE_ID}`
        );
        if (resObs.ok) {
            const obs = await resObs.json();

            // Llenar la lista
            obs.forEach((o) =>
                addToList(
                    "obs-history-list",
                    formatObstacleItem(mapDbObstacle(o)),
                    10
                )
            );

            // Actualizar tarjeta grande con el MÁS RECIENTE
            if (obs.length > 0) {
                // CORRECCIÓN: Usamos obs[0] en lugar de 'o'
                const recentObs = obs[0];

                // Usamos la descripción que viene de la BD para decidir el ID o icono
                // Como la BD devuelve texto, usaremos un ID genérico 1 para que salga la alerta
                updateObstacleCard({
                    obs_id: getObsIdFromDesc(recentObs.description),
                    device_id: TARGET_DEVICE_ID,
                });
            }
        }

        // 3. Cargar Demos
        const resDemo = await fetch(`${API_BASE_URL}/api/demos`);
        if (resDemo.ok) {
            const data = await resDemo.json();
            const list = document.getElementById("demo-history-list");
            if (list) {
                // Pequeña protección por si el elemento no carga a tiempo
                list.innerHTML = "";
                data.forEach((demo) => {
                    const li = document.createElement("li");
                    li.innerHTML = `
                        <span class="fw-bold" style="color: var(--orange-p)">🎬 ${
                            demo.demo_name
                        }</span>
                        <span style="font-size:0.75rem; color: #bbb">${new Date(
                            demo.created_at
                        ).toLocaleDateString()}</span>
                    `;
                    list.appendChild(li);
                });
            }
        }
    } catch (error) {
        console.error("Error cargando datos iniciales:", error);
    }
}

// HELPERS PARA MAPEAR LA DATA QUE VIENE DE LA BD (Snake_case) A LO QUE ESPERA TU UI
function mapDbMovement(dbItem) {
    // La BD devuelve 'operacion' (string) y 'velocidad' (string).
    // Necesitamos convertirlo a IDs o usar el texto directamente.
    // Para simplificar, ajustaremos formatMovementItem para que acepte textos si no hay IDs.
    return {
        op_text: dbItem.operacion,
        speed_text: dbItem.velocidad,
        client_ip: dbItem.client_city || dbItem.client_country || "Histórico",
        time_str: new Date(dbItem.event_time).toLocaleTimeString(),
    };
}

function mapDbObstacle(dbItem) {
    return {
        obs_text: dbItem.description,
        time_str: new Date(dbItem.event_time).toLocaleTimeString(),
    };
}

// Helper inverso simple (solo para efectos visuales)
function getObsIdFromDesc(desc) {
    // Retorna un ID genérico para que salga el ícono de alerta
    return 1;
}

// ==========================================
// 2. FUNCIONES DE UI (TARJETAS)
// ==========================================

function updateMovementCard(data) {
    const opInfo = OP_MAP[data.op_id] || { text: "Desconocido", icon: "?" };
    const container = document.getElementById("live-movement");

    // Actualizar DOM
    container.querySelector(".status-icon").innerText = opInfo.icon;
    container.querySelector(".status-text").innerText = opInfo.text;

    const speedText = getSpeedText(data.speed_id);
    const time = new Date().toLocaleTimeString();
    container.querySelector(
        ".status-meta"
    ).innerText = `Vel: ${speedText} | ${time}`;
}

function updateObstacleCard(data) {
    const obsText = OBS_MAP[data.obs_id] || "Obstáculo Desconocido";
    const container = document.getElementById("live-obstacle");

    container.querySelector(".status-icon").innerText = "⚠️";
    container.querySelector(".status-text").innerText = obsText;
    container.querySelector(".status-meta").innerText = `Carro ID: ${
        data.device_id
    } | ${new Date().toLocaleTimeString()}`;
}

function triggerAlertEffect() {
    const card = document.getElementById("obstacle-card");
    card.classList.add("obstacle-alert");

    // Quitar la alerta visual después de 3 segundos
    setTimeout(() => {
        card.classList.remove("obstacle-alert");
        // Resetear texto a estado neutral si se desea
    }, 3000);
}

// ==========================================
// 3. FUNCIONES DE LISTAS (HISTORIAL)
// ==========================================

function addToList(listId, htmlContent, maxItems) {
    const list = document.getElementById(listId);

    // Si es el primer elemento y dice "Cargando...", limpiarlo
    if (
        list.children.length > 0 &&
        list.children[0].innerText.includes("Cargando")
    ) {
        list.innerHTML = "";
    }

    const li = document.createElement("li");
    li.innerHTML = htmlContent;

    // Animación de entrada simple
    li.style.opacity = "0";
    list.prepend(li);

    // Fade in
    setTimeout(() => (li.style.opacity = "1"), 50);

    // Mantener límite de elementos
    if (list.children.length > maxItems) {
        list.removeChild(list.lastElementChild);
    }
}

// Helpers de Formato
function formatMovementItem(data) {
    // Si viene de Socket trae op_id, si viene de BD trae op_text
    const op = data.op_text || OP_MAP[data.op_id]?.text || "N/A";
    const speed = data.speed_text || getSpeedText(data.speed_id);
    const loc = data.client_ip || data.geo?.city || "Remoto";
    const time = data.time_str || new Date().toLocaleTimeString();

    return `
        <span><strong>${op}</strong> <small>(${speed})</small></span>
        <span style="font-size:0.75rem; color:var(--gray-p)">${loc} - ${time}</span>
    `;
}

function formatObstacleItem(data) {
    const obs = data.obs_text || OBS_MAP[data.obs_id] || "Detectado";
    const time = data.time_str || new Date().toLocaleTimeString();
    return `
        <span class="text-danger fw-bold">${obs}</span>
        <span style="font-size:0.75rem;">${time}</span>
    `;
}

function getSpeedText(id) {
    if (id == 1) return "Rápido";
    if (id == 2) return "Normal";
    if (id == 3) return "Lento";
    if (id == 4) return "Reversa";
    return "--";
}

function updateMovementCard(data) {
    // Manejar tanto datos de Socket como de DB
    const text = data.op_text || OP_MAP[data.op_id]?.text || "---";
    const icon = data.op_text ? "⏱️" : OP_MAP[data.op_id]?.icon || "⏱️"; // Ícono genérico si viene de DB por texto
    const speed = data.speed_text || getSpeedText(data.speed_id);

    const container = document.getElementById("live-movement");
    container.querySelector(".status-icon").innerText = icon;
    container.querySelector(".status-text").innerText = text;
    container.querySelector(".status-meta").innerText = `Vel: ${speed}`;
}

// ==========================================
// 4. CARGA DE DEMOS (Vía API REST)
// ==========================================
// Como las demos no llegan por socket de la misma forma,
// las cargamos al inicio usando el endpoint que creamos en la BDD
async function loadRecentDemos() {
    try {
        // Asumiendo que creaste un endpoint GET /api/demos en Flask
        // Si no, esto fallará silenciosamente.
        const response = await fetch(`${API_BASE_URL}/api/demos`);
        if (response.ok) {
            const data = await response.json(); // { demos: [...] }
            const list = document.getElementById("demo-history-list");
            list.innerHTML = "";

            // Iterar sobre las demos (Limitado a 20)
            data.demos.forEach((demo) => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <span>🎬 ${demo.demo_name}</span>
                    <span style="font-size:0.75rem;">${new Date(
                        demo.created_at
                    ).toLocaleDateString()}</span>
                `;
                list.appendChild(li);
            });
        }
    } catch (e) {
        console.log(
            "No se pudo cargar historial de demos (Endpoint no disponible)"
        );
        document.getElementById("demo-history-list").innerHTML =
            "<li class='text-center'>Esperando demos...</li>";
    }
}

// Iniciar carga
loadRecentDemos();
