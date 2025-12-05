import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ==================== SCENE SETUP ====================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(-5, 1.6, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Color management
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6; // <--- lower = darker HDRI (start around 0.6–0.8)

// ==================== ENVIRONMENT / HDRI ====================

// Create PMREM generator once
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const exrLoader = new EXRLoader();
exrLoader.setDataType(THREE.FloatType);

exrLoader.load(
  'hdris/rogland_clear_night_2k.exr',
  (texture) => {
    // Use original EXR as background (visible HDRI)
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;

    // Create prefiltered env map for PBR lighting
    const envRT = pmremGenerator.fromEquirectangular(texture);
    const envMap = envRT.texture;

    scene.environment = envMap; // this makes the HDRI a light source

    // Optional: tweak lighting strength per material later via envMapIntensity

    // Clean up only the render target, keep `texture` for background
    // envRT and pmremGenerator can be disposed once you don't need more env maps:
    // envRT.dispose();
    // pmremGenerator.dispose();
  },
  undefined,
  (err) => {
    console.error('Failed to load environment map:', err);
  }
);

// ==================== POST-PROCESSING (BLOOM) ====================
const composer = new EffectComposer(renderer);

// RenderPass renders the scene normally first
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// UnrealBloomPass creates the glowing effect
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,    // strength - intensity of the bloom (increased)
    0.5,    // radius - how far the bloom spreads
    0.85     // threshold - lowered so fireflies bloom even through glass
);
composer.addPass(bloomPass);
// Camera controls (Drag-to-look style)
// Custom implementation for press-and-hold to rotate camera
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
const MOUSE_SENSITIVITY = 0.002;

// Euler angles for camera rotation
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
cameraEuler.setFromQuaternion(camera.quaternion);

// Add camera to scene so its children (tongue) are rendered
scene.add(camera);

// ==================== TONGUE ====================
let tongueProgress = 0; // 0 = hidden, 1 = fully extended
const TONGUE_EXTEND_SPEED = 8.0; // How fast tongue extends (quick snap out)
const TONGUE_RETRACT_SPEED = 4.0; // How fast tongue retracts
const TONGUE_HOLD_TIME = 0.15; // Time to hold tongue at full extension
let tongueHoldTimer = 0;
let tongueState = 'hidden'; // 'hidden', 'extending', 'holding', 'retracting'

// Create a smooth procedural tongue shape
const tongueGroup = new THREE.Group();

// Create tongue using a more organic shape - LatheGeometry for smooth rounded tongue
const tonguePoints = [];
// Create a tongue profile (side view) - starts thick, tapers to rounded tip
tonguePoints.push(new THREE.Vector2(0, 0));        // tip (center)
tonguePoints.push(new THREE.Vector2(0.06, 0.05));  // tip curve
tonguePoints.push(new THREE.Vector2(0.10, 0.15));  // middle
tonguePoints.push(new THREE.Vector2(0.12, 0.35));  // wider part
tonguePoints.push(new THREE.Vector2(0.10, 0.55));  // base starts
tonguePoints.push(new THREE.Vector2(0.08, 0.65));  // base
tonguePoints.push(new THREE.Vector2(0, 0.70));     // back center

const tongueGeometry = new THREE.LatheGeometry(tonguePoints, 32);
const tongueMaterial = new THREE.MeshStandardMaterial({
    color: 0xff5566,      // Pink-red tongue color
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide
});

const tongueMesh = new THREE.Mesh(tongueGeometry, tongueMaterial);
tongueMesh.rotation.x = -Math.PI / 2; // Point forward
tongueMesh.position.z = 0;
tongueGroup.add(tongueMesh);

// Add a slight highlight/wet look with a second layer
const tongueHighlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7788,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
    side: THREE.FrontSide
});
const tongueHighlight = new THREE.Mesh(tongueGeometry.clone(), tongueHighlightMaterial);
tongueHighlight.rotation.x = -Math.PI / 2;
tongueHighlight.scale.set(1.02, 1.02, 1.02); // Slightly larger
tongueGroup.add(tongueHighlight);

tongueGroup.visible = false;
camera.add(tongueGroup);

console.log('👅 Procedural tongue created and added to camera');

// Function to trigger tongue animation
function triggerTongueAnimation() {
    if (tongueState === 'hidden') {
        console.log('🦎 Tongue animation triggered!');
        tongueState = 'extending';
        tongueProgress = 0;
        tongueGroup.visible = true;
    }
}

