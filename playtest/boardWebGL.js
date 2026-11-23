// ============================================================================
// ESCAPE FROM TARTARUS - HYBRID WEBGL BOARD VFX & PARTICLE ENGINE
// Viewport-projected WebGL point-sprite shaders with automatic Canvas2D fallback.
// ============================================================================
(function () {
  "use strict";

  const MAX_PARTICLES = 640;
  const FLOATS_PER_VERTEX = 8; // x, y, size, r, g, b, a, shape(0=soft,1=ring)

  const VERT_SRC = `
    attribute vec2 a_pos;
    attribute float a_size;
    attribute vec4 a_color;
    attribute float a_shape;
    uniform vec2 u_res;
    varying vec4 v_color;
    varying float v_shape;
    void main() {
      vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      gl_PointSize = a_size;
      v_color = a_color;
      v_shape = a_shape;
    }
  `;

  const FRAG_SRC = `
    precision mediump float;
    varying vec4 v_color;
    varying float v_shape;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float r = length(p);
      if (r > 1.0) discard;
      float alpha;
      if (v_shape > 0.5) {
        float ring = smoothstep(0.55, 0.82, r) * (1.0 - smoothstep(0.84, 1.0, r));
        float core = exp(-r * r * 6.0) * 0.25;
        alpha = (ring * 1.15 + core) * v_color.a;
      } else {
        float falloff = pow(1.0 - r, 2.1);
        alpha = falloff * v_color.a;
      }
      gl_FragColor = vec4(v_color.rgb, alpha);
    }
  `;

  function hexToRgb01(hex) {
    const clean = String(hex || "#9fd6be").replace("#", "").trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) / 255;
      const g = parseInt(clean[1] + clean[1], 16) / 255;
      const b = parseInt(clean[2] + clean[2], 16) / 255;
      return [r, g, b];
    }
    if (clean.length === 6) {
      const n = parseInt(clean, 16);
      if (!Number.isNaN(n)) {
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      }
    }
    return [0.62, 0.84, 0.75];
  }

  function isReducedMotionPreferred() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  const engine = {
    canvas: null,
    viewportEl: null,
    gl: null,
    ctx2d: null,
    program: null,
    vbo: null,
    attribs: null,
    uRes: null,
    vertexData: new Float32Array(MAX_PARTICLES * FLOATS_PER_VERTEX),
    particles: [],
    ambientAnchors: [],
    boardW: 2970,
    boardH: 1998,
    getCamera: null,
    getTileMap: null,
    rafId: null,
    lastTime: 0,
    ambientAccum: 0,
    hitStopActive: false,
    rendererKind: "none",
    dpr: 1,
    viewW: 1,
    viewH: 1
  };

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initWebGL(canvas) {
    let gl = null;
    try {
      gl =
        canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, premultipliedAlpha: false }) ||
        canvas.getContext("experimental-webgl", { alpha: true, antialias: false, depth: false });
    } catch (e) {
      gl = null;
    }
    if (!gl) return false;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return false;
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, engine.vertexData.byteLength, gl.DYNAMIC_DRAW);

    engine.gl = gl;
    engine.program = prog;
    engine.vbo = vbo;
    engine.uRes = gl.getUniformLocation(prog, "u_res");
    engine.attribs = {
      pos: gl.getAttribLocation(prog, "a_pos"),
      size: gl.getAttribLocation(prog, "a_size"),
      color: gl.getAttribLocation(prog, "a_color"),
      shape: gl.getAttribLocation(prog, "a_shape")
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    engine.rendererKind = "webgl";
    return true;
  }

  function resize() {
    if (!engine.canvas || !engine.viewportEl) return;
    const rect = engine.viewportEl.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    engine.viewW = w;
    engine.viewH = h;
    engine.dpr = dpr;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (engine.canvas.width !== pw || engine.canvas.height !== ph) {
      engine.canvas.width = pw;
      engine.canvas.height = ph;
    }
    if (engine.gl) {
      engine.gl.viewport(0, 0, pw, ph);
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
    if (engine.particles.length >= MAX_PARTICLES) {
      engine.particles.shift();
    }
    engine.particles.push({
      wx: p.wx,
      wy: p.wy,
      vx: p.vx || 0,
      vy: p.vy || 0,
      drag: p.drag !== undefined ? p.drag : 0.94,
      gravity: p.gravity || 0,
      sizeStart: p.sizeStart || 18,
      sizeEnd: p.sizeEnd !== undefined ? p.sizeEnd : 2,
      alphaStart: p.alphaStart !== undefined ? p.alphaStart : 0.95,
      alphaEnd: p.alphaEnd !== undefined ? p.alphaEnd : 0,
      color: p.color || [0.62, 0.84, 0.75],
      colorEnd: p.colorEnd || null,
      shape: p.shape || 0,
      age: 0,
      life: Math.max(0.08, p.life || 0.7)
    });
    ensureLoopRunning();
  }

  function burstAtTile(tileId, kind = "skill_cast", customColorHex = null) {
    const pos = getTileBoardCoords(tileId);
    if (!pos) return;
    const reduced = isReducedMotionPreferred();
    const scaleCount = reduced ? 0.35 : 1;

    if (kind === "sam_fire_impact") {
      // Shockwave ring
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 38,
        sizeEnd: 245,
        alphaStart: 0.95,
        alphaEnd: 0,
        color: [0.99, 0.56, 0.16],
        colorEnd: [0.88, 0.18, 0.12],
        shape: 1,
        life: 0.68
      });
      // Core flash
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 120,
        sizeEnd: 20,
        alphaStart: 0.9,
        alphaEnd: 0,
        color: [1.0, 0.92, 0.55],
        colorEnd: [0.98, 0.42, 0.12],
        shape: 0,
        life: 0.42
      });
      const count = Math.max(12, Math.round(68 * scaleCount));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 75 + Math.random() * 290;
        spawnParticle({
          wx: pos.wx + (Math.random() - 0.5) * 26,
          wy: pos.wy + (Math.random() - 0.5) * 26,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 45,
          drag: 0.91,
          gravity: -110,
          sizeStart: 14 + Math.random() * 24,
          sizeEnd: 2,
          alphaStart: 0.95,
          alphaEnd: 0,
          color: Math.random() < 0.35 ? [1.0, 0.9, 0.42] : [0.98, 0.45, 0.12],
          colorEnd: [0.82, 0.12, 0.12],
          life: 0.48 + Math.random() * 0.52
        });
      }
      return;
    }

    if (kind === "shard_claim") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 32,
        sizeEnd: 260,
        alphaStart: 0.92,
        alphaEnd: 0,
        color: [0.95, 0.78, 0.25],
        colorEnd: [0.68, 0.36, 0.98],
        shape: 1,
        life: 0.78
      });
      const count = Math.max(14, Math.round(78 * scaleCount));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 310;
        const isGold = i % 2 === 0;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 30,
          drag: 0.92,
          gravity: 50,
          sizeStart: 12 + Math.random() * 22,
          sizeEnd: 2,
          alphaStart: 0.95,
          alphaEnd: 0,
          color: isGold ? [0.96, 0.8, 0.28] : [0.76, 0.5, 0.99],
          life: 0.55 + Math.random() * 0.6
        });
      }
      return;
    }

    if (kind === "warp_burst") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 28,
        sizeEnd: 190,
        alphaStart: 0.85,
        alphaEnd: 0,
        color: [0.35, 0.82, 0.98],
        shape: 1,
        life: 0.56
      });
      const count = Math.max(10, Math.round(42 * scaleCount));
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const spd = 65 + Math.random() * 195;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.9,
          sizeStart: 12 + Math.random() * 14,
          sizeEnd: 2,
          alphaStart: 0.9,
          alphaEnd: 0,
          color: [0.42, 0.86, 0.98],
          colorEnd: [0.62, 0.86, 0.76],
          life: 0.42 + Math.random() * 0.38
        });
      }
      return;
    }

    if (kind === "push_impact") {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 26,
        sizeEnd: 185,
        alphaStart: 0.9,
        alphaEnd: 0,
        color: [0.96, 0.26, 0.38],
        shape: 1,
        life: 0.52
      });
      const count = Math.max(10, Math.round(38 * scaleCount));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 230;
        spawnParticle({
          wx: pos.wx,
          wy: pos.wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.89,
          sizeStart: 11 + Math.random() * 15,
          sizeEnd: 2,
          alphaStart: 0.92,
          alphaEnd: 0,
          color: [0.98, 0.32, 0.44],
          colorEnd: [1.0, 0.78, 0.32],
          life: 0.36 + Math.random() * 0.32
        });
      }
      return;
    }

    if (kind === "coin_gain" || kind === "coin_loss") {
      const col = kind === "coin_gain" ? [0.96, 0.8, 0.28] : [0.95, 0.32, 0.42];
      const count = Math.max(5, Math.round(16 * scaleCount));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 120;
        spawnParticle({
          wx: pos.wx + (Math.random() - 0.5) * 18,
          wy: pos.wy + (Math.random() - 0.5) * 18,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 65,
          drag: 0.93,
          gravity: 120,
          sizeStart: 10 + Math.random() * 10,
          sizeEnd: 2,
          alphaStart: 0.88,
          alphaEnd: 0,
          color: col,
          life: 0.42 + Math.random() * 0.34
        });
      }
      return;
    }

    // Default themed skill_cast / step_land
    const rgb = hexToRgb01(customColorHex || "#9fd6be");
    const isStep = kind === "step_land";
    const count = Math.max(4, Math.round((isStep ? 8 : 28) * scaleCount));
    if (!isStep) {
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        sizeStart: 24,
        sizeEnd: 155,
        alphaStart: 0.78,
        alphaEnd: 0,
        color: rgb,
        shape: 1,
        life: 0.48
      });
    }
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (isStep ? 24 : 55) + Math.random() * (isStep ? 65 : 160);
      spawnParticle({
        wx: pos.wx,
        wy: pos.wy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.91,
        sizeStart: (isStep ? 7 : 11) + Math.random() * (isStep ? 6 : 12),
        sizeEnd: 2,
        alphaStart: isStep ? 0.55 : 0.85,
        alphaEnd: 0,
        color: rgb,
        life: (isStep ? 0.25 : 0.38) + Math.random() * 0.28
      });
    }
  }

  function emitMoveTrail(fromTileId, toTileId, colorHex = "#9fd6be") {
    const a = getTileBoardCoords(fromTileId);
    const b = getTileBoardCoords(toTileId);
    if (!a || !b) return;
    const rgb = hexToRgb01(colorHex);
    const steps = isReducedMotionPreferred() ? 5 : 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wx = a.wx + (b.wx - a.wx) * t + (Math.random() - 0.5) * 14;
      const wy = a.wy + (b.wy - a.wy) * t + (Math.random() - 0.5) * 14;
      spawnParticle({
        wx,
        wy,
        vx: (Math.random() - 0.5) * 24,
        vy: -18 - Math.random() * 28,
        drag: 0.92,
        sizeStart: 10 + Math.random() * 8,
        sizeEnd: 2,
        alphaStart: 0.72,
        alphaEnd: 0,
        color: rgb,
        life: 0.34 + t * 0.22
      });
    }
  }

  function syncAmbientAnchors(activeShards = [], boardTokens = []) {
    const anchors = [];
    (activeShards || []).forEach((sh) => {
      const pos = getTileBoardCoords(sh.tileId);
      if (pos) {
        anchors.push({ wx: pos.wx, wy: pos.wy, kind: "shard", color: [0.76, 0.52, 0.99], alt: [0.96, 0.8, 0.3] });
      }
    });
    (boardTokens || []).forEach((tok) => {
      const pos = getTileBoardCoords(tok.tileId);
      if (!pos) return;
      if (tok.type === "sam_fire") {
        anchors.push({ wx: pos.wx, wy: pos.wy, kind: "fire", color: [0.98, 0.48, 0.14], alt: [1.0, 0.84, 0.34] });
      } else if (tok.type === "virus_trap") {
        anchors.push({ wx: pos.wx, wy: pos.wy, kind: "virus", color: [0.74, 0.42, 0.98], alt: [0.9, 0.65, 1.0] });
      } else if (tok.type === "herb_tile") {
        anchors.push({ wx: pos.wx, wy: pos.wy, kind: "herb", color: [0.32, 0.86, 0.64], alt: [0.64, 0.95, 0.82] });
      } else if (tok.type === "safe_zone") {
        anchors.push({ wx: pos.wx, wy: pos.wy, kind: "safe", color: [0.34, 0.78, 0.98], alt: [0.72, 0.92, 1.0] });
      }
    });
    engine.ambientAnchors = anchors;
    if (anchors.length > 0 && !isReducedMotionPreferred()) {
      ensureLoopRunning();
    }
  }

  function emitAmbientStep(dt) {
    if (engine.ambientAnchors.length === 0 || isReducedMotionPreferred()) return;
    engine.ambientAccum += dt;
    if (engine.ambientAccum < 0.14) return;
    engine.ambientAccum = 0;

    for (let i = 0; i < engine.ambientAnchors.length; i++) {
      const a = engine.ambientAnchors[i];
      if (Math.random() > (a.kind === "shard" || a.kind === "fire" ? 0.62 : 0.38)) continue;
      const spread = a.kind === "shard" ? 36 : 28;
      spawnParticle({
        wx: a.wx + (Math.random() - 0.5) * spread,
        wy: a.wy + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 18,
        vy: -24 - Math.random() * 44,
        drag: 0.97,
        sizeStart: a.kind === "shard" ? 13 : 10,
        sizeEnd: 2,
        alphaStart: 0.55,
        alphaEnd: 0,
        color: Math.random() < 0.45 ? a.alt : a.color,
        life: 0.75 + Math.random() * 0.55
      });
    }
  }

  function projectToScreen(wx, wy, cam) {
    const cx = engine.viewW * 0.5;
    const cy = engine.viewH * 0.5;
    const dx = wx - engine.boardW * 0.5;
    const dy = wy - engine.boardH * 0.5;
    const zoom = cam ? cam.zoom : 1;
    const panX = cam ? cam.panX + (cam.shakeX || 0) : 0;
    const panY = cam ? cam.panY + (cam.shakeY || 0) : 0;
    return {
      sx: cx + panX + dx * zoom,
      sy: cy + panY + dy * zoom,
      zoom
    };
  }

  function renderFrame(now) {
    engine.rafId = null;
    if (!engine.canvas) return;
    if (!engine.lastTime) engine.lastTime = now;
    const rawDt = Math.min(0.05, Math.max(0.001, (now - engine.lastTime) / 1000));
    engine.lastTime = now;

    // Skip simulation if Arena view is hidden
    const simView = document.getElementById("view-simulator");
    const isArenaVisible = !simView || simView.classList.contains("active");

    if (isArenaVisible && !engine.hitStopActive) {
      emitAmbientStep(rawDt);
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

    const cam = engine.getCamera ? engine.getCamera() : { panX: 0, panY: 0, zoom: 1, shakeX: 0, shakeY: 0 };
    const dpr = engine.dpr;

    if (engine.rendererKind === "webgl" && engine.gl) {
      const gl = engine.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const count = engine.particles.length;
      if (count > 0 && isArenaVisible) {
        let ptr = 0;
        const buf = engine.vertexData;
        for (let i = 0; i < count; i++) {
          const p = engine.particles[i];
          const t = Math.min(1, p.age / p.life);
          const pos = projectToScreen(p.wx, p.wy, cam);
          const size = Math.max(2, (p.sizeStart + (p.sizeEnd - p.sizeStart) * t) * Math.max(0.35, pos.zoom) * dpr);
          const alpha = Math.max(0, p.alphaStart + (p.alphaEnd - p.alphaStart) * t);
          let r = p.color[0], g = p.color[1], b = p.color[2];
          if (p.colorEnd) {
            r += (p.colorEnd[0] - r) * t;
            g += (p.colorEnd[1] - g) * t;
            b += (p.colorEnd[2] - b) * t;
          }
          buf[ptr++] = pos.sx * dpr;
          buf[ptr++] = pos.sy * dpr;
          buf[ptr++] = size;
          buf[ptr++] = r;
          buf[ptr++] = g;
          buf[ptr++] = b;
          buf[ptr++] = alpha;
          buf[ptr++] = p.shape;
        }

        gl.useProgram(engine.program);
        gl.uniform2f(engine.uRes, engine.canvas.width, engine.canvas.height);
        gl.bindBuffer(gl.ARRAY_BUFFER, engine.vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, ptr));

        const stride = FLOATS_PER_VERTEX * 4;
        gl.enableVertexAttribArray(engine.attribs.pos);
        gl.vertexAttribPointer(engine.attribs.pos, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(engine.attribs.size);
        gl.vertexAttribPointer(engine.attribs.size, 1, gl.FLOAT, false, stride, 8);
        gl.enableVertexAttribArray(engine.attribs.color);
        gl.vertexAttribPointer(engine.attribs.color, 4, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(engine.attribs.shape);
        gl.vertexAttribPointer(engine.attribs.shape, 1, gl.FLOAT, false, stride, 28);

        gl.drawArrays(gl.POINTS, 0, count);
      }
    } else if (engine.ctx2d) {
      const ctx = engine.ctx2d;
      ctx.clearRect(0, 0, engine.canvas.width, engine.canvas.height);
      if (isArenaVisible && engine.particles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < engine.particles.length; i++) {
          const p = engine.particles[i];
          const t = Math.min(1, p.age / p.life);
          const pos = projectToScreen(p.wx, p.wy, cam);
          const radius = Math.max(1.5, ((p.sizeStart + (p.sizeEnd - p.sizeStart) * t) * 0.5) * Math.max(0.35, pos.zoom) * dpr);
          const alpha = Math.max(0, p.alphaStart + (p.alphaEnd - p.alphaStart) * t);
          const r = Math.round(p.color[0] * 255);
          const g = Math.round(p.color[1] * 255);
          const b = Math.round(p.color[2] * 255);
          ctx.beginPath();
          ctx.arc(pos.sx * dpr, pos.sy * dpr, radius, 0, Math.PI * 2);
          if (p.shape > 0.5) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
            ctx.lineWidth = Math.max(1.5, radius * 0.14);
            ctx.stroke();
          } else {
            ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.8).toFixed(3)})`;
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    if (engine.particles.length > 0 || (engine.ambientAnchors.length > 0 && !isReducedMotionPreferred())) {
      engine.rafId = requestAnimationFrame(renderFrame);
    }
  }

  function ensureLoopRunning() {
    if (!engine.rafId && engine.canvas) {
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

    let canvas = document.getElementById("board-webgl-vfx");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "board-webgl-vfx";
      canvas.className = "board-webgl-vfx";
      canvas.setAttribute("aria-hidden", "true");
      viewportEl.appendChild(canvas);
    }
    engine.canvas = canvas;

    if (!initWebGL(canvas)) {
      engine.ctx2d = canvas.getContext("2d");
      engine.rendererKind = engine.ctx2d ? "canvas2d" : "none";
    }
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 160));
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
