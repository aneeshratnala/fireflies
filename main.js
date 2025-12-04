import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// Post-processing imports for bloom effect
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ==================== SCENE SETUP ====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a); // Dark blue background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
// Use correct output encoding for colors
renderer.outputEncoding = THREE.sRGBEncoding;
// Enable tone mapping for better PBR results
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ==================== POST-PROCESSING (BLOOM) ====================
const composer = new EffectComposer(renderer);

// RenderPass renders the scene normally first
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// UnrealBloomPass creates the glowing effect
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2.0,    // strength - intensity of the bloom (increased)
    0.5,    // radius - how far the bloom spreads
    0.85     // threshold - lowered so fireflies bloom even through glass
);
composer.addPass(bloomPass);

// Camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;

// Firefly camera mode state
let fireflyCameraMode = false;
let trackedFireflyIndex = -1;
const originalCameraPosition = new THREE.Vector3(0, 5, 15);
const originalControlsTarget = new THREE.Vector3(0, 0, 0);
controls.maxDistance = 50;

// ==================== LIGHTING ====================
const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// ==================== FIREFLY POINT LIGHTS (Lantern Effect) ====================
// Pool of 5 point lights that follow the lowest fireflies for performance
const FIREFLY_LIGHT_COUNT = 5;
const fireflyLights = [];

for (let i = 0; i < FIREFLY_LIGHT_COUNT; i++) {
    const light = new THREE.PointLight(0xffdd44, 0.8, 8, 2);
    // color: warm yellow, intensity: 0.8, distance: 8 units, decay: 2 (physically correct)
    light.castShadow = false; // Shadows from many lights = expensive
    scene.add(light);
    fireflyLights.push(light);
}

// Function to update point lights to follow closest-to-ground fireflies
function updateFireflyLights() {
    // Sort fireflies by Y position (lowest first - closest to ground)
    const sortedIndices = fireflyPositions
        .map((pos, i) => ({ index: i, y: pos.y }))
        .sort((a, b) => a.y - b.y)
        .slice(0, FIREFLY_LIGHT_COUNT);
    
    // Assign lights to the lowest fireflies
    for (let i = 0; i < FIREFLY_LIGHT_COUNT; i++) {
        const fireflyIndex = sortedIndices[i].index;
        const fireflyPos = fireflyPositions[fireflyIndex];
        fireflyLights[i].position.copy(fireflyPos);
    }
}

// ==================== GROUND ====================

const groundGeometry = new THREE.PlaneGeometry(50, 50, 512, 512);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    metalness: 0.0
});

const loader = new THREE.TextureLoader();
// correct paths (textures are at `textures/`)
const dispPath = 'textures/gravelly_sand_4k.blend/textures/gravelly_sand_disp_4k.png';
const colorPath = 'textures/gravelly_sand_4k.blend/textures/gravelly_sand_diff_4k.jpg';

// load displacement/bump (height) texture
loader.load(
    dispPath,
    (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        // displacement/bump maps should use linear encoding
        tex.encoding = THREE.LinearEncoding;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        groundMaterial.displacementMap = tex;
        groundMaterial.bumpMap = tex; // also use as bump for extra normal detail
        groundMaterial.bumpScale = 0.5;
        groundMaterial.displacementScale = 0.8;
        groundMaterial.needsUpdate = true;
    },
    undefined,
    (err) => console.warn('Failed to load displacement texture:', dispPath, err)
);

// load color (albedo) texture
loader.load(
    colorPath,
    (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        groundMaterial.map = tex;
        groundMaterial.needsUpdate = true;
    },
    undefined,
    (err) => console.warn('Failed to load color texture:', colorPath, err)
);

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
scene.add(ground);

// ===================== rock ====================
// import rock from obj file and mtl file
const rockLoader = new MTLLoader();
rockLoader.load(
    'objs/rock/Rock1.mtl',
    (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        
        // Load the rock model
        objLoader.load(
            'objs/rock/Rock1.obj',
            (object) => {
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;                    }
                });
                object.position.set(-10, -2, 0);
                object.scale.set(0.5, 0.5, 0.5);
                scene.add(object);
            },
            undefined,
            (error) => console.error('Error loading rock model:', error)
        );
    },
    undefined,
    (error) => console.error('Error loading rock materials:', error)
);

// ==================== MASON JAR ====================
// For initial demo, using basic geometry. Can be replaced with OBJ model later
const jarGroup = new THREE.Group();

