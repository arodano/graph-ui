import { CARD_WIDTH, CARD_DEPTH, CARD_THICKNESS, NODE_COLORS } from "./config.js";
import { createCardTexture } from "./materials.js";
import { darken } from "./utils.js";
import { addPorts } from "./ports.js";
import { addPlayButton } from "./packets.js";

const CORNER_RADIUS = 0.22;

export function createNode(scene, node, state) {
    const color = NODE_COLORS[node.type];

    // Root transform so card + cylinders move together
    const root = new BABYLON.TransformNode(`${node.id}_root`, scene);
    root.position.set(node.position.x, node.position.y, node.position.z);

    const bodyMat = new BABYLON.StandardMaterial(`${node.id}_bodymat`, scene);
    bodyMat.diffuseColor  = darken(color, 0.18);
    bodyMat.emissiveColor = darken(color, 0.04);
    bodyMat.specularColor = BABYLON.Color3.Black();

    // Central box narrowed so cylinders fill the corners flush
    const R  = CORNER_RADIUS;
    const box = BABYLON.MeshBuilder.CreateBox(`${node.id}_box`, {
        width:  CARD_WIDTH  - R * 2,
        height: CARD_THICKNESS,
        depth:  CARD_DEPTH  - R * 2
    }, scene);
    box.parent     = root;
    box.position.y = CARD_THICKNESS / 2;
    box.material   = bodyMat;

    // Side slabs to fill the flat edges between corners
    const slabH = BABYLON.MeshBuilder.CreateBox(`${node.id}_slabH`, {
        width:  CARD_WIDTH - R * 2,
        height: CARD_THICKNESS,
        depth:  R * 2
    }, scene);
    slabH.parent   = root;
    slabH.position.y = CARD_THICKNESS / 2;

    const slabHB = slabH.createInstance(`${node.id}_slabHB`);
    slabHB.parent   = root;
    slabHB.position = new BABYLON.Vector3(0, CARD_THICKNESS / 2,  -(CARD_DEPTH / 2 - R));
    slabH.position  = new BABYLON.Vector3(0, CARD_THICKNESS / 2,   (CARD_DEPTH / 2 - R));

    const slabV = BABYLON.MeshBuilder.CreateBox(`${node.id}_slabV`, {
        width:  R * 2,
        height: CARD_THICKNESS,
        depth:  CARD_DEPTH - R * 2
    }, scene);
    slabV.parent   = root;

    const slabVB = slabV.createInstance(`${node.id}_slabVB`);
    slabVB.parent   = root;
    slabVB.position = new BABYLON.Vector3( (CARD_WIDTH / 2 - R), CARD_THICKNESS / 2, 0);
    slabV.position  = new BABYLON.Vector3(-(CARD_WIDTH / 2 - R), CARD_THICKNESS / 2, 0);

    // Quarter-cylinder at each corner
    const cornerPositions = [
        [ CARD_WIDTH / 2 - R,  CARD_DEPTH / 2 - R],
        [-CARD_WIDTH / 2 + R,  CARD_DEPTH / 2 - R],
        [-CARD_WIDTH / 2 + R, -CARD_DEPTH / 2 + R],
        [ CARD_WIDTH / 2 - R, -CARD_DEPTH / 2 + R],
    ];
    const cornerAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

    cornerPositions.forEach(([cx, cz], i) => {
        const cyl = BABYLON.MeshBuilder.CreateCylinder(`${node.id}_corner${i}`, {
            height:          CARD_THICKNESS,
            diameter:        R * 2,
            tessellation:    20,
            arc:             0.25  // quarter circle
        }, scene);
        cyl.parent     = root;
        cyl.position   = new BABYLON.Vector3(cx, CARD_THICKNESS / 2, cz);
        cyl.rotation.y = cornerAngles[i];
        cyl.material   = bodyMat;
        cyl.metadata   = { isNodeHit: true, node };
    });

    [box, slabH, slabHB, slabV, slabVB].forEach(m => {
        m.material = bodyMat;
        m.metadata  = { isNodeHit: true, node };
    });

    // Draggable face mesh (the box is the pick target)
    const face = BABYLON.MeshBuilder.CreatePlane(`${node.id}_face`, {
        width:  CARD_WIDTH,
        height: CARD_DEPTH
    }, scene);
    face.parent     = root;
    face.position.y = CARD_THICKNESS + 0.006;
    face.rotation.x = Math.PI / 2;

    const texture = createCardTexture(scene, node);
    const faceMat = new BABYLON.StandardMaterial(`${node.id}_facemat`, scene);
    faceMat.diffuseTexture             = texture;
    faceMat.useAlphaFromDiffuseTexture = true;
    faceMat.emissiveColor              = new BABYLON.Color3(0.22, 0.22, 0.22);
    faceMat.specularColor              = BABYLON.Color3.Black();
    faceMat.backFaceCulling            = false;
    face.material                      = faceMat;

    // face is purely visual — hit plane handles all picking
    face.isPickable = false;

    const gl = scene.effectLayers?.find(l => l.name === "glow");
    if (gl) {
        [box, slabH, slabHB, slabV, slabVB, face].forEach(m => gl.addExcludedMesh(m));
    }

    node.root = root;
    node.face = face;
    state.nodesById[node.id] = node;
    addPorts(scene, node);
    addPlayButton(scene, node);

    _setupHitPlane(node, scene);
    return node;
}

function _setupHitPlane(node, scene) {
    // Narrower than card so port cylinders at ±CARD_WIDTH/2 are not obstructed
    const hit = BABYLON.MeshBuilder.CreatePlane(`${node.id}_hit`, {
        width: CARD_WIDTH - 1.0, height: CARD_DEPTH + 0.4
    }, scene);
    hit.isVisible = false;
    hit.position.set(node.position.x, node.position.y + CARD_THICKNESS + 0.01, node.position.z);
    hit.rotation.x = Math.PI / 2;
    hit.metadata = { isNodeHit: true, node };
    node.hitPlane = hit;
}