// Function to update tongue animation
function updateTongueAnimation(deltaTime) {
    if (tongueState === 'hidden') return;
    
    switch (tongueState) {
        case 'extending':
            tongueProgress += TONGUE_EXTEND_SPEED * deltaTime;
            if (tongueProgress >= 1) {
                tongueProgress = 1;
                tongueState = 'holding';
                tongueHoldTimer = 0;
            }
            break;
            
        case 'holding':
            tongueHoldTimer += deltaTime;
            if (tongueHoldTimer >= TONGUE_HOLD_TIME) {
                tongueState = 'retracting';
            }
            break;
            
        case 'retracting':
            tongueProgress -= TONGUE_RETRACT_SPEED * deltaTime;
            if (tongueProgress <= 0) {
                tongueProgress = 0;
                tongueState = 'hidden';
                tongueGroup.visible = false;
            }
            break;
    }
    
    // Ease function for smooth animation
    const easedProgress = tongueState === 'extending' 
        ? easeOutBack(tongueProgress) 
        : easeInQuad(tongueProgress);
    
    // Position tongue in camera space (attached to camera, so moves with it):
    // X: 0 (centered horizontally)
    // Y: slightly below center (like coming from mouth)
    // Z: negative = in front of camera
    const extendDistance = 0.5 * easedProgress; // How far tongue extends forward
    
    // Scale the tongue - stretches forward as it extends
    const baseScale = 0.6;
    tongueGroup.scale.set(
        baseScale,
        baseScale * (1 + 0.5 * easedProgress), // Stretch longer as it extends
        baseScale
    );
    
    // Position: centered, slightly below eye level, extends forward
    tongueGroup.position.set(0, -0.15, -0.4 - extendDistance);
    tongueGroup.rotation.set(0, 0, 0);
}

// Easing functions for smooth animation
function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInQuad(t) {
    return t * t;
}

// ==================== LIGHTING ====================
// Dim ambient for night-time atmosphere
const ambientLight = new THREE.AmbientLight(0x101020, 0.3);
scene.add(ambientLight);

// Moonlight - very dim directional light
const directionalLight = new THREE.DirectionalLight(0xd3ddf0, 0.9);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Shared sizing helpers so vegetation aligns with the ground plane
const GROUND_SIZE = 70;
const HALF_GROUND = GROUND_SIZE / 2;

function generateTreeBorderPositions(
    halfSize,
    treesPerEdge = 7,
    inset = 1.2,
    phase = 0,
    tangentialJitter = 0.8,
    radialJitter = 0.4
) {
    const positions = [];
    const min = -halfSize + inset;
    const max = halfSize - inset;
    const denom = Math.max(treesPerEdge - 1, 1);

    for (let i = 0; i < treesPerEdge; i++) {
        const t = treesPerEdge === 1 ? 0.5 : THREE.MathUtils.clamp((i + phase) / denom, 0, 1);
        const z = THREE.MathUtils.lerp(min, max, t) + (Math.random() - 0.5) * tangentialJitter;
        const leftX = -halfSize + inset + (Math.random() - 0.5) * radialJitter;
        const rightX = halfSize - inset + (Math.random() - 0.5) * radialJitter;
        positions.push(new THREE.Vector3(leftX, -2, z));
        positions.push(new THREE.Vector3(rightX, -2, THREE.MathUtils.lerp(min, max, t) + (Math.random() - 0.5) * tangentialJitter));
    }

    for (let i = 1; i < treesPerEdge - 1; i++) {
        const t = treesPerEdge === 1 ? 0.5 : THREE.MathUtils.clamp((i + phase) / denom, 0, 1);
        const x = THREE.MathUtils.lerp(min, max, t) + (Math.random() - 0.5) * tangentialJitter;
        const frontZ = -halfSize + inset + (Math.random() - 0.5) * radialJitter;
        const backZ = halfSize - inset + (Math.random() - 0.5) * radialJitter;
        positions.push(new THREE.Vector3(x, -2, frontZ));
        positions.push(new THREE.Vector3(THREE.MathUtils.lerp(min, max, t) + (Math.random() - 0.5) * tangentialJitter, -2, backZ));
    }

    return positions;
}

// ===================== rock ====================
// Helper: convert a Phong material (from MTL) to a Standard material
function phongToStandard(mat) {
    const std = new THREE.MeshStandardMaterial({
        color: mat.color.clone ? mat.color.clone() : mat.color,  // base color
        map: mat.map || null,
        normalMap: mat.normalMap || null,
        emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
        emissiveMap: mat.emissiveMap || null,
        transparent: mat.transparent,
        opacity: mat.opacity,
        side: mat.side,
        metalness: 0.0,
        roughness: 0.9
    });

    // Ensure color textures use sRGB
    if (std.map) {
        std.map.encoding = THREE.sRGBEncoding;
        std.map.needsUpdate = true;
    }
    if (std.emissiveMap) {
        std.emissiveMap.encoding = THREE.sRGBEncoding;
        std.emissiveMap.needsUpdate = true;
    }

    // Hook into environment lighting if you want
    std.envMap = scene.environment || null;
    std.envMapIntensity = 1.0;  // tweak as needed

    return std;
}

