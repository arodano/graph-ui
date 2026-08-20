export function createGroundPlane(scene) {
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, scene);
    ground.isVisible  = false;
    ground.isPickable = true;
    return ground;
}

export function createBaseScene(engine) {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.015, 0.018, 0.028, 1);
    return scene;
}

export function createGlowLayer(scene) {
    const gl = new BABYLON.GlowLayer("glow", scene);
    gl.intensity = 0.55;
    return gl;
}

export function createLights(scene) {
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.75;

    const point = new BABYLON.PointLight("point", new BABYLON.Vector3(0, 12, 0), scene);
    point.intensity = 0.45;
}

export function createGrid(scene) {
    const lines = [];
    for (let i = -50; i <= 50; i += 2) {
        lines.push([new BABYLON.Vector3(i, 0, -50), new BABYLON.Vector3(i, 0, 50)]);
        lines.push([new BABYLON.Vector3(-50, 0, i), new BABYLON.Vector3(50, 0, i)]);
    }
    const grid = BABYLON.MeshBuilder.CreateLineSystem("grid", { lines }, scene);
    grid.color = new BABYLON.Color3(0.035, 0.045, 0.065);
}
