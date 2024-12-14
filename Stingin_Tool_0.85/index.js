import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/TransformControls.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17.0/dist/lil-gui.esm.min.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js';
import { STLExporter } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/exporters/STLExporter.js';

let container;
let camera, scene, renderer, controls, transformControls, gui;
let points = []; // Array to store point positions
let pointObjects = []; // Array to store point mesh objects
let selectedPoints = []; // Array to store selected points
let forcefields = []; // Array to store forcefields
let selectedForcefield = null; // Currently selected forcefield
let isEditingForcefields = false; // Toggle for editing forcefields
let connections = []; // Array to store line connections
let connectionTubeMeshes = [];
let selectedConnections = []; // Array to store selected connections
let model, mixer;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let dialogBox = document.createElement('div');
let isHelloEventActive = false;
let isFurtherInstructionsActive = false;
let clock = new THREE.Clock();
let positionBox = document.createElement('div');
let meshThickness = 0.1; // Default thickness
let tubeMesh;
let isMeshVisible = true;
let ConnectionStraight = [];
let ConnectionCurve = [];
let selectedForcefields = [];

positionBox.id = 'positionBox';
positionBox.style.position = 'absolute';
positionBox.style.bottom = '10px';
positionBox.style.left = '10px';
positionBox.style.padding = '10px';
positionBox.style.backgroundColor = 'white';
positionBox.style.border = '1px solid black';
positionBox.style.display = 'none';
document.body.appendChild(positionBox);

// Function to update and display the position box
function updatePositionBox(point) {
    positionBox.innerHTML = `
        <label>X: <input type="number" id="posX" value="${point.position.x.toFixed(2)}" step="0.01"></label><br>
        <label>Y: <input type="number" id="posY" value="${point.position.y.toFixed(2)}" step="0.01"></label><br>
        <label>Z: <input type="number" id="posZ" value="${point.position.z.toFixed(2)}" step="0.01"></label><br>
    `;
    positionBox.style.display = 'block';

    document.getElementById('posX').addEventListener('input', (event) => {
        point.position.x = parseFloat(event.target.value);
    });
    document.getElementById('posY').addEventListener('input', (event) => {
        point.position.y = parseFloat(event.target.value);
    });
    document.getElementById('posZ').addEventListener('input', (event) => {
        point.position.z = parseFloat(event.target.value);
    });
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
    const ambientLight = new THREE.AmbientLight(0xf0f0f0, 6);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Color and intensity
    directionalLight.position.set(20, 20, 20); // Position the light
    directionalLight.castShadow = true; // Enable shadow casting
    scene.add(directionalLight);
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -1;
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(1000, 20);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
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
    pointsGroupFolder.add({ addPoint }, 'addPoint').name('Add Point');
    pointsGroupFolder.add({ removePoint }, 'removePoint').name('Remove Point');
    pointsGroupFolder.add({ deselectPoints }, 'deselectPoints').name('Deselect Points');
    pointsGroupFolder.add({ togglePointsVisibility }, 'togglePointsVisibility').name('Hide Points');

    const connectionsFolder = gui.addFolder('Connections');
    connectionsFolder.add({ connectPoints }, 'connectPoints').name('Connect Points');
    connectionsFolder.add({ deselectConnections }, 'deselectConnections').name('Deselect Connections');
    connectionsFolder.add({ clearConnections }, 'clearConnections').name('Clear all Connections');
    connectionsFolder.add({ removeSelectedConnection }, 'removeSelectedConnection').name('Remove Connection');
    connectionsFolder.add({ createBezierCurveFromConnections }, 'createBezierCurveFromConnections').name('Apply Force');

    const forcefieldsFolder = gui.addFolder('Forcefields');
    forcefieldsFolder.add({ addForcefield }, 'addForcefield').name('Add Forcefield');
    forcefieldsFolder.add({ toggleEditForcefields }, 'toggleEditForcefields').name('Edit Forcefields');
    forcefieldsFolder.add({ removeForcefield }, 'removeForcefield').name('Remove Forcefield');

    const meshFolder = gui.addFolder('Mesh');
    meshFolder.add({ createMesh: createTubeMeshFromConnections }, 'createMesh').name('Create Mesh');
    meshFolder.add({ thickness: meshThickness }, 'thickness', 0.1, 10).name('Thickness').onChange(updateTubeThickness);
    meshFolder.add({ toggleMeshVisibility }, 'toggleMeshVisibility').name('Hide Mesh');
    meshFolder.add({ downloadMesh: downloadMeshAsSTL }, 'downloadMesh').name('Download Mesh');

    const knightFolder = gui.addFolder('Knight');
    knightFolder.add({ removeKnight }, 'removeKnight').name('Remove Knight');

    // Add event listener for selecting objects
    window.addEventListener('pointerdown', onPointerDown);

    // Add event listener for selecting forcefields
    window.addEventListener('pointerdown', (event) => {
        if (isEditingForcefields) {
            const intersects = raycaster.intersectObjects(forcefields);
            if (intersects.length > 0) {
                const forcefield = intersects[0].object;
                selectForcefield(forcefield, event.shiftKey);
            }
        }
    });

    // Resize listener
    window.addEventListener('resize', onWindowResize);

    // Load the model
    const loader = new FBXLoader();
    loader.load('./stuff/modells/Ritter.fbx', (object) => {
        model = object;
        model.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(model);

        // Load the initial animation
        loader.load('./stuff/animations/Waving.fbx', (anim) => {
            mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(anim.animations[0]);
            action.play();
        });
    });

    // Resize listener
    window.addEventListener('resize', onWindowResize);

    // Example usage of deselectConnections
    deselectConnections();

    // Animation loop
    animate();
}