// import rock from obj file and mtl file
const rockLoader = new MTLLoader();
rockLoader.load(
    'objs/rock/Rock1.mtl',
    (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        
        objLoader.load(
            'objs/rock/Rock1.obj',
            (object) => {
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true; 

                        // child.material may be a single material or an array
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map((m) => phongToStandard(m));
                        } else {
                            child.material = phongToStandard(child.material);
                        }
                    }
                });

                object.position.set(-10, -2, 0);
                object.scale.set(0.5, 0.5, 0.5);
                scene.add(object);

                // create a second rock instance using instancedMesh
                const rockGeometry = object.children[1].geometry;
                const rockMaterial = object.children[1].material;
                const rockCount = 10;
                const rockMesh = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
                const dummy = new THREE.Object3D();
                for (let i = 0; i < rockCount; i++) {
                    dummy.position.set(Math.random() * 40 - 20, -2, Math.random() * 40 - 20);
                    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    dummy.scale.setScalar(.45 + Math.random() * 0.1);
                    dummy.updateMatrix();
                    rockMesh.setMatrixAt(i, dummy.matrix);
                }
                scene.add(rockMesh);
            },
            undefined,
            (error) => console.error('Error loading rock model:', error)
        );
    },
    undefined,
    (error) => console.error('Error loading rock materials:', error)
);

// ==================== TREE ====================
const treeLoader = new TDSLoader();
treeLoader.setPath('objs/tree1_3ds/');
treeLoader.setResourcePath('objs/tree1_3ds/');
treeLoader.load(
    'tree1.3ds',
    (object) => {
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        object.position.set(0, -2, 0);
        object.rotateX(-Math.PI / 2);

        const treeGroup = new THREE.Group();
        treeGroup.name = 'TreeBorder';
        scene.add(treeGroup);

        const treeLayers = [
            { inset: 1.3, phase: 0, tangentialJitter: 0.8, radialJitter: 0.4, scaleRange: [0.85, 1.1] },
            { inset: 10.0, phase: 0.45, tangentialJitter: 1.1, radialJitter: 0.6, scaleRange: [0.75, 1.0] }
        ];

        treeLayers.forEach((layer) => {
            const positions = generateTreeBorderPositions(
                HALF_GROUND,
                9,
                layer.inset,
                layer.phase,
                layer.tangentialJitter,
                layer.radialJitter
            );

            positions.forEach((position) => {
                const treeInstance = object.clone(true);
                treeInstance.position.copy(position);
                treeInstance.rotation.x = -Math.PI / 2;
                const scale = THREE.MathUtils.lerp(layer.scaleRange[0], layer.scaleRange[1], Math.random());
                treeInstance.scale.set(scale, scale, scale);
                treeGroup.add(treeInstance);
            });
        });
    },
    undefined,
    (error) => console.error('Error loading tree model:', error)
);

// ==================== GROUND ====================

const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 512, 512);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    metalness: 0.0,
    side: THREE.DoubleSide // Make both sides visible (uncull bottom)
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

// Create procedural frosted glass roughness map
function createFrostedRoughnessMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base layer - high value for very rough/frosted base
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(0, 0, 512, 512);
    
    // Add noise pattern for frosted effect
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    
    // Create multi-scale noise for realistic frosted glass
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4;
            
            // Multiple noise frequencies for realistic frost pattern - STRONGER
            const noise1 = Math.random() * 100 - 50;  // Fine grain (stronger)
            const noise2 = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 40;  // Medium waves (stronger)
            const noise3 = Math.sin(x * 0.03 + y * 0.03) * 30;  // Large patterns (stronger)
            const noise4 = Math.sin(x * 0.08) * Math.sin(y * 0.12) * 25; // Extra texture layer
            
            // Combine noise layers
            const noiseValue = noise1 + noise2 + noise3 + noise4;
            
            // Apply noise to RGB channels (grayscale roughness map)
            const baseValue = 220; // Very high base = very rough/frosted
            const value = Math.max(150, Math.min(255, baseValue + noiseValue)); // Clamp to high values
            
            data[i] = value;     // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
            // Alpha stays at 255
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add more circular frost patterns (like ice crystals) - MORE of them
    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 40 + 15;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(0.3, 'rgba(240, 240, 255, 0.4)');
        gradient.addColorStop(0.6, 'rgba(220, 220, 240, 0.3)');
        gradient.addColorStop(1, 'rgba(200, 200, 220, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Add streaky frost lines
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 80; i++) {
        const x1 = Math.random() * 512;
        const y1 = Math.random() * 512;
        const angle = Math.random() * Math.PI * 2;
        const length = Math.random() * 60 + 20;
        const x2 = x1 + Math.cos(angle) * length;
        const y2 = y1 + Math.sin(angle) * length;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3); // More tiling for denser frost pattern
    return texture;
}

