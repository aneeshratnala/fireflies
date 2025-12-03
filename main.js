import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

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

// Camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 50;

// ==================== LIGHTING ====================
const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);



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

// ==================== MASON JAR ====================
// For initial demo, using basic geometry. Can be replaced with OBJ model later
const jarGroup = new THREE.Group();

// Jar body (cylinder)
const jarGeometry = new THREE.CylinderGeometry(2, 2, 4, 32);
const jarMaterial = new THREE.MeshPhongMaterial({
    color: 0xf0f0f0,
    transparent: true,
    opacity: 0.7,
    shininess: 100,
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

// ==================== FIREFLIES ====================
const FIREFLY_COUNT = 100;
const fireflies = [];
const fireflyVelocities = [];
const fireflyPositions = [];

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

// Create firefly geometry and material
const fireflyGeometry = new THREE.SphereGeometry(0.05, 8, 8);
const fireflyMaterial = new THREE.MeshPhongMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1.0,
    shininess: 100
});

// initialize fireflies inside the jar
for (let i = 0; i < FIREFLY_COUNT; i++) {
    const firefly = new THREE.Mesh(fireflyGeometry, fireflyMaterial);
    
    // random position inside jar (cylinder)
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * BOIDS_CONFIG.jarRadius * 0.8;
    const height = (Math.random() - 0.5) * BOIDS_CONFIG.jarHeight * 0.8;
    
    firefly.position.set(
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
    
    fireflies.push(firefly);
    fireflyVelocities.push(velocity);
    fireflyPositions.push(firefly.position.clone());
    
    scene.add(firefly);
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
    const pos = fireflies[fireflyIndex].position;
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflies[i].position);
        
        // Use the passed 'radius' instead of the constant
        if (distance < radius && distance > 0) {
            const diff = new THREE.Vector3().subVectors(pos, fireflies[i].position);
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
    const pos = fireflies[fireflyIndex].position;
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflies[i].position);
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
    const pos = fireflies[fireflyIndex].position;
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflies[i].position);
        if (distance < BOIDS_CONFIG.cohesionDistance && distance > 0) {
            center.add(fireflies[i].position);
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
    const pos = fireflies[fireflyIndex].position;
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
            const dist = fireflies[i].position.distanceTo(pokePosition);
            if (dist < REPULSION_RADIUS) {
                const timeProgress = pokeTime / POKE_DURATION;
                flockingStrength = Math.pow(timeProgress, 2); 
                
                const proximity = 1.0 - (dist / REPULSION_RADIUS);
                const decayFactor = proximity * proximity * proximity;
                const burstAmount = (BOIDS_CONFIG.maxSpeed * MAX_BURST_MULTIPLIER) * decayFactor;
                currentSpeedLimit += burstAmount * (1.0 - timeProgress);
            }
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
        
        fireflies[i].position.add(fireflyVelocities[i]);
    }
}

// ==================== MOUSE INTERACTION (POKE) ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pokePosition = null;
let pokeTime = 0;
const POKE_DURATION = 1.0; // seconds

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

    const pos = fireflies[fireflyIndex].position;
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
        
        fireflies[i].position.set(
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
}

// ==================== ANIMATION LOOP ====================
const clock = new THREE.Clock();

function animate() {
    const deltaTime = clock.getDelta();
    
    // Update controls
    controls.update();
    
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
    
    // Update boids
    updateBoids();
    
    // Render
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ==================== EVENT LISTENERS ====================
window.addEventListener('click', onMouseClick);
window.addEventListener('keydown', onKeyPress);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
console.log('Controls: Mouse to move camera, Click to poke, Spacebar to open jar, R to reset');