// Function to level selected points on the specified axis
function levelPointsOnAxis(axis) {
    if (selectedPoints.length < 2) return; // Need at least two points to level

    const referencePoint = selectedPoints[0].position[axis];

    selectedPoints.forEach(point => {
        point.position[axis] = referencePoint;
    });

    // Update the positions of the points in the scene
    selectedPoints.forEach(point => {
        point.geometry.attributes.position.needsUpdate = true;
    });
}

// Function to add a point
function addPoint() {
    const pointGeometry = new THREE.SphereGeometry(10, 16, 16);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const point = new THREE.Mesh(pointGeometry, pointMaterial);

    if (selectedPoints.length === 2) {
        const pos1 = selectedPoints[0].position;
        const pos2 = selectedPoints[1].position;
        point.position.set(
            (pos1.x + pos2.x) / 2,
            (pos1.y + pos2.y) / 2,
            (pos1.z + pos2.z) / 2
        );
    } else {
        point.position.set(
            (Math.random() - 0.5) * 1000,
            0,
            (Math.random() - 0.5) * 1000
        );
    }

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

// Function to select a point
function selectPoint(point, isMultiSelect) {
    if (isMultiSelect) {
        // Multi-selection logic
        const index = selectedPoints.indexOf(point);
        if (index !== -1) {
            // Deselect point if already selected
            selectedPoints.splice(index, 1);
            point.material.color.set(0xff0000); // Reset color to red
        } else {
            // Select point
            selectedPoints.push(point);
            point.material.color.set(0x00ff00); // Change color to indicate selection
        }
    } else {
        // Single selection logic
        selectedPoints.forEach(p => p.material.color.set(0xff0000)); // Reset color of all selected points
        selectedPoints = [point];
        point.material.color.set(0x00ff00); // Change color to indicate selection
    }

    // Update and display the position box
    updatePositionBox(point);

    // Attach or detach transform controls based on selection
    if (selectedPoints.length === 1) {
        transformControls.attach(selectedPoints[0]);
    } else {
        transformControls.detach();
    }
}

// Function to connect points with lines
function connectPoints() {
    if (selectedPoints.length < 2) {
        console.warn('At least two points must be selected to create a connection');
        return;
    }

    for (let i = 0; i < selectedPoints.length - 1; i++) {
        const start = selectedPoints[i];
        const end = selectedPoints[i + 1];

        const line = createLine(start.position, end.position);
        line.userData.start = start;
        line.userData.end = end;
        scene.add(line);
        connections.push(line);
        ConnectionStraight.push(line); // Save the connection in ConnectionStraight
    }
}

// Function to create a line between two points
function createLine(startPosition, endPosition) {
    const points = [
        startPosition,
        endPosition
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 1 }); // Increase linewidth
    const line = new THREE.Line(geometry, material);

    return line;
}