const frostedRoughnessMap = createFrostedRoughnessMap();

// Jar state for frosted glass
let jarFrosted = false;

// Jar body (cylinder)
const jarGeometry = new THREE.CylinderGeometry(2, 2, 4, 32);
const jarMaterial = new THREE.MeshPhongMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: 0.25,
    shininess: 100,
    specular: 0x444444,
    side: THREE.DoubleSide
});
const jarBody = new THREE.Mesh(jarGeometry, jarMaterial);

// Function to toggle frosted glass effect
function toggleFrostedGlass() {
    jarFrosted = !jarFrosted;
    
    if (jarFrosted) {
        // Frosted glass - more opaque, less shiny
        jarMaterial.opacity = 0.6;
        jarMaterial.shininess = 20;
        jarMaterial.color.setHex(0xddeeff);
        console.log('🧊 Jar is now FROSTED');
    } else {
        // Clear glass
        jarMaterial.opacity = 0.25;
        jarMaterial.shininess = 100;
        jarMaterial.color.setHex(0xaaddff);
        console.log('✨ Jar is now CLEAR');
    }
    
    jarMaterial.needsUpdate = true;
}
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
const fireflyMaterials = []; // Individual materials for each firefly

// Kuramoto model parameters for synchronization
const KURAMOTO_CONFIG = {
    couplingStrength: 2.0,     // K - how strongly fireflies influence each other
    couplingRadius: 2.5,       // Only couple with nearby fireflies (local coupling)
    baseFrequency: 1.5,        // Base angular frequency (radians per second) - slower for more visible pulses
    frequencyVariance: 0.3,    // Variance in natural frequencies
    brightnessThreshold: -0.3, // sin(phase) threshold for "on" state (gives ~60% on time)
    minBrightness: 0.5,        // Minimum glow when "off" - visible yellow dot
    maxBrightness: 2.0         // Maximum glow when "on" (brighter for bloom effect)
};

// Kuramoto state for each firefly
const fireflyPhases = [];      // Current phase (0 to 2π)
const fireflyFrequencies = []; // Natural frequency of each firefly

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

// Create firefly geometry (smaller core)
const fireflyGeometry = new THREE.SphereGeometry(0.03, 8, 8);