// Jar body (cylinder)
const jarGeometry = new THREE.CylinderGeometry(2, 2, 4, 32);
const jarMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1.0,      // Allows light to pass through like real glass
    roughness: 0.1,         // Low = clear glass, higher = frosted
    thickness: 1.0,         // Volume-based refraction
    ior: 1.5,               // Index of Refraction for glass
    transparent: true,
    side: THREE.DoubleSide
});
const jarBody = new THREE.Mesh(jarGeometry, jarMaterial);
jarBody.position.y = 0;
jarBody.castShadow = true;
jarBody.receiveShadow = true;
jarGroup.add(jarBody);

// Jar lid (cylinder)
const lidGeometry = new THREE.CylinderGeometry(2.1, 2.1, 0.3, 32);
const lidMaterial = new THREE.MeshPhongMaterial({
    color: 0x888888,
    shininess: 50
});
const jarLid = new THREE.Mesh(lidGeometry, lidMaterial);
jarLid.position.y = 2.15;
jarLid.castShadow = true;
jarGroup.add(jarLid);

jarGroup.position.set(0, 0, 0);
scene.add(jarGroup);

// Jar state
let jarOpen = false;
let lidRotation = 0;
const LID_OPEN_ANGLE = Math.PI / 2; // 90 degrees

// ==================== FIREFLIES (InstancedMesh for Performance) ====================
const FIREFLY_COUNT = 1000;  // Can now handle 1000+ fireflies at 60FPS!
const fireflyPositions = [];  // Vector3 positions for each firefly
const fireflyVelocities = []; // Vector3 velocities for each firefly

// Boids parameters
const BOIDS_CONFIG = {
    separationDistance: 0.5,  // Distance to maintain from neighbors
    alignmentDistance: 1.5,   // Distance to align with neighbors
    cohesionDistance: 2.0,    // Distance to move toward neighbors
    separationWeight: 1.5,
    alignmentWeight: 1.0,
    cohesionWeight: 1.2,
    maxSpeed: 0.1,
    maxForce: 0.05,
    jarRadius: 1.8,           // Radius of jar (slightly smaller than visual)
    jarHeight: 3.5,           // Height of jar
    jarCenter: new THREE.Vector3(0, 0, 0)
};

// Create firefly geometry and material (shared by all instances)
const fireflyGeometry = new THREE.SphereGeometry(0.05, 8, 8);
const fireflyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 5.0,  // Very high intensity to exceed bloom threshold even through glass
    roughness: 0.2,
    metalness: 0.0,
    toneMapped: false        // Bypass tone mapping so bloom can catch the full brightness
});

// Create InstancedMesh - ONE draw call for ALL fireflies!
const fireflyMesh = new THREE.InstancedMesh(fireflyGeometry, fireflyMaterial, FIREFLY_COUNT);
fireflyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Optimize for frequent updates
scene.add(fireflyMesh);

// Temporary matrix for updates
const tempMatrix = new THREE.Matrix4();

// Initialize firefly positions and velocities
for (let i = 0; i < FIREFLY_COUNT; i++) {
    // Random position inside jar (cylinder)
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * BOIDS_CONFIG.jarRadius * 0.8;
    const height = (Math.random() - 0.5) * BOIDS_CONFIG.jarHeight * 0.8;
    
    const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
    );
    
    // Random initial velocity
    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
    );
    
    fireflyPositions.push(position);
    fireflyVelocities.push(velocity);
    
    // Set initial instance matrix
    tempMatrix.setPosition(position);
    fireflyMesh.setMatrixAt(i, tempMatrix);
}
fireflyMesh.instanceMatrix.needsUpdate = true;

// Update all instance matrices from positions (call every frame)
function updateFireflyMatrices() {
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        tempMatrix.setPosition(fireflyPositions[i]);
        fireflyMesh.setMatrixAt(i, tempMatrix);
    }
    fireflyMesh.instanceMatrix.needsUpdate = true;
}

// ==================== BOIDS ALGORITHM ====================
function limit(vector, max) {
    if (vector.length() > max) {
        vector.normalize().multiplyScalar(max);
    }
    return vector;
}