// Hide Points
function togglePointsVisibility() {
    const arePointsVisible = pointObjects.length > 0 && pointObjects[0].visible;
    pointObjects.forEach(point => {
        point.visible = !arePointsVisible;
    });
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

// Define the deselectConnections function
function deselectConnections() {
    selectedConnections.forEach(conn => {
        conn.material = new THREE.LineBasicMaterial({
            color: 0x0000ff,
            linewidth: 2
        });
    });
    selectedConnections = [];
}

function removeSelectedConnection() {
    if (selectedConnections.length === 0) {
        console.warn('No connection selected to remove');
        return;
    }

    selectedConnections.forEach(selectedConnection => {
        // Remove the selected connection from the connections array
        const index = connections.indexOf(selectedConnection);
        if (index > -1) {
            connections.splice(index, 1);
        }

        // Remove the connection from ConnectionStraight array
        const straightIndex = ConnectionStraight.indexOf(selectedConnection);
        if (straightIndex > -1) {
            ConnectionStraight.splice(straightIndex, 1);
        }

        // Remove the connection from ConnectionCurve array
        const curveIndex = ConnectionCurve.indexOf(selectedConnection);
        if (curveIndex > -1) {
            ConnectionCurve.splice(curveIndex, 1);
        }

        // Remove the connection's mesh from the scene
        scene.remove(selectedConnection);
    });

    // Clear the selected connections array
    selectedConnections = [];

    console.log('Selected connection(s) removed');
}

// Function to add a forcefield
function addForcefield() {
    const geometry = new THREE.SphereGeometry(20, 32, 32); // Fixed size of 20
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
}

// Function to toggle editing forcefields
function toggleEditForcefields() {
    isEditingForcefields = !isEditingForcefields;
    if (isEditingForcefields && forcefields.length > 0) {
        selectedForcefield = forcefields[0];
        selectedForcefields = [selectedForcefield];
        transformControls.attach(selectedForcefield);
        updatePositionBox(selectedForcefield); // Update position box
        selectedForcefield.material.color.set(0x0000ff); // Set color to blue
    } else {
        // Deselect all forcefields
        selectedForcefields.forEach(forcefield => {
            forcefield.material.color.set(0x00ff00); // Set color to green
        });
        transformControls.detach();
        selectedForcefield = null;
        selectedForcefields = [];
        positionBox.style.display = 'none'; // Hide position box
    }
}

// Is not working like it should ..........
// Function to select a forcefield
function selectForcefield(forcefield, isMultiSelect) {
    if (isMultiSelect) {
        // Multi-selection logic
        const index = selectedForcefields.indexOf(forcefield);
        if (index !== -1) {
            // Deselect forcefield if already selected
            selectedForcefields.splice(index, 1);
            forcefield.material.color.set(0x00ff00); // Reset color to green
        } else {
            // Select forcefield
            selectedForcefields.push(forcefield);
            forcefield.material.color.set(0x0000ff); // Change color to indicate selection
        }
    } else {
        // Single selection logic
        selectedForcefields.forEach(f => f.material.color.set(0x00ff00)); // Reset color of all selected forcefields
        selectedForcefields = [forcefield];
        forcefield.material.color.set(0x0000ff); // Change color to indicate selection
    }

    // Attach transform controls only if one forcefield is selected
    if (selectedForceFields.length === 1) {
        transformControls.attach(selectedForceFields[0]);
    } else {
        transformControls.detach();
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

// Function to create a Bezier curve from selected connections using the forcefield as the control point
function createBezierCurveFromConnections() {
    if (selectedConnections.length === 0) {
        console.warn('At least one connection must be selected to create a Bezier curve');
        return;
    }

    if (!selectedForcefield) {
        console.warn('A forcefield must be selected to use as the control point');
        return;
    }

    selectedConnections.forEach(connection => {
        const start = connection.userData.start.position;
        const end = connection.userData.end.position;
        const controlPoint = selectedForcefield.position;

        // Remove the old connection from the scene and connections array
        scene.remove(connection);
        const index = connections.indexOf(connection);
        if (index !== -1) {
            connections.splice(index, 1);
        }

        // Remove the old connection from the ConnectionStraight array
        const straightIndex = ConnectionStraight.indexOf(connection);
        if (straightIndex !== -1) {
            ConnectionStraight.splice(straightIndex, 1);
        }

        const curve = new THREE.CubicBezierCurve3(
            start,
            controlPoint,
            controlPoint,
            end
        );

        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const bezierCurve = new THREE.Line(geometry, material);

        // Store the necessary information for updating the curve
        bezierCurve.userData = {
            start: start,
            end: end,
            controlPoint: controlPoint,
            curve: curve
        };

        scene.add(bezierCurve);
        connections.push(bezierCurve);
        ConnectionCurve.push(bezierCurve); // Save the Bezier curve in ConnectionCurve
    });

    // Clear the selected connections after creating the Bezier curves
    selectedConnections = [];
}

// Create Mesh
function createTubeMeshFromConnections() {
    const vertices = [];

    // Add straight connections to the vertices array
    ConnectionStraight.forEach(connection => {
        const points = connection.geometry.attributes.position.array;
        for (let i = 0; i < points.length; i += 3) {
            vertices.push(points[i], points[i + 1], points[i + 2]);
        }
    });

    // Add curved connections to the vertices array
    ConnectionCurve.forEach(connection => {
        const points = connection.geometry.attributes.position.array;
        for (let i = 0; i < points.length; i += 3) {
            vertices.push(points[i], points[i + 1], points[i + 2]);
        }
    });

    // Check if vertices array is not empty
    if (vertices.length === 0) {
        console.error('No vertices found for creating the tube mesh.');
        return;
    }

    // Create the tube geometry and set the vertices
    const tubeGeometry = new THREE.BufferGeometry();
    tubeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    // Create the tube material with purple color
    const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0x800080, wireframe: true });

    // Create the tube mesh
    const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);

    // Add the tube mesh to the scene
    scene.add(tubeMesh);
}

