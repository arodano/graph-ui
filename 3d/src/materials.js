import { NODE_COLORS, TYPE_META } from "./config.js";
import { hex, roundRect }         from "./utils.js";

const W = 1040;
const H = 540;
const R = 44;   // corner radius
const P = 38;   // horizontal padding

export function createCardTexture(scene, node) {
    const texture = new BABYLON.DynamicTexture(`${node.id}_tex`, { width: W, height: H }, scene, false);
    texture.hasAlpha = true;
    _drawCard(texture.getContext(), node);
    texture.update();
    return texture;
}

function _drawCard(ctx, node) {
    const meta = TYPE_META[node.type];
    const cHex = hex(NODE_COLORS[node.type]);

    ctx.clearRect(0, 0, W, H);

    // ── Clip all drawing to rounded rect ──────────────────────────
    ctx.save();
    roundRect(ctx, 0, 0, W, H, R);
    ctx.clip();

    // Background
    ctx.fillStyle = "#080C15";
    ctx.fillRect(0, 0, W, H);

    // Left accent bar
    ctx.fillStyle = cHex;
    ctx.fillRect(0, 0, 6, H);

    // Subtle header gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 130);
    grad.addColorStop(0, cHex + "28");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(6, 0, W - 6, 130);

    // ── Type badge ────────────────────────────────────────────────
    ctx.font = "700 22px 'Courier New', monospace";
    const badgeW = ctx.measureText(meta.abbr).width + 30;
    const badgeX = P + 6;
    const badgeY = 28;
    const badgeH = 44;

    ctx.fillStyle = cHex + "38";
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 9);
    ctx.fill();

    ctx.fillStyle    = cHex;
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.abbr, badgeX + 15, badgeY + badgeH / 2);

    ctx.font      = "600 17px Arial";
    ctx.fillStyle = "#4E6880";
    ctx.fillText(meta.label, badgeX + badgeW + 16, badgeY + badgeH / 2);

    // ── Node name ─────────────────────────────────────────────────
    ctx.font         = "700 48px Arial";
    ctx.fillStyle    = "#D8E6F4";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(_truncate(ctx, node.name, W - P * 2 - 6), P + 6, 168);

    // ── Divider 1 ─────────────────────────────────────────────────
    ctx.fillStyle = "#18202E";
    ctx.fillRect(P, 185, W - P * 2, 1.5);

    // ── Property row ──────────────────────────────────────────────
    ctx.font      = "600 18px 'Courier New', monospace";
    ctx.fillStyle = "#344F6A";
    ctx.textAlign = "left";
    ctx.fillText(node.property.toUpperCase(), P + 6, 227);

    ctx.font      = "500 21px Arial";
    ctx.fillStyle = "#90AECA";
    ctx.textAlign = "right";
    ctx.fillText(_truncate(ctx, String(node.value), W / 2), W - P, 227);

    // Description row
    if (node.description) {
        ctx.font      = "600 17px 'Courier New', monospace";
        ctx.fillStyle = "#2A3F58";
        ctx.textAlign = "left";
        ctx.fillText("DESCRIPTION", P + 6, 268);

        ctx.font      = "500 18px Arial";
        ctx.fillStyle = "#5E7A96";
        ctx.textAlign = "right";
        ctx.fillText(_truncate(ctx, node.description, W / 2), W - P, 268);
    }

    // ── Divider 2 ─────────────────────────────────────────────────
    ctx.fillStyle = "#18202E";
    ctx.fillRect(P, 295, W - P * 2, 1.5);

    // ── Metadata ──────────────────────────────────────────────────
    ctx.font      = "700 14px 'Courier New', monospace";
    ctx.fillStyle = "#243040";
    ctx.textAlign = "left";
    ctx.fillText("METADATA", P + 6, 322);

    Object.entries(node.metadata).forEach(([key, val], i) => {
        const y = 360 + i * 44;
        ctx.font      = "600 16px 'Courier New', monospace";
        ctx.fillStyle = "#30485E";
        ctx.textAlign = "left";
        ctx.fillText(key.toUpperCase(), P + 6, y);

        ctx.font      = "500 18px Arial";
        ctx.fillStyle = "#6E8EAC";
        ctx.textAlign = "right";
        ctx.fillText(_truncate(ctx, String(val), W / 2), W - P, y);
    });

    ctx.restore();

    // ── Border (outside clip so it sits on the rounded edge) ──────
    ctx.strokeStyle = cHex + "55";
    ctx.lineWidth   = 2.5;
    roundRect(ctx, 1.5, 1.5, W - 3, H - 3, R);
    ctx.stroke();
}

function _truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + "\u2026").width > maxWidth) t = t.slice(0, -1);
    return t + "\u2026";
}