function separation(fireflyIndex, radius = BOIDS_CONFIG.separationDistance) {
    const steer = new THREE.Vector3();
    let count = 0;
    const pos = fireflyPositions[fireflyIndex];
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflyPositions[i]);
        
        // Use the passed 'radius' instead of the constant
        if (distance < radius && distance > 0) {
            const diff = new THREE.Vector3().subVectors(pos, fireflyPositions[i]);
            diff.normalize();
            diff.divideScalar(distance); // weight by distance
            steer.add(diff);
            count++;
        }
    }
    
    if (count > 0) {
        steer.divideScalar(count);
        steer.normalize();
        steer.multiplyScalar(BOIDS_CONFIG.maxSpeed);
        steer.sub(fireflyVelocities[fireflyIndex]);
        limit(steer, BOIDS_CONFIG.maxForce);
    }
    
    return steer.multiplyScalar(BOIDS_CONFIG.separationWeight);
}

function alignment(fireflyIndex) {
    const steer = new THREE.Vector3();
    let count = 0;
    const pos = fireflyPositions[fireflyIndex];
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflyPositions[i]);
        if (distance < BOIDS_CONFIG.alignmentDistance && distance > 0) {
            steer.add(fireflyVelocities[i]);
            count++;
        }
    }
    
    if (count > 0) {
        steer.divideScalar(count);
        steer.normalize();
        steer.multiplyScalar(BOIDS_CONFIG.maxSpeed);
        steer.sub(fireflyVelocities[fireflyIndex]);
        limit(steer, BOIDS_CONFIG.maxForce);
    }
    
    return steer.multiplyScalar(BOIDS_CONFIG.alignmentWeight);
}

function cohesion(fireflyIndex) {
    const center = new THREE.Vector3();
    let count = 0;
    const pos = fireflyPositions[fireflyIndex];
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflyPositions[i]);
        if (distance < BOIDS_CONFIG.cohesionDistance && distance > 0) {
            center.add(fireflyPositions[i]);
            count++;
        }
    }
    
    if (count > 0) {
        center.divideScalar(count);
        const desired = new THREE.Vector3().subVectors(center, pos);
        desired.normalize();
        desired.multiplyScalar(BOIDS_CONFIG.maxSpeed);
        const steer = new THREE.Vector3().subVectors(desired, fireflyVelocities[fireflyIndex]);
        limit(steer, BOIDS_CONFIG.maxForce);
        return steer.multiplyScalar(BOIDS_CONFIG.cohesionWeight);
    }
    
    return new THREE.Vector3();
}

function applyJarBoundary(fireflyIndex) {
    const pos = fireflyPositions[fireflyIndex];
    const vel = fireflyVelocities[fireflyIndex];
    
    // Config
    const r = BOIDS_CONFIG.jarRadius;
    const h = BOIDS_CONFIG.jarHeight / 2; // ~1.75
    const GROUND_LEVEL = -1.9; // Just above the visual floor (-2.0)

    // ================= 1. GLOBAL FLOOR =================
    // This applies whether they are inside OR outside the jar
    if (pos.y < GROUND_LEVEL) {
        pos.y = GROUND_LEVEL; // Hard stop
        if (vel.y < 0) {
            vel.y *= -0.5; // Bounce off the ground
        }
    }

    // ================= 2. LID (Only if closed) =================
    if (!jarOpen) {
        if (pos.y > h) {
            pos.y = h - 0.01;
            if (vel.y > 0) vel.y *= -0.5;
        }
    }

    // ================= 3. GLASS WALLS =================
    const distSq = pos.x * pos.x + pos.z * pos.z;
    
    // Are we outside the glass radius?
    if (distSq > r * r) {
        // We are allowed outside if: Jar is OPEN AND we are ABOVE the rim
        const isAboveRim = pos.y > h;
        const canEscape = jarOpen && isAboveRim;

        if (!canEscape) {
            // We are trapped. Calculate physics to bounce off the glass.
            
            const dist = Math.sqrt(distSq);
            // 1. Teleport to surface (Hard Clamp)
            const correctionScale = (r - 0.01) / dist; 
            pos.x *= correctionScale;
            pos.z *= correctionScale;

            // 2. Reflect Velocity
            const normalX = pos.x / dist;
            const normalZ = pos.z / dist;
            const vDotN = (vel.x * normalX) + (vel.z * normalZ);
            
            // Only bounce if heading outward
            if (vDotN > 0) {
                vel.x -= 2 * vDotN * normalX;
                vel.z -= 2 * vDotN * normalZ;
                
                // Friction
                vel.x *= 0.5;
                vel.z *= 0.5;
            }
        }
    }
}
function wander(fireflyIndex) {
    // Create a random vector
    const noise = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
    );
    
    // Normalize and scale it
    noise.normalize().multiplyScalar(BOIDS_CONFIG.maxSpeed);
    
    // Steer towards this random point
    const steer = new THREE.Vector3().subVectors(noise, fireflyVelocities[fireflyIndex]);
    
    // Limit the turning speed so they don't jitter
    limit(steer, BOIDS_CONFIG.maxForce);
    
    // Multiply by a weight (stronger means more erratic movement)
    return steer.multiplyScalar(0.5); 
}

