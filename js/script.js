// Configuración de la API (simulada)
const API_BASE_URL = "http://34.237.107.4:5555";

// Definición de las 8 acciones
const ACTIONS = [
    { name: "adelante", text: "Adelante" }, // La primera se coloca en la parte superior
    { name: "vuelta-adelante-derecha", text: "V. Adelante Derecha" },
    { name: "90-derecha", text: "90° Derecha" },
    { name: "vuelta-atras-derecha", text: "V. Atrás Derecha" },
    { name: "atras", text: "Atrás" },
    { name: "vuelta-atras-izquierda", text: "V. Atrás Izquierda" },
    { name: "90-izquierda", text: "90° Izquierda" },
    { name: "vuelta-adelante-izquierda", text: "V. Adelante Izquierda" },
];

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
    const innerRadius = 60; // Radio del botón "Detener"
    const outerRadius = 200; // Radio exterior del Canvas

    ctx.clearRect(0, 0, W, H); // Limpiar

    // Dibujar los 8 segmentos
    ACTIONS.forEach((action, index) => {
        // Cálculo dinámico de los ángulos
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

        // Estilo de Relleno (Gruvbox Dark)
        ctx.fillStyle = index % 2 === 0 ? "#3c3836" : "#504945"; // Tonos de gris/marrón
        ctx.fill();

        // Línea de separación (mismo color del fondo oscuro para simular separación)
        ctx.strokeStyle = "#282828";
        ctx.lineWidth = 2;
        ctx.stroke();

        // ------------------
        // Dibujar el texto de la acción
        // ------------------
        ctx.fillStyle = "#ebdbb2"; // Color del texto (Gruvbox fg)
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Calcular el ángulo medio
        const midAngleDeg = startAngle + SEGMENT_ANGLE / 2;
        const midAngleRad = degToRad(midAngleDeg);

        const textRadius = innerRadius + (outerRadius - innerRadius) * 0.7; // Posicionar más afuera

        const textX = center.x + textRadius * Math.cos(midAngleRad);
        const textY = center.y + textRadius * Math.sin(midAngleRad);

        // Rotación del texto
        ctx.save();
        ctx.translate(textX, textY);
        // La rotación se aplica para que el texto siga la línea radial. Sumamos 90 grados para orientarlo.
        ctx.rotate(midAngleRad + degToRad(90));

        const lines = action.text.split(" ");
        lines.forEach((line, i) => {
            // Ajuste de posición vertical para múltiples líneas
            ctx.fillText(line, 0, i * 14 - (lines.length - 1) * 7);
        });

        ctx.restore();
    });

    // Dibujar el borde circular interior (separación con Detener)
    ctx.beginPath();
    ctx.arc(center.x, center.y, innerRadius, 0, degToRad(360));
    ctx.strokeStyle = "#928374"; // Gruvbox gray-p
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
    return ACTIONS[index % NUM_ACTIONS].name;
}

// --- Lógica de la API y Inicialización ---

/**
 * 💡 Simulación de la función para hacer una petición POST a la API
 * y registrar un movimiento. (Se mantiene la misma lógica)
 */
async function registerMovement(action, speed) {
    console.log(`📡 Enviando acción: ${action} a velocidad: ${speed}...`);
    // ... (Lógica de fetch simulada) ...

    try {
        // SIMULACIÓN DE REGISTRO
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simula latencia de red

        console.log("✅ Registro exitoso:", { action, speed });
        await loadMovementHistory(action, speed); // Actualizar historial con el nuevo dato simulado
    } catch (error) {
        console.error("❌ Fallo al registrar movimiento:", error);
        alert(
            `Fallo al conectar con la API para la acción "${action}". Revisa la consola.`
        );
    }
}

/**
 * 💡 Simulación de la función para obtener el historial de movimientos de la API.
 */
