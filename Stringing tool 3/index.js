import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/TransformControls.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17.0/dist/lil-gui.esm.min.js';

let container;
let camera, scene, renderer, controls, transformControls, gui;
let points = []; // Array to store point positions
let pointObjects = []; // Array to store point mesh objects
let selectedPoints = []; // Array to store selected points
let forcefields = []; // Array to store forcefields
let selectedForcefield = null; // Currently selected forcefield
let isEditingForcefields = false; // Toggle for editing forcefields

init();

function init() {
    // Container
    container = document.getElementById('container');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(500, 500, 1000);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xf0f0f0, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 100, 100).normalize();
    scene.add(directionalLight);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(1000, 20);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 2000;
    controls.maxPolarAngle = Math.PI / 2;

    // Transform Controls
    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('change', render);
    transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value; // Disable orbit controls while dragging
    });
    scene.add(transformControls);

    // GUI
    gui = new GUI();
    gui.add({ addPoint }, 'addPoint').name('Add Point');
    gui.add({ removePoint }, 'removePoint').name('Remove Point');
    gui.add({ connectPoints }, 'connectPoints').name('Connect Points');
    gui.add({ addForcefield }, 'addForcefield').name('Add Forcefield');
    gui.add({ toggleEditForcefields }, 'toggleEditForcefields').name('Edit Forcefields');
    gui.add({ removeForcefield }, 'removeForcefield').name('Remove Forcefield');

    // Add event listener for selecting objects
    window.addEventListener('pointerdown', onPointerDown);

    // Resize listener
    window.addEventListener('resize', onWindowResize);

    // Animation loop
    animate();
}

// Function to add a point
function addPoint() {
    const pointGeometry = new THREE.SphereGeometry(10, 16, 16);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const point = new THREE.Mesh(pointGeometry, pointMaterial);

    point.position.set(
        (Math.random() - 0.5) * 1000,
        0,
        (Math.random() - 0.5) * 1000
    );

    scene.add(point);
    points.push(point.position);
    pointObjects.push(point);
}

// Function to remove selected points
function removePoint() {
    selectedPoints.forEach((point) => {
        const index = pointObjects.indexOf(point);
        if (index !== -1) {
            scene.remove(pointObjects[index]);
            pointObjects.splice(index, 1);
            points.splice(index, 1);
        }
    });
    selectedPoints = [];
    transformControls.detach();
}

// Function to connect points
function connectPoints() {
    if (selectedPoints.length < 2) return;

    for (let i = 0; i < selectedPoints.length - 1; i++) {
        const start = selectedPoints[i];
        const end = selectedPoints[i + 1];

        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const line = new THREE.Line(lineGeometry, lineMaterial);

        lineGeometry.setFromPoints([start.position, end.position]);
        scene.add(line);
    }
}

// Function to add a forcefield
function addForcefield() {
    const geometry = new THREE.SphereGeometry(50, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3
    });
    const forcefield = new THREE.Mesh(geometry, material);

    forcefield.position.set(
        (Math.random() - 0.5) * 1000,
        0,
        (Math.random() - 0.5) * 1000
    );

    scene.add(forcefield);
    forcefields.push(forcefield);

    const sizeControl = gui.add({ size: 50 }, 'size', 10, 200).name('Forcefield Size').onChange((value) => {
        forcefield.scale.set(value / 50, value / 50, value / 50);
    });
}

// Function to toggle editing forcefields
function toggleEditForcefields() {
    isEditingForcefields = !isEditingForcefields;
    if (!isEditingForcefields) {
        transformControls.detach(); // Detach controls when editing is disabled
    }
}

// Function to remove selected forcefield
function removeForcefield() {
    if (selectedForcefield) {
        scene.remove(selectedForcefield);
        const index = forcefields.indexOf(selectedForcefield);
        if (index !== -1) forcefields.splice(index, 1);
        selectedForcefield = null;
        transformControls.detach();
    }
}

// Function to handle pointer down for selection
function onPointerDown(event) {
    if (!isEditingForcefields) return; // Only handle selection if editing forcefields

    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(forcefields);
    if (intersects.length > 0) {
        selectedForcefield = intersects[0].object;
        transformControls.attach(selectedForcefield);
    }
}

// Update on window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Render the scene
function render() {
    renderer.render(scene, camera);
}
