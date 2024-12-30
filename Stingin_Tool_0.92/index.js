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
let allPoints = []; // Make sure to populate this array with all points in your scene
let currentIndex = 0; // Index to keep track of the current point

let allConnections = []; // Array to store all connections in the scene
let currentConnectionIndex = 0; // Index to keep track of the current connection
let selectedConnections = []; // Array to store selected connections

let forcefields = []; // Array to store forcefields
let selectedForcefield = null; // Currently selected forcefield
let connections = []; // Array to store line connections

let model, mixer;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let dialogBox = document.createElement('div');
let isHelloEventActive = false;
let isFurtherInstructionsActive = false;
let clock = new THREE.Clock();
let positionBox = document.createElement('div');

let ConnectionStraight = []; //wollen wir loeschen
let ConnectionCurve = []; //wollen wir loeschen
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
    pointsGroupFolder.add({ removePoint }, 'removePoint').name('Delete Point');
    pointsGroupFolder.add({ deselectPoints }, 'deselectPoints').name('Deselect Points');
    pointsGroupFolder.add({ togglePointsVisibility }, 'togglePointsVisibility').name('Hide Points');

    const connectionsFolder = gui.addFolder('Connections');
    connectionsFolder.add({ connectPoints }, 'connectPoints').name('Connect Points');
    connectionsFolder.add({ removeSelectedConnection }, 'removeSelectedConnection').name('Delete Connection');
    connectionsFolder.add({ deselectConnections }, 'deselectConnections').name('Deselect Connections');
    connectionsFolder.add({ createBezierCurveFromConnections }, 'createBezierCurveFromConnections').name('Apply Force');

    const forcefieldsFolder = gui.addFolder('Forcefields');
    forcefieldsFolder.add({ addForcefield }, 'addForcefield').name('Add Forcefield');
    forcefieldsFolder.add({ removeForcefield }, 'removeForcefield').name('Delete Forcefield');
    forcefieldsFolder.add({ deselectForcefields }, 'deselectForcefields').name('Deselect Forcefield');
    forcefieldsFolder.add({ toggleForcefieldsVisibility }, 'toggleForcefieldsVisibility').name('Hide Forcefields');

    const knightFolder = gui.addFolder('Knight');
    knightFolder.add({ removeKnight }, 'removeKnight').name('Remove Knight');

    // Add event listener for selecting objects
    window.addEventListener('pointerdown', onPointerDown);

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

    // Add event listener for deselecting all objects
    document.addEventListener('keydown', function(event) {
        if (event.key === 'd') {
            deselectAll();
        }
    });

    // Event listener for selecting points
    document.addEventListener('keydown', (event) => {
        if (event.key === 'p') {
            if (allPoints.length > 0) {
                selectPoint(allPoints[currentIndex], false);
                currentIndex = (currentIndex + 1) % allPoints.length; // Move to the next point
            }
        }
    });

    // Event listener for selecting connections
    document.addEventListener('keydown', (event) => {
        if (event.key === 'c') {
            if (allConnections.length > 0) {
                selectConnection(allConnections[currentConnectionIndex], false);
                currentConnectionIndex = (currentConnectionIndex + 1) % allConnections.length; // Move to the next connection
            }
        }
    });

    // Add an event listener for key press
    document.addEventListener('keydown', (event) => {
        if (event.key === 'f') {
            // Call the function to select the next forcefield
            selectNextForcefield(event.shiftKey); // Use shift key for multi-selection
        }
    });

    // Add an event listener for creating a Bezier curve
    document.addEventListener('keydown', (event) => {
        if (event.key === 's') {
            createBezierCurveFromConnections();
        }
    });

    // Add an event listener for deleting selected objects
    document.addEventListener('keydown', (event) => {
        if (event.key === 'x') {
            if (selectedForcefields.length > 0) {
                removeForcefield();
            } else if (selectedConnections.length > 0) {
                removeSelectedConnection();
            } else if (selectedPoints.length > 0) {
                removePoint();
            }
        }
    });

    // Resize listener
    window.addEventListener('resize', onWindowResize);

    // Example usage of deselectConnections
    deselectConnections();

    // Animation loop
    animate();
}

// Function to deselect all Points, Connections, and Forcefields
function deselectAll() {
    deselectPoints();
    deselectConnections();
    deselectForcefields();
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

// Populate allPoints array with points in the scene
function populateAllPoints() {
    // Assuming points are added to the scene and stored in an array called pointObjects
    allPoints = pointObjects; // Assign pointObjects to allPoints
}

// Call populateAllPoints after points are added to the scene
populateAllPoints();

// Function to deselect all selected points
function deselectPoints() {
    selectedPoints.forEach((point) => {
        point.material.color.set(0xff0000); // Reset color to red
    });
    selectedPoints = [];
    transformControls.detach(); // Detach transform controls
    console.log('All points deselected');
}

// Hide Points
function togglePointsVisibility() {
    const arePointsVisible = pointObjects.length > 0 && pointObjects[0].visible;
    pointObjects.forEach(point => {
        point.visible = !arePointsVisible;
    });
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
    }
}

