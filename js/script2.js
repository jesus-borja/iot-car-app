const API_BASE_URL = "http://34.237.107.4:5555";

// --- CONFIGURACIÓN ---
const ACTIONS = [
    { name: "adelante", text: "Adelante" },
    { name: "vuelta_adelante_derecha", text: "V. Adelante Derecha" },
    { name: "giro_90_derecha", text: "90° Derecha" },
    { name: "vuelta_atras_derecha", text: "V. Atrás Derecha" },
    { name: "atras", text: "Atrás" },
    { name: "vuelta_atras_izquierda", text: "V. Atrás Izquierda" },
    { name: "giro_90_izquierda", text: "90° Izquierda" },
    { name: "vuelta_adelante_izquierda", text: "V. Adelante Izquierda" },
];

const NUM_ACTIONS = ACTIONS.length;
const SEGMENT_ANGLE = 360 / NUM_ACTIONS;
const ANGLE_OFFSET = -90;
const degToRad = (degrees) => degrees * (Math.PI / 180);

// --- ESTADO DE ANIMACIÓN ---
// Aquí guardamos cuánto ha crecido cada rebanada (de 0.0 a 1.0)
// 0.0 = Reposo, 1.0 = Totalmente extendida
let segmentStates = new Array(NUM_ACTIONS).fill(0);

let hoveredIndex = -1; // -1 significa que el mouse no está sobre ninguna
let currentSpeed = "normal"; // Valor por defecto

// --- LÓGICA PRINCIPAL ---

function initializeApp() {
    // Referencias DOM
    const canvas = document.getElementById("controlCanvas");
    const ctx = canvas.getContext("2d");

    // Elementos de UI
    const stopButton = document.querySelector(".stop-btn");
    const speedRange = document.getElementById("speedRange");
    const speedValueLabel = document.getElementById("speedValue");
    const reverseSwitch = document.getElementById("reverseSwitch");

    // Botones extra
    const gearStick = document.getElementById("gearStick"); // Si usas la palanca
    const btnSpinLeft = document.getElementById("spinLeft");
    const btnSpinRight = document.getElementById("spinRight");

    // 1. Bucle de Animación (El corazón de la suavidad)
    function animate() {
        updateAnimations(); // Calcular matemáticas (acercar valores)
        drawCanvas(ctx, canvas); // Dibujar el frame actual
        requestAnimationFrame(animate); // Pedir el siguiente frame
    }

    // Iniciar el bucle
    requestAnimationFrame(animate);

    // 2. Eventos del Mouse en Canvas
    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Detectar índice (No la acción string, sino el número 0-7)
        hoveredIndex = getHoveredIndex(x, y, canvas);

        // Cambiar cursor
        canvas.style.cursor = hoveredIndex !== -1 ? "pointer" : "default";
    });

    canvas.addEventListener("mouseleave", () => {
        hoveredIndex = -1;
    });

    canvas.addEventListener("click", () => {
        if (hoveredIndex !== -1) {
            const actionName = ACTIONS[hoveredIndex].name;
            registerMovement(actionName, currentSpeed);
        }
    });

    // 3. Configuración de Velocidad (Tu lógica de Palanca o Slider)
    // NOTA: Asegúrate de que coincida con el HTML que tengas activo (Palanca o Slider)
    if (gearStick) {
        // Si usas la palanca vertical
        const gearText = document.getElementById("currentGearText");
        const labels = document.querySelectorAll(".label-item");
        const SPEED_MAP = {
            3: { id: "rapido", label: "RÁPIDO", color: "var(--orange-p)" },
            2: { id: "normal", label: "NORMAL", color: "var(--green-p)" },
            1: { id: "lento", label: "LENTO", color: "var(--blue-p)" },
            0: { id: "reversa", label: "REVERSA", color: "var(--red-p)" },
        };

        function updateGearBox() {
            const val = parseInt(gearStick.value);
            const setting = SPEED_MAP[val];
            currentSpeed = setting.id;

            if (gearText) {
                gearText.textContent = setting.label;
                gearText.style.color = setting.color;
                gearText.style.borderColor = setting.color;
            }

            if (val === 0) gearStick.classList.add("reversa-active");
            else gearStick.classList.remove("reversa-active");

            labels.forEach((lbl) => {
                lbl.classList.remove("active");
                if (parseInt(lbl.dataset.val) === val)
                    lbl.classList.add("active");
            });
        }
        gearStick.addEventListener("input", updateGearBox);
        labels.forEach((l) =>
            l.addEventListener("click", () => {
                gearStick.value = l.dataset.val;
                updateGearBox();
            })
        );
        updateGearBox();
    }

    // 4. Botón Detener
    stopButton.addEventListener("click", () =>
        registerMovement("detener", currentSpeed)
    );

    // 5. Botones 360
    if (btnSpinLeft)
        btnSpinLeft.addEventListener("click", () =>
            registerMovement("360-izquierda", currentSpeed)
        );
    if (btnSpinRight)
        btnSpinRight.addEventListener("click", () =>
            registerMovement("360-derecha", currentSpeed)
        );

    // Cargar historial inicial
    loadMovementHistory();
}

