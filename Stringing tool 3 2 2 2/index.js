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
let connections = []; // Array to store line connections
let connectionGroups = []; // Array to store connection groups
let selectedConnections = []; // Array to store selected connections

// Connection Group Class
class ConnectionGroup {
    constructor() {
        this.connections = [];
        this.rigidity = 1.0; // Default rigidity
        this.material = new THREE.LineBasicMaterial({ 
            color: 0xff6600, // Orange color for grouped connections
            linewidth: 3 
        });
    }

    addConnection(connection) {
        if (!this.connections.includes(connection)) {
            this.connections.push(connection);
            connection.material = this.material;
        }
    }

    removeConnection(connection) {
        const index = this.connections.indexOf(connection);
        if (index !== -1) {
            this.connections.splice(index, 1);
            // Restore original material
            connection.material = new THREE.LineBasicMaterial({ 
                color: 0x0000ff,
                linewidth: 2 
            });
        }
    }

    setRigidity(value) {
        this.rigidity = value;
        console.log(`Group rigidity set to: ${value}`);
    }
}

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

    const pointsGroupFolder = gui.addFolder('Points');
    pointsGroupFolder .add({ addPoint }, 'addPoint').name('Add Point');
    pointsGroupFolder.add({ removePoint }, 'removePoint').name('Remove Point');
    pointsGroupFolder.add({ deselectPoints }, 'deselectPoints').name('Deselect Points');

    const connectionsFolder = gui.addFolder('Connections');
    connectionsFolder.add({ connectPoints }, 'connectPoints').name('Connect Points');
    connectionsFolder.add({ clearConnections }, 'clearConnections').name('Clear Connections');

    const forcefieldsFolder = gui.addFolder('Forcefields');
    forcefieldsFolder.add({ addForcefield }, 'addForcefield').name('Add Forcefield');
    forcefieldsFolder.add({ toggleEditForcefields }, 'toggleEditForcefields').name('Edit Forcefields');
    forcefieldsFolder.add({ removeForcefield }, 'removeForcefield').name('Remove Forcefield');

    // Connection Group Controls
    const connectionGroupFolder = gui.addFolder('Connection Groups');
    connectionGroupFolder.add({ createConnectionGroup }, 'createConnectionGroup').name('Create Group');
    connectionGroupFolder.add({ clearConnectionGroups }, 'clearConnectionGroups').name('Clear Group');

    // Add event listener for selecting objects
    window.addEventListener('pointerdown', onPointerDown);

    // Resize listener
    window.addEventListener('resize', onWindowResize);

    // Animation loop
    animate();
}

// Function to create a connection group from selected connections
function createConnectionGroup() {
    if (selectedConnections.length === 0) {
        console.warn('No connections selected to create a group');
        return;
    }

    const newGroup = new ConnectionGroup();
    selectedConnections.forEach(connection => {
        newGroup.addConnection(connection);
    });

    connectionGroups.push(newGroup);

    // Add rigidity control for this specific group
    const groupIndex = connectionGroups.length - 1;
    gui.add(
        { rigidity: newGroup.rigidity }, 
        'rigidity', 
        0, 
        2
    ).name(`Group ${groupIndex + 1} Rigidity`).onChange((value) => {
        newGroup.setRigidity(value);
    });

    selectedConnections = []; // Clear selection after grouping
}