// Function to create a line between two points
function createLine(startPosition, endPosition) {
    const points = [
        startPosition,
        endPosition
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 }); // Increase linewidth
    const line = new THREE.Line(geometry, material);

    return line;
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

// Function to select a connection
function selectConnection(connection, isMultiSelect) {
    if (isMultiSelect) {
        // Multi-selection logic
        const index = selectedConnections.indexOf(connection);
        if (index !== -1) {
            // Deselect connection if already selected
            selectedConnections.splice(index, 1);
            connection.material.color.set(0x0000ff); // Reset color to blue
        } else {
            // Select connection
            selectedConnections.push(connection);
            connection.material.color.set(0x00ff00); // Change color to green to indicate selection
        }
    } else {
        // Single selection logic
        selectedConnections.forEach(c => c.material.color.set(0x0000ff)); // Reset color of all selected connections to blue
        selectedConnections = [connection];
        connection.material.color.set(0x00ff00); // Change color to green to indicate selection
    }

    console.log('Selected connection:', connection);
}

// Function to remove selected connections
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

// Populate allConnections array with connections in the scene
function populateAllConnections() {
    // Assuming connections are added to the scene and stored in an array called connections
    allConnections = connections; // Assign connections to allConnections
}

// Call populateAllConnections after connections are added to the scene
populateAllConnections();

// Function to add a forcefield
function addForcefield() {
    const geometry = new THREE.SphereGeometry(20, 32, 32); // Initial size of 20
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

    // Add a diameter property to the forcefield
    forcefield.userData.diameter = 20;

    // Create a GUI folder for the forcefield
    const forcefieldFolder = gui.addFolder(`Forcefield ${forcefields.length + 1}`);
    forcefieldFolder.add(forcefield.userData, 'diameter', 1, 2000).name('Diameter').onChange(value => {
        // Update the sphere geometry when the diameter changes
        const newGeometry = new THREE.SphereGeometry(value / 2, 32, 32);
        forcefield.geometry.dispose(); // Dispose of the old geometry
        forcefield.geometry = newGeometry; // Assign the new geometry
    });

    // Store the GUI folder in the forcefield
    forcefield.userData.guiFolder = forcefieldFolder;

    scene.add(forcefield);
    forcefields.push(forcefield);
}

// Function to select the next forcefield
function selectNextForcefield(isMultiSelect) {
    if (forcefields.length === 0) {
        console.warn('No forcefields available to select');
        return;
    }

    // Increment the current index to cycle through forcefields
    currentForcefieldIndex = (currentForcefieldIndex + 1) % forcefields.length;
    const nextForcefield = forcefields[currentForcefieldIndex];

    // Call the selectForcefield function with the next forcefield
    selectForcefield(nextForcefield, isMultiSelect);
}

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

    // Attach or detach transform controls based on selection
    if (selectedForcefields.length === 1) {
        transformControls.attach(selectedForcefields[0]);
    } else {
        transformControls.detach();
    }

    // Update and display the position box
    updatePositionBox(forcefield);
}

// Initialize the current forcefield index
let currentForcefieldIndex = -1;

// Function to deselect all forcefields
function deselectForcefields() {
    selectedForcefields.forEach(forcefield => {
        forcefield.material.color.set(0x00ff00); // Reset color to green
    });
    selectedForcefields = [];
    transformControls.detach(); // Detach transform controls
}

function removeForcefield() {
    if (selectedForcefields.length === 0) {
        console.warn('No forcefields selected to remove');
        return;
    }

    selectedForcefields.forEach(forcefield => {
        // Remove the forcefield from the scene
        scene.remove(forcefield);

        // Dispose of the geometry and material
        forcefield.geometry.dispose();
        forcefield.material.dispose();

        // Remove the forcefield from the forcefields array
        const index = forcefields.indexOf(forcefield);
        if (index !== -1) {
            forcefields.splice(index, 1);
        }

        // Remove the GUI folder associated with the forcefield
        if (forcefield.userData.guiFolder) {
            forcefield.userData.guiFolder.destroy();
        }

    });

    // Clear the selected forcefields array
    selectedForcefields = [];

    // Detach transform controls
    transformControls.detach();

}

// Function to toggle the visibility of forcefields
function toggleForcefieldsVisibility() {
    forcefields.forEach(forcefield => {
        forcefield.visible = !forcefield.visible;
    });
}