async function loadMovementHistory(newAction = null, newSpeed = null) {
    const historyList = document.getElementById("movement-history");

    // Datos simulados (Se mantienen en la sesión de la consola para la demo)
    if (!window.simulatedHistory) {
        window.simulatedHistory = [
            { action: "detener", speed: "normal", time: "hace 5s" },
            { action: "adelante", speed: "normal", time: "hace 10s" },
        ];
    }

    if (newAction) {
        // Añadir el nuevo movimiento al principio del historial simulado
        window.simulatedHistory.unshift({
            action: newAction,
            speed: newSpeed,
            time: "justo ahora",
        });
        // Limitar a 5 movimientos para que no crezca demasiado
        window.simulatedHistory = window.simulatedHistory.slice(0, 5);
    }

    historyList.innerHTML = ""; // Limpiar lista

    window.simulatedHistory.forEach((item) => {
        const li = document.createElement("li");
        const timePart =
            item.time === "justo ahora" ? `**${item.time}**` : item.time;
        li.innerHTML = `[${timePart}] Acción: **${item.action
            .toUpperCase()
            .replace(
                /-/g,
                " "
            )}** | Velocidad: **${item.speed.toUpperCase()}**`;
        historyList.appendChild(li);
    });
}

/**
 * 💡 Simulación de la función para hacer una petición POST a la API
 * y registrar un movimiento.
 * @param {string} action - El movimiento a registrar (ej: 'adelante', 'detener').
 * @param {string} speed - La velocidad actual (ej: 'normal', 'reversa').
 */
async function registerMovement(action, speed) {
    console.log(`📡 Enviando acción: ${action} a velocidad: ${speed}...`);

    try {
        // --- SIMULACIÓN DE PETICIÓN API ---
        const response = await fetch(`${API_BASE_URL}/movement`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                action: action,
                speed: speed,
                timestamp: new Date().toISOString(),
            }),
            // En un caso real, la respuesta de un POST indicaría éxito o el nuevo registro.
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
        alert(
            `Fallo al conectar con la API para la acción "${action}". Revisa la consola.`
        );
    }
}

/**
 * 💡 Simulación de la función para obtener el historial de movimientos de la API.
 */
async function loadMovementHistory() {
    const historyList = document.getElementById("movement-history");
    historyList.innerHTML = ""; // Limpiar lista

    try {
        // --- SIMULACIÓN DE PETICIÓN API ---
        // En una aplicación real, se haría un GET a `${API_BASE_URL}/history`

        // Datos simulados:
        const simulatedHistory = [
            { action: "detener", speed: "normal", time: "hace 5s" },
            { action: "adelante", speed: "normal", time: "hace 10s" },
            { action: "90-izquierda", speed: "normal", time: "hace 15s" },
            {
                action: "vuelta-atras-derecha",
                speed: "reversa",
                time: "hace 20s",
            },
            { action: "atras", speed: "reversa", time: "hace 25s" },
        ];

        // const data = await response.json(); // En caso real
        const data = simulatedHistory; // Usamos datos simulados

        data.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = `[${item.time}] Acción: ${item.action
                .toUpperCase()
                .replace(/-/g, " ")} | Velocidad: ${item.speed.toUpperCase()}`;
            historyList.appendChild(li);
        });
    } catch (error) {
        console.error("❌ Fallo al cargar historial:", error);
        historyList.innerHTML = "<li>Error al cargar el historial.</li>";
    }
}

/**
 * 💡 Inicializa los eventos y la carga de datos al cargar la página.
 */
function initializeApp() {
    const speedButtons = document.querySelectorAll(".speed-btn");
    const stopButton = document.querySelector(".stop-btn");
    const canvas = document.getElementById("controlCanvas");
    const ctx = canvas.getContext("2d");

    let currentSpeed = "normal";

    // 1. Configuración de Velocidad
    speedButtons.forEach((button) => {
        button.addEventListener("click", () => {
            speedButtons.forEach((btn) => btn.classList.remove("active"));
            button.classList.add("active");
            currentSpeed = button.dataset.speed;
        });

        if (button.classList.contains("active")) {
            currentSpeed = button.dataset.speed;
        }
    });

    // 2. Configuración del Botón DETENER
    stopButton.addEventListener("click", () => {
        registerMovement("detener", currentSpeed);
    });

    // 3. Manejo de Clics en el CANVAS
    canvas.addEventListener("click", (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const action = getClickedAction(x, y, canvas);

        if (action) {
            registerMovement(action, currentSpeed);
        }
    });

    // 4. Dibujar el Canvas inicialmente y manejar redimensionamiento
    drawCanvas(ctx, canvas);
    window.addEventListener("resize", () => drawCanvas(ctx, canvas));

    // 5. Carga Inicial del Historial
    loadMovementHistory();
}

// Ejecutar la función de inicialización
document.addEventListener("DOMContentLoaded", initializeApp);
