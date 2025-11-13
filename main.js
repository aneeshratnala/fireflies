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

// Camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 50;

// ==================== LIGHTING ====================
const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// ==================== GROUND ====================
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x2a2a3a,
    shininess: 30
});
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
    cohesionWeight: 1.0,
    maxSpeed: 0.1,
    maxForce: 0.02,
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

function separation(fireflyIndex) {
    const steer = new THREE.Vector3();
    let count = 0;
    const pos = fireflies[fireflyIndex].position;
    
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        if (i === fireflyIndex) continue;
        
        const distance = pos.distanceTo(fireflies[i].position);
        if (distance < BOIDS_CONFIG.separationDistance && distance > 0) {
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
    const center = BOIDS_CONFIG.jarCenter;
    
    // Check if inside jar (cylinder)
    const distanceFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const height = pos.y;
    
    // Boundary constraints
    if (!jarOpen) {
        // Keep inside jar
        if (distanceFromCenter > BOIDS_CONFIG.jarRadius) {
            const pushBack = new THREE.Vector3(-pos.x, 0, -pos.z).normalize();
            fireflyVelocities[fireflyIndex].add(pushBack.multiplyScalar(0.1));
        }
        
        if (height > BOIDS_CONFIG.jarHeight / 2) {
            fireflyVelocities[fireflyIndex].y -= 0.1;
        }
        if (height < -BOIDS_CONFIG.jarHeight / 2) {
            fireflyVelocities[fireflyIndex].y += 0.1;
        }
    }
}

function updateBoids() {
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        // Calculate steering forces
        const sep = separation(i);
        const ali = alignment(i);
        const coh = cohesion(i);
        
        // Apply forces
        fireflyVelocities[i].add(sep);
        fireflyVelocities[i].add(ali);
        fireflyVelocities[i].add(coh);
        
        // Apply jar boundary
        applyJarBoundary(i);
        
        // Limit velocity
        limit(fireflyVelocities[i], BOIDS_CONFIG.maxSpeed);
        
        // Update position
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
    const intersects = raycaster.intersectObjects(fireflies);
    
    if (intersects.length > 0) {
        // Get world position of click
        const worldPosition = new THREE.Vector3();
        raycaster.ray.at(intersects[0].distance, worldPosition);
        pokePosition = worldPosition;
        pokeTime = 0;
        
        // Apply repulsion force to nearby fireflies
        const REPULSION_RADIUS = 2.0;
        const REPULSION_FORCE = 0.3;
        
        for (let i = 0; i < FIREFLY_COUNT; i++) {
            const distance = fireflies[i].position.distanceTo(pokePosition);
            if (distance < REPULSION_RADIUS) {
                const repulsion = new THREE.Vector3()
                    .subVectors(fireflies[i].position, pokePosition)
                    .normalize()
                    .multiplyScalar(REPULSION_FORCE * (1 - distance / REPULSION_RADIUS));
                fireflyVelocities[i].add(repulsion);
            }
        }
    }
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