function createBezierCurveFromConnections() {
    if (selectedConnections.length === 0) {
        console.warn('No connections selected to create a Bezier curve');
        return;
    }

    selectedConnections.forEach(connection => {
        const start = connection.userData.start.position;
        const end = connection.userData.end.position;

        let controlPoint1, controlPoint2;
        let pointA, pointB;
        if (selectedForcefields.length === 1) {
            controlPoint1 = getOrthogonalProjectionOnLine(selectedForcefields[0], start, end);
            controlPoint2 = controlPoint1;
        } else if (selectedForcefields.length === 2) {
            pointA = getOrthogonalProjectionOnLine(selectedForcefields[0], start, end);
            pointB = getOrthogonalProjectionOnLine(selectedForcefields[1], start, end);

            // Compute the absolute distances from start to controlPoint1 and controlPoint2
            const distanceToPointA = start.distanceTo(pointA);
            const distanceToPointB = start.distanceTo(pointB);  

            if (distanceToPointA > distanceToPointB) {
                controlPoint1 = pointB;
                controlPoint2 = pointA;
            } 
            else {
                controlPoint1 = pointA;
                controlPoint2 = pointB;
            } 
               
        }

        const curve = new THREE.CubicBezierCurve3(
            start,
            controlPoint1,
            controlPoint2,
            end
        );

        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const bezierCurve = new THREE.Line(geometry, material);

        // Store the necessary information for updating the curve
        bezierCurve.userData = {
            start: connection.userData.start,
            end: connection.userData.end,
            controlPoint1: controlPoint1,
            controlPoint2: controlPoint2,
            curve: curve
        };

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

        scene.add(bezierCurve);
        connections.push(bezierCurve);
        ConnectionCurve.push(bezierCurve); // Save the Bezier curve in ConnectionCurve
    });

    // Clear the selected connections after creating the Bezier curves
    selectedConnections = [];
}



function getOrthogonalProjectionOnLine(center, start, end, forcefieldDiameter) {
    // Define the direction vector of the line
    const lineDirection = new THREE.Vector3().subVectors(end, start).normalize();

    // Calculate the vector from the start point to the center
    const startToCenter = new THREE.Vector3().subVectors(center, start);

    // Project the vector from the start point to the center onto the direction vector of the line
    const projectionLength = startToCenter.dot(lineDirection);
    const projectionVector = lineDirection.multiplyScalar(projectionLength);

    // Add the projection vector to the start point to get the orthogonal projection
    const orthogonalProjection = new THREE.Vector3().addVectors(start, projectionVector);

    // Define the line through the orthogonal projection of the center and the center
    const centerToProjection = new THREE.Vector3().subVectors(orthogonalProjection, center).normalize();

    // Calculate the new point by adding half of the diameter of the forcefield to the center in the direction of the orthogonal projection
    const halfDiameter = forcefieldDiameter / 2;
    const newPoint = new THREE.Vector3().addVectors(center, centerToProjection.multiplyScalar(halfDiameter));

    return newPoint;
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


function onPointerDown(event) {
    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersected objects
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check for forcefield selection
    if (forcefields) {
        const forcefieldsIntersects = raycaster.intersectObjects(forcefields);
        if (forcefieldsIntersects.length > 0) {
            const newSelectedForcefield = forcefieldsIntersects[0].object;
            selectForcefield(newSelectedForcefield, event.shiftKey);
            return;
        }
    }

    // Point selection logic
    if (pointObjects) {
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
            // Attach transform controls to the point if only one point is selected
            if (selectedPoints.length === 1) {
                transformControls.attach(selectedPoints[0]);
            } else {
                transformControls.detach();
            }
            // Update and display the position box
            updatePositionBox(selectedPoint);
            return;
        }
    }

    // Connection selection logic
    if (connections) {
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
            return;
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
                if (connection.userData.start.position && connection.userData.end.position) {
                    // Recalculate control points if forcefields are moved
                    if (selectedForcefields.length === 1) {
                        connection.userData.controlPoint1 = getOrthogonalProjectionOnLine(
                            selectedForcefields[0].position,
                            connection.userData.start.position,
                            connection.userData.end.position,
                            selectedForcefields[0].userData.diameter
                        );
                        connection.userData.controlPoint2 = connection.userData.controlPoint1;
                    } else if (selectedForcefields.length === 2) {
                        connection.userData.controlPoint1 = getOrthogonalProjectionOnLine(
                            selectedForcefields[0].position,
                            connection.userData.start.position,
                            connection.userData.end.position,
                            selectedForcefields[0].userData.diameter
                        );
                        connection.userData.controlPoint2 = getOrthogonalProjectionOnLine(
                            selectedForcefields[1].position,
                            connection.userData.start.position,
                            connection.userData.end.position,
                            selectedForcefields[1].userData.diameter
                        );
                    }

                    curve.v0.copy(connection.userData.start.position);
                    curve.v1.copy(connection.userData.controlPoint1);
                    curve.v2.copy(connection.userData.controlPoint2);
                    curve.v3.copy(connection.userData.end.position);

                    const points = curve.getPoints(50);
                    connection.geometry.setFromPoints(points);
                }
            } else {
                // Update the straight line connection
                const points = connection.geometry.attributes.position.array;
                const start = connection.userData.start.position;
                const end = connection.userData.end.position;

                if (start && end) {
                    points[0] = start.x;
                    points[1] = start.y;
                    points[2] = start.z;
                    points[3] = end.x;
                    points[4] = end.y;
                    points[5] = end.z;

                    connection.geometry.attributes.position.needsUpdate = true;
                }
            }
        }
    });

    // Update animation mixer
    if (mixer) {
        mixer.update(clock.getDelta()); // Use clock to get delta time
    }

    controls.update();
    renderer.render(scene, camera);
}

// Render the scene
function render() {
    renderer.render(scene, camera);
}