// Create glow sprite texture procedurally
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for soft glow
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 240, 100, 0.8)');
    gradient.addColorStop(0.4, 'rgba(200, 255, 100, 0.4)');
    gradient.addColorStop(0.7, 'rgba(100, 200, 50, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 100, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

const glowTexture = createGlowTexture();

// Arrays for glow sprites and point lights
const fireflyGlowSprites = [];
const fireflyPointLights = [];
const LIGHTS_COUNT = 15; // Only add point lights to some fireflies for performance

// initialize fireflies inside the jar
for (let i = 0; i < FIREFLY_COUNT; i++) {
    // Create individual material for each firefly so they can have different brightness
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffaa,
        transparent: true,
        opacity: 1.0
    });
    fireflyMaterials.push(material);
    
    // Create firefly group to hold core + glow
    const fireflyGroup = new THREE.Group();
    
    // Core (small bright center)
    const core = new THREE.Mesh(fireflyGeometry, material);
    fireflyGroup.add(core);
    
    // Glow sprite (additive blending for light emission effect)
    const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xccff66,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 1.0
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(0.5, 0.5, 1);
    fireflyGroup.add(glowSprite);
    fireflyGlowSprites.push(glowSprite);
    
    // Add point light to some fireflies for actual scene illumination
    if (i < LIGHTS_COUNT) {
        const pointLight = new THREE.PointLight(0xccff66, 0.3, 2.0, 2);
        fireflyGroup.add(pointLight);
        fireflyPointLights.push(pointLight);
    } else {
        fireflyPointLights.push(null);
    }
    
    // random position inside jar (cylinder)
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * BOIDS_CONFIG.jarRadius * 0.8;
    const height = (Math.random() - 0.5) * BOIDS_CONFIG.jarHeight * 0.8;
    
    fireflyGroup.position.set(
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
    
    // Initialize Kuramoto state
    // Random initial phase (spread across the cycle)
    fireflyPhases.push(Math.random() * Math.PI * 2);
    // Natural frequency with some variance (creates diversity)
    fireflyFrequencies.push(
        KURAMOTO_CONFIG.baseFrequency + 
        (Math.random() - 0.5) * 2 * KURAMOTO_CONFIG.frequencyVariance
    );
    
    fireflies.push(fireflyGroup);
    fireflyVelocities.push(velocity);
    fireflyPositions.push(fireflyGroup.position.clone());
    
    scene.add(fireflyGroup);
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
    
    for (let i = 0; i < fireflies.length; i++) {
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
    
    for (let i = 0; i < fireflies.length; i++) {
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
    
    for (let i = 0; i < fireflies.length; i++) {
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

    for (let i = 0; i < fireflies.length; i++) {
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

// ==================== KURAMOTO MODEL ====================
// Updates firefly phases and brightness based on the Kuramoto model
// dθᵢ/dt = ωᵢ + (K/N_neighbors) * Σⱼ sin(θⱼ - θᵢ)
function updateKuramoto(deltaTime) {
    const K = KURAMOTO_CONFIG.couplingStrength;
    const radius = KURAMOTO_CONFIG.couplingRadius;
    
    // Calculate phase derivatives for all fireflies
    const phaseDerivatives = [];
    
    for (let i = 0; i < fireflies.length; i++) {
        const pos_i = fireflies[i].position;
        const phase_i = fireflyPhases[i];
        const omega_i = fireflyFrequencies[i];
        
        // Start with natural frequency
        let dPhase = omega_i;
        
        // Sum coupling influence from nearby fireflies (local Kuramoto)
        let neighborCount = 0;
        let couplingSum = 0;
        
        for (let j = 0; j < fireflies.length; j++) {
            if (i === j) continue;
            
            const distance = pos_i.distanceTo(fireflies[j].position);
            
            // Only couple with nearby fireflies
            if (distance < radius) {
                const phase_j = fireflyPhases[j];
                // Kuramoto coupling term: sin(θⱼ - θᵢ)
                couplingSum += Math.sin(phase_j - phase_i);
                neighborCount++;
            }
        }
        
        // Add coupling influence (normalized by neighbor count)
        if (neighborCount > 0) {
            dPhase += (K / neighborCount) * couplingSum;
        }
        
        phaseDerivatives.push(dPhase);
    }
    
    // Update phases and brightness
    for (let i = 0; i < fireflies.length; i++) {
        // Update phase (Euler integration)
        fireflyPhases[i] += phaseDerivatives[i] * deltaTime;
        
        // Keep phase in [0, 2π]
        while (fireflyPhases[i] > Math.PI * 2) {
            fireflyPhases[i] -= Math.PI * 2;
        }
        while (fireflyPhases[i] < 0) {
            fireflyPhases[i] += Math.PI * 2;
        }
        
        // Calculate brightness based on phase
        // Using sin(phase) with a threshold to ensure ~50%+ are on
        const sinPhase = Math.sin(fireflyPhases[i]);
        
        let brightness;
        if (sinPhase > KURAMOTO_CONFIG.brightnessThreshold) {
            // Firefly is "on" - map from threshold to 1 -> minBrightness to maxBrightness
            const normalized = (sinPhase - KURAMOTO_CONFIG.brightnessThreshold) / 
                             (1 - KURAMOTO_CONFIG.brightnessThreshold);
            brightness = KURAMOTO_CONFIG.minBrightness + 
                        normalized * (KURAMOTO_CONFIG.maxBrightness - KURAMOTO_CONFIG.minBrightness);
        } else {
            // Firefly is "off" - very dim glow
            brightness = KURAMOTO_CONFIG.minBrightness;
        }
        
        // Check if firefly is inside or outside the jar
        const fireflyPos = fireflies[i].position;
        const horizontalDistSq = fireflyPos.x * fireflyPos.x + fireflyPos.z * fireflyPos.z;
        const jarRadius = BOIDS_CONFIG.jarRadius;
        const jarHeight = BOIDS_CONFIG.jarHeight / 2;
        const isOutside = horizontalDistSq > jarRadius * jarRadius || fireflyPos.y > jarHeight;
        
        // Normalize brightness factor (0 = off, 1 = fully on)
        const brightnessFactor = (brightness - KURAMOTO_CONFIG.minBrightness) / 
                                 (KURAMOTO_CONFIG.maxBrightness - KURAMOTO_CONFIG.minBrightness);
        
        // Scale brightness based on location
        let coreOpacity;
        let glowOpacity;
        let glowScale;
        
        if (isOutside) {
            // Outside jar: moderate brightness, visible glow
            coreOpacity = 0.7 + brightnessFactor * 0.3;  // 0.7 to 1.0
            glowOpacity = 0.3 + brightnessFactor * 0.5;  // 0.3 to 0.8
            glowScale = 0.25 + brightnessFactor * 0.35;  // 0.25 to 0.6
        } else {
            // Inside jar: always visible core, controlled glow to prevent overwhelming
            coreOpacity = 0.85 + brightnessFactor * 0.15; // 0.85 to 1.0 - always visible
            glowOpacity = 0.2 + brightnessFactor * 0.4;   // 0.2 to 0.6 - reduced max glow
            glowScale = 0.2 + brightnessFactor * 0.25;    // 0.2 to 0.45 - smaller glow inside
        }
        
        // Update core material opacity
        fireflyMaterials[i].opacity = coreOpacity;
        
        // Update glow sprite
        const glowSprite = fireflyGlowSprites[i];
        glowSprite.material.opacity = glowOpacity;
        glowSprite.scale.set(glowScale, glowScale, 1);
        
        // Update color - warm yellow always, brighter yellow-green when lit
        const r = 1.0;
        const g = 0.85 + brightnessFactor * 0.15;
        const b = 0.3 + brightnessFactor * 0.2;
        fireflyMaterials[i].color.setRGB(r, g, b);
        glowSprite.material.color.setRGB(r, g, b * 0.5);
        
        // Update point light if this firefly has one
        if (fireflyPointLights[i]) {
            // Reduced intensity to prevent overwhelming glow
            fireflyPointLights[i].intensity = isOutside ? 0.15 + brightnessFactor * 0.2 : 0.1 + brightnessFactor * 0.15;
            fireflyPointLights[i].color.setRGB(r, g, b);
        }
    }
}

// ==================== MOUSE INTERACTION (POKE) ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pokePosition = null;
let pokeTime = 0;
const POKE_DURATION = 1.0; // seconds

function onMouseClick(event) {
    // Convert click position to normalized device coordinates
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

// Mouse drag handlers for camera rotation
let dragStartX = 0;
let dragStartY = 0;
let hasDragged = false;
const DRAG_THRESHOLD = 5; // pixels - to distinguish click from drag

function onMouseDown(event) {
    isDragging = true;
    hasDragged = false;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const deltaX = event.clientX - previousMouseX;
    const deltaY = event.clientY - previousMouseY;
    
    // Check if we've moved enough to count as a drag
    const totalDragX = Math.abs(event.clientX - dragStartX);
    const totalDragY = Math.abs(event.clientY - dragStartY);
    if (totalDragX > DRAG_THRESHOLD || totalDragY > DRAG_THRESHOLD) {
        hasDragged = true;
    }
    
    // Update camera rotation
    cameraEuler.y -= deltaX * MOUSE_SENSITIVITY;
    cameraEuler.x -= deltaY * MOUSE_SENSITIVITY;
    
    // Clamp vertical rotation to prevent flipping
    cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraEuler.x));
    
    camera.quaternion.setFromEuler(cameraEuler);
    
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
}

function onMouseUp(event) {
    // Only trigger click if we didn't drag
    if (!hasDragged && isDragging) {
        onMouseClick(event);
    }
    isDragging = false;
    hasDragged = false;
}

// First-person camera zoom (FOV-based)
let targetFOV = 75; // Target FOV for smooth zoom
const MIN_FOV = 10;   // Maximum zoom in
const MAX_FOV = 120;  // Maximum zoom out
const ZOOM_SPEED = 50; // How fast to zoom (degrees per second)
const ZOOM_SMOOTHNESS = 8; // Smooth interpolation speed

function handleZoom(deltaTime) {
    // Smoothly interpolate to target FOV
    if (Math.abs(camera.fov - targetFOV) > 0.1) {
        camera.fov += (targetFOV - camera.fov) * ZOOM_SMOOTHNESS * deltaTime;
        camera.updateProjectionMatrix();
    }
}

// Zoom in/out with mouse wheel (first-person style)
function onMouseWheel(event) {
    event.preventDefault();
    
    // Adjust target FOV based on wheel direction
    // Scrolling up (negative deltaY) = zoom in (decrease FOV)
    // Scrolling down (positive deltaY) = zoom out (increase FOV)
    const zoomDelta = (event.deltaY > 0 ? 1 : -1) * ZOOM_SPEED * 0.016; // Normalize to ~60fps
    targetFOV += zoomDelta;
    
    // Clamp target FOV to min/max limits
    targetFOV = Math.max(MIN_FOV, Math.min(MAX_FOV, targetFOV));
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
// Track which keys are currently pressed for smooth movement
const keysPressed = {
    w: false,
    a: false,
    s: false,
    d: false,
    q: false, // up
    e: false
};

const CAMERA_MOVE_SPEED = 10; // Units per second
const FIREFLY_CATCH_RADIUS_INSIDE = 0.5; // Distance at which camera catches fireflies inside jar
const FIREFLY_CATCH_RADIUS_OUTSIDE = 1.5; // Larger radius for fireflies outside jar (easier to catch)

// Bug counter
let bugsCaught = 0;
const bugCounterElement = document.getElementById('bugs-killed');

function updateBugCounter() {
    if (bugCounterElement) {
        bugCounterElement.textContent = bugsCaught;
    }
}

function onKeyDown(event) {
    const key = event.key.toLowerCase();
    
    // Handle arrow keys (they don't get lowercased)
    if (event.key === 'q' || event.key === 'e') {
        keysPressed[event.key] = true;
        return;
    }
    
    // Handle movement keys
    if (key in keysPressed) {
        keysPressed[key] = true;
    }
    
    // Handle toggle keys
    switch (key) {
        case ' ': // Spacebar - open/close jar
            jarOpen = !jarOpen;
            break;
        case 'r': // Reset
            resetSimulation();
            break;
        case 'f': // Toggle frosted glass
            toggleFrostedGlass();
            break;
    }
}

function onKeyUp(event) {
    // Handle arrow keys (they don't get lowercased)
    if (event.key === 'q' || event.key === 'e') {
        keysPressed[event.key] = false;
        return;
    }
    
    const key = event.key.toLowerCase();
    if (key in keysPressed) {
        keysPressed[key] = false;
    }
}

function updateCameraMovement(deltaTime) {
    const moveDistance = CAMERA_MOVE_SPEED * deltaTime;
    
    // Get forward and right vectors from camera orientation
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    // Apply camera's Y rotation to get world-space directions (ignore pitch for movement)
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraEuler.y);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraEuler.y);

    if (keysPressed.w) {
        camera.position.add(forward.clone().multiplyScalar(moveDistance));
    }
    if (keysPressed.s) {
        camera.position.add(forward.clone().multiplyScalar(-moveDistance));
    }
    if (keysPressed.d) {
        camera.position.add(right.clone().multiplyScalar(moveDistance));
    }
    if (keysPressed.a) {
        camera.position.add(right.clone().multiplyScalar(-moveDistance));
    }

    // move up/down with Q/E keys
    if (keysPressed.q) {
        camera.position.y += moveDistance;
    }
    if (keysPressed.e) {
        camera.position.y -= moveDistance;
    }
}

function isFireflyOutsideJar(fireflyPos) {
    // Check if firefly is outside the jar boundaries
    const horizontalDistSq = fireflyPos.x * fireflyPos.x + fireflyPos.z * fireflyPos.z;
    const jarRadius = BOIDS_CONFIG.jarRadius;
    const jarHeight = BOIDS_CONFIG.jarHeight / 2;
    
    // Firefly is outside if it's beyond the jar walls OR above the jar rim
    const isOutsideWalls = horizontalDistSq > jarRadius * jarRadius;
    const isAboveRim = fireflyPos.y > jarHeight;
    
    return isOutsideWalls || isAboveRim;
}

function checkFireflyCollisions() {
    const cameraPos = camera.position;
    let caughtAny = false;
    
    // Iterate backwards since we're removing elements
    for (let i = fireflies.length - 1; i >= 0; i--) {
        const fireflyPos = fireflies[i].position;
        const distance = cameraPos.distanceTo(fireflyPos);
        
        // Use larger catch radius for fireflies outside the jar
        const isOutside = isFireflyOutsideJar(fireflyPos);
        const catchRadius = isOutside ? FIREFLY_CATCH_RADIUS_OUTSIDE : FIREFLY_CATCH_RADIUS_INSIDE;
        
        if (distance < catchRadius) {
            // Remove the firefly from the scene
            scene.remove(fireflies[i]);
            
            // Remove from all tracking arrays
            fireflies.splice(i, 1);
            fireflyVelocities.splice(i, 1);
            fireflyPositions.splice(i, 1);
            fireflyMaterials.splice(i, 1);
            fireflyPhases.splice(i, 1);
            fireflyFrequencies.splice(i, 1);
            fireflyGlowSprites.splice(i, 1);
            fireflyPointLights.splice(i, 1);
            
            // Increment bug counter
            bugsCaught++;
            updateBugCounter();
            
            // Mark that we caught a firefly
            caughtAny = true;
        }
    }
    
    // Trigger tongue animation if we caught any fireflies
    if (caughtAny) {
        triggerTongueAnimation();
    }
}

function resetSimulation() {
    jarOpen = false;
    lidRotation = 0;
    jarLid.rotation.x = 0;
    
    // Reset bug counter
    bugsCaught = 0;
    updateBugCounter();
    
    // Remove all existing fireflies from scene
    for (let i = fireflies.length - 1; i >= 0; i--) {
        scene.remove(fireflies[i]);
    }
    
    // Clear all firefly arrays
    fireflies.length = 0;
    fireflyVelocities.length = 0;
    fireflyPositions.length = 0;
    fireflyMaterials.length = 0;
    fireflyPhases.length = 0;
    fireflyFrequencies.length = 0;
    fireflyGlowSprites.length = 0;
    fireflyPointLights.length = 0;
    
    // Recreate all fireflies
    for (let i = 0; i < FIREFLY_COUNT; i++) {
        // Create individual material for each firefly
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 1.0
        });
        fireflyMaterials.push(material);
        
        // Create firefly group to hold core + glow
        const fireflyGroup = new THREE.Group();
        
        // Core (small bright center)
        const core = new THREE.Mesh(fireflyGeometry, material);
        fireflyGroup.add(core);
        
        // Glow sprite
        const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xccff66,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 1.0
        });
        const glowSprite = new THREE.Sprite(glowMaterial);
        glowSprite.scale.set(0.5, 0.5, 1);
        fireflyGroup.add(glowSprite);
        fireflyGlowSprites.push(glowSprite);
        
        // Add point light to some fireflies
        if (i < LIGHTS_COUNT) {
            const pointLight = new THREE.PointLight(0xccff66, 0.3, 2.0, 2);
            fireflyGroup.add(pointLight);
            fireflyPointLights.push(pointLight);
        } else {
            fireflyPointLights.push(null);
        }
        
        // Random position inside jar
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * BOIDS_CONFIG.jarRadius * 0.8;
        const height = (Math.random() - 0.5) * BOIDS_CONFIG.jarHeight * 0.8;
        
        fireflyGroup.position.set(
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
        
        // Initialize Kuramoto state
        fireflyPhases.push(Math.random() * Math.PI * 2);
        fireflyFrequencies.push(
            KURAMOTO_CONFIG.baseFrequency + 
            (Math.random() - 0.5) * 2 * KURAMOTO_CONFIG.frequencyVariance
        );
        
        fireflies.push(fireflyGroup);
        fireflyVelocities.push(velocity);
        fireflyPositions.push(fireflyGroup.position.clone());
        
        scene.add(fireflyGroup);
    }
    
    console.log('🔄 Simulation reset! All', FIREFLY_COUNT, 'fireflies restored.');
}

