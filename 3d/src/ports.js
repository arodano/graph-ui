import { CARD_WIDTH, CARD_THICKNESS, NODE_COLORS } from "./config.js";

const PORT_DIAM = 0.32;
const PORT_H    = 0.09;
const CAP_DIAM  = 0.15;
const CAP_H     = 0.025;

export function addPorts(scene, node) {
    node.inputPort  = _createPort(scene, `${node.id}_in`,  node, -CARD_WIDTH / 2, "input");
    node.outputPort = _createPort(scene, `${node.id}_out`, node,  CARD_WIDTH / 2, "output");
}

function _createPort(scene, name, node, offsetX, type) {
    const nodeColor = NODE_COLORS[node.type];
    const baseY     = CARD_THICKNESS + PORT_H / 2 + 0.02;

    // Dark metallic body
    const cyl = BABYLON.MeshBuilder.CreateCylinder(name, {
        height: PORT_H, diameter: PORT_DIAM, tessellation: 16
    }, scene);
    cyl.parent = node.root;
    cyl.position.set(offsetX, baseY, 0);

    const bodyMat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    bodyMat.diffuseColor  = nodeColor.scale(0.10);
    bodyMat.emissiveColor = nodeColor.scale(0.06);
    bodyMat.specularColor = new BABYLON.Color3(0.30, 0.33, 0.40);
    bodyMat.specularPower = 48;
    cyl.material = bodyMat;

    // Small indicator cap: output uses the node's accent color, input is a neutral cool dot
    const capColor = type === "output"
        ? nodeColor.scale(0.65)
        : new BABYLON.Color3(0.28, 0.55, 0.85);

    const cap = BABYLON.MeshBuilder.CreateCylinder(`${name}_cap`, {
        height: CAP_H, diameter: CAP_DIAM, tessellation: 16
    }, scene);
    cap.parent = node.root;
    cap.position.set(offsetX, CARD_THICKNESS + PORT_H + 0.02 + CAP_H / 2, 0);

    const capMat = new BABYLON.StandardMaterial(`${name}_cap_mat`, scene);
    capMat.diffuseColor  = capColor.scale(0.5);
    capMat.emissiveColor = capColor;
    capMat.specularColor = BABYLON.Color3.Black();
    cap.material = capMat;

    cyl.metadata = { isPort: true, portType: type, node };
    cap.metadata = { isPort: true, portType: type, node };
    cyl.renderingGroupId = 1;
    cap.renderingGroupId = 1;
    return cyl;
}