// Function to clear all connection groups
function clearConnectionGroups() {
    connectionGroups.forEach(group => {
        // Restore original materials
        group.connections.forEach(connection => {
            connection.material = new THREE.LineBasicMaterial({ 
                color: 0x0000ff,
                linewidth: 2 
            });
        });
    });
    connectionGroups = [];
    
    // Remove all group-related GUI controls
    const connectionGroupFolder = gui.children.find(folder => folder.name === 'Scene Controls')
        .children.find(folder => folder.name === 'Connection Groups');
    
    // Remove individual group rigidity controls
    gui.children.forEach((child, index) => {
        if (child.name.includes('Group') && child.name.includes('Rigidity')) {
            gui.remove(child);
        }
    });
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
    if (selectedPoints.length === 0) {
        console.warn('No points selected to remove');
        return;
    }

    selectedPoints.forEach((point) => {
        const index = pointObjects.indexOf(point);
        if (index !== -1) {
            scene.remove(point);
            pointObjects.splice(index, 1);
            points.splice(index, 1);
        }
    });
    
    // Clear selections and transform controls
    selectedPoints = [];
    transformControls.detach();
}

// Function to deselect all selected points
function deselectPoints() {
    selectedPoints.forEach((point) => {
        point.material.color.set(0xff0000); // Reset color to red
    });
    selectedPoints = [];
    transformControls.detach(); // Detach transform controls
    console.log('All points deselected');
}

// Function to connect points
function connectPoints() {
    if (selectedPoints.length < 2) {
        console.warn('At least two points must be selected to create a connection');
        return;
    }

    for (let i = 0; i < selectedPoints.length - 1; i++) {
        const start = selectedPoints[i];
        const end = selectedPoints[i + 1];

        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            start.position, 
            end.position
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x0000ff,
            linewidth: 2 
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        connections.push(line);
    }
}

// Function to clear all connections
function clearConnections() {
    connections.forEach(connection => {
        scene.remove(connection);
    });
    connections = [];
    selectedConnections = [];
    connectionGroups = [];
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
    } else {
        console.warn('No forcefield selected to remove');
    }
}

// Function to handle pointer down for selection
function onPointerDown(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check for forcefield selection if in edit mode
    if (isEditingForcefields) {
        const forcefieldsIntersects = raycaster.intersectObjects(forcefields);
        if (forcefieldsIntersects.length > 0) {
            selectedForcefield = forcefieldsIntersects[0].object;
            transformControls.attach(selectedForcefield);
            return;
        }
    }

    // Point selection logic
    const pointsIntersects = raycaster.intersectObjects(pointObjects);
    if (pointsIntersects.length > 0) {
        const selectedPoint = pointsIntersects[0].object;
        
        // Toggle point selection
        const index = selectedPoints.indexOf(selectedPoint);
        if (index !== -1) {
            selectedPoints.splice(index, 1);
            selectedPoint.material.color.set(0xff0000);
        } else {
            selectedPoints.push(selectedPoint);
            selectedPoint.material.color.set(0x00ff00);
        }

        // If in edit mode, attach transform controls to the point
        if (selectedPoints.length === 1) {
            transformControls.attach(selectedPoints[0]);
        } else {
            transformControls.detach();
        }
        return;
    }

    // Connection selection logic
    const connectionIntersects = raycaster.intersectObjects(connections);
    if (connectionIntersects.length > 0) {
        const selectedConnection = connectionIntersects[0].object;
        
        // Check if shift key is pressed for multi-selection
        if (event.shiftKey) {
            const index = selectedConnections.indexOf(selectedConnection);
            if (index !== -1) {
                // Deselect
                selectedConnections.splice(index, 1);
                selectedConnection.material = new THREE.LineBasicMaterial({ 
                    color: 0x0000ff,
                    linewidth: 2 
                });
            } else {
                // Select
                selectedConnections.push(selectedConnection);
                selectedConnection.material = new THREE.LineBasicMaterial({ 
                    color: 0xff6600, // Orange color
                    linewidth: 3 
                });
            }
        } else {
            // Single selection - clear previous selections
            selectedConnections.forEach(conn => {
                conn.material = new THREE.LineBasicMaterial({ 
                    color: 0x0000ff,
                    linewidth: 2 
                });
            });
            
            selectedConnections = [selectedConnection];
            selectedConnection.material = new THREE.LineBasicMaterial({ 
                color: 0xff6600, // Orange color
                linewidth: 3 
            });
        }
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