// ==================== ANIMATION LOOP ====================
const clock = new THREE.Clock();

function animate() {
    const deltaTime = clock.getDelta();
    
    // Update camera movement (WASD + T/B)
    updateCameraMovement(deltaTime);
    
    // Handle first-person zoom
    handleZoom(deltaTime);
    
    // Check for firefly collisions with camera
    checkFireflyCollisions();
    
    // Update tongue animation
    updateTongueAnimation(deltaTime);
    
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
    
    // Update Kuramoto model (firefly synchronization/flashing)
    updateKuramoto(deltaTime);
    
    // Render with bloom post-processing
    composer.render();
}

renderer.setAnimationLoop(animate);

// ==================== AUDIO ====================
// Firefly chirping ambient sound
const fireflyAudio = new Audio('smartsound_ATMO_BUSH_Water_Hole_Early_Morning_01.mp3'); // Update path to your audio file
fireflyAudio.loop = true;
fireflyAudio.volume = 0.3; // Adjust volume (0.0 to 1.0)

// Try to play audio (may require user interaction due to browser autoplay policies)
function startFireflyAudio() {
    fireflyAudio.play().catch(error => {
        console.log('Audio autoplay prevented. Audio will start on user interaction.');
    });
}

// Start audio on first user interaction
let audioStarted = false;
function enableAudio() {
    if (!audioStarted) {
        startFireflyAudio();
        audioStarted = true;
    }
}

// Enable audio on any user interaction
window.addEventListener('click', enableAudio);
window.addEventListener('keydown', enableAudio);

// Try to start immediately (may not work in all browsers)
startFireflyAudio();

// ==================== EVENT LISTENERS ====================
renderer.domElement.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('wheel', onMouseWheel, { passive: false }); // Zoom with mouse wheel
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
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
console.log('Features: Kuramoto model synchronization - watch fireflies sync their flashing!');
console.log('Controls: Click to poke fireflies, hold & drag to look around, Spacebar to open jar, R to reset, F to toggle frosted glass');
console.log('Movement: W/A/S/D to move camera, Q to go up, E to go down');
console.log('Catch fireflies by moving the camera close to them!');

