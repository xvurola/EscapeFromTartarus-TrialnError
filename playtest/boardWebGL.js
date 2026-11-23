// ============================================================================
// ESCAPE FROM TARTARUS - ON-DEMAND LIGHTWEIGHT BOARD VFX ENGINE
// Burst-only Canvas 2D at 1x DPR. Stays hidden (0% CPU/GPU) when idle.
// ============================================================================
(function () {
  "use strict";

  const MAX_PARTICLES = 96;

  function hexToRgb255(hex) {
    const clean = String(hex || "#9fd6be").replace("#", "").trim();
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16),
        parseInt(clean[1] + clean[1], 16),
        parseInt(clean[2] + clean[2], 16)
      ];
    }
    if (clean.length === 6) {
      const n = parseInt(clean, 16);
      if (!Number.isNaN(n)) {
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
    }
    return [159, 214, 190];
  }

  function isReducedMotionPreferred() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  const engine = {
    canvas: null,
    viewportEl: null,
    ctx2d: null,
    simViewEl: null,
    particles: [],
    boardW: 2970,
    boardH: 1998,
    getCamera: null,
    getTileMap: null,
    rafId: null,
    lastTime: 0,
    hitStopActive: false,
    rendererKind: "none",
    viewW: 1,
    viewH: 1,
    isVisible: false
  };

  function isArenaVisible() {
    if (!engine.simViewEl) {
      engine.simViewEl = document.getElementById("view-simulator");
    }
    return !engine.simViewEl || engine.simViewEl.classList.contains("active");
  }

  function setCanvasVisible(visible) {
    if (!engine.canvas || engine.isVisible === visible) return;
    engine.isVisible = visible;
    engine.canvas.style.display = visible ? "block" : "none";
  }

  function resize() {
    if (!engine.canvas || !engine.viewportEl) return;
    const w = Math.max(1, Math.round(engine.viewportEl.clientWidth || window.innerWidth));
    const h = Math.max(1, Math.round(engine.viewportEl.clientHeight || window.innerHeight));
    engine.viewW = w;
    engine.viewH = h;
    if (engine.canvas.width !== w || engine.canvas.height !== h) {
      engine.canvas.width = w;
      engine.canvas.height = h;
    }
  }

  function getTileBoardCoords(tileId) {
    if (!engine.getTileMap || !tileId) return null;
    const map = engine.getTileMap();
    const t = map && map[tileId];
    if (!t) return null;
    return {
      wx: (t.x / 100) * engine.boardW,
      wy: (t.y / 100) * engine.boardH
    };
  }

  function spawnParticle(p) {
    if (!engine.ctx2d || !isArenaVisible()) return;
    if (engine.particles.length >= MAX_PARTICLES) {
      engine.particles.shift();
    }
    engine.particles.push({
      wx: p.wx,
      wy: p.wy,
      vx: p.vx || 0,
      vy: p.vy || 0,
      drag: p.drag !== undefined ? p.drag : 0.92,
      gravity: p.gravity || 0,
      sizeStart: p.sizeStart || 14,
      sizeEnd: p.sizeEnd !== undefined ? p.sizeEnd : 2,
      alphaStart: p.alphaStart !== undefined ? p.alphaStart : 0.9,
      alphaEnd: p.alphaEnd !== undefined ? p.alphaEnd : 0,
      color: p.color || [159, 214, 190],
      shape: p.shape || 0,
      age: 0,
      life: Math.max(0.08, p.life || 0.45)
    });
    ensureLoopRunning();
  }

  function burstAtTile(tileId, kind = "skill_cast", customColorHex = null) {
    if (!engine.ctx2d || !isArenaVisible() || isReducedMotionPreferred()) return;
    const pos = getTileBoardCoords(tileId);
    if (!pos) return;

    if (kind === "sam_fire_impact") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 36,
        sizeEnd: 220,
        alphaStart: 0.92,
        alphaEnd: 0,
        color: [252, 142, 42],
        shape: 1,
        life: 0.52
      });
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 240;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 36,
          drag: 0.9,
          gravity: -90,
          sizeStart: 10 + Math.random() * 14,
          sizeEnd: 2,
          alphaStart: 0.92,
          alphaEnd: 0,
          color: i % 3 === 0 ? [255, 228, 108] : [249, 115, 22],
          life: 0.36 + Math.random() * 0.28
        });
      }
      return;
    }

    if (kind === "shard_claim") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 30,
        sizeEnd: 235,
        alphaStart: 0.9,
        alphaEnd: 0,
        color: [245, 204, 68],
        shape: 1,
        life: 0.58
      });
      for (let i = 0; i < 28; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 250;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 24,
          drag: 0.91,
          gravity: 45,
          sizeStart: 10 + Math.random() * 14,
          sizeEnd: 2,
          alphaStart: 0.92,
          alphaEnd: 0,
          color: i % 2 === 0 ? [245, 204, 68] : [192, 132, 252],
          life: 0.4 + Math.random() * 0.32
        });
      }
      return;
    }

    if (kind === "warp_burst") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 24,
        sizeEnd: 175,
        alphaStart: 0.85,
        alphaEnd: 0,
        color: [88, 210, 250],
        shape: 1,
        life: 0.44
      });
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2;
        const spd = 75 + Math.random() * 165;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.9,
          sizeStart: 9 + Math.random() * 10,
          sizeEnd: 2,
          alphaStart: 0.88,
          alphaEnd: 0,
          color: [106, 220, 250],
          life: 0.34 + Math.random() * 0.24
        });
      }
      return;
    }

    if (kind === "push_impact") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 24,
        sizeEnd: 165,
        alphaStart: 0.88,
        alphaEnd: 0,
        color: [244, 66, 98],
        shape: 1,
        life: 0.42
      });
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 85 + Math.random() * 190;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.89,
          sizeStart: 9 + Math.random() * 10,
          sizeEnd: 2,
          alphaStart: 0.9,
          alphaEnd: 0,
          color: [248, 86, 114],
          life: 0.3 + Math.random() * 0.22
        });
      }
      return;
    }

    if (kind === "coin_gain" || kind === "coin_loss") {
      const col = kind === "coin_gain" ? [245, 204, 68] : [242, 82, 108];
      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 45 + Math.random() * 95;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 50,
          drag: 0.92,
          gravity: 110,
          sizeStart: 8 + Math.random() * 6,
          sizeEnd: 2,
          alphaStart: 0.85,
          alphaEnd: 0,
          color: col,
          life: 0.32 + Math.random() * 0.2
        });
      }
      return;
    }

    const rgb = hexToRgb255(customColorHex || "#9fd6be");
    spawnParticle({
      wx: pos.wx,
      wy: pos.wy,
      sizeStart: 22,
      sizeEnd: 145,
      alphaStart: 0.78,
      alphaEnd: 0,
      color: rgb,
      shape: 1,
      life: 0.4
    });
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 145;
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.91,
        sizeStart: 8 + Math.random() * 9,
        sizeEnd: 2,
        alphaStart: 0.84,
        alphaEnd: 0,
        color: rgb,
        life: 0.3 + Math.random() * 0.22
      });
    }
  }

  function emitMoveTrail(fromTileId, toTileId, colorHex = "#9fd6be") {
    if (!engine.ctx2d || !isArenaVisible() || isReducedMotionPreferred()) return;
    const a = getTileBoardCoords(fromTileId);
    const b = getTileBoardCoords(toTileId);
    if (!a || !b) return;
    const rgb = hexToRgb255(colorHex);
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      spawnParticle({
        wx: a.wx + (b.wx - a.wx) * t,
        wy: a.wy + (b.wy - a.wy) * t,
        vx: (Math.random() - 0.5) * 18,
        vy: -16 - Math.random() * 20,
        drag: 0.91,
        sizeStart: 8 + Math.random() * 5,
        sizeEnd: 2,
        alphaStart: 0.68,
        alphaEnd: 0,
        color: rgb,
        life: 0.26 + t * 0.14
      });
    }
  }

  // Intentionally a no-op: shards and board traps use crisp CSS markers with 0 FPS background cost.
  function syncAmbientAnchors() {}

  function renderFrame(now) {
    engine.rafId = null;
    if (!engine.canvas || !engine.ctx2d) return;

    if (!isArenaVisible() || engine.particles.length === 0) {
      engine.particles.length = 0;
      engine.ctx2d.clearRect(0, 0, engine.canvas.width, engine.canvas.height);
      setCanvasVisible(false);
      return;
    }

    if (!engine.lastTime) engine.lastTime = now;
    const rawDt = Math.min(0.05, Math.max(0.001, (now - engine.lastTime) / 1000));
    engine.lastTime = now;

    if (!engine.hitStopActive) {
      for (let i = engine.particles.length - 1; i >= 0; i--) {
        const p = engine.particles[i];
        p.age += rawDt;
        if (p.age >= p.life) {
          engine.particles.splice(i, 1);
          continue;
        }
        const damp = Math.pow(p.drag, rawDt * 60);
        p.vx *= damp;
        p.vy = p.vy * damp + p.gravity * rawDt;
        p.wx += p.vx * rawDt;
        p.wy += p.vy * rawDt;
      }
    }

    const ctx = engine.ctx2d;
    ctx.clearRect(0, 0, engine.canvas.width, engine.canvas.height);

    if (engine.particles.length === 0) {
      setCanvasVisible(false);
      return;
    }

    const cam = engine.getCamera ? engine.getCamera() : { panX: 0, panY: 0, zoom: 1, shakeX: 0, shakeY: 0 };
    const cx = engine.viewW * 0.5;
    const cy = engine.viewH * 0.5;
    const halfBW = engine.boardW * 0.5;
    const halfBH = engine.boardH * 0.5;
    const zoom = cam ? cam.zoom : 1;
    const sizeZoom = Math.max(0.4, zoom);
    const panX = cam ? cam.panX + (cam.shakeX || 0) : 0;
    const panY = cam ? cam.panY + (cam.shakeY || 0) : 0;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < engine.particles.length; i++) {
      const p = engine.particles[i];
      const t = Math.min(1, p.age / p.life);
      const sx = cx + panX + (p.wx - halfBW) * zoom;
      const sy = cy + panY + (p.wy - halfBH) * zoom;
      if (sx < -260 || sx > engine.viewW + 260 || sy < -260 || sy > engine.viewH + 260) continue;
      const radius = Math.max(1.5, (p.sizeStart + (p.sizeEnd - p.sizeStart) * t) * 0.5 * sizeZoom);
      const alpha = Math.max(0, p.alphaStart + (p.alphaEnd - p.alphaStart) * t);
      const col = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      if (p.shape > 0.5) {
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(2)})`;
        ctx.lineWidth = Math.max(2, radius * 0.12);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(alpha * 0.85).toFixed(2)})`;
        ctx.fill();
      }
    }
    ctx.restore();

    engine.rafId = requestAnimationFrame(renderFrame);
  }

  function ensureLoopRunning() {
    if (!engine.canvas || !engine.ctx2d) return;
    setCanvasVisible(true);
    if (!engine.rafId) {
      engine.lastTime = performance.now();
      engine.rafId = requestAnimationFrame(renderFrame);
    }
  }

  function init(viewportEl, boardW, boardH, getCameraFn, getTileMapFn) {
    if (!viewportEl) return;
    engine.viewportEl = viewportEl;
    engine.boardW = boardW || 2970;
    engine.boardH = boardH || 1998;
    engine.getCamera = getCameraFn;
    engine.getTileMap = getTileMapFn;
    engine.simViewEl = document.getElementById("view-simulator");

    let canvas = document.getElementById("board-webgl-vfx");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "board-webgl-vfx";
      canvas.className = "board-webgl-vfx";
      canvas.setAttribute("aria-hidden", "true");
      viewportEl.appendChild(canvas);
    }
    engine.canvas = canvas;
    engine.canvas.style.display = "none";
    engine.isVisible = false;

    engine.ctx2d = canvas.getContext("2d", { alpha: true });
    engine.rendererKind = engine.ctx2d ? "canvas2d_ondemand" : "none";
    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 160), { passive: true });
  }

  window.EFT_WEBGL_VFX = {
    init,
    resize,
    burstAtTile,
    emitMoveTrail,
    syncAmbientAnchors,
    setHitStopActive(active) {
      engine.hitStopActive = Boolean(active);
    },
    getRendererKind() {
      return engine.rendererKind;
    }
  };
})();
