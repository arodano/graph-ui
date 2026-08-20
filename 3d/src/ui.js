export function createUI(scene) {
    const ui    = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const title = new BABYLON.GUI.TextBlock();

    title.text      = "SETTLEMENT GRAPH";
    title.color     = "#E8EDF6";
    title.fontSize  = 22;
    title.width     = "420px";
    title.height    = "35px";
    title.left      = "26px";
    title.top       = "22px";
    title.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.verticalAlignment       = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    ui.addControl(title);
}