function updateBoids() {
    const REPULSION_RADIUS = 3.5;
    const MAX_BURST_MULTIPLIER = 8.0;

    for (let i = 0; i < FIREFLY_COUNT; i++) {
        // === 1. DETERMINE FLOCKING STATE ===
        
        // SEPARATION RADIUS
        // Open: 6.0 (Target: Spread across screen)
        // Closed: 0.5 (Target: Tight ball)
        const sepRadius = jarOpen ? 6.0 : BOIDS_CONFIG.separationDistance;
        
        const sep = separation(i, sepRadius);
        const ali = alignment(i);
        const coh = cohesion(i);
        const rep = getRepulsion(i);
        const wan = wander(i); 

        let currentSpeedLimit = BOIDS_CONFIG.maxSpeed;
        
        // === 2. CALCULATE POKE INTERACTION ===
        let flockingStrength = 1.0; 
        
        if (pokePosition) {
            const dist = fireflyPositions[i].distanceTo(pokePosition);
            if (dist < REPULSION_RADIUS) {
                const timeProgress = pokeTime / POKE_DURATION;
                flockingStrength = Math.pow(timeProgress, 2); 
                
                const proximity = 1.0 - (dist / REPULSION_RADIUS);
                const decayFactor = proximity * proximity * proximity;
                const burstAmount = (BOIDS_CONFIG.maxSpeed * MAX_BURST_MULTIPLIER) * decayFactor;
                currentSpeedLimit += burstAmount * (1.0 - timeProgress);
            }
        }
        
        // === 2.5 APPLY SHAKE STUN (overrides cohesion/alignment) ===
        const shakeRecovery = getFlockingRecoveryMultiplier();
        flockingStrength *= shakeRecovery;
        
        // Increase speed limit during shake for more chaotic movement
        if (isShaking) {
            currentSpeedLimit += BOIDS_CONFIG.maxSpeed * 3.0 * shakeIntensity;
        }

        // === 3. APPLY FORCES ===
        
        // Apply Repulsion (Poke)
        if (pokePosition) fireflyVelocities[i].add(rep);

        // Apply Separation
        // CHANGE: When jar is open, we multiply by 0.1 instead of 2.0.
        // This is the "Trickle" factor. They feel the pressure to leave, but they act on it very slowly.
        fireflyVelocities[i].add(sep.multiplyScalar(jarOpen ? 0.1 : 1.0));

        if (jarOpen) {
            // === OPEN JAR (Slow Diffusion) ===
            
            // 1. Tiny Cohesion (Requested)
            // Keeps them vaguely related to each other, preventing total isolation.
            fireflyVelocities[i].add(coh.multiplyScalar(0.1 * flockingStrength));

            // 2. Weak Alignment
            fireflyVelocities[i].add(ali.multiplyScalar(0.1 * flockingStrength));

            // 3. Gentle Wander
            // Reduced to 0.5 to prevent them from zooming around too fast.
            fireflyVelocities[i].add(wan.multiplyScalar(0.5));

        } else {
            // === CLOSED JAR (Swarm) ===
            fireflyVelocities[i].add(ali.multiplyScalar(flockingStrength));
            fireflyVelocities[i].add(coh.multiplyScalar(flockingStrength));
        }

        // === 4. LIMITS ===
        applyJarBoundary(i);
        limit(fireflyVelocities[i], currentSpeedLimit);
        
        fireflyPositions[i].add(fireflyVelocities[i]);
    }
}

// ==================== MOUSE INTERACTION (POKE) ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pokePosition = null;
let pokeTime = 0;
const POKE_DURATION = 1.0; // seconds

// ==================== SHAKE THE JAR ====================
const SHAKE_CONFIG = {
    velocityThreshold: 15,    // Mouse speed required to trigger shake
    chaosMultiplier: 0.3,     // How much velocity to add to fireflies
    recoveryTime: 2.0,        // Seconds to recover from stun
    sampleWindow: 100         // ms to sample mouse velocity
};