function updateTubeThickness(value) {
    meshThickness = value;
    createTubeMeshFromConnections();
}

function downloadMeshAsSTL() {
    if (!tubeMesh) {
        console.warn('No mesh available to download');
        return;
    }

    const exporter = new STLExporter();
    const stlString = exporter.parse(tubeMesh);

    const blob = new Blob([stlString], { type: 'text/plain' });
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);

    link.href = URL.createObjectURL(blob);
    link.download = 'mesh.stl';
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// Function to toggle the visibility of the mesh
function toggleMeshVisibility() {
    isMeshVisible = !isMeshVisible;
    if (tubeMesh) {
        tubeMesh.visible = isMeshVisible;
    }
}

function removeKnight() {
    if (model) {
        scene.remove(model);
        model = null;
        console.log('Knight removed from the scene');
    } else {
        console.warn('No knight model to remove');
    }
}

// Function to handle pointer down for selection
function onPointerDown(event) {
    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersected objects
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pointObjects);

    if (intersects.length > 0) {
        const selectedPoint = intersects[0].object;
        selectPoint(selectedPoint, event.shiftKey); // Call selectPoint function with Shift key state
        return; // Exit early if a point is selected
    }

    // Check for forcefield selection if in edit mode
    if (isEditingForcefields) {
        const forcefieldsIntersects = raycaster.intersectObjects(forcefields);
        if (forcefieldsIntersects.length > 0) {
            const newSelectedForcefield = forcefieldsIntersects[0].object;

            // Change color of previously selected forcefield to green
            if (selectedForcefield && selectedForcefield !== newSelectedForcefield) {
                selectedForcefield.material.color.set(0x00ff00);
            }

            // Change color of newly selected forcefield to blue
            newSelectedForcefield.material.color.set(0x0000ff);

            selectedForcefield = newSelectedForcefield;
            transformControls.attach(selectedForcefield);
            updatePositionBox(selectedForcefield); // Update position box

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
        // Update and display the position box
        updatePositionBox(selectedPoint);
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

    // Level Points on Axis
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'x':
                levelPointsOnAxis('x');
                break;
            case 'y':
                levelPointsOnAxis('y');
                break;
            case 'z':
                levelPointsOnAxis('z');
                break;
        }
    });

    //RItter intro
     {
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the raycaster with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(model, true);

        if (intersects.length > 0) {
            const loader = new FBXLoader();

            if (isFurtherInstructionsActive) {
                // Update the dialog box text
                dialogBox.innerHTML = 'It looks like this program is designed to create objects by setting points and connecting them. It also seems like you can influence the connections with force fields. Perhaps you can find out more about it.';

                // Load the "Walking.fbx" animation
                loader.load('./stuff/animations/Walking.fbx', (anim) => {
                    mixer.stopAllAction();
                    const action = mixer.clipAction(anim.animations[0]);
                    action.play();

                    // Remove the dialog box
                    document.body.removeChild(dialogBox);

                    // Move the model to the left corner of the grid
                    const targetPosition = new THREE.Vector3(0, 0, 410);
                    const duration = 1.5; // Duration of the walk animation in seconds
                    const startPosition = model.position.clone();
                    const deltaPosition = targetPosition.clone().sub(startPosition).divideScalar(duration);

                    let elapsedTime = 0.1;
                    const walkInterval = setInterval(() => {
                        const delta = clock.getDelta(1);
                        elapsedTime += delta;
                        if (elapsedTime >= duration) {
                            clearInterval(walkInterval);
                            model.position.copy(targetPosition);

                            // Load the "Stand To Sit.fbx" animation
                            loader.load('./stuff/animations/Sitting Idle.fbx', (anim) => {
                                mixer.stopAllAction();
                                const action = mixer.clipAction(anim.animations[0]);
                                action.play();
                            });
                        } else {
                            model.position.add(deltaPosition.clone().multiplyScalar(delta));
                        }
                    }, 100);
                });
            } else if (isHelloEventActive) {
                // Update the dialog box text
                dialogBox.innerHTML = 'It looks like this program is designed to create objects by setting points and connecting them. It also seems like you can influence the connections with force fields, but I have no idea about that because Im just a knight. Maybe you can find out more about it';

                // Load the "Telling A Secret.fbx" animation
                loader.load('./stuff/animations/Telling A Secret.fbx', (anim) => {
                    mixer.stopAllAction();
                    const action = mixer.clipAction(anim.animations[0]);
                    action.play();
                });

                // Activate the further instructions event
                isFurtherInstructionsActive = true;
            } else {
                // Load the "Talking.fbx" animation
                loader.load('./stuff/animations/Talking.fbx', (anim) => {
                    mixer.stopAllAction();
                    const action = mixer.clipAction(anim.animations[0]);
                    action.play();
                });

                // Display the dialog box
                dialogBox.style.position = 'absolute';
                dialogBox.style.bottom = '20px';
                dialogBox.style.left = '50%';
                dialogBox.style.transform = 'translateX(-50%)';
                dialogBox.style.padding = '10px';
                dialogBox.style.backgroundColor = 'white';
                dialogBox.style.border = '1px solid black';
                dialogBox.innerHTML = 'Hello friend, I am somehow stuck in this weird program that Max wrote.';
                document.body.appendChild(dialogBox);

                // Activate the hello event
                isHelloEventActive = true;
            }
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

    // Update connections
    connections.forEach(connection => {
        if (connection.userData.start && connection.userData.end) {
            if (connection.userData.curve) {
                // Update the Bezier curve
                const curve = connection.userData.curve;
                curve.v0.copy(connection.userData.start);
                curve.v1.copy(connection.userData.controlPoint);
                curve.v2.copy(connection.userData.controlPoint);
                curve.v3.copy(connection.userData.end);

                const points = curve.getPoints(50);
                connection.geometry.setFromPoints(points);
            } else {
                // Update the straight line connection
                const points = connection.geometry.attributes.position.array;
                const start = connection.userData.start.position;
                const end = connection.userData.end.position;

                points[0] = start.x;
                points[1] = start.y;
                points[2] = start.z;
                points[3] = end.x;
                points[4] = end.y;
                points[5] = end.z;

                connection.geometry.attributes.position.needsUpdate = true;
            }
        }
    });

    // Update animation mixer
    if (mixer) {
        mixer.update(0.01); // Adjust the delta time as needed
    }

    controls.update();
    renderer.render(scene, camera);
}

// Render the scene
function render() {
    renderer.render(scene, camera);
}