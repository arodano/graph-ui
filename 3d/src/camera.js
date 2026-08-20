// Final locked orientation: near-top with slight tilt for better 3D depth perception
const ALPHA_LOCKED = -Math.PI / 2;
const BETA_LOCKED  = 0.22;
const RADIUS_LOCKED = 100;

export function createIsometricCamera(scene, canvas) {
    const camera = new BABYLON.ArcRotateCamera(
        "camera", ALPHA_LOCKED, BETA_LOCKED, RADIUS_LOCKED,
        new BABYLON.Vector3(2, 0, 5), scene
    );

    camera.inputs.clear();
    camera._lockOrientation = true; // disabled during intro, re-enabled on finish

    scene.registerBeforeRender(() => {
        if (camera._lockOrientation) {
            camera.alpha = ALPHA_LOCKED;
            camera.beta  = BETA_LOCKED;
        }
        if (camera.target.y < 0) camera.target.y = 0;
    });

    _setupOrthographicZoom(camera, canvas);
    _setupCameraPan(camera, canvas, scene);
    return camera;
}

export function playIntroAnimation(camera, scene) {
    const fps      = 60;
    const endFrame = fps * 2.0; // 2-second sweep

    const finalTarget = camera.target.clone();
    const startTarget = finalTarget.add(new BABYLON.Vector3(-6, 8, -10));
    const startAlpha = ALPHA_LOCKED + 0.35;
    const startBeta = Math.PI / 3;
    const startRadius = 125;

    camera._lockOrientation = false;
    camera.alpha = startAlpha;
    camera.beta  = startBeta;
    camera.radius = startRadius;
    camera.target = startTarget;

    const ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

    const animAlpha = new BABYLON.Animation(
        "introAlpha", "alpha", fps,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animAlpha.setKeys([
        { frame: 0,        value: startAlpha },
        { frame: endFrame, value: ALPHA_LOCKED }
    ]);
    animAlpha.setEasingFunction(ease);

    const animBeta = new BABYLON.Animation(
        "introBeta", "beta", fps,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animBeta.setKeys([
        { frame: 0,        value: startBeta },
        { frame: endFrame, value: BETA_LOCKED  }
    ]);
    animBeta.setEasingFunction(ease);

    const animRadius = new BABYLON.Animation(
        "introRadius", "radius", fps,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animRadius.setKeys([
        { frame: 0,        value: startRadius },
        { frame: endFrame, value: RADIUS_LOCKED }
    ]);
    animRadius.setEasingFunction(ease);

    const animTarget = new BABYLON.Animation(
        "introTarget", "target", fps,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animTarget.setKeys([
        { frame: 0,        value: startTarget },
        { frame: endFrame, value: finalTarget }
    ]);
    animTarget.setEasingFunction(ease);

    camera.animations = [animAlpha, animBeta, animRadius, animTarget];
    scene.beginAnimation(camera, 0, endFrame, false, 1, () => {
        camera.beta             = BETA_LOCKED;
        camera.alpha            = ALPHA_LOCKED;
        camera.radius           = RADIUS_LOCKED;
        camera.target           = finalTarget;
        camera._lockOrientation = true;
        camera.animations       = [];
    });
}

export function resetCamera(camera) {
    // Reset camera to default position and target
    camera.alpha = ALPHA_LOCKED;
    camera.beta = BETA_LOCKED;
    camera.radius = RADIUS_LOCKED;
    camera.target = new BABYLON.Vector3(2, 0, 5);
    
    // Also reset orthographic zoom if applicable
    if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
        if (camera._updateOrtho) {
            camera._updateOrtho();
        }
    }
}

function _setupCameraPan(camera, canvas, scene) {
    let leftDown      = false;
    let rightDown     = false;
    let lastX         = 0;
    let lastY         = 0;
    let blockedByMesh = false;

    // Registered before interaction observers so blockedByMesh is set first on POINTERDOWN
    scene.onPointerObservable.add((info) => {
        const ev = info.type;
        const e  = info.event;

        if (ev === BABYLON.PointerEventTypes.POINTERDOWN) {
            const m = info.pickInfo?.pickedMesh?.metadata;
            blockedByMesh = !!(m?.isPort || m?.isNodeHit || m?.isEdgePick
                             || m?.isPlayButton || m?.isPacket);
            lastX = e.clientX;
            lastY = e.clientY;
            if (e.button === 0) leftDown  = true;
            if (e.button === 1 || e.button === 2) rightDown = true;
        }

        if (ev === BABYLON.PointerEventTypes.POINTERMOVE) {
            const shouldPan = (leftDown && !blockedByMesh) || rightDown;
            if (!shouldPan) return;

            // Pick the ground plane at both positions to get exact world-space delta
            // This gives correct grab-feel for any camera orientation without manual math
            const p1 = scene.pick(lastX,       lastY,       m => m.name === "ground");
            const p2 = scene.pick(e.clientX,   e.clientY,   m => m.name === "ground");
            lastX = e.clientX;
            lastY = e.clientY;

            if (p1.hit && p2.hit) {
                camera.target.x -= p2.pickedPoint.x - p1.pickedPoint.x;
                camera.target.z -= p2.pickedPoint.z - p1.pickedPoint.z;
            }
        }

        if (ev === BABYLON.PointerEventTypes.POINTERUP) {
            if (e.button === 0) leftDown  = false;
            if (e.button === 1 || e.button === 2) rightDown = false;
            if (!leftDown && !rightDown) blockedByMesh = false;
        }
    });

    window.addEventListener("pointerup", (e) => {
        if (e.button === 0) leftDown  = false;
        if (e.button === 1 || e.button === 2) rightDown = false;
        if (!leftDown && !rightDown) blockedByMesh = false;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function _setupOrthographicZoom(camera, canvas) {
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    let zoom = 1;
    const BASE_ORTHO_HEIGHT = 13; // smaller = more zoom, cards more readable

    function updateOrtho() {
        const aspect = camera.getEngine().getAspectRatio(camera);
        const orthoHeight = BASE_ORTHO_HEIGHT * zoom;
        const orthoWidth = orthoHeight * aspect;

        // Ensure (width / height) exactly matches viewport aspect ratio.
        camera.orthoLeft   = -orthoWidth / 2;
        camera.orthoRight  =  orthoWidth / 2;
        camera.orthoTop    =  orthoHeight / 2;
        camera.orthoBottom = -orthoHeight / 2;
    }
    updateOrtho();

    // Re-apply ortho bounds when the render size changes.
    camera._updateOrtho = updateOrtho;

    let lastWidth = camera.getEngine().getRenderWidth();
    let lastHeight = camera.getEngine().getRenderHeight();
    camera.getScene().registerBeforeRender(() => {
        const width = camera.getEngine().getRenderWidth();
        const height = camera.getEngine().getRenderHeight();
        if (width !== lastWidth || height !== lastHeight) {
            lastWidth = width;
            lastHeight = height;
            updateOrtho();
        }
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        zoom *= e.deltaY > 0 ? 1.1 : 0.9;
        zoom = Math.max(0.15, Math.min(4.0, zoom)); // Cambiado de 0.35-3.5 a 0.15-4.0 para más rango de zoom
        updateOrtho();
    }, { passive: false });
}