/**
 * Actualiza progresivamente los valores de animación.
 * Técnica: Linear Interpolation (Lerp) simple.
 */
function updateAnimations() {
    // 0.1 es una velocidad suave y agradable.
    // Si pones 0.5 es muy rápido. Si pones 0.05 es muy lento "gelatinoso".
    const speed = 0.12;

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
 * Dibuja todo el canvas basado en los valores actuales de segmentStates
 */
function drawCanvas(ctx, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const center = { x: W / 2, y: H / 2 };

    // AJUSTES DE TAMAÑO CRÍTICOS
    // Reducimos el radio base a 160px. Como el canvas es de 400px (radio 200),
    // esto nos deja 40px de margen para que la rebanada crezca y se desplace sin cortarse.
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
    // Al dibujarlo al final, garantizamos que se superponga a los vecinos y la sombra se vea bien
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

    // --- PASO 3: Círculo Central (Tapa) ---
    // ctx.beginPath();
    // ctx.arc(center.x, center.y, baseInnerRadius + 2, 0, degToRad(360));
    // ctx.fillStyle = "#282828";
    // ctx.fill();
    // ctx.strokeStyle = "#928374";
    // ctx.lineWidth = 3;
    // ctx.stroke();
}

/**
 * Función auxiliar para dibujar un solo segmento
 * @param {boolean} isHovered - Define si aplicamos estilos destacados
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
    // 1. Desplazamiento (Shift): Cuánto se separa del centro (0px a 25px)
    const shiftDistance = animValue * 25;

    // 2. Crecimiento (Grow): Cuánto aumenta su radio (0px a 15px)
    const radiusExpansion = animValue * 10;

    // Calculamos coordenadas de desplazamiento
    const dx = Math.cos(midAngleRad) * shiftDistance;
    const dy = Math.sin(midAngleRad) * shiftDistance;

    ctx.save();

    // Movemos el origen de dibujo
    ctx.translate(dx, dy);

    // Dibujamos la rebanada
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    // El radio final es: Base (160) + Expansión (hasta 15) = 175px.
    // Con el desplazamiento de 25px, el borde llega a 200px (el límite exacto del canvas)
    ctx.arc(center.x, center.y, outerR + radiusExpansion, startRad, endRad);
    ctx.closePath();

    // Estilos
    if (isHovered) {
        ctx.fillStyle = "#fe8019"; // Naranja brillante
        // Sombra fuerte para efecto 3D "flotante"
        ctx.shadowColor = "rgba(0,0,0, 0.6)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
    } else {
        // Colores normales
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
    // El texto también crece
    ctx.font = `bold ${11 + 3 * animValue}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Posición del texto (ajustada al nuevo radio)
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
 * Función auxiliar optimizada para obtener solo el índice
 */
function getHoveredIndex(x, y, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const center = { x: W / 2, y: H / 2 };
    const innerRadius = 60;

    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= innerRadius || distance > 240) {
        // 230 = margen extra por si crece
        return -1;
    }

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    let normalizedAngle = angle - ANGLE_OFFSET;
    if (normalizedAngle < 0) normalizedAngle += 360;

    const segmentStartAngle = SEGMENT_ANGLE / 2;
    const adjustedForIndex = (normalizedAngle + segmentStartAngle) % 360;

    return Math.floor(adjustedForIndex / SEGMENT_ANGLE) % NUM_ACTIONS;
}

// --- FUNCIONES DE API (Simuladas) ---
async function registerMovement(action, speed) {
    console.log(`📡 Enviando: ${action} | Velocidad: ${speed}`);
    await loadMovementHistory(action, speed);
}

async function loadMovementHistory(newAction, newSpeed) {
    const historyList = document.getElementById("movement-history");
    if (newAction) {
        const li = document.createElement("li");
        li.innerHTML = `[Ahora] <b>${newAction.toUpperCase()}</b> (${newSpeed})`;
        historyList.prepend(li);
    }
}

// Iniciar
document.addEventListener("DOMContentLoaded", initializeApp);