let isShaking = false;
let shakeRecoveryTime = 0;
let shakeIntensity = 0;
let lastMousePos = { x: 0, y: 0 };
let lastMouseTime = 0;
let mouseVelocity = 0;
let isDragging = false;

// Track mouse movement for shake detection
function onMouseDown(event) {
    isDragging = true;
    lastMousePos = { x: event.clientX, y: event.clientY };
    lastMouseTime = performance.now();
}

function onMouseUp() {
    isDragging = false;
    mouseVelocity = 0;
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastMouseTime;
    
    if (deltaTime > 0) {
        // Calculate mouse velocity (pixels per second)
        const dx = event.clientX - lastMousePos.x;
        const dy = event.clientY - lastMousePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        mouseVelocity = (distance / deltaTime) * 1000; // Convert to pixels/second
        
        // Check if we're shaking hard enough
        if (mouseVelocity > SHAKE_CONFIG.velocityThreshold * 50) {
            triggerShake(dx, dy, mouseVelocity);
        }
    }
    
    lastMousePos = { x: event.clientX, y: event.clientY };
    lastMouseTime = currentTime;
}

function triggerShake(dx, dy, velocity) {
    isShaking = true;
    shakeRecoveryTime = 0;
    shakeIntensity = Math.min(velocity / 1000, 2.0); // Cap intensity
    
    // Normalize the shake direction
    const shakeDirX = dx / Math.abs(dx + 0.001);
    const shakeDirY = dy / Math.abs(dy + 0.001);
    
    // Apply chaotic velocity to ALL fireflies
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        // Random chaos + directional push from shake
        const chaos = new THREE.Vector3(
            (Math.random() - 0.5 + shakeDirX * 0.5) * SHAKE_CONFIG.chaosMultiplier * shakeIntensity,
            (Math.random() - 0.5) * SHAKE_CONFIG.chaosMultiplier * shakeIntensity,
            (Math.random() - 0.5 - shakeDirY * 0.3) * SHAKE_CONFIG.chaosMultiplier * shakeIntensity
        );
        
        fireflyVelocities[i].add(chaos);
    }
}

function updateShakeRecovery(deltaTime) {
    if (isShaking) {
        shakeRecoveryTime += deltaTime;
        
        // Calculate recovery progress (0 = just shaken, 1 = fully recovered)
        const recoveryProgress = Math.min(shakeRecoveryTime / SHAKE_CONFIG.recoveryTime, 1.0);
        
        // Ease out for smoother recovery
        shakeIntensity = (1.0 - recoveryProgress) * (1.0 - recoveryProgress);
        
        if (recoveryProgress >= 1.0) {
            isShaking = false;
            shakeIntensity = 0;
        }
    }
}

// Get the current weight multiplier for flocking behaviors (stunned = 0, recovered = 1)
function getFlockingRecoveryMultiplier() {
    if (!isShaking) return 1.0;
    return Math.min(shakeRecoveryTime / SHAKE_CONFIG.recoveryTime, 1.0);
}

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);

    // Still intersect the JAR, not the fireflies, for accuracy
    const intersects = raycaster.intersectObject(jarBody);
    
    if (intersects.length > 0) {
        pokePosition = intersects[0].point;
        pokeTime = 0; // Reset timer to start the effect
    }
}

function getRepulsion(fireflyIndex) {
    if (!pokePosition) return new THREE.Vector3();

    const REPULSION_RADIUS = 3.5; // Slightly larger radius
    const MAX_REPULSION_FORCE = 2.0; // Much stronger kick

    const pos = fireflyPositions[fireflyIndex];
    const distance = pos.distanceTo(pokePosition);

    // Only affect fireflies inside the radius
    if (distance < REPULSION_RADIUS) {
        const steer = new THREE.Vector3().subVectors(pos, pokePosition);
        steer.normalize();

        // INVERSE SQUARE: Creates a much sharper "wall" of force
        // The closer to the center, the force increases exponentially
        const strength = 1 - (distance / REPULSION_RADIUS);
        const exponentialStrength = strength * strength; 
        
        // Weight by time: Strongest immediately after click
        const timeWeight = 1 - (pokeTime / POKE_DURATION);
        
        return steer.multiplyScalar(MAX_REPULSION_FORCE * exponentialStrength * timeWeight);
    }

    return new THREE.Vector3();
}

function updatePokeEffect(deltaTime) {
    if (pokePosition) {
        pokeTime += deltaTime;
        if (pokeTime > POKE_DURATION) {
            pokePosition = null;
            pokeTime = 0;
        }
    }
}

// ==================== KEYBOARD INTERACTIONS ====================
function onKeyPress(event) {
    switch (event.key.toLowerCase()) {
        case ' ': // Spacebar - open/close jar
            jarOpen = !jarOpen;
            break;
        case 'r': // Reset
            resetSimulation();
            break;
        case 't': // Toggle firefly camera view
            fireflyCameraMode = !fireflyCameraMode;
            if (fireflyCameraMode) {
                // Enter firefly camera mode - select random firefly
                trackedFireflyIndex = Math.floor(Math.random() * FIREFLY_COUNT);
                controls.enabled = false; // Disable orbit controls
            } else {
                // Exit firefly camera mode - restore original camera
                camera.position.copy(originalCameraPosition);
                controls.target.copy(originalControlsTarget);
                controls.enabled = true; // Re-enable orbit controls
                trackedFireflyIndex = -1;
            }
            break;
    }
}

function resetSimulation() {
    jarOpen = false;
    lidRotation = 0;
    jarLid.rotation.x = 0;
    
    // Reset fireflies to random positions inside jar
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * BOIDS_CONFIG.jarRadius * 0.8;
        const height = (Math.random() - 0.5) * BOIDS_CONFIG.jarHeight * 0.8;
        
        fireflyPositions[i].set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        
        fireflyVelocities[i].set(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        );
    }
    
    // Update instance matrices after reset
    updateFireflyMatrices();
    
    // Reset shake state
    isShaking = false;
    shakeIntensity = 0;
    shakeRecoveryTime = 0;
}

// ==================== ANIMATION LOOP ====================
const clock = new THREE.Clock();

function animate() {
    const deltaTime = clock.getDelta();
    
    // Update firefly camera if in firefly mode
    if (fireflyCameraMode && trackedFireflyIndex >= 0 && trackedFireflyIndex < fireflyPositions.length) {
        const fireflyPos = fireflyPositions[trackedFireflyIndex];
        // Position camera at firefly position
        camera.position.copy(fireflyPos);
        // Look slightly ahead in the direction the firefly is moving
        if (fireflyVelocities[trackedFireflyIndex]) {
            const lookAhead = fireflyPos.clone().add(fireflyVelocities[trackedFireflyIndex].clone().multiplyScalar(2));
            camera.lookAt(lookAhead);
        } else {
            camera.lookAt(fireflyPos.clone().add(new THREE.Vector3(0, 0, 1)));
        }
    } else {
        // Update controls (only when not in firefly mode)
        controls.update();
    }
    
    // Update jar lid animation
    if (jarOpen && lidRotation < LID_OPEN_ANGLE) {
        lidRotation += deltaTime * 2; // 2 radians per second
        if (lidRotation > LID_OPEN_ANGLE) {
            lidRotation = LID_OPEN_ANGLE;
        }
        jarLid.rotation.x = lidRotation;
    } else if (!jarOpen && lidRotation > 0) {
        lidRotation -= deltaTime * 2;
        if (lidRotation < 0) {
            lidRotation = 0;
        }
        jarLid.rotation.x = lidRotation;
    }
    
    // Update poke effect
    updatePokeEffect(deltaTime);
    
    // Update shake recovery
    updateShakeRecovery(deltaTime);
    
    // Update boids
    updateBoids();
    
    // Update instanced mesh matrices from positions
    updateFireflyMatrices();
    
    // Update point lights to follow lowest fireflies
    updateFireflyLights();
    
    // Render with bloom post-processing
    composer.render();
}

renderer.setAnimationLoop(animate);

// ==================== EVENT LISTENERS ====================
window.addEventListener('click', onMouseClick);
window.addEventListener('keydown', onKeyPress);

// Shake detection events
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('mousemove', onMouseMove);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== OBJ LOADER SETUP (for future use) ====================
// Example function to load jar model (commented out for now)
/*
function loadJarModel(path) {
    const loader = new OBJLoader();
    loader.load(
        path,
        (object) => {
            // Process loaded object
            object.traverse((child) => {
                if (child.isMesh) {
                    child.material = jarMaterial;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            jarGroup.add(object);
        },
        (progress) => {
            console.log('Loading progress:', progress);
        },
        (error) => {
            console.error('Error loading model:', error);
        }
    );
}
*/

console.log('Fireflies simulation initialized!');
console.log('Controls: Mouse to move camera, Click to poke, Drag rapidly to shake jar, Spacebar to open jar, R to reset');

