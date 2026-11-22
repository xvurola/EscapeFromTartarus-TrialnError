// ============================================================================
// ESCAPE FROM TARTARUS — OFFICIAL PATCH, DYNAMIC CAMERA & QOL ENGINE
// ============================================================================

(function () {
  const DATA = window.EFT_DATA;
  const BOARD_W = 2970;
  const BOARD_H = 1998;
  const STEP_ANIM_MS = 240;

  // Build lookup maps, reverse adjacency & undirected arrival-aware adjacency
  const TILE_MAP = {};
  const PREV_MAP = {};
  const ADJ_MAP = {};
  DATA.BOARD_TILES.forEach((t) => {
    TILE_MAP[t.id] = t;
    PREV_MAP[t.id] = [];
    ADJ_MAP[t.id] = [];
  });
  DATA.BOARD_TILES.forEach((t) => {
    (t.next || []).forEach((nid) => {
      if (PREV_MAP[nid] && !PREV_MAP[nid].includes(t.id)) {
        PREV_MAP[nid].push(t.id);
      }
      if (ADJ_MAP[t.id] && TILE_MAP[nid] && !ADJ_MAP[t.id].includes(nid)) {
        ADJ_MAP[t.id].push(nid);
      }
      if (ADJ_MAP[nid] && !ADJ_MAP[nid].includes(t.id)) {
        ADJ_MAP[nid].push(t.id);
      }
    });
  });

  function isSplitTile(tileId) {
    return Boolean(TILE_MAP[tileId] && TILE_MAP[tileId].type === "intersect");
  }

  function isOffTrackTile(tileId) {
    return Boolean(TILE_MAP[tileId] && TILE_MAP[tileId].offTrack);
  }

  function findPassedRoadsideShop(fromTileId, toTileId, viaSplitId = null) {
    for (const t of DATA.BOARD_TILES) {
      if (t.type !== "merchant" || !t.offTrack) continue;
      if (t.shopTriggerSplit && viaSplitId && viaSplitId === t.shopTriggerSplit) {
        return t.shopId || 1;
      }
      if (Array.isArray(t.shopTriggerEdge) && t.shopTriggerEdge.length === 2) {
        const [a, b] = t.shopTriggerEdge;
        if ((fromTileId === a && toTileId === b) || (fromTileId === b && toTileId === a)) {
          return t.shopId || 2;
        }
      }
    }
    return null;
  }

  // Returns next REAL (non-split) tiles reachable in 1 step, passing through split hubs at 0 step cost
  function getNextPlayableOptions(currTileId, fromTileId = null, direction = 1) {
    const currTile = TILE_MAP[currTileId];
    if (!currTile) return [];

    // Spawn Point always goes straight to T1; leaving Spawn from T0->T1 always goes straight to T2
    if (currTileId === "T0") {
      return [{ tileId: "T1", viaSplitId: null }];
    }
    if (currTileId === "T1" && fromTileId === "T0" && direction >= 0) {
      return [{ tileId: "T2", viaSplitId: null }];
    }

    const neighbors = (ADJ_MAP[currTileId] || []).filter((id) => id !== "T0");
    let rawNext = [];

    if (direction >= 0) {
      if (fromTileId && neighbors.includes(fromTileId)) {
        rawNext = neighbors.filter((id) => id !== fromTileId);
      } else {
        const defNext = (currTile.next || []).filter((id) => id !== "T0" && id !== fromTileId);
        rawNext = defNext.length > 0 ? defNext : neighbors.filter((id) => id !== fromTileId);
      }
    } else {
      if (fromTileId && fromTileId !== "T0" && neighbors.includes(fromTileId)) {
        rawNext = [fromTileId];
      } else {
        const defPrev = (PREV_MAP[currTileId] || []).filter((id) => id !== "T0");
        rawNext = defPrev.length > 0 ? defPrev : neighbors;
      }
    }

    if (rawNext.length === 0 && neighbors.length > 0) {
      rawNext = neighbors;
    }

    const out = [];
    const seen = new Set();
    const visitSplit = (splitId, enteredFrom, visitedSplits) => {
      visitedSplits.add(splitId);
      const exits = (ADJ_MAP[splitId] || []).filter((id) => id !== enteredFrom && id !== "T0");
      exits.forEach((exId) => {
        if (isSplitTile(exId)) {
          if (!visitedSplits.has(exId)) visitSplit(exId, splitId, visitedSplits);
        } else if (!seen.has(exId)) {
          seen.add(exId);
          out.push({ tileId: exId, viaSplitId: splitId });
        }
      });
    };

    rawNext.forEach((nb) => {
      if (isSplitTile(nb)) {
        visitSplit(nb, currTileId, new Set());
      } else if (!seen.has(nb)) {
        seen.add(nb);
        out.push({ tileId: nb, viaSplitId: null });
      }
    });

    return out;
  }

  // Clean vector SVG crests for each character (No "1P/2P" text on board!)
  function getCharacterSvgIcon(charId) {
    switch (charId) {
      case "bocchi":
        // Musical Note crest
        return `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      case "aventurine":
        // Spade / Casino Diamond crest
        return `<svg viewBox="0 0 24 24"><path d="M12 2L4.5 12 12 22l7.5-10L12 2zm0 4.5l4.2 5.5-4.2 5.5-4.2-5.5L12 6.5z"/></svg>`;
      case "lilith":
        // Crescent / Daemonissa Crown crest
        return `<svg viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>`;
      case "joker":
        // Phantom Star / Mask crest
        return `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>`;
      case "maomao":
        // Apothecary Herb Leaf crest
        return `<svg viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/></svg>`;
      case "firefly":
        // Stellaron Flame / Mecha Wing crest
        return `<svg viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>`;
    }
  }

  // Helper: Generate V2-styled SVG card art for Beta 1 cards
  function generateSvgCardArt(card, charObj) {
    const rarityBadgeMap = {
      Common: { code: "C", bg: "#9ca3af", fg: "#061411" },
      Uncommon: { code: "UC", bg: "#10b981", fg: "#061411" },
      Rare: { code: "R", bg: "#3b82f6", fg: "#ffffff" },
      Epic: { code: "E", bg: "#a855f7", fg: "#ffffff" },
      Unique: { code: "Un", bg: "#ef4444", fg: "#ffffff" },
      Ultimate: { code: "ULT", bg: "#f5c542", fg: "#061411" }
    };
    const badge = rarityBadgeMap[card.rarity] || rarityBadgeMap.Common;
    const accent = charObj ? charObj.color : "#3e856c";
    const safeName = (card.name || "Skill Card").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const safeChar = (charObj ? charObj.name : "Tartarus").replace(/&/g, "&amp;");
    const desc = (card.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

    const words = desc.split(" ");
    const lines = [];
    let cur = "";
    words.forEach((w) => {
      if ((cur + " " + w).trim().length > 28) {
        lines.push(cur.trim());
        cur = w;
      } else {
        cur = (cur + " " + w).trim();
      }
    });
    if (cur) lines.push(cur.trim());

    const textTspans = lines
      .slice(0, 6)
      .map((line, i) => `<tspan x="200" dy="${i === 0 ? 0 : 24}">${line}</tspan>`)
      .join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 580" width="400" height="580">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#061411"/>
          <stop offset="55%" stop-color="#11332b"/>
          <stop offset="100%" stop-color="#040b09"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="38%" r="45%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.48"/>
          <stop offset="100%" stop-color="#061411" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="580" rx="22" fill="url(#bg)" stroke="${badge.bg}" stroke-width="5"/>
      <circle cx="200" cy="220" r="150" fill="url(#glow)"/>
      <rect x="20" y="24" width="360" height="52" rx="12" fill="#040d0b" fill-opacity="0.9" stroke="${accent}" stroke-width="1.5"/>
      <circle cx="48" cy="50" r="26" fill="${badge.bg}" stroke="#061411" stroke-width="2.5"/>
      <text x="48" y="58" text-anchor="middle" font-family="Georgia, serif" font-size="21" font-weight="bold" fill="${badge.fg}">${badge.code}</text>
      <text x="88" y="57" font-family="Georgia, serif" font-size="20" font-style="italic" font-weight="bold" fill="#ffffff">${safeName}</text>
      <circle cx="200" cy="225" r="74" fill="#081c17" stroke="${accent}" stroke-width="2.5"/>
      <text x="200" y="222" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="#ade0ca">${safeChar}</text>
      <text x="200" y="246" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="12" fill="#8fbdb0">${card.rarity.toUpperCase()}</text>
      <rect x="20" y="365" width="360" height="190" rx="14" fill="#030908" fill-opacity="0.94" stroke="rgba(173,224,202,0.25)" stroke-width="1.5"/>
      <text x="200" y="405" text-anchor="middle" font-family="Georgia, serif" font-size="16.5" fill="#ecfdf5">${textTspans}</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function getCardImage(card, charId) {
    if (card && card.image) return card.image;
    const charObj = DATA.CHARACTERS[charId];
    return generateSvgCardArt(card || { name: "Card", rarity: "Common" }, charObj);
  }

  function getCharacterForCompendium(charId, compVersionId) {
    const base = DATA.CHARACTERS[charId];
    if (!base) return null;
    const copy = JSON.parse(JSON.stringify(base));
    const comp = DATA.COMPENDIUM_VERSIONS[compVersionId] || DATA.COMPENDIUM_VERSIONS.comp_beta1;
    const charOverrides = (comp.overrides && comp.overrides[charId]) || {};

    copy.cards = copy.cards.map((c) => {
      if (charOverrides[c.id]) {
        return { ...c, ...charOverrides[c.id] };
      }
      return c;
    });
    if (copy.ultimate && charOverrides[copy.ultimate.id]) {
      copy.ultimate = { ...copy.ultimate, ...charOverrides[copy.ultimate.id] };
    }
    return copy;
  }

  function getTileDistance(tileA, tileB) {
    if (tileA === tileB) return 0;
    // 0-1 BFS: split (intersect) hubs cost 0 steps, real tiles cost 1 step
    const distMap = new Map([[tileA, 0]]);
    const deque = [tileA];
    while (deque.length > 0) {
      const curr = deque.shift();
      const dist = distMap.get(curr);
      if (curr === tileB) return dist;
      if (dist >= 16) continue;
      const neighbors = ADJ_MAP[curr] || [];
      for (const nb of neighbors) {
        const stepCost = isSplitTile(nb) ? 0 : 1;
        const nd = dist + stepCost;
        if (!distMap.has(nb) || nd < distMap.get(nb)) {
          distMap.set(nb, nd);
          if (stepCost === 0) deque.unshift(nb);
          else deque.push(nb);
        }
      }
    }
    return 999;
  }

  function getTilesWithinRadius(centerTileId, radius, onlyNormal = false, excludeCenter = false) {
    const result = [];
    DATA.BOARD_TILES.forEach((t) => {
      if (t.id === "T0" || t.type === "intersect" || t.offTrack) return;
      if (excludeCenter && t.id === centerTileId) return;
      const d = getTileDistance(centerTileId, t.id);
      if (d <= radius) {
        if (!onlyNormal || t.type === "normal") {
          result.push({ tile: t, distance: d });
        }
      }
    });
    return result;
  }

  function getDirectedPathToTile(startTileId, targetTileId, maxDepth = 12) {
    if (startTileId === targetTileId) return [];
    const visited = new Set([startTileId]);
    const queue = [[startTileId, []]];
    while (queue.length > 0) {
      const [curr, path] = queue.shift();
      if (path.length >= maxDepth) continue;
      const neighbors = ADJ_MAP[curr] || [];
      for (const nid of neighbors) {
        if (nid === "T0" && targetTileId !== "T0") continue;
        const nextPath = isSplitTile(nid) ? path : [...path, nid];
        if (nid === targetTileId) return nextPath;
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push([nid, nextPath]);
        }
      }
    }
    return [targetTileId];
  }

  function getOppositeAdjacentNeighbor(tileId, cameFromNeighborId) {
    const nbs = (ADJ_MAP[tileId] || []).filter((id) => id !== "T0");
    if (!cameFromNeighborId) return (PREV_MAP[tileId] && PREV_MAP[tileId][0]) || nbs[0] || null;
    const other = nbs.find((id) => id !== cameFromNeighborId);
    return other || (PREV_MAP[tileId] && PREV_MAP[tileId][0]) || null;
  }

  function computeConsistentLastTileIdAfterJump(startTileId, destTileId, startLastTileId = null, isBackwardMove = false) {
    if (!destTileId || !TILE_MAP[destTileId]) return startLastTileId;
    if (startTileId === destTileId) return startLastTileId;
    const initDir = isBackwardMove ? -1 : 1;
    const visited = new Set([`${startTileId}|${startLastTileId || ""}`]);
    const queue = [[startTileId, startLastTileId, 0]];
    while (queue.length > 0) {
      const [curr, prev, dist] = queue.shift();
      if (dist >= 12) continue;
      const stepDir = dist === 0 ? initDir : 1;
      const opts = getNextPlayableOptions(curr, prev, stepDir);
      for (const opt of opts) {
        const nid = opt.tileId;
        if (nid === "T0" || isSplitTile(nid)) continue;
        const arrivalPrev = opt.viaSplitId || curr;
        if (nid === destTileId) {
          return isBackwardMove ? getOppositeAdjacentNeighbor(destTileId, arrivalPrev) : arrivalPrev;
        }
        const stKey = `${nid}|${arrivalPrev}`;
        if (!visited.has(stKey)) {
          visited.add(stKey);
          queue.push([nid, arrivalPrev, dist + 1]);
        }
      }
    }
    return (PREV_MAP[destTileId] && PREV_MAP[destTileId][0]) || startLastTileId;
  }

  // ============================================================================
  // MAIN GAME STATE, ADMIN GATE & DYNAMIC CAMERA STATE
  // ============================================================================
  const ADMIN_PASSCODE = "010406";
  let isAdminUnlocked = false;
  try {
    isAdminUnlocked = sessionStorage.getItem("eft_admin_unlocked") === "1";
  } catch (e) {}
  let adminFreeSkillUse = false;

  let state = null;
  let undoStack = [];
  let printPreviewMode = false;
  let pendingInteraction = null;
  let selectedCardUid = null;
  let hoveredBranchTileId = null;
  let isWalkingAnim = false;
  let isTileEffectAnimating = false;
  let tileShuffleState = null;
  let tileShuffleTimers = [];
  let tileShuffleShownAt = 0;
  let queuedTileEffectRuns = [];
  let lastShownTileEffectRevealId = null;
  let isSkillActivationInFlight = false;
  let isProcessingRemoteAction = false;
  let activeStepsRemaining = 0;
  let stepTimerId = null;
  let diceAnimIntervalId = null;
  let diceAnimTimeoutId = null;
  let skillPopupTimerId = null;
  let skillPopupShownAt = 0;
  let lastShownSkillEventId = null;
  let fadingShards = [];
  let lastProcessedPurchasedShardId = null;
  let dofRollAnimInterval = null;
  let dofBotTimer = null;
  let dofTieTimer = null;
  let dofAutoFinishTimer = null;
  const TURN_TIME_LIMIT_SEC = 180;
  let turnTimerIntervalId = null;
  let turnReminderTimeoutId = null;
  let turnReminderFadeTimeoutId = null;
  let lastTrackedTurnTimerKey = null;
  let localTurnKeyStartedAt = 0;
  let turnThinkingRemainingMs = TURN_TIME_LIMIT_SEC * 1000;
  let lastTurnTimerTickAt = 0;
  let lastTimerWarnSec = -1;
  let autoEndTurnTimerId = null;
  let lastRenderedTileModalKey = null;
  let tileModalMinimizedForId = null;
  let tileModalAutoCloseTimerId = null;
  let lastShownDiceRollEventId = null;
  let lastShownDofRollEventId = null;
  let isInitializingMatch = false;
  let isMatchStarted = false;
  let isTitleScreenVisible = true;
  let hasPreloadedAssets = false;
  let seenActivityLogIds = new Set();
  let activeCompendiumFilter = "all";
  let selectedCompendiumCharId = null;
  let selectedCompendiumCardId = null;

  function getPlayableCharacterIds(compId = null) {
    const cid = compId || (state ? state.compendiumId : "comp_beta1");
    const compDef = DATA.COMPENDIUM_VERSIONS[cid] || DATA.COMPENDIUM_VERSIONS.comp_beta1;
    const active = (compDef.availableCharacters || []).filter(
      (id) => DATA.CHARACTERS[id] && !DATA.CHARACTERS[id].unavailable
    );
    return active.length > 0 ? active : ["bocchi", "aventurine", "joker", "lilith"];
  }

  function getFullCycleTurns() {
    if (!state) return 16;
    const totalRounds = state.rules && state.rules.turnsPerCycle ? state.rules.turnsPerCycle : 4;
    const curRound = state.roundInCycle || 1;
    const playersCount = state.players && state.players.length ? state.players.length : 4;
    const curPlayerIdx = typeof state.activePlayerIndex === "number" ? state.activePlayerIndex : 0;
    const remainingRoundsAfterThis = Math.max(0, totalRounds - curRound);
    const remainingTurnsThisRound = Math.max(1, playersCount - curPlayerIdx);
    return remainingRoundsAfterThis * playersCount + remainingTurnsThisRound;
  }

  function getActiveCycleDurationLabel(copiedTurns = null) {
    if (copiedTurns) {
      return copiedTurns === 1 ? "1 Turn" : "1 Ronde";
    }
    if (!state) return "1 Cycle";
    const totalRounds = state.rules && state.rules.turnsPerCycle ? state.rules.turnsPerCycle : 4;
    const curRound = state.roundInCycle || 1;
    const roundsLeft = Math.max(1, totalRounds - curRound + 1);
    return `Cycle ${state.cycle} (${curRound}/${totalRounds} · Sisa ${roundsLeft} Ronde)`;
  }

  function addOrRefreshPassive(player, passiveObj) {
    if (!player || !passiveObj) return;
    player.passives = (player.passives || []).filter((p) => p.key !== passiveObj.key);
    const expiresOnCycleEnd = passiveObj.expiresOnCycleEnd !== undefined ? !!passiveObj.expiresOnCycleEnd : true;
    player.passives.push({
      ...passiveObj,
      expiresOnCycleEnd,
      activatedCycle: state ? state.cycle : 1,
      activatedOnTurn: state ? state.totalTurnsCompleted : -1
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function loadPlayerProfile() {
    try {
      const raw = localStorage.getItem("eft_player_profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const rawCid = typeof parsed.charId === "string" ? parsed.charId : "bocchi";
          const safeCid = DATA.CHARACTERS[rawCid] && !DATA.CHARACTERS[rawCid].unavailable ? rawCid : "bocchi";
          return {
            username: typeof parsed.username === "string" ? parsed.username : "",
            charId: safeCid
          };
        }
      }
    } catch (e) {}
    return { username: "", charId: "bocchi" };
  }

  function savePlayerProfile(username, charId) {
    const safeCid = DATA.CHARACTERS[charId] && !DATA.CHARACTERS[charId].unavailable ? charId : "bocchi";
    try {
      localStorage.setItem(
        "eft_player_profile",
        JSON.stringify({ username: String(username || "").trim(), charId: String(safeCid) })
      );
    } catch (e) {}
  }

  // ============================================================================
  // SOFT PROCEDURAL SOUND EFFECT ENGINE (WEB AUDIO API) & ACTIVITY FEED
  // ============================================================================
  const SOUND_PREFS_KEY = "eft_sound_prefs";
  const sfxLastPlayed = {};
  let audioCtx = null;
  let audioNoiseBuffer = null;

  function loadSoundPrefs() {
    try {
      const raw = localStorage.getItem(SOUND_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === "object") {
          const vol = Number.isFinite(Number(p.volume)) ? Math.max(0, Math.min(1, Number(p.volume))) : 0.45;
          return {
            muted: !!p.muted,
            volume: vol
          };
        }
      }
    } catch (e) {}
    return { muted: false, volume: 0.45 };
  }

  let soundPrefs = loadSoundPrefs();

  function saveSoundPrefs() {
    try {
      localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(soundPrefs));
    } catch (e) {}
  }

  function ensureAudioCtx(allowCreate = false) {
    if (!audioCtx && allowCreate) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try {
          audioCtx = new Ctx();
        } catch (e) {
          return null;
        }
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    if (audioCtx && !audioNoiseBuffer) {
      try {
        const len = Math.floor(audioCtx.sampleRate * 0.16);
        const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        audioNoiseBuffer = buf;
      } catch (e) {}
    }
    return audioCtx;
  }

  function getEffectiveSfxGain() {
    if (soundPrefs.muted || soundPrefs.volume <= 0.005) return 0;
    return Math.pow(soundPrefs.volume, 1.35) * 0.28;
  }

  function playSoftTone(ctx, dest, opts) {
    const start = opts.startTime || ctx.currentTime;
    const attack = opts.attack !== undefined ? opts.attack : 0.015;
    const dur = opts.duration || 0.14;
    const peak = Math.max(0.002, opts.gain || 0.25);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq || 440, start);
    if (opts.endFreq && opts.endFreq !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), start + dur);
    }

    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, start + attack + dur);

    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + attack + dur + 0.02);
  }

  function playSoftNoise(ctx, dest, opts) {
    if (!audioNoiseBuffer) return;
    const start = opts.startTime || ctx.currentTime;
    const dur = opts.duration || 0.065;
    const peak = Math.max(0.002, opts.gain || 0.14);

    const src = ctx.createBufferSource();
    src.buffer = audioNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || "bandpass";
    filter.frequency.setValueAtTime(opts.filterFreq || 1600, start);
    filter.Q.setValueAtTime(opts.q || 1.1, start);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, start + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  function playSfx(type, variant = "") {
    const masterLevel = getEffectiveSfxGain();
    if (masterLevel <= 0) return;

    const nowMs = Date.now();
    const debounceWindows = {
      coin_gain: 90,
      coin_loss: 90,
      card: 110,
      click: 45,
      preview: 110,
      step: 45,
      dice_tick: 50,
      turn: 120
    };
    const minGap = debounceWindows[type] || 30;
    if (sfxLastPlayed[type] && nowMs - sfxLastPlayed[type] < minGap) return;
    sfxLastPlayed[type] = nowMs;

    const ctx = ensureAudioCtx(true);
    if (!ctx || ctx.state === "closed") return;

    const t = ctx.currentTime;
    const warmFilter = ctx.createBiquadFilter();
    warmFilter.type = "lowpass";
    warmFilter.frequency.setValueAtTime(2400, t);
    warmFilter.Q.setValueAtTime(0.5, t);

    const master = ctx.createGain();
    master.gain.setValueAtTime(masterLevel, t);
    warmFilter.connect(master);
    master.connect(ctx.destination);

    switch (type) {
      case "click":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 520, endFreq: 420, duration: 0.045, attack: 0.006, gain: 0.24, type: "sine" });
        break;
      case "preview":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 587, endFreq: 740, duration: 0.075, attack: 0.008, gain: 0.26, type: "sine" });
        break;
      case "dice_tick": {
        const pitch = 290 + Math.random() * 110;
        playSoftTone(ctx, warmFilter, { startTime: t, freq: pitch, endFreq: pitch * 0.72, duration: 0.032, attack: 0.004, gain: 0.16, type: "triangle" });
        playSoftNoise(ctx, warmFilter, { startTime: t, filterFreq: 1350, duration: 0.028, gain: 0.09, q: 1.4 });
        break;
      }
      case "dice_land":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 392, endFreq: 392, duration: 0.11, attack: 0.01, gain: 0.26, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.065, freq: 523.25, endFreq: 523.25, duration: 0.18, attack: 0.012, gain: 0.30, type: "sine" });
        break;
      case "step":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 310, endFreq: 205, duration: 0.042, attack: 0.005, gain: 0.22, type: "triangle" });
        break;
      case "branch":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 440, duration: 0.13, attack: 0.012, gain: 0.24, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.07, freq: 587.33, duration: 0.18, attack: 0.014, gain: 0.26, type: "sine" });
        break;
      case "coin_gain":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 659.25, duration: 0.11, attack: 0.01, gain: 0.24, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.065, freq: 880, duration: 0.19, attack: 0.012, gain: 0.28, type: "sine" });
        break;
      case "coin_loss":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 349.23, endFreq: 311.13, duration: 0.12, attack: 0.012, gain: 0.24, type: "triangle" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.08, freq: 261.63, endFreq: 233.08, duration: 0.18, attack: 0.014, gain: 0.22, type: "sine" });
        break;
      case "card":
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1650, duration: 0.075, gain: 0.18, q: 0.9 });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.015, freq: 493.88, endFreq: 587.33, duration: 0.08, attack: 0.01, gain: 0.16, type: "sine" });
        break;
      case "card_shuffle": {
        const pitch = 360 + Math.random() * 140;
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1950, duration: 0.055, gain: 0.15, q: 1.1 });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.008, freq: pitch, endFreq: pitch * 0.82, duration: 0.04, attack: 0.005, gain: 0.10, type: "triangle" });
        break;
      }
      case "card_reveal": {
        if (variant === "negative") {
          [392.0, 311.13, 246.94].forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, { startTime: t + idx * 0.075, freq: hz, duration: 0.36, attack: 0.016, gain: 0.22, type: idx === 0 ? "triangle" : "sine" });
          });
        } else if (variant === "event") {
          [392.0, 587.33, 659.25, 880.0].forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, { startTime: t + idx * 0.06, freq: hz, duration: 0.42, attack: 0.016, gain: 0.22, type: "sine" });
          });
        } else {
          [523.25, 659.25, 783.99, 1046.5].forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, { startTime: t + idx * 0.055, freq: hz, duration: 0.36, attack: 0.014, gain: 0.22, type: "sine" });
          });
        }
        break;
      }
      case "turn":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 329.63, duration: 0.14, attack: 0.016, gain: 0.20, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.075, freq: 440, duration: 0.20, attack: 0.016, gain: 0.22, type: "sine" });
        break;
      case "turn_reminder": {
        const notes = variant === "my_turn" ? [440.0, 554.37, 659.25, 880.0] : [392.0, 493.88, 587.33];
        notes.forEach((hz, idx) => {
          playSoftTone(ctx, warmFilter, {
            startTime: t + idx * 0.075,
            freq: hz,
            duration: idx === notes.length - 1 ? 0.34 : 0.20,
            attack: 0.014,
            gain: variant === "my_turn" ? 0.22 : 0.18,
            type: "sine"
          });
        });
        break;
      }
      case "timer_warn":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 520, endFreq: 440, duration: 0.045, attack: 0.005, gain: 0.16, type: "triangle" });
        break;
      case "shard":
        [523.25, 659.25, 783.99].forEach((hz, idx) => {
          playSoftTone(ctx, warmFilter, { startTime: t + idx * 0.07, freq: hz, duration: 0.34, attack: 0.018, gain: 0.26, type: "sine" });
        });
        break;
      case "skill": {
        const parts = String(variant || "").split(":");
        const charId = parts.length === 2 ? parts[0] : "";
        const theme = parts.length === 2 ? parts[1] : variant;
        const isUlt = theme === "ultimate";

        if (charId === "bocchi") {
          // Soft plucked rock/acoustic guitar chord strum (E major / C#m resonance)
          const strings = isUlt
            ? [329.63, 415.30, 493.88, 659.25, 830.61]
            : [277.18, 329.63, 415.30, 493.88];
          strings.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + idx * 0.036,
              freq: hz,
              endFreq: hz * 0.996,
              duration: isUlt ? 0.56 : 0.42,
              attack: 0.009,
              gain: isUlt ? 0.21 : 0.17,
              type: "triangle"
            });
          });
        } else if (charId === "aventurine") {
          // Soft casino chip clink + sparkling gold coin cascade
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 2100, duration: 0.035, gain: 0.12, q: 2.2 });
          const notes = isUlt
            ? [587.33, 739.99, 880.00, 1174.66]
            : [587.33, 739.99, 987.77];
          notes.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + 0.025 + idx * 0.055,
              freq: hz,
              duration: isUlt ? 0.46 : 0.32,
              attack: 0.01,
              gain: isUlt ? 0.22 : 0.18,
              type: "sine"
            });
          });
        } else if (charId === "joker") {
          // Sleek acid-jazz Phantom Thief synth-Rhodes chord + subtle snap
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1850, duration: 0.032, gain: 0.14, q: 1.8 });
          const jazz = isUlt
            ? [293.66, 349.23, 440.00, 523.25, 659.25]
            : [293.66, 349.23, 440.00, 523.25];
          jazz.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + 0.03 + idx * 0.038,
              freq: hz,
              duration: isUlt ? 0.54 : 0.38,
              attack: 0.018,
              gain: isUlt ? 0.20 : 0.17,
              type: "sine"
            });
          });
        } else if (charId === "lilith") {
          // Ethereal dark music-box celesta + soft velvet sub-pad
          playSoftTone(ctx, warmFilter, { startTime: t, freq: 196.0, endFreq: 174.61, duration: isUlt ? 0.62 : 0.44, attack: 0.045, gain: 0.16, type: "sine" });
          const box = isUlt
            ? [698.46, 622.25, 523.25, 392.00]
            : [622.25, 523.25, 466.16];
          box.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + idx * 0.075,
              freq: hz,
              duration: 0.36,
              attack: 0.012,
              gain: 0.18,
              type: "sine"
            });
          });
        } else {
          const themeChords = {
            sonic: [329.63, 415.30, 493.88],
            fortune: [392.00, 493.88, 587.33],
            phantom: [311.13, 392.00, 466.16],
            abyss: [261.63, 311.13, 392.00],
            passive: [349.23, 440.00, 523.25],
            ultimate: [392.00, 493.88, 587.33, 783.99]
          };
          const chord = themeChords[theme] || themeChords.sonic;
          chord.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + idx * 0.045,
              freq: hz,
              duration: isUlt ? 0.52 : 0.40,
              attack: 0.032,
              gain: isUlt ? 0.22 : 0.19,
              type: "sine"
            });
          });
        }
        break;
      }
      default:
        break;
    }
  }

  function syncSoundControlUi() {
    const pill = document.getElementById("sound-control-pill");
    const btn = document.getElementById("btn-sound-mute");
    const slider = document.getElementById("sound-volume-slider");
    const label = document.getElementById("sound-volume-label");
    const pct = Math.round(soundPrefs.volume * 100);
    const isEffectivelyMuted = soundPrefs.muted || pct === 0;

    if (pill) pill.classList.toggle("is-muted", isEffectivelyMuted);
    if (slider) slider.value = String(pct);
    if (label) label.textContent = isEffectivelyMuted ? "Mute" : `${pct}%`;
    if (btn) {
      btn.classList.toggle("is-muted", isEffectivelyMuted);
      btn.title = isEffectivelyMuted ? "Aktifkan Sound Effect" : "Matikan Sound Effect";
      btn.innerHTML = isEffectivelyMuted
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="22" y1="9" x2="16" y2="15"></line>
            <line x1="16" y1="9" x2="22" y2="15"></line>
          </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>`;
    }
  }

  function toggleSoundMute() {
    if (soundPrefs.muted || soundPrefs.volume <= 0.005) {
      soundPrefs.muted = false;
      if (soundPrefs.volume <= 0.005) soundPrefs.volume = 0.45;
      saveSoundPrefs();
      syncSoundControlUi();
      playSfx("preview");
    } else {
      soundPrefs.muted = true;
      saveSoundPrefs();
      syncSoundControlUi();
    }
  }

  function setSoundVolume(valPct) {
    const clamped = Math.max(0, Math.min(100, Number(valPct) || 0));
    soundPrefs.volume = clamped / 100;
    soundPrefs.muted = clamped === 0;
    saveSoundPrefs();
    syncSoundControlUi();
    if (clamped > 0) playSfx("preview");
  }

  function clearRecentActivityFeed() {
    seenActivityLogIds.clear();
    const feed = document.getElementById("recent-activity-feed");
    if (feed) feed.innerHTML = "";
  }

  function formatActivitySnippet(rawText) {
    const raw = String(rawText || "").trim();
    if (!raw) return null;

    if (/^(Match initialized|Undo:|Urutan Giliran|Admin Mode|Admin Free Skill|Connected|Firebase Lobby|Lobby|PeerJS|Room )/i.test(raw)) {
      return null;
    }
    if (/left Spawn Point/i.test(raw) || /^CYCLE \d+ STARTED/i.test(raw)) {
      return null;
    }
    if (/^.+? landed on \[T\d+:/i.test(raw)) {
      return null;
    }

    let m = null;
    if ((m = raw.match(/^(.+?) gained \+?(-?\d+) TC/i))) {
      return { text: `... ${m[1]} mendapat +${m[2]} coin`, kind: "gain" };
    }
    if ((m = raw.match(/^(.+?) lost (-?\d+) TC/i))) {
      return { text: `... ${m[1]} kehilangan ${Math.abs(Number(m[2]))} coin`, kind: "loss" };
    }
    if ((m = raw.match(/^IPC Gems \([^)]+\): (.+?) memperoleh \+(\d+) TC/i))) {
      return { text: `... ${m[1]} +${m[2]} coin (IPC Gems)`, kind: "gain" };
    }
    if ((m = raw.match(/^The Emperor's Favor: (.+?) paid (\d+) TC tax to (.+?)\.?$/i))) {
      return { text: `... ${m[1]} bayar pajak ${m[2]} coin ke ${m[3]}`, kind: "loss" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) ([+\-]?\d+) TC/i))) {
      const val = Number(m[3]);
      return val >= 0
        ? { text: `... ${m[2]} mendapat +${val} coin (${m[1]})`, kind: "gain" }
        : { text: `... ${m[2]} kehilangan ${Math.abs(val)} coin (${m[1]})`, kind: "loss" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) drew (\d+) card/i))) {
      return { text: `... ${m[2]} ambil +${m[3]} kartu (${m[1]})`, kind: "gain" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) discarded (\d+) card/i))) {
      return { text: `... ${m[2]} buang ${m[3]} kartu (${m[1]})`, kind: "loss" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) ([+\-]?\d+) die/i))) {
      return { text: `... ${m[2]} ${m[3]} dadu giliran depan (${m[1]})`, kind: Number(m[3]) >= 0 ? "gain" : "loss" };
    }
    if ((m = raw.match(/^(.+?) rolled \[(.+?)\] -> Moving (backward )?(\d+) steps/i))) {
      return { text: `... ${m[1]} roll ${m[4]} langkah${m[3] ? " (mundur)" : ""}`, kind: "move" };
    }
    if ((m = raw.match(/^\[The Stage Is Mine\]: (.+?) pindah ([+-]\d+ tile) ke \[([^:\]]+)/i))) {
      return { text: `... ${m[1]} pindah ${m[2]} (${m[3]})`, kind: "move" };
    }
    if ((m = raw.match(/^\[The Stage Is Mine\]: (.+?) berpindah ke \[([^:\]]+)/i))) {
      return { text: `... ${m[1]} pindah ke ${m[2]} (Stage)`, kind: "move" };
    }
    if ((m = raw.match(/^(.+?) purchased Tartarus Shard at Zone ([IVX]+)/i))) {
      return { text: `... ${m[1]} beli Shard Zone ${m[2]}`, kind: "shard" };
    }
    if ((m = raw.match(/^Shard d6 rolled \[\d+\] -> Tartarus Shard spawned at Zone ([IVX]+) \((T\d+)\)/i))) {
      return { text: `... Shard baru di Zone ${m[1]} (${m[2]})`, kind: "shard" };
    }
    if ((m = raw.match(/^(.+?) drew \+(\d+) card/i))) {
      return { text: `... ${m[1]} ambil +${m[2]} kartu`, kind: "gain" };
    }
    if ((m = raw.match(/^(.+?) discarded (\d+) card/i))) {
      return { text: `... ${m[1]} buang ${m[2]} kartu`, kind: "loss" };
    }
    if ((m = raw.match(/^GLOBAL EVENT: \[(.+?)\]/i))) {
      return { text: `... Event: ${m[1]}`, kind: "skill" };
    }
    if ((m = raw.match(/^Versus: (.+?) defeated (.+?) \(\+(\d+) TC\)/i))) {
      return { text: `... ${m[1]} menang Duel (+${m[3]} coin)`, kind: "gain" };
    }
    if ((m = raw.match(/^Awaken, Arsene!: (.+?) mendapat \+1/i))) {
      return { text: `... ${m[1]} +1 ekstra dadu (Arsene)`, kind: "skill" };
    }
    if ((m = raw.match(/^\[([^\]]+)\]: (.+)$/))) {
      const cleaned = m[2]
        .replace(/\s+TC\b/g, " coin")
        .replace(/\[(T\d+):[^\]]+\]/g, "$1")
        .replace(/!$/, "");
      const line = `${cleaned} (${m[1]})`;
      const trimmed = line.length > 68 ? line.slice(0, 65) + "..." : line;
      let kind = "skill";
      if (/kehilangan|membayar|membuang|hancur|mundur|-\d+/i.test(line)) kind = "loss";
      else if (/pindah|bergerak|melompat|bertukar/i.test(line)) kind = "move";
      else if (/mencuri|\+\d+/i.test(line)) kind = "gain";
      return { text: `... ${trimmed}`, kind };
    }

    let cleaned = raw
      .replace(/\s+TC\b/g, " coin")
      .replace(/\[(T\d+):[^\]]+\]/g, "$1");
    if (cleaned.length > 68) cleaned = cleaned.slice(0, 65) + "...";

    let kind = "neutral";
    if (/Shard|VICTORY/i.test(cleaned)) kind = "shard";
    else if (/kehilangan|lost|buang|discard|trap|virus|Fire|-15|-5|-\d+/i.test(cleaned)) kind = "loss";
    else if (/\+\d+|gained|memperoleh|Herbs|Minigame/i.test(cleaned)) kind = "gain";
    else if (/pindah|moved|teleport|River|Warp/i.test(cleaned)) kind = "move";
    else if (/Passive|ULTIMATE|Event/i.test(cleaned)) kind = "skill";

    return { text: `... ${cleaned}`, kind };
  }

  function pushRecentActivity(rawText) {
    if (isInitializingMatch) return;
    const feed = document.getElementById("recent-activity-feed");
    if (!feed) return;
    const formatted = formatActivitySnippet(rawText);
    if (!formatted) return;

    const item = document.createElement("div");
    item.className = `recent-activity-item act-${formatted.kind}`;
    item.textContent = formatted.text;
    feed.appendChild(item);

    while (feed.children.length > 4) {
      feed.removeChild(feed.firstElementChild);
    }

    setTimeout(() => {
      if (item.parentNode) item.classList.add("fading-out");
    }, 5000);
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 5700);
  }

  function syncRemoteActivityFeed() {
    if (!state || !Array.isArray(state.logs) || state.logs.length === 0) return;
    if (seenActivityLogIds.size === 0 && state.logs.length > 3) {
      state.logs.forEach((l) => {
        if (l && l.id !== undefined) seenActivityLogIds.add(l.id);
      });
      return;
    }
    const fresh = [];
    for (let i = state.logs.length - 1; i >= 0; i--) {
      const l = state.logs[i];
      if (!l || l.id === undefined) continue;
      if (!seenActivityLogIds.has(l.id)) {
        seenActivityLogIds.add(l.id);
        fresh.push(l.text);
      }
    }
    if (seenActivityLogIds.size > 240) {
      seenActivityLogIds = new Set(state.logs.map((l) => l.id));
    }
    fresh.forEach((txt) => pushRecentActivity(txt));
  }

  const setupDraft = {
    tab: "local",
    username: loadPlayerProfile().username,
    charId: loadPlayerProfile().charId,
    patchId: "alpha2",
    compendiumId: "comp_beta1",
    playerCount: 4,
    extraPlayers: [
      { username: "", charId: "aventurine" },
      { username: "", charId: "joker" },
      { username: "", charId: "lilith" }
    ]
  };

  // Camera state: "follow" zooms & tracks active player; "wide" shows whole board; "free" when user drags
  const camera = {
    mode: "follow", // "follow" | "wide" | "free"
    zoom: 0.96,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginPanX: 0,
    dragOriginPanY: 0,
    movedDuringDrag: false
  };

  function applyCameraTransform() {
    const surface = document.getElementById("map-canvas-wrap");
    if (!surface) return;
    surface.style.transform = `translate(${camera.panX.toFixed(1)}px, ${camera.panY.toFixed(1)}px) scale(${camera.zoom.toFixed(3)})`;

    const followBtn = document.getElementById("btn-cam-follow");
    const wideBtn = document.getElementById("btn-cam-wide");
    if (followBtn && wideBtn) {
      followBtn.classList.toggle("active-cam", camera.mode === "follow");
      wideBtn.classList.toggle("active-cam", camera.mode === "wide");
    }
  }

  function isMobilePortrait() {
    return window.innerWidth <= 820;
  }

  function focusCameraOnTile(tileId, customZoom = null) {
    const t = TILE_MAP[tileId];
    if (!t) return;
    const mobile = isMobilePortrait();
    const defaultFollowZoom = mobile ? 0.72 : 0.96;
    if (customZoom !== null) {
      camera.zoom = customZoom;
    } else if (camera.zoom < (mobile ? 0.54 : 0.74)) {
      camera.zoom = defaultFollowZoom;
    }
    const offsetFromCenterX = ((50 - t.x) / 100) * BOARD_W;
    const offsetFromCenterY = ((50 - t.y) / 100) * BOARD_H;
    camera.panX = offsetFromCenterX * camera.zoom;
    camera.panY = offsetFromCenterY * camera.zoom + (mobile ? 10 : -36);
    applyCameraTransform();
  }

  function setCameraMode(mode) {
    camera.mode = mode;
    const mobile = isMobilePortrait();
    if (mode === "wide") {
      if (mobile) {
        camera.zoom = Math.max(0.12, Math.min(0.35, (window.innerWidth - 14) / BOARD_W));
        camera.panX = 0;
        camera.panY = 4;
      } else {
        camera.zoom = 0.34;
        camera.panX = 0;
        camera.panY = -26;
      }
      applyCameraTransform();
    } else if (mode === "follow" && state) {
      const p = getActivePlayer();
      const followZoom = mobile ? 0.72 : 0.96;
      camera.zoom = followZoom;
      focusCameraOnTile(p.tileId, followZoom);
    }
  }

  function setupBoardDragAndZoom() {
    const viewport = document.getElementById("board-viewport");
    const surface = document.getElementById("map-canvas-wrap");
    if (!viewport || !surface) return;

    viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      camera.isDragging = true;
      camera.movedDuringDrag = false;
      camera.dragStartX = e.clientX;
      camera.dragStartY = e.clientY;
      camera.dragOriginPanX = camera.panX;
      camera.dragOriginPanY = camera.panY;
      viewport.classList.add("dragging");
      surface.classList.add("manual-dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!camera.isDragging) return;
      const dx = e.clientX - camera.dragStartX;
      const dy = e.clientY - camera.dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        camera.movedDuringDrag = true;
        camera.mode = "free";
      }
      camera.panX = camera.dragOriginPanX + dx;
      camera.panY = camera.dragOriginPanY + dy;
      applyCameraTransform();
    });

    window.addEventListener("mouseup", () => {
      if (!camera.isDragging) return;
      camera.isDragging = false;
      viewport.classList.remove("dragging");
      surface.classList.remove("manual-dragging");
    });

    // Touch drag (1 finger) & Pinch-to-Zoom (2 fingers) support for Mobile Smartphones
    let initialPinchDist = null;
    let initialPinchZoom = 1;

    viewport.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          camera.isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          initialPinchDist = Math.hypot(dx, dy);
          initialPinchZoom = camera.zoom;
          surface.classList.add("manual-dragging");
          return;
        }
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        camera.isDragging = true;
        camera.movedDuringDrag = false;
        camera.dragStartX = t.clientX;
        camera.dragStartY = t.clientY;
        camera.dragOriginPanX = camera.panX;
        camera.dragOriginPanY = camera.panY;
        surface.classList.add("manual-dragging");
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && initialPinchDist) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const scaleRatio = dist / initialPinchDist;
          const oldZoom = camera.zoom;
          const newZoom = Math.min(2.0, Math.max(0.12, initialPinchZoom * scaleRatio));
          const ratio = newZoom / oldZoom;
          camera.panX *= ratio;
          camera.panY *= ratio;
          camera.zoom = newZoom;
          camera.mode = "free";
          applyCameraTransform();
          return;
        }
        if (!camera.isDragging || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - camera.dragStartX;
        const dy = t.clientY - camera.dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          camera.movedDuringDrag = true;
          camera.mode = "free";
        }
        camera.panX = camera.dragOriginPanX + dx;
        camera.panY = camera.dragOriginPanY + dy;
        applyCameraTransform();
      },
      { passive: true }
    );

    window.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        initialPinchDist = null;
      }
      if (e.touches.length === 0) {
        camera.isDragging = false;
        surface.classList.remove("manual-dragging");
      }
    });

    // Smooth Mouse Wheel Zoom centered around current pan
    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const oldZoom = camera.zoom;
        const newZoom = Math.min(2.0, Math.max(0.20, oldZoom * factor));
        const ratio = newZoom / oldZoom;
        camera.panX *= ratio;
        camera.panY *= ratio;
        camera.zoom = newZoom;
        if (camera.zoom <= 0.40) camera.mode = "wide";
        else if (camera.mode === "wide") camera.mode = "free";
        applyCameraTransform();
      },
      { passive: false }
    );
  }

  // Multiplayer state (Firebase Realtime Database + PeerJS + LAN / Multi-Tab)
  const mp = {
    mode: "local", // "local" | "firebase_host" | "firebase_client" | "p2p_host" | "p2p_client" | "lan_host" | "lan_client"
    roomCode: "",
    mySeat: -1,
    clientId: "cli_" + Math.random().toString(36).slice(2, 10),
    fbDb: null,
    fbRoomRef: null,
    fbActionsRef: null,
    fbSeatsRef: null,
    fbStateListener: null,
    fbActionListener: null,
    fbSeatsListener: null,
    onlineSeats: {},
    peer: null,
    connections: [],
    hostConn: null,
    bc: typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("eft_mp_channel") : null,
    lanTimer: null,
    lastLanTimestamp: 0,
    processedActionIds: new Set(),
    lobby: {
      status: "idle", // "idle" | "waiting" | "playing"
      hostClientId: "",
      patchId: "alpha2",
      compendiumId: "comp_beta1",
      fillWithBots: true,
      members: []
    }
  };

  function isRemoteClient() {
    return mp.mode === "firebase_client" || mp.mode === "p2p_client" || mp.mode === "lan_client";
  }

  function isMultiplayerHost() {
    return mp.mode === "firebase_host" || mp.mode === "p2p_host" || mp.mode === "lan_host";
  }

  function serializePendingInteraction() {
    if (!pendingInteraction) return null;
    const { player, ...rest } = pendingInteraction;
    return {
      ...rest,
      playerIndex: player ? player.index : state ? state.activePlayerIndex : 0
    };
  }

  function deserializePendingInteraction(raw) {
    if (!raw || !state || !state.players) return null;
    const pIdx = typeof raw.playerIndex === "number" ? raw.playerIndex : state.activePlayerIndex;
    const playerObj = state.players[pIdx] || state.players[0];
    const { playerIndex, ...rest } = raw;
    return {
      ...rest,
      player: playerObj
    };
  }

  function ensureFirebaseDb() {
    if (typeof firebase === "undefined" || typeof firebase.database !== "function") {
      throw new Error("Firebase SDK belum termuat. Periksa koneksi internet Anda.");
    }
    const cfg = typeof window.EFT_GET_FIREBASE_CONFIG === "function" ? window.EFT_GET_FIREBASE_CONFIG() : null;
    if (!cfg) {
      throw new Error("Konfigurasi Firebase belum diisi di playtest/firebaseConfig.js.");
    }
    if (firebase.apps.length === 0) {
      firebase.initializeApp(cfg);
    }
    mp.fbDb = firebase.database();
    return mp.fbDb;
  }

  if (mp.bc) {
    mp.bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !mp.roomCode || msg.roomCode !== mp.roomCode) return;
      handleIncomingMpMessage(msg);
    };
  }

  const PLAYER_COLORS = ["#ec4899", "#eab308", "#ef4444", "#38bdf8", "#10b981", "#a855f7"];

  function applyRounding(val, rules) {
    if (rules.roundingMode === "ceil") {
      return Math.ceil(val - 1e-9);
    }
    return Math.round(val);
  }

  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildDeckForCharacter(charId, compVersionId, isSamMode = false) {
    const charDef = getCharacterForCompendium(charId, compVersionId);
    if (!charDef) return [];
    const sourceCards = isSamMode && charDef.samCards ? charDef.samCards : charDef.cards;
    const deck = [];
    sourceCards.forEach((c) => {
      for (let i = 0; i < (c.count || 1); i++) {
        deck.push({
          ...c,
          uid: `${c.id}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          charId
        });
      }
    });
    return shuffleArray(deck);
  }

  function createShopState(rules) {
    return {
      1: { ultStock: 1, drawStock: rules.drawShopStock, actAgainStock: rules.actAgainStock, playerBuys: {} },
      2: { ultStock: 1, drawStock: rules.drawShopStock, actAgainStock: rules.actAgainStock, playerBuys: {} }
    };
  }

  function initGame(patchId = "alpha2", compendiumId = "comp_beta1", customRoster = null, options = {}) {
    isInitializingMatch = true;
    clearTimeout(stepTimerId);
    clearDiceOverlay();
    clearDiceOfFateTimers();
    cancelTileEffectShuffle(true);
    clearRecentActivityFeed();
    fadingShards = [];
    lastProcessedPurchasedShardId = null;
    isWalkingAnim = false;
    activeStepsRemaining = 0;
    const basePatch = DATA.RULE_PATCHES[patchId] || DATA.RULE_PATCHES.alpha2;
    const compDef = DATA.COMPENDIUM_VERSIONS[compendiumId] || DATA.COMPENDIUM_VERSIONS.comp_beta1;
    const rules = JSON.parse(JSON.stringify(basePatch));

    const allowedChars = getPlayableCharacterIds(compendiumId);
    const defaultRoster = ["bocchi", "aventurine", "joker", "lilith"];
    let rosterEntries = (customRoster || defaultRoster).map((item, idx) => {
      const cid = typeof item === "string" ? item : item && item.charId ? item.charId : allowedChars[idx % allowedChars.length];
      const validCid = allowedChars.includes(cid) ? cid : allowedChars[idx % allowedChars.length];
      return {
        charId: validCid,
        username: typeof item === "object" && item && item.username ? String(item.username).trim() : "",
        clientId: typeof item === "object" && item && item.clientId ? item.clientId : null,
        isBot: !!(typeof item === "object" && item && item.isBot)
      };
    });

    if (options.randomizeOrder) {
      rosterEntries = shuffleArray(rosterEntries);
    }

    const seatMap = {};
    const players = rosterEntries.map((entry, idx) => {
      const charDef = getCharacterForCompendium(entry.charId, compendiumId);
      const deck = buildDeckForCharacter(entry.charId, compendiumId, false);
      const hand = deck.splice(0, rules.startHandSize);
      const cleanUser = entry.username;
      if (entry.clientId) {
        seatMap[entry.clientId] = idx;
      }
      return {
        index: idx,
        id: `P${idx + 1}`,
        username: cleanUser,
        charName: charDef.name,
        name: cleanUser || charDef.name,
        clientId: entry.clientId,
        isBot: entry.isBot,
        charId: charDef.id,
        isSamMode: false,
        color: charDef.color || PLAYER_COLORS[idx % PLAYER_COLORS.length],
        tileId: "T0",
        lastTileId: null,
        inSpawn: true,
        tc: rules.startTC,
        shards: 0,
        metaShard: 0,
        metaShardBought: false,
        hand,
        deck,
        discard: [],
        skillsUsedThisTurn: 0,
        maxSkillsThisTurn: rules.maxSkillsPerTurn,
        rollsUsedThisTurn: 0,
        maxRollsThisTurn: 2,
        extraPhasesThisTurn: 0,
        nextTurnDiceMod: 0,
        nextPhaseDiceMod: 0,
        nextRollStepMod: 0,
        nextRollMaxCap: null,
        reverseNextRoll: false,
        skipNextTurn: false,
        silencedThisPhase: false,
        turnTcMultiplier: 1.0,
        passives: [],
        cooldowns: {}
      };
    });

    state = {
      patchId,
      compendiumId,
      rules,
      seatMap,
      cycle: 1,
      roundInCycle: 1,
      totalTurnsCompleted: 0,
      activePlayerIndex: 0,
      phaseIndex: 1,
      lastDiceRoll: [],
      lastDiceTotal: 0,
      players,
      activeShards: [],
      boardTokens: [],
      activeGlobalEvent: null,
      lastOpponentSkillUsed: null,
      recentOpponentSkills: [],
      lastSkillEvent: null,
      lastDiceRollEvent: null,
      lastTileEffectReveal: null,
      lastPurchasedShard: null,
      activeMinigame: null,
      activeTileModal: null,
      turnTimerKey: "tk_init_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      shops: createShopState(rules),
      winner: null,
      logs: []
    };

    lastShownSkillEventId = null;
    lastShownDiceRollEventId = null;
    lastShownDofRollEventId = null;
    lastShownTileEffectRevealId = null;
    lastTrackedTurnTimerKey = null;
    lastRenderedTileModalKey = null;
    tileModalMinimizedForId = null;
    clearTimeout(tileModalAutoCloseTimerId);
    tileModalAutoCloseTimerId = null;
    localTurnKeyStartedAt = Date.now();
    turnThinkingRemainingMs = TURN_TIME_LIMIT_SEC * 1000;
    lastTurnTimerTickAt = Date.now();
    lastTimerWarnSec = -1;
    clearTimeout(autoEndTurnTimerId);
    autoEndTurnTimerId = null;
    ensureTurnCountdownLoop();

    undoStack = [];
    pendingInteraction = null;
    selectedCardUid = null;

    for (let i = 0; i < rules.activeShardsOnBoard; i++) {
      spawnRandomShard(true);
    }

    addLog(`Match initialized: [${rules.name}] with [${compDef.name}]. Cycle 1 started.`);
    if (options.randomizeOrder) {
      const orderStr = players.map((p, i) => `${i + 1}. ${p.name}`).join(" -> ");
      addLog(`Urutan Giliran (Acak): ${orderStr}`);
      showEffectSpotlight("Urutan Pemain Diacak", "Turn Order Randomized", orderStr, null);
    }

    const patchSel = document.getElementById("rules-patch-select");
    if (patchSel) patchSel.value = patchId;
    const compSel = document.getElementById("compendium-version-select");
    if (compSel) compSel.value = compendiumId;

    camera.mode = "follow";
    focusCameraOnTile("T0", isMobilePortrait() ? 0.72 : 0.96);
    isInitializingMatch = false;
    renderAll();
    broadcastMultiplayerState();
  }

  function saveSnapshot() {
    if (!state) return;
    const snap = JSON.stringify({
      ...state,
      logs: state.logs.slice(-30)
    });
    undoStack.push(snap);
    if (undoStack.length > 25) undoStack.shift();
  }

  function undoLastAction() {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    if (undoStack.length === 0) return;
    clearTimeout(stepTimerId);
    clearTimeout(autoEndTurnTimerId);
    autoEndTurnTimerId = null;
    clearDiceOverlay();
    clearDiceOfFateTimers();
    cancelTileEffectShuffle(true);
    isWalkingAnim = false;
    activeStepsRemaining = 0;
    state = JSON.parse(undoStack.pop());
    state.turnTimerKey = "tk_undo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    pendingInteraction = null;
    selectedCardUid = null;
    addLog("Undo: Reverted to previous state.");
    if (camera.mode === "follow") {
      focusCameraOnTile(getActivePlayer().tileId);
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function addLog(text) {
    if (!state) return;
    const prefix = `[C${state.cycle}·R${state.roundInCycle}]`;
    const logId = "lg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    state.logs.unshift({
      id: logId,
      prefix,
      text
    });
    seenActivityLogIds.add(logId);
    if (seenActivityLogIds.size > 240) {
      seenActivityLogIds = new Set(state.logs.map((l) => l.id));
    }
    if (state.logs.length > 100) state.logs.pop();
    pushRecentActivity(text);
  }

  // ============================================================================
  // SHARD SPAWNING & ECONOMY HELPERS
  // ============================================================================
  function spawnRandomShard(silent = false, forcedDie = null) {
    const occupiedTiles = new Set(state.activeShards.map((s) => s.tileId));
    const available = DATA.SHARD_SPAWNS.filter((s) => !occupiedTiles.has(s.tileId));
    if (available.length === 0) return null;

    let chosen = null;
    if (forcedDie) {
      chosen = DATA.SHARD_SPAWNS.find((s) => s.die === forcedDie && !occupiedTiles.has(s.tileId));
    }
    if (!chosen) {
      chosen = available[Math.floor(Math.random() * available.length)];
    }

    while (state.activeShards.length >= state.rules.activeShardsOnBoard) {
      state.activeShards.shift();
    }
    state.activeShards.push({ ...chosen });
    if (!silent) {
      addLog(`Shard d6 rolled [${chosen.die}] -> Tartarus Shard spawned at Zone ${chosen.roman} (${chosen.tileId}).`);
      showEffectSpotlight("Tartarus Shard Spawned", `Zone ${chosen.roman} (${chosen.tileId})`, "Pass by this tile with 100 TC to claim it.", null);
      playSfx("shard");
    }
    return chosen;
  }

  function modifyPlayerTC(player, rawAmount, source = "tile") {
    let amount = rawAmount;
    if (amount > 0) {
      if (
        state.activeGlobalEvent &&
        state.activeGlobalEvent.card.multiplierTC &&
        (source === "tile" || source === "minigame")
      ) {
        amount *= state.activeGlobalEvent.card.multiplierTC;
      }
      const ipcPassive = player.passives.find((p) => p.key === "passive_ipc_gems");
      let ipcApplied = false;
      if (ipcPassive && source !== "own_skill") {
        amount *= ipcPassive.multiplier || 1.3;
        ipcApplied = true;
      }
      if (player.turnTcMultiplier && player.turnTcMultiplier > 1) {
        amount *= player.turnTcMultiplier;
      }
      amount = applyRounding(amount, state.rules);
      if (ipcApplied && rawAmount > 0) {
        addLog(`IPC Gems (${ipcPassive.multiplier || 1.3}x): ${player.name} memperoleh +${amount} TC (dari dasar ${rawAmount} TC).`);
      }
    } else if (amount < 0) {
      amount = -applyRounding(Math.abs(amount), state.rules);
    }
    player.tc = Math.max(0, player.tc + amount);
    if (!isInitializingMatch && amount !== 0) {
      playSfx(amount > 0 ? "coin_gain" : "coin_loss");
    }
    return amount;
  }

  function getEffectiveHandLimit(player) {
    for (const other of state.players) {
      if (
        other.index !== player.index &&
        !other.inSpawn &&
        hasPassive(other, "passive_daemonissa_domain") &&
        getTileDistance(player.tileId, other.tileId) <= 3
      ) {
        return 5;
      }
    }
    return state.rules.maxHandSize;
  }

  function drawCards(player, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffleArray(player.discard);
        player.discard = [];
      }
      const card = player.deck.shift();
      if (card) {
        player.hand.push(card);
        drawn.push(card);
      }
    }
    const maxLimit = getEffectiveHandLimit(player);
    let excess = 0;
    while (player.hand.length > maxLimit) {
      let idx = player.hand.findIndex((c) => c.rarity !== "Ultimate");
      if (idx === -1) idx = player.hand.length - 1;
      const removed = player.hand.splice(idx, 1)[0];
      player.discard.push(removed);
      excess++;
    }
    if (excess > 0) {
      addLog(`Hand-Limit (${maxLimit}) exceeded: ${player.name} discarded ${excess} excess card(s).`);
    }
    if (!isInitializingMatch && drawn.length > 0) {
      playSfx("card");
    }
    return drawn;
  }

  function discardRandomCards(player, count) {
    if (hasPassive(player, "passive_immune_steal")) {
      addLog(`${player.name} is immune to card destruction/stealing (Stellaron Hunter's Resolve).`);
      return [];
    }
    const removed = [];
    for (let i = 0; i < count; i++) {
      const eligibleIndices = [];
      player.hand.forEach((c, idx) => {
        if (c && c.rarity !== "Ultimate") eligibleIndices.push(idx);
      });
      if (eligibleIndices.length === 0) break;
      const pickIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
      const c = player.hand.splice(pickIdx, 1)[0];
      player.discard.push(c);
      removed.push(c);
    }
    return removed;
  }

  function hasPassive(player, key) {
    return player.passives.some((p) => p.key === key);
  }

  function checkVictory(player) {
    const totalShards = player.shards + player.metaShard;
    if (totalShards >= state.rules.victoryShards && !state.winner) {
      state.winner = {
        index: player.index,
        id: player.id,
        name: player.name,
        charId: player.charId,
        charName: player.charName || player.name,
        color: player.color,
        shards: player.shards,
        metaShard: player.metaShard,
        tc: player.tc,
        cycle: state.cycle
      };
      pendingInteraction = null;
      isWalkingAnim = false;
      closeModal();
      playSfx("shard");
      addLog(`VICTORY: ${player.name} collected ${totalShards} Tartarus Shards and escaped Tartarus!`);
      renderVictoryScreenOverlay();
      broadcastMultiplayerState();
      return true;
    }
    return false;
  }

  function renderVictoryScreenOverlay() {
    const overlay = document.getElementById("victory-screen-overlay");
    if (!overlay) return;
    const w = state ? state.winner : null;
    if (!w) {
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
      return;
    }
    const ch = DATA.CHARACTERS[w.charId] || {};
    const pt = ch.portrait || null;
    const portraitHtml =
      pt && pt.src
        ? `<img src="${pt.src}" alt="${escapeHtml(w.name)}" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
        : `<div class="ph-portrait-fallback" style="width:100%;height:100%;"><div class="ph-fallback-icon" style="fill:${escapeHtml(w.color || "#fbbf24")};">${getCharacterSvgIcon(w.charId)}</div></div>`;

    const ranked = [...(state.players || [])].sort((a, b) => {
      const sa = (a.shards || 0) + (a.metaShard || 0);
      const sb = (b.shards || 0) + (b.metaShard || 0);
      if (sb !== sa) return sb - sa;
      return (b.tc || 0) - (a.tc || 0);
    });

    const standingsHtml = ranked
      .map((p, idx) => {
        const shTot = (p.shards || 0) + (p.metaShard || 0);
        const isWinnerRow = p.id === w.id || idx === 0;
        return `
        <div class="victory-standing-row ${isWinnerRow ? "is-first" : ""}">
          <div class="victory-standing-left">
            <span class="victory-rank-badge">#${idx + 1}</span>
            <span>${escapeHtml(p.name)}</span>
          </div>
          <div style="display:flex;gap:12px;font-weight:700;color:#cbd5e1;">
            <span>💎 ${shTot}/${state.rules.victoryShards}</span>
            <span>💰 ${p.tc} TC</span>
          </div>
        </div>`;
      })
      .join("");

    const totalShards = (w.shards || 0) + (w.metaShard || 0);
    overlay.innerHTML = `
      <div class="victory-stage-card">
        <div class="victory-eyebrow">ESCAPED FROM TARTARUS · VICTORY</div>
        <div class="victory-hero-row">
          <div class="victory-portrait-frame">${portraitHtml}</div>
          <div class="victory-hero-info">
            <div class="victory-winner-name">${escapeHtml(w.name)} Menang!</div>
            <div class="victory-subtitle">Berhasil mengumpulkan ${totalShards} Shard pada Cycle ${w.cycle || state.cycle}.</div>
            <div class="victory-stats-pills">
              <span class="victory-stat-pill">💎 ${w.shards} Shard${w.metaShard ? ` + ${w.metaShard} Meta` : ""}</span>
              <span class="victory-stat-pill">💰 ${w.tc} TC</span>
              <span class="victory-stat-pill">Cycle ${w.cycle || state.cycle}</span>
            </div>
          </div>
        </div>
        <div class="victory-standings">
          ${standingsHtml}
        </div>
        <div class="victory-actions">
          <button class="victory-menu-btn" type="button" onclick="window.EFT_APP.resetGameToMainMenu()">Kembali ke Main Menu</button>
        </div>
      </div>`;
    overlay.classList.add("visible");
  }

  function resetGameToMainMenu() {
    playSfx("click");
    clearTimeout(stepTimerId);
    clearDiceOverlay();
    clearDiceOfFateTimers();
    cancelTileEffectShuffle(true);
    dismissSkillPopup(true, true);
    closeModal();
    if (mp.mode !== "local") {
      detachFirebaseListeners();
      if (mp.bc) {
        try { mp.bc.close(); } catch (e) {}
        mp.bc = null;
      }
      clearInterval(mp.lanPollInterval);
      mp.lanPollInterval = null;
      mp.mode = "local";
      mp.roomCode = "";
      mp.mySeat = -1;
      mp.lobby = {
        status: "idle",
        hostClientId: null,
        patchId: "alpha2",
        compendiumId: "comp_beta1",
        fillWithBots: true,
        members: []
      };
    }
    const vOv = document.getElementById("victory-screen-overlay");
    if (vOv) {
      vOv.classList.remove("visible");
      vOv.innerHTML = "";
    }
    showMainTitleScreen();
    initGame("alpha2", "comp_beta1", ["bocchi", "aventurine", "lilith", "joker"]);
  }

  function showMainTitleScreen() {
    isTitleScreenVisible = true;
    isMatchStarted = false;
    const screen = document.getElementById("main-title-screen");
    const loadingSec = document.getElementById("mts-loading-section");
    const menuSec = document.getElementById("mts-menu-section");
    if (screen) screen.classList.remove("is-hidden");
    if (hasPreloadedAssets) {
      if (loadingSec) loadingSec.classList.add("is-hidden");
      if (menuSec) menuSec.classList.remove("is-hidden");
    }
  }

  function hideMainTitleScreen() {
    isTitleScreenVisible = false;
    isMatchStarted = true;
    const screen = document.getElementById("main-title-screen");
    if (screen) screen.classList.add("is-hidden");
  }

  function openTitleSingleplayer() {
    playSfx("click");
    openWelcomeSetupModal("local");
  }

  function openTitleMultiplayer() {
    playSfx("click");
    openWelcomeSetupModal("multiplayer");
  }

  function collectAllPreloadAssetUrls() {
    const urls = new Set(["assets/maps/board_v2.png"]);
    if (DATA && DATA.CHARACTERS) {
      Object.values(DATA.CHARACTERS).forEach((ch) => {
        if (!ch) return;
        if (ch.portrait && ch.portrait.src) urls.add(ch.portrait.src);
        if (ch.compPortrait && ch.compPortrait.src) urls.add(ch.compPortrait.src);
        if (ch.menuPortrait) urls.add(ch.menuPortrait);
        if (ch.chibi) urls.add(ch.chibi);
        if (Array.isArray(ch.cards)) {
          ch.cards.forEach((c) => {
            if (c && c.image) urls.add(c.image);
          });
        }
        if (ch.ultimate && ch.ultimate.image) urls.add(ch.ultimate.image);
      });
    }
    if (DATA && DATA.BOARD_CARDS) {
      ["positive", "negative", "globalEvents"].forEach((groupKey) => {
        const list = DATA.BOARD_CARDS[groupKey];
        if (Array.isArray(list)) {
          list.forEach((c) => {
            if (c && c.image) urls.add(c.image);
          });
        }
      });
    }
    return Array.from(urls);
  }

  function runInitialAssetPreload(onComplete) {
    const fillEl = document.getElementById("mts-progress-fill");
    const trackEl = fillEl ? fillEl.parentElement : null;
    const loadingSec = document.getElementById("mts-loading-section");
    const menuSec = document.getElementById("mts-menu-section");

    const finishLoading = () => {
      hasPreloadedAssets = true;
      if (fillEl) fillEl.style.width = "100%";
      if (trackEl) trackEl.setAttribute("aria-valuenow", "100");
      if (loadingSec) loadingSec.classList.add("is-hidden");
      if (menuSec) menuSec.classList.remove("is-hidden");
      if (typeof onComplete === "function") onComplete();
    };

    try {
      const urls = collectAllPreloadAssetUrls();
      const total = Math.max(1, urls.length);
      let loadedCount = 0;
      let displayPct = 4;
      let finished = false;
      const startTime = Date.now();
      const minDurationMs = 1250;

      const setBarPct = (pct) => {
        const clamped = Math.max(4, Math.min(100, Math.round(pct)));
        if (fillEl) fillEl.style.width = `${clamped}%`;
        if (trackEl) trackEl.setAttribute("aria-valuenow", String(clamped));
      };

      setBarPct(4);

      urls.forEach((url) => {
        const img = new Image();
        let settled = false;
        const markDone = () => {
          if (settled) return;
          settled = true;
          loadedCount++;
        };
        img.onload = () => {
          if (typeof img.decode === "function") {
            img.decode().then(markDone).catch(markDone);
          } else {
            markDone();
          }
        };
        img.onerror = markDone;
        img.src = url;
      });

      const tickInterval = setInterval(() => {
        if (finished) {
          clearInterval(tickInterval);
          return;
        }
        const elapsed = Date.now() - startTime;
        const timeProgress = Math.min(1, elapsed / minDurationMs);
        const assetProgress = loadedCount / total;
        const effectiveProgress = Math.min(timeProgress, assetProgress);
        const targetPct = Math.max(displayPct, Math.round(effectiveProgress * 100));
        displayPct = targetPct;
        setBarPct(displayPct);

        if ((loadedCount >= total && elapsed >= minDurationMs) || elapsed >= 5000) {
          finished = true;
          clearInterval(tickInterval);
          setBarPct(100);
          setTimeout(finishLoading, 220);
        }
      }, 45);
    } catch (e) {
      finishLoading();
    }
  }

  // ============================================================================
  // ANIMATED MOVEMENT, DYNAMIC CAMERA FOLLOW, PASS-BY & INTERSECTIONS
  // ============================================================================
  function getActivePlayer() {
    return state.players[state.activePlayerIndex];
  }

  function getExpectedActingSeat() {
    if (!state) return -1;
    if (state.activeMinigame && state.activeMinigame.status === "rolling") {
      const curIdx = getCurrentDiceOfFateEntryIndex(state.activeMinigame);
      if (curIdx >= 0 && state.activeMinigame.entries[curIdx]) {
        return state.activeMinigame.entries[curIdx].playerIndex;
      }
    }
    if (pendingInteraction && pendingInteraction.player && typeof pendingInteraction.player.index === "number") {
      return pendingInteraction.player.index;
    }
    return state.activePlayerIndex;
  }

  function canLocalPlayerAct() {
    if (isProcessingRemoteAction) return true;
    if (mp.mode === "local" || mp.mySeat === -1) return true;
    return mp.mySeat === getExpectedActingSeat();
  }

  function handleRollButton() {
    if (isWalkingAnim || isTileEffectAnimating || pendingInteraction || (state && state.activeMinigame)) return;
    if (!canLocalPlayerAct()) {
      alert(`Sekarang giliran ${getActivePlayer().name}.`);
      return;
    }
    if (state.phaseIndex === 1 || state.phaseIndex === 3) {
      rollMovementDice();
    }
  }

  function handleEndTurnButton() {
    if (isWalkingAnim || isTileEffectAnimating || pendingInteraction || (state && state.activeMinigame)) return;
    if (!canLocalPlayerAct()) {
      alert(`Sekarang giliran ${getActivePlayer().name}.`);
      return;
    }
    const player = getActivePlayer();
    if ((player.rollsUsedThisTurn || 0) < 1 && state.phaseIndex !== 5) {
      alert("Minimal 1x Roll harus dilakukan sebelum End Turn.");
      return;
    }
    endCurrentTurn();
  }

  function handlePrimaryPhaseButton() {
    if (state && state.phaseIndex === 5) handleEndTurnButton();
    else handleRollButton();
  }

  function isTouchOnlyDevice() {
    return !!(window.matchMedia && window.matchMedia("(hover: none)").matches);
  }

  function getBranchPreviewPath(firstTileId, stepsRemaining, direction = 1, originTileId = null, firstViaSplitId = null) {
    const path = [firstTileId];
    const polylineIds = [];
    if (originTileId) polylineIds.push(originTileId);
    if (firstViaSplitId) polylineIds.push(firstViaSplitId);
    polylineIds.push(firstTileId);

    let curr = firstTileId;
    let prev = firstViaSplitId || originTileId;
    let left = Math.max(0, stepsRemaining - 1);
    let hitNextBranch = false;

    while (left > 0) {
      const opts = getNextPlayableOptions(curr, prev, 1);
      if (opts.length === 0) break;
      if (opts.length > 1) {
        hitNextBranch = true;
        break;
      }
      const nextOpt = opts[0];
      if (nextOpt.viaSplitId) polylineIds.push(nextOpt.viaSplitId);
      polylineIds.push(nextOpt.tileId);
      prev = nextOpt.viaSplitId || curr;
      curr = nextOpt.tileId;
      path.push(curr);
      left--;
    }

    return {
      path,
      polylineIds,
      landingTileId: curr,
      hitNextBranch,
      stepsLeftAtNextBranch: left
    };
  }

  function clearDiceOverlay() {
    clearInterval(diceAnimIntervalId);
    clearTimeout(diceAnimTimeoutId);
    diceAnimIntervalId = null;
    diceAnimTimeoutId = null;
    const overlay = document.getElementById("dice-roll-overlay");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
    }
  }

  function playDiceRollAnimation(info, onComplete) {
    clearDiceOverlay();
    const overlay = document.getElementById("dice-roll-overlay");
    if (!overlay) {
      onComplete();
      return;
    }

    const renderCubesHtml = (vals, rollingCls) =>
      vals.map((v) => `<div class="anim-die-cube ${rollingCls}">${v}</div>`).join("");

    const sides = info.sides || 6;
    const stepNoteParts = [];
    if (info.totalSteps !== info.rawTotal) stepNoteParts.push(`Awal: ${info.rawTotal}`);
    if (info.direction < 0) stepNoteParts.push("Mundur");
    const subNote = stepNoteParts.length > 0 ? ` (${stepNoteParts.join(" · ")})` : "";

    if (info.isForced) {
      overlay.innerHTML = `
        <div class="dice-anim-card landed">
          <div class="dice-anim-sub">${escapeHtml(info.player.name)}</div>
          <div class="dice-anim-cubes">${renderCubesHtml(info.rolls, "landed")}</div>
          <div class="dice-anim-total">${info.totalSteps} Langkah${escapeHtml(subNote)}</div>
        </div>`;
      overlay.classList.add("visible");
      playSfx("dice_land");
      diceAnimTimeoutId = setTimeout(() => {
        clearDiceOverlay();
        onComplete();
      }, 450);
      return;
    }

    let ticks = 0;
    const maxTicks = 8;
    const initialVals = info.rolls.map(() => Math.floor(Math.random() * sides) + 1);
    overlay.innerHTML = `
      <div class="dice-anim-card">
        <div class="dice-anim-sub">${escapeHtml(info.player.name)} mengocok dadu...</div>
        <div class="dice-anim-cubes" id="dice-anim-cubes-slot">${renderCubesHtml(initialVals, "rolling")}</div>
        <div class="dice-anim-total" style="opacity:0.45;">...</div>
      </div>`;
    overlay.classList.add("visible");
    playSfx("dice_tick");

    diceAnimIntervalId = setInterval(() => {
      ticks++;
      if (ticks < maxTicks) {
        if (ticks % 2 === 1) playSfx("dice_tick");
        const slot = document.getElementById("dice-anim-cubes-slot");
        if (slot) {
          const fakeVals = info.rolls.map(() => Math.floor(Math.random() * sides) + 1);
          slot.innerHTML = renderCubesHtml(fakeVals, "rolling");
        }
        return;
      }

      clearInterval(diceAnimIntervalId);
      diceAnimIntervalId = null;

      overlay.innerHTML = `
        <div class="dice-anim-card landed">
          <div class="dice-anim-sub">${escapeHtml(info.player.name)} mendapat</div>
          <div class="dice-anim-cubes">${renderCubesHtml(info.rolls, "landed")}</div>
          <div class="dice-anim-total">${info.totalSteps} Langkah${escapeHtml(subNote)}</div>
        </div>`;
      playSfx("dice_land");

      diceAnimTimeoutId = setTimeout(() => {
        clearDiceOverlay();
        onComplete();
      }, 720);
    }, 65);
  }

  function rollMovementDice(forcedTotal = null) {
    if (isWalkingAnim || isTileEffectAnimating) return;
    if (forcedTotal !== null && !isAdminUnlocked) {
      openAdminModal();
      return;
    }
    if (isRemoteClient() && forcedTotal === null) {
      sendClientActionToHost("roll_dice", {});
      return;
    }
    if (state.phaseIndex !== 1 && state.phaseIndex !== 2 && state.phaseIndex !== 3 && state.phaseIndex !== 4) {
      return;
    }
    saveSnapshot();
    selectedCardUid = null;
    const player = getActivePlayer();
    player.rollsUsedThisTurn = (player.rollsUsedThisTurn || 0) + 1;

    if (state.phaseIndex === 1) state.phaseIndex = 2;
    else if (state.phaseIndex === 3) state.phaseIndex = 4;

    if (player.inSpawn) {
      player.inSpawn = false;
      addLog(`${player.name} left Spawn Point (Spawn Protection expired).`);
    }

    let numDice = state.rules.diceCount;
    const sides = state.rules.diceSides;

    if (state.activeGlobalEvent && state.activeGlobalEvent.card.bonusDice) {
      numDice += state.activeGlobalEvent.card.bonusDice;
    }
    if (player.nextTurnDiceMod !== 0) {
      numDice += player.nextTurnDiceMod;
      player.nextTurnDiceMod = 0;
    }
    if (player.nextPhaseDiceMod !== 0) {
      numDice += player.nextPhaseDiceMod;
      player.nextPhaseDiceMod = 0;
    }
    numDice = Math.max(1, numDice);

    let rolls = [];
    let rawTotal = 0;
    if (forcedTotal !== null) {
      rolls = [forcedTotal];
      rawTotal = forcedTotal;
    } else {
      for (let i = 0; i < numDice; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        rawTotal += r;
      }
    }

    let totalSteps = rawTotal;
    if (hasPassive(player, "passive_sam_armor")) totalSteps += 1;
    if (player.nextRollStepMod !== 0) {
      totalSteps = Math.max(1, totalSteps + player.nextRollStepMod);
      player.nextRollStepMod = 0;
    }
    if (state.activeGlobalEvent && state.activeGlobalEvent.card.multiplierSteps) {
      totalSteps = applyRounding(totalSteps * state.activeGlobalEvent.card.multiplierSteps, state.rules);
    }
    if (player.nextRollMaxCap !== null) {
      totalSteps = Math.min(totalSteps, player.nextRollMaxCap);
      player.nextRollMaxCap = null;
    }

    let direction = 1;
    player.isBackwardMovement = false;
    if (player.reverseNextRoll) {
      direction = -1;
      player.reverseNextRoll = false;
      player.isBackwardMovement = true;
      addLog(`Mind Deviation: ${player.name} moves BACKWARD ${totalSteps} steps.`);
    }

    state.lastDiceRoll = rolls;
    state.lastDiceTotal = totalSteps * direction;
    const rollEventId = "dr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    state.lastDiceRollEvent = {
      id: rollEventId,
      playerName: player.name,
      rolls,
      rawTotal,
      totalSteps,
      direction,
      sides,
      isForced: forcedTotal !== null
    };
    lastShownDiceRollEventId = rollEventId;

    addLog(
      `${player.name} rolled [${rolls.join(" + ")}] -> Moving ${direction === -1 ? "backward " : ""}${totalSteps} steps.`
    );

    isWalkingAnim = true;
    activeStepsRemaining = totalSteps;
    camera.mode = "follow";
    focusCameraOnTile(player.tileId, Math.max(camera.zoom, isMobilePortrait() ? 0.72 : 0.96));
    renderAll();
    broadcastMultiplayerState();

    playDiceRollAnimation(
      { player, rolls, rawTotal, totalSteps, direction, sides, isForced: forcedTotal !== null },
      () => {
        if (!state) return;
        startSteppingMovement(player, totalSteps, direction, true);
      }
    );
  }

  function startSteppingMovement(player, stepsRemaining, direction = 1, activateFinalTile = true) {
    activeStepsRemaining = stepsRemaining;
    if (stepsRemaining <= 0) {
      isWalkingAnim = false;
      finishMovementPhase(player, activateFinalTile);
      return;
    }

    const options = getNextPlayableOptions(player.tileId, player.lastTileId || null, direction);

    if (options.length === 0) {
      isWalkingAnim = false;
      finishMovementPhase(player, activateFinalTile);
      return;
    }

    if (options.length === 1) {
      const opt = options[0];
      isWalkingAnim = true;
      renderAll();
      clearTimeout(stepTimerId);
      stepTimerId = setTimeout(() => {
        executeSingleStep(player, opt.tileId, stepsRemaining - 1, 1, activateFinalTile, opt.viaSplitId || null);
      }, STEP_ANIM_MS);
    } else {
      // Pause walking animation, show remaining steps & let player preview/choose turn directly on highlighted tiles!
      isWalkingAnim = false;
      hoveredBranchTileId = null;
      const candidateViaMap = {};
      const candidates = options.map((o) => {
        if (o.viaSplitId) candidateViaMap[o.tileId] = o.viaSplitId;
        return o.tileId;
      });
      pendingInteraction = {
        type: "choose_branch",
        player,
        candidates,
        candidateViaMap,
        stepsRemaining,
        direction: 1,
        activateFinalTile
      };
      if (camera.mode !== "wide") {
        focusCameraOnTile(player.tileId, isMobilePortrait() ? 0.54 : Math.min(camera.zoom, 0.74));
      }
      playSfx("branch");
      renderAll();
      broadcastMultiplayerState();
    }
  }

  function triggerUnpredictableTricksOnTile(mover, tileId, alreadyHitSet = null) {
    if (!state || !mover || mover.inSpawn || !tileId) return 0;
    let procs = 0;
    state.players.forEach((other) => {
      if (other.index === mover.index || other.inSpawn || other.tileId !== tileId) return;
      if (alreadyHitSet && alreadyHitSet.has(other.index)) return;

      let triggeredThisPair = false;
      if (hasPassive(mover, "passive_unpredictable_tricks")) {
        const disc = discardRandomCards(other, 1);
        const stolen = Math.min(5, other.tc);
        other.tc -= stolen;
        mover.tc += stolen;
        addLog(`Unpredictable Tricks: ${mover.name} melewati ${other.name} -> ${other.name} kehilangan ${disc.length} kartu & membayar ${stolen} TC.`);
        triggerDramaticSkillEvent({
          charId: mover.charId,
          cardId: "lilith_uq",
          casterName: mover.name,
          cardName: "Unpredictable Tricks",
          rarity: "Passive",
          cardImg: "assets/cards/characters/lilith/uq.png",
          description: "Pass opponent: opponent loses 1 random card and gives 5 TC.",
          outcomeText: `${mover.name} melewati ${other.name}: -${disc.length} Kartu & -${stolen} TC!`,
          profile: { theme: "passive", tagline: "PASSIVE TRIGGERED · UNPREDICTABLE TRICKS", accent: "#ef4444", accentRgb: "239, 68, 68" }
        });
        procs++;
        triggeredThisPair = true;
      }
      if (hasPassive(other, "passive_unpredictable_tricks")) {
        const disc = discardRandomCards(mover, 1);
        const stolen = Math.min(5, mover.tc);
        mover.tc -= stolen;
        other.tc += stolen;
        addLog(`Unpredictable Tricks (${other.name}): ${mover.name} melewati ${other.name} -> ${mover.name} kehilangan ${disc.length} kartu & membayar ${stolen} TC.`);
        triggerDramaticSkillEvent({
          charId: other.charId,
          cardId: "lilith_uq",
          casterName: other.name,
          cardName: "Unpredictable Tricks",
          rarity: "Passive",
          cardImg: "assets/cards/characters/lilith/uq.png",
          description: "Opponent passed you: they lose 1 random card and give 5 TC.",
          outcomeText: `${mover.name} melewati ${other.name}: ${mover.name} kehilangan ${disc.length} Kartu & ${stolen} TC!`,
          profile: { theme: "passive", tagline: "PASSIVE TRIGGERED · UNPREDICTABLE TRICKS", accent: "#ef4444", accentRgb: "239, 68, 68" }
        });
        procs++;
        triggeredThisPair = true;
      }
      if (triggeredThisPair && alreadyHitSet) {
        alreadyHitSet.add(other.index);
      }
    });
    return procs;
  }

  function applySkillPathPassChecks(mover, fromTileId, toTileId) {
    if (!fromTileId || !toTileId || fromTileId === toTileId) return;
    const pathIds = getDirectedPathToTile(fromTileId, toTileId, 10);
    const hitPlayers = new Set();
    pathIds.forEach((tid, idx) => {
      const isFinal = idx === pathIds.length - 1;
      triggerUnpredictableTricksOnTile(mover, tid, hitPlayers);
      checkTokensOnStep(mover, tid, isFinal);
    });
  }

  function triggerStageIsMinePrompt(player, normalTile) {
    if (!player || !normalTile) return false;
    const tileStepLabels = {};
    const fwdMap = getReachableTilesDirected(normalTile.id, 1, 2, 1, player.lastTileId || null);
    fwdMap.forEach((dist, tid) => {
      tileStepLabels[tid] = "+" + dist;
    });
    const bwdMap = getReachableTilesDirected(normalTile.id, 1, 1, -1, player.lastTileId || null);
    bwdMap.forEach((dist, tid) => {
      if (!tileStepLabels[tid]) tileStepLabels[tid] = "-" + dist;
    });
    const validTileIds = Object.keys(tileStepLabels);
    if (validTileIds.length === 0) return false;

    pendingInteraction = {
      type: "stage_is_mine",
      player,
      fromTileId: normalTile.id,
      validTileIds,
      tileStepLabels
    };
    addLog(`Passive [The Stage Is Mine]: ${player.name} mendarat di Normal Tile (${normalTile.id}) — pilih pindah +1 / +2 / -1 atau tetap.`);
    triggerDramaticSkillEvent({
      charId: player.charId,
      cardId: "bocchi_uq",
      casterName: player.name,
      cardName: "The Stage Is Mine",
      rarity: "Passive",
      cardImg: "assets/cards/characters/bocchi/uq.png",
      description: "[Activate Block Effect] When land on Normal Tiles, choose to move (+1/+2/-1).",
      outcomeText: `${player.name} mendarat di Normal Tile — Pilih pindah +1 / +2 / -1 di peta!`,
      profile: { theme: "passive", tagline: "UNIQUE PASSIVE TRIGGERED · BOCCHI", accent: "#ec4899", accentRgb: "236, 72, 153" }
    });
    if (camera.mode !== "wide") {
      camera.mode = "follow";
      focusCameraOnTile(normalTile.id, isMobilePortrait() ? 0.62 : 0.85);
    }
    return true;
  }

  function resolveStageIsMineChoice(tileId = null) {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("stage_is_mine_choice", { tileId });
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "stage_is_mine") return;
    const { player, fromTileId, validTileIds, tileStepLabels } = pendingInteraction;
    pendingInteraction = null;

    if (!tileId || !validTileIds.includes(tileId) || !TILE_MAP[tileId]) {
      addLog(`[The Stage Is Mine]: ${player.name} memilih tetap di [${fromTileId}].`);
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    saveSnapshot();
    playSfx("step");
    applySkillPathPassChecks(player, fromTileId, tileId);
    const stepDelta = tileStepLabels && tileStepLabels[tileId] ? tileStepLabels[tileId] : "";
    player.lastTileId = computeConsistentLastTileIdAfterJump(
      fromTileId,
      tileId,
      player.lastTileId,
      String(stepDelta).startsWith("-")
    );
    player.tileId = tileId;
    if (player.inSpawn && tileId !== "T0") player.inSpawn = false;
    const destTile = TILE_MAP[tileId];
    if (stepDelta) {
      addLog(`[The Stage Is Mine]: ${player.name} pindah ${stepDelta} tile ke [${tileId}: ${destTile.name}] dan mengaktifkan efek block!`);
    } else {
      addLog(`[The Stage Is Mine]: ${player.name} berpindah ke [${tileId}: ${destTile.name}] dan mengaktifkan efek block!`);
    }
    resolveExactLandingTile(player, destTile, { fromStagePassive: true });
    if (camera.mode === "follow") focusCameraOnTile(tileId);
    renderAll();
    broadcastMultiplayerState();
  }

  function resolveForcedAllInChoice(choice = "shard") {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("forced_all_in_choice", { choice });
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "forced_all_in_reward") return;
    const { player, targetPlayerIndex, myRoll, oppRoll } = pendingInteraction;
    const targetPlayer = state.players[targetPlayerIndex];
    pendingInteraction = null;
    closeModal();

    if (targetPlayer) {
      if (choice === "shard" && targetPlayer.shards > 0) {
        targetPlayer.shards--;
        player.shards++;
        addLog(`ULTIMATE [Forced All-In]: ${player.name} menang (${myRoll} vs ${oppRoll}) dan memilih mengambil 1 Tartarus Shard dari ${targetPlayer.name}!`);
        checkVictory(player);
      } else {
        const allTc = targetPlayer.tc;
        targetPlayer.tc = 0;
        player.tc += allTc;
        addLog(`ULTIMATE [Forced All-In]: ${player.name} menang (${myRoll} vs ${oppRoll}) dan mengambil seluruh ${allTc} TC milik ${targetPlayer.name}!`);
      }
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function executeSingleStep(player, nextTileId, stepsLeft, direction, activateFinalTile, viaSplitId = null) {
    const prevTileId = player.tileId;
    player.lastTileId = viaSplitId || prevTileId;
    player.tileId = nextTileId;
    activeStepsRemaining = stepsLeft;
    playSfx("step");

    // Dynamically track player with camera on every step!
    if (camera.mode === "follow") {
      focusCameraOnTile(nextTileId);
    }
    renderAll();

    // Check Lilith Unpredictable Tricks (both directions)
    triggerUnpredictableTricksOnTile(player, nextTileId);

    checkTokensOnStep(player, nextTileId, stepsLeft === 0);

    // Check Pass-By Tartarus Shard
    const shardIdx = state.activeShards.findIndex((s) => s.tileId === nextTileId);
    if (shardIdx !== -1 && player.tc >= state.rules.shardCost) {
      isWalkingAnim = false;
      pendingInteraction = {
        type: "prompt_shard_buy",
        player,
        shard: state.activeShards[shardIdx],
        stepsLeft,
        direction,
        activateFinalTile
      };
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    // Check Pass-By River Entry
    const tileObj = TILE_MAP[nextTileId];
    if (tileObj && tileObj.type === "river_top" && player.tc >= state.rules.riverCost && stepsLeft > 0) {
      isWalkingAnim = false;
      pendingInteraction = {
        type: "prompt_river",
        player,
        targetTileId: tileObj.riverTarget || "T69",
        stepsLeft,
        direction,
        activateFinalTile
      };
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    // Check Pass-By Roadside Merchant Shop (crossing Shop 1 split T36_INT or Shop 2 edge T67<->T68_B)
    const passedShopId = findPassedRoadsideShop(prevTileId, nextTileId, viaSplitId);
    const merchantShopToPrompt =
      passedShopId !== null ? passedShopId : tileObj && tileObj.type === "merchant" ? tileObj.shopId || 1 : null;
    if (merchantShopToPrompt !== null && player.tc >= 15) {
      isWalkingAnim = false;
      pendingInteraction = {
        type: "prompt_merchant_pass",
        player,
        shopId: merchantShopToPrompt,
        stepsLeft,
        direction,
        activateFinalTile
      };
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    startSteppingMovement(player, stepsLeft, direction, activateFinalTile);
  }

  function checkTokensOnStep(player, tileId, isExactLanding) {
    for (let i = state.boardTokens.length - 1; i >= 0; i--) {
      const tok = state.boardTokens[i];
      if (tok.tileId !== tileId) continue;

      if (tok.type === "virus_trap" && tok.ownerIndex !== player.index) {
        player.nextPhaseDiceMod = Math.max(-2, player.nextPhaseDiceMod - 1);
        state.boardTokens.splice(i, 1);
        addLog(`${player.name} terkena trap Punishing Virus (-1 dadu pada roll dadu berikutnya).`);
        showEffectSpotlight("Punishing Virus!", `${player.name} terkena Trap`, "Roll dadu berikutnya berkurang -1 dadu.", "assets/cards/characters/lilith/uc.png");
      } else if (tok.type === "herb_tile") {
        modifyPlayerTC(player, 10, "tile");
        state.boardTokens.splice(i, 1);
        addLog(`${player.name} activated Medicinal Herbs (+10 TC).`);
      } else if (tok.type === "restricted_zone" && isExactLanding && tok.ownerIndex !== player.index) {
        const fee = Math.min(20, player.tc);
        player.tc -= fee;
        state.players[tok.ownerIndex].tc += fee;
        addLog(`${player.name} landed on Restricted Zone (Paid ${fee} TC fee to ${state.players[tok.ownerIndex].name}).`);
      } else if (tok.type === "fire_tile" && isExactLanding) {
        modifyPlayerTC(player, -15, "tile");
        player.nextRollMaxCap = 6;
        state.boardTokens.splice(i, 1);
        addLog(`${player.name} landed on Deathstar Fire (-15 TC, next roll max 6).`);
      }
    }
  }

  function clearTileShuffleTimers() {
    tileShuffleTimers.forEach((tid) => clearTimeout(tid));
    tileShuffleTimers = [];
  }

  function cancelTileEffectShuffle(clearQueue = true) {
    clearTileShuffleTimers();
    isTileEffectAnimating = false;
    tileShuffleState = null;
    tileShuffleShownAt = 0;
    if (clearQueue) queuedTileEffectRuns = [];
    const overlay = document.getElementById("tile-effect-shuffle-overlay");
    if (overlay) {
      overlay.classList.remove("visible", "is-revealed");
      overlay.innerHTML = "";
    }
  }

  function getTileEffectDeckMeta(deckKind) {
    if (deckKind === "negative") {
      return {
        theme: "negative",
        eyebrow: "NEGATIVE EFFECT DECK",
        crestLabel: "CURSE",
        crestSub: "TARTARUS TRAP",
        shufflingText: "Mengocok kartu Negative Effect"
      };
    }
    if (deckKind === "event") {
      return {
        theme: "event",
        eyebrow: "GLOBAL EVENT DECK",
        crestLabel: "EVENT",
        crestSub: "WORLD FATE",
        shufflingText: "Mengocok kartu Global Event"
      };
    }
    return {
      theme: "positive",
      eyebrow: "POSITIVE EFFECT DECK",
      crestLabel: "BONUS",
      crestSub: "TARTARUS BLESSING",
      shufflingText: "Mengocok kartu Positive Effect"
    };
  }

  function buildTartarusCardBackHtml(deckKind) {
    const meta = getTileEffectDeckMeta(deckKind);
    let crestSvg = "";
    if (deckKind === "negative") {
      crestSvg = `<svg class="tef-back-crest" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="32 6 54 32 32 58 10 32" fill="currentColor" fill-opacity="0.14"/>
        <path d="M23 23 L41 41 M41 23 L23 41"/>
        <circle cx="32" cy="32" r="18" stroke-dasharray="4 4" stroke-opacity="0.6"/>
      </svg>`;
    } else if (deckKind === "event") {
      crestSvg = `<svg class="tef-back-crest" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="32" cy="32" r="20" stroke-opacity="0.72"/>
        <polygon points="32 8 38 26 56 32 38 38 32 56 26 38 8 32 26 26" fill="currentColor" fill-opacity="0.18"/>
        <circle cx="32" cy="32" r="5" fill="currentColor"/>
      </svg>`;
    } else {
      crestSvg = `<svg class="tef-back-crest" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M32 7 L38 25 L57 32 L38 39 L32 57 L26 39 L7 32 L26 25 Z" fill="currentColor" fill-opacity="0.18"/>
        <circle cx="32" cy="32" r="19" stroke-dasharray="3 4" stroke-opacity="0.58"/>
      </svg>`;
    }
    return `
      <div class="tef-card-back">
        ${crestSvg}
        <div class="tef-back-label">${meta.crestLabel}</div>
        <div class="tef-back-sub">${meta.crestSub}</div>
      </div>`;
  }

  function flushNextQueuedTileEffect() {
    if (tileShuffleState || isSkillActivationInFlight) return;
    const skillOv = document.getElementById("skill-dramatic-overlay");
    if (skillOv && skillOv.classList.contains("visible")) return;
    if (queuedTileEffectRuns.length === 0) {
      isTileEffectAnimating = false;
      return;
    }
    const nextJob = queuedTileEffectRuns.shift();
    _launchTileEffectShuffle(nextJob);
  }

  function dismissTileEffectOverlay(force = false) {
    if (!tileShuffleState) return;
    if (!force) {
      if (tileShuffleState.phase !== "revealed") return;
      if (tileShuffleShownAt && Date.now() - tileShuffleShownAt < 180) return;
    }
    const postDismiss = tileShuffleState.onPostDismiss;
    clearTileShuffleTimers();
    tileShuffleState = null;
    tileShuffleShownAt = 0;
    const overlay = document.getElementById("tile-effect-shuffle-overlay");
    if (overlay) {
      overlay.classList.remove("visible", "is-revealed");
      overlay.innerHTML = "";
    }
    if (typeof postDismiss === "function") {
      postDismiss();
    }
    if (queuedTileEffectRuns.length > 0) {
      flushNextQueuedTileEffect();
    } else {
      isTileEffectAnimating = false;
      renderAll();
    }
  }

  function onTileEffectOverlayClick() {
    if (!tileShuffleState) return;
    if (tileShuffleState.phase !== "revealed") return;
    if (tileShuffleShownAt && Date.now() - tileShuffleShownAt < 180) return;
    playSfx("click");
    dismissTileEffectOverlay(true);
  }

  function startTileEffectCardShuffle(job) {
    if (!job || !job.card) return false;
    isTileEffectAnimating = true;
    const skillOv = document.getElementById("skill-dramatic-overlay");
    const skillVisible = !!(skillOv && skillOv.classList.contains("visible"));
    if (isSkillActivationInFlight || skillVisible || tileShuffleState) {
      queuedTileEffectRuns.push(job);
      return true;
    }
    _launchTileEffectShuffle(job);
    return true;
  }

  function _launchTileEffectShuffle(job) {
    const overlay = document.getElementById("tile-effect-shuffle-overlay");
    if (!overlay || !job || !job.card) {
      let fallbackRes = null;
      if (!job.visualOnly && typeof job.applyFn === "function") {
        fallbackRes = job.applyFn(job.card);
      }
      if (typeof job.onComplete === "function") job.onComplete();
      if (fallbackRes && fallbackRes.needsMinigame) {
        runClashOfFateMinigame("Global Event: Sudden Minigame");
      }
      isTileEffectAnimating = false;
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    clearTileShuffleTimers();
    const deckKind = job.deckKind || "positive";
    const meta = getTileEffectDeckMeta(deckKind);
    const card = job.card;
    const playerName = job.playerName || (job.player ? job.player.name : "Arena");
    const tileName = job.tileName || (job.tile ? job.tile.name : meta.eyebrow);
    const revealId = job.revealId || ("tef_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6));

    if (!job.visualOnly && state) {
      state.lastTileEffectReveal = {
        id: revealId,
        deckKind,
        playerName,
        tileName,
        card: {
          id: card.id,
          name: card.name,
          category: card.category,
          description: card.description,
          image: card.image
        },
        outcomeText: ""
      };
      lastShownTileEffectRevealId = revealId;
      broadcastMultiplayerState();
    }

    const backHtml = buildTartarusCardBackHtml(deckKind);
    const cardImg = card.image || "";

    tileShuffleState = {
      id: revealId,
      phase: "shuffling",
      deckKind,
      card,
      visualOnly: !!job.visualOnly,
      outcomeText: job.outcomeText || "",
      onPostDismiss: null
    };
    isTileEffectAnimating = true;

    overlay.innerHTML = `
      <div id="tef-stage-box" class="tef-stage theme-${meta.theme} phase-shuffling">
        <div class="tef-header">
          <div class="tef-deck-eyebrow">${escapeHtml(meta.eyebrow)}</div>
          <div class="tef-deck-sub"><strong>${escapeHtml(playerName)}</strong> memasuki <strong>${escapeHtml(tileName)}</strong></div>
        </div>

        <div class="tef-deck-arena">
          <div class="tef-ambient-glow"></div>
          <div class="tef-reveal-burst"></div>
          <div class="tef-sat-card tef-sat-1">${backHtml}</div>
          <div class="tef-sat-card tef-sat-2">${backHtml}</div>
          <div class="tef-sat-card tef-sat-3">${backHtml}</div>
          <div class="tef-sat-card tef-sat-4">${backHtml}</div>
          <div class="tef-hero-wrap">
            <div class="tef-hero-flipper">
              <div class="tef-card-face tef-face-back">${backHtml}</div>
              <div class="tef-card-face tef-face-front">
                ${cardImg ? `<img src="${escapeHtml(cardImg)}" alt="${escapeHtml(card.name)}" />` : backHtml}
              </div>
            </div>
          </div>
        </div>

        <div id="tef-info-box" class="tef-info-box">
          <div class="tef-shuffling-status">
            <span>${escapeHtml(meta.shufflingText)}</span>
            <span class="tef-dots"><span></span><span></span><span></span></span>
          </div>
        </div>
      </div>`;

    overlay.classList.remove("is-revealed");
    overlay.classList.add("visible");

    // Soft rhythmic card riffle sounds during the shuffle stage
    [30, 250, 480, 720, 940].forEach((ms) => {
      tileShuffleTimers.push(
        setTimeout(() => {
          if (tileShuffleState && tileShuffleState.id === revealId && tileShuffleState.phase === "shuffling") {
            playSfx("card_shuffle");
          }
        }, ms)
      );
    });

    // Stage 2: Start 3D flip at 1120ms
    tileShuffleTimers.push(
      setTimeout(() => {
        if (!tileShuffleState || tileShuffleState.id !== revealId) return;
        tileShuffleState.phase = "flipping";
        const stageBox = document.getElementById("tef-stage-box");
        if (stageBox) {
          stageBox.classList.remove("phase-shuffling");
          stageBox.classList.add("phase-flipping");
        }
        playSfx("card");
      }, 1120)
    );

    // Stage 3: Card lands face-up at 1560ms -> APPLY EFFECT NOW & show result!
    tileShuffleTimers.push(
      setTimeout(() => {
        if (!tileShuffleState || tileShuffleState.id !== revealId) return;
        tileShuffleState.phase = "revealed";
        tileShuffleShownAt = Date.now();

        let outcomeText = tileShuffleState.outcomeText || "";
        let needsMinigame = false;

        if (!job.visualOnly && typeof job.applyFn === "function") {
          const res = job.applyFn(card);
          if (typeof res === "string") {
            outcomeText = res;
          } else if (res && typeof res === "object") {
            outcomeText = res.outcomeText || "";
            needsMinigame = !!res.needsMinigame;
          }
          if (job.extraOutcomeNote) {
            outcomeText = outcomeText ? `${outcomeText} · ${job.extraOutcomeNote}` : job.extraOutcomeNote;
          }
          tileShuffleState.outcomeText = outcomeText;
          if (state && state.lastTileEffectReveal && state.lastTileEffectReveal.id === revealId) {
            state.lastTileEffectReveal.outcomeText = outcomeText;
          }
          if (needsMinigame) {
            tileShuffleState.onPostDismiss = () => {
              runClashOfFateMinigame("Global Event: Sudden Minigame");
              renderAll();
              broadcastMultiplayerState();
            };
          }
          if (typeof job.onComplete === "function") {
            job.onComplete();
          } else {
            renderAll();
            broadcastMultiplayerState();
          }
        }

        playSfx("card_reveal", deckKind);

        const stageBox = document.getElementById("tef-stage-box");
        if (stageBox) {
          stageBox.classList.remove("phase-flipping");
          stageBox.classList.add("phase-revealed");
        }
        overlay.classList.add("is-revealed");

        const infoBox = document.getElementById("tef-info-box");
        if (infoBox) {
          infoBox.innerHTML = `
            <div class="tef-result-panel">
              <div class="tef-card-title">${escapeHtml(card.name)}</div>
              <div class="tef-card-desc">${escapeHtml(card.description || "")}</div>
              <div id="tef-outcome-pill-slot">${outcomeText ? `<div class="tef-outcome-pill">${escapeHtml(outcomeText)}</div>` : ""}</div>
              <div class="tef-continue-hint">${needsMinigame ? "Klik di mana saja untuk memulai Dice of Fate" : "Klik di mana saja untuk lanjut"}</div>
            </div>`;
        }

        const autoCloseMs = needsMinigame ? 2600 : 3200;
        tileShuffleTimers.push(
          setTimeout(() => {
            if (tileShuffleState && tileShuffleState.id === revealId) {
              dismissTileEffectOverlay(true);
            }
          }, autoCloseMs)
        );
      }, 1560)
    );
  }

  function finalizeMovementPhaseProgress(player) {
    if (!state || !player) return;
    if (state.phaseIndex === 2) {
      state.phaseIndex = 3;
      player.silencedThisPhase = false;
    } else if (state.phaseIndex === 4) {
      if (player.extraPhasesThisTurn > 0) {
        player.extraPhasesThisTurn--;
        state.phaseIndex = 3;
        addLog(`${player.name} activated Extra Roll Phase.`);
      } else {
        state.phaseIndex = 5;
      }
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function finishMovementPhase(player, activateFinalTile) {
    isWalkingAnim = false;
    activeStepsRemaining = 0;
    pendingInteraction = null;
    hoveredBranchTileId = null;
    if (player && player.isBackwardMovement) {
      player.lastTileId = getOppositeAdjacentNeighbor(player.tileId, player.lastTileId);
      player.isBackwardMovement = false;
    }
    const tile = TILE_MAP[player.tileId];
    if (camera.mode === "follow") {
      focusCameraOnTile(player.tileId);
    }
    let isAsyncEffect = false;
    if (activateFinalTile && tile) {
      isAsyncEffect =
        resolveExactLandingTile(player, tile, {
          onComplete: () => finalizeMovementPhaseProgress(player)
        }) === true;
    }
    if (!isAsyncEffect) {
      finalizeMovementPhaseProgress(player);
    } else {
      renderAll();
      broadcastMultiplayerState();
    }
  }

  function resolveExactLandingTile(player, tile, meta = {}) {
    if (!tile) return false;
    addLog(`${player.name} landed on [${tile.id}: ${tile.name}].`);

    switch (tile.type) {
      case "normal": {
        if (!meta.fromStagePassive && hasPassive(player, "passive_stage_is_mine")) {
          triggerStageIsMinePrompt(player, tile);
        }
        return false;
      }
      case "tc_plus10": {
        const gained = modifyPlayerTC(player, 10, "tile");
        addLog(`${player.name} gained +${gained} TC (Total: ${player.tc} TC).`);
        return false;
      }
      case "tc_minus5": {
        const lost = modifyPlayerTC(player, -5, "tile");
        addLog(`${player.name} lost ${lost} TC (Total: ${player.tc} TC).`);
        return false;
      }
      case "card_plus1": {
        const d = drawCards(player, 1);
        addLog(`${player.name} drew +${d.length} card.`);
        return false;
      }
      case "card_minus1": {
        const disc = discardRandomCards(player, 1);
        addLog(`${player.name} discarded ${disc.length} card.`);
        return false;
      }
      case "pos_effect": {
        const deck = DATA.BOARD_CARDS.positive;
        const card = deck[Math.floor(Math.random() * deck.length)];
        return startTileEffectCardShuffle({
          deckKind: "positive",
          player,
          tile,
          card,
          applyFn: (drawnCard) => applyBoardEffectCard(player, drawnCard, { showToast: false }),
          onComplete: meta.onComplete
        });
      }
      case "neg_effect": {
        const deck = DATA.BOARD_CARDS.negative;
        const card = deck[Math.floor(Math.random() * deck.length)];
        return startTileEffectCardShuffle({
          deckKind: "negative",
          player,
          tile,
          card,
          applyFn: (drawnCard) => applyBoardEffectCard(player, drawnCard, { showToast: false }),
          onComplete: meta.onComplete
        });
      }
      case "event": {
        let jokerPassiveNote = "";
        if (hasPassive(player, "passive_awaken_arsene")) {
          player.nextPhaseDiceMod += 1;
          addLog(`Awaken, Arsene!: ${player.name} mendapat +1 ekstra dadu untuk Phase berikutnya!`);
          jokerPassiveNote = `Awaken, Arsene!: ${player.name} +1 Ekstra Dadu di Phase berikutnya`;
        }
        const deck = DATA.BOARD_CARDS.globalEvents;
        const card = deck[Math.floor(Math.random() * deck.length)];
        return startTileEffectCardShuffle({
          deckKind: "event",
          player,
          tile,
          card,
          extraOutcomeNote: jokerPassiveNote,
          applyFn: (drawnCard) => triggerGlobalEventCard(drawnCard, { showToast: false, deferMinigame: true }),
          onComplete: meta.onComplete
        });
      }
      case "versus": {
        if (hasPassive(player, "passive_awaken_arsene")) {
          player.nextPhaseDiceMod += 1;
          addLog(`Awaken, Arsene!: ${player.name} mendapat +1 ekstra dadu untuk Phase berikutnya!`);
          triggerDramaticSkillEvent({
            charId: player.charId,
            cardId: "joker_uq",
            casterName: player.name,
            cardName: "Awaken, Arsene!",
            rarity: "Passive",
            cardImg: "assets/cards/characters/joker/uq.png",
            description: "Each time you land on an Event or Versus tile, gain +1 extra dice roll for your next Phase.",
            outcomeText: `${player.name} mendapat +1 Ekstra Dadu di Phase berikutnya!`,
            profile: { theme: "passive", tagline: "PASSIVE TRIGGERED · AWAKEN, ARSENE!", accent: "#dc2626", accentRgb: "220, 38, 38" }
          });
        }
        openVersusModal(player);
        return false;
      }
      case "trading": {
        openTradingModal(player);
        return false;
      }
      case "warp": {
        if (tile.warpTarget) {
          const dest = tile.warpTarget;
          player.tileId = dest;
          player.lastTileId = (PREV_MAP[dest] && PREV_MAP[dest][0]) || null;
          addLog(`Warp Teleporter: ${player.name} teleported to [${dest}].`);
          showEffectSpotlight("Warp Teleporter", `${player.name} -> ${dest}`, "Instant dimensional warp triggered.", null);
          if (camera.mode === "follow") focusCameraOnTile(dest);
        }
        return false;
      }
      case "merchant": {
        openMerchantModal(tile.shopId || 1);
        return false;
      }
      default:
        return false;
    }
  }

  function applyBoardEffectCard(player, card, opts = {}) {
    const showToast = opts.showToast !== false;
    let outcomeText = card.description || "";
    if (card.effectType === "tc") {
      const delta = modifyPlayerTC(player, card.value, "tile");
      const sign = delta >= 0 ? "+" : "";
      addLog(`Board Card [${card.name}]: ${player.name} ${sign}${delta} TC.`);
      outcomeText = `${player.name} ${sign}${delta} TC (Total: ${player.tc} TC)`;
    } else if (card.effectType === "draw") {
      const drawn = drawCards(player, card.value);
      addLog(`Board Card [${card.name}]: ${player.name} drew ${drawn.length} card(s).`);
      outcomeText = `${player.name} menarik +${drawn.length} kartu`;
    } else if (card.effectType === "discard") {
      const disc = discardRandomCards(player, card.value);
      addLog(`Board Card [${card.name}]: ${player.name} discarded ${disc.length} card(s).`);
      outcomeText = `${player.name} membuang ${disc.length} kartu`;
    } else if (card.effectType === "dice_next_turn") {
      player.nextTurnDiceMod += card.value;
      const sign = card.value > 0 ? "+" : "";
      addLog(`Board Card [${card.name}]: ${player.name} ${sign}${card.value} die next turn.`);
      outcomeText = `${player.name} ${sign}${card.value} dadu di giliran berikutnya`;
    }
    if (showToast) {
      showEffectSpotlight(card.category, card.name, card.description, card.image);
    }
    return outcomeText;
  }

  function triggerGlobalEventCard(card, opts = {}) {
    const showToast = opts.showToast !== false;
    const deferMinigame = !!opts.deferMinigame;
    addLog(`GLOBAL EVENT: [${card.name}] — ${card.description}`);
    if (showToast) {
      showEffectSpotlight("Global Event", card.name, card.description, card.image);
    }

    let outcomeText = card.description || "Efek Global aktif!";
    let needsMinigame = false;

    if (card.effectType === "global_buff") {
      state.activeGlobalEvent = {
        card,
        remainingTurns: card.durationTurns || 4
      };
      outcomeText = `Global Event aktif selama 1 ronde penuh!`;
    } else if (card.effectType === "instant_all_tc") {
      state.players.forEach((p) => modifyPlayerTC(p, card.value, "tile"));
      const sign = card.value >= 0 ? "+" : "";
      outcomeText = `Seluruh pemain langsung ${sign}${card.value} TC!`;
    } else if (card.effectType === "instant_minigame") {
      if (deferMinigame) {
        needsMinigame = true;
        outcomeText = "Dice of Fate segera dimulai untuk semua pemain!";
      } else {
        runClashOfFateMinigame("Global Event: Sudden Minigame");
      }
    } else if (card.effectType === "instant_shuffle_all") {
      state.players.forEach((p) => reshufflePlayerCycleDeck(p));
      outcomeText = "Seluruh deck pemain dikocok ulang & menarik kartu baru!";
    }
    if (!deferMinigame) {
      renderAll();
      broadcastMultiplayerState();
    }
    return { outcomeText, needsMinigame };
  }

  function reshufflePlayerCycleDeck(p) {
    const retained = p.hand.filter((c) => c.retain || c.rarity === "Ultimate");
    const nonRetained = p.hand.filter((c) => !c.retain && c.rarity !== "Ultimate");
    const cleanDeck = (p.deck || []).filter((c) => c.rarity !== "Ultimate");
    const cleanDiscard = (p.discard || []).filter((c) => c.rarity !== "Ultimate");
    const fullPool = [...cleanDeck, ...cleanDiscard, ...nonRetained];
    p.deck = shuffleArray(fullPool);
    p.discard = [];
    p.hand = [...retained];
    drawCards(p, state.rules.startHandSize);
  }

  // ============================================================================
  // TURN START REMINDER, 180s ACTION TIMER & AUTO END TURN ENGINE
  // ============================================================================
  function generateTurnTimerKey() {
    if (!state) return "tk_" + Date.now();
    return `tk_c${state.cycle}_r${state.roundInCycle}_p${state.activePlayerIndex}_t${state.totalTurnsCompleted}_${Date.now().toString(36)}`;
  }

  function triggerTurnStartReminder(player) {
    if (!player || !state || isInitializingMatch || !isMatchStarted || isTitleScreenVisible) return;
    const banner = document.getElementById("turn-reminder-banner");
    const isMyMultiplayerTurn = mp.mode !== "local" && mp.mySeat !== -1 && mp.mySeat === player.index;
    const isLocalTurn = mp.mode === "local" || mp.mySeat === -1;

    playSfx("turn_reminder", isMyMultiplayerTurn || isLocalTurn ? "my_turn" : "normal");

    if (!banner) return;
    clearTimeout(turnReminderTimeoutId);
    clearTimeout(turnReminderFadeTimeoutId);

    const badgeText = isMyMultiplayerTurn ? "GILIRAN KAMU" : `CYCLE ${state.cycle} · ROUND ${state.roundInCycle}`;
    const mainText = isMyMultiplayerTurn
      ? `Giliranmu dimulai, ${player.name}! (Batas waktu: 180 detik)`
      : `Giliran ${player.name} dimulai (Waktu: 03:00)`;

    banner.style.setProperty("--turn-accent", player.color || "#34d399");
    banner.classList.remove("fading-out");
    banner.classList.toggle("is-my-turn", isMyMultiplayerTurn);
    banner.innerHTML = `
      <span class="turn-reminder-badge">${escapeHtml(badgeText)}</span>
      <span>${escapeHtml(mainText)}</span>`;
    banner.classList.add("visible");

    turnReminderFadeTimeoutId = setTimeout(() => {
      banner.classList.add("fading-out");
    }, 2400);
    turnReminderTimeoutId = setTimeout(() => {
      banner.classList.remove("visible", "fading-out", "is-my-turn");
      banner.innerHTML = "";
    }, 2900);
  }

  function formatTurnCountdown(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function isInteractiveGameplayModalOpen() {
    const modal = document.getElementById("app-modal");
    if (!modal || !modal.classList.contains("open")) return false;
    const titleEl = document.getElementById("modal-title");
    const kind = titleEl && titleEl.dataset ? titleEl.dataset.modalKind || "" : "";
    if (kind === "welcome_lobby") return false;
    return true;
  }

  function isTurnTimerPausedForAnimation() {
    if (!isMatchStarted || isTitleScreenVisible) return true;
    if (!state || state.winner || state.activeMinigame) return true;
    const modal = document.getElementById("app-modal");
    const titleEl = document.getElementById("modal-title");
    if (modal && modal.classList.contains("open") && titleEl && titleEl.dataset && titleEl.dataset.modalKind === "welcome_lobby") {
      return true;
    }
    if (isWalkingAnim || isTileEffectAnimating || tileShuffleState) return true;
    if (diceAnimIntervalId || diceAnimTimeoutId) return true;
    const diceOv = document.getElementById("dice-roll-overlay");
    if (diceOv && diceOv.classList.contains("visible")) return true;
    const skillOv = document.getElementById("skill-dramatic-overlay");
    if (skillOv && skillOv.classList.contains("visible")) return true;
    return false;
  }

  function scheduleAutoEndTurnIfReady() {
    clearTimeout(autoEndTurnTimerId);
    autoEndTurnTimerId = null;
    if (!isMatchStarted || isTitleScreenVisible) return;
    if (!state || state.winner || state.activeMinigame) return;
    if (isRemoteClient()) return;
    if (state.phaseIndex !== 5) return;
    if (isWalkingAnim || isTileEffectAnimating || tileShuffleState || pendingInteraction) return;
    if (state.activeTileModal) return;
    if (isInteractiveGameplayModalOpen()) return;

    autoEndTurnTimerId = setTimeout(() => {
      autoEndTurnTimerId = null;
      if (!state || state.winner || state.activeMinigame || isRemoteClient()) return;
      if (state.phaseIndex !== 5) return;
      if (isWalkingAnim || isTileEffectAnimating || tileShuffleState || pendingInteraction) return;
      if (state.activeTileModal) return;
      if (isInteractiveGameplayModalOpen()) return;
      endCurrentTurn({ isAuto: true });
    }, 520);
  }

  function updateTurnTimerUi() {
    const el = document.getElementById("metric-turn-timer");
    const now = Date.now();
    const dt = lastTurnTimerTickAt > 0 ? Math.max(0, Math.min(2000, now - lastTurnTimerTickAt)) : 0;
    lastTurnTimerTickAt = now;

    if (!el) return;
    if (!state || state.winner || state.activeMinigame) {
      el.textContent = "03:00";
      el.classList.remove("is-warning", "is-critical");
      return;
    }

    if (!isTurnTimerPausedForAnimation()) {
      turnThinkingRemainingMs = Math.max(0, turnThinkingRemainingMs - dt);
    }

    const remainingSec = Math.max(0, Math.ceil(turnThinkingRemainingMs / 1000));
    el.textContent = formatTurnCountdown(remainingSec);
    el.classList.toggle("is-warning", remainingSec <= 30 && remainingSec > 10);
    el.classList.toggle("is-critical", remainingSec <= 10);

    if (
      !isTurnTimerPausedForAnimation() &&
      remainingSec <= 10 &&
      remainingSec >= 1 &&
      remainingSec !== lastTimerWarnSec &&
      canLocalPlayerAct()
    ) {
      lastTimerWarnSec = remainingSec;
      playSfx("timer_warn");
    }

    if (turnThinkingRemainingMs <= 0 && !isRemoteClient()) {
      forceExpireCurrentTurn();
    }
  }

  function ensureTurnCountdownLoop() {
    if (turnTimerIntervalId) clearInterval(turnTimerIntervalId);
    lastTurnTimerTickAt = Date.now();
    turnTimerIntervalId = setInterval(() => {
      updateTurnTimerUi();
    }, 250);
  }

  function forceExpireCurrentTurn() {
    if (!state || state.winner || state.activeMinigame || isRemoteClient()) return;
    const player = getActivePlayer();
    if (!player) return;

    clearTimeout(stepTimerId);
    clearTimeout(autoEndTurnTimerId);
    clearTimeout(tileModalAutoCloseTimerId);
    autoEndTurnTimerId = null;
    tileModalAutoCloseTimerId = null;
    clearDiceOverlay();
    cancelTileEffectShuffle(true);
    dismissSkillPopup(true, true);
    isWalkingAnim = false;
    activeStepsRemaining = 0;
    pendingInteraction = null;
    state.activeTileModal = null;
    hoveredBranchTileId = null;
    if (isInteractiveGameplayModalOpen()) {
      closeModal();
    }

    player.rollsUsedThisTurn = Math.max(1, player.rollsUsedThisTurn || 1);
    state.phaseIndex = 5;
    addLog(`Waktu giliran habis (180 detik) — Giliran ${player.name} otomatis berakhir!`);
    showEffectSpotlight("Waktu Habis (180 Detik)", `${player.name} — Auto End Turn`, "Batas waktu 3 menit terlampaui, giliran otomatis diakhiri.", null);
    endCurrentTurn({ forceTimeout: true });
  }

  // ============================================================================
  // END OF TURN, MINIGAME & CYCLE RESET
  // ============================================================================
  function endCurrentTurn(opts = {}) {
    const isAuto = !!(opts && (opts.isAuto || opts.forceTimeout));
    if (!opts.forceTimeout && (isWalkingAnim || isTileEffectAnimating || (state && state.activeMinigame))) return;
    if (!isAuto && !canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("end_turn", {});
      return;
    }
    const player = getActivePlayer();
    if (!opts.forceTimeout && (player.rollsUsedThisTurn || 0) < 1 && state.phaseIndex !== 5) return;
    clearTimeout(autoEndTurnTimerId);
    clearTimeout(tileModalAutoCloseTimerId);
    autoEndTurnTimerId = null;
    tileModalAutoCloseTimerId = null;
    saveSnapshot();
    selectedCardUid = null;
    player.skillsUsedThisTurn = 0;
    player.maxSkillsThisTurn = state.rules.maxSkillsPerTurn;
    player.rollsUsedThisTurn = 0;
    player.maxRollsThisTurn = 2;
    player.extraPhasesThisTurn = 0;
    player.turnTcMultiplier = 1.0;
    player.silencedThisPhase = false;
    pendingInteraction = null;
    state.activeTileModal = null;

    state.players.forEach((other) => {
      if (
        other.index !== player.index &&
        !other.inSpawn &&
        hasPassive(other, "passive_daemonissa_domain") &&
        getTileDistance(player.tileId, other.tileId) <= 3
      ) {
        player.nextTurnDiceMod = Math.max(-1, player.nextTurnDiceMod - 1);
        addLog(`Daemonissa's Domain: ${player.name} ended turn within 3 blocks of ${other.name} (-1 die next turn).`);
      }
    });

    if (state.activeGlobalEvent) {
      state.activeGlobalEvent.remainingTurns--;
      if (state.activeGlobalEvent.remainingTurns <= 0) {
        addLog(`Global Event [${state.activeGlobalEvent.card.name}] expired.`);
        state.activeGlobalEvent = null;
      }
    }

    state.players.forEach((p) => {
      p.passives = p.passives.filter((pas) => {
        if (pas.expiresOnCycleEnd) {
          return true;
        }
        if (typeof pas.remainingTurns === "number") {
          pas.remainingTurns--;
          if (pas.remainingTurns <= 0) {
            addLog(`Passive [${pas.name}] milik ${p.name} telah berakhir.`);
            return false;
          }
          return true;
        }
        return true;
      });
    });

    state.boardTokens = state.boardTokens.filter((t) => {
      if (typeof t.remainingTurns === "number") {
        t.remainingTurns--;
        return t.remainingTurns > 0;
      }
      return true;
    });

    state.totalTurnsCompleted++;

    if (
      state.rules.shardSpawnUnit === "turn" &&
      state.totalTurnsCompleted % state.rules.shardSpawnInterval === 0
    ) {
      spawnRandomShard(false);
    }

    if (state.activePlayerIndex < state.players.length - 1) {
      state.activePlayerIndex++;
      startPlayerTurn(getActivePlayer());
    } else {
      startDiceOfFateMinigame(`Akhir Ronde ${state.roundInCycle} · Cycle ${state.cycle}`, "advance_round");
      return;
    }

    // Smoothly pan camera to the new active player when their turn begins!
    if (camera.mode !== "wide") {
      camera.mode = "follow";
      focusCameraOnTile(getActivePlayer().tileId);
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function startPlayerTurn(player) {
    state.lastDiceRoll = [];
    state.lastDiceTotal = 0;
    player.rollsUsedThisTurn = 0;
    player.maxRollsThisTurn = 2;
    player.extraPhasesThisTurn = 0;
    state.turnTimerKey = generateTurnTimerKey();
    Object.keys(player.cooldowns).forEach((k) => {
      if (player.cooldowns[k] > 0) player.cooldowns[k]--;
    });

    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      addLog(`${player.name} skips this turn (Dreamfall Showdown / Last Lullaby).`);
      state.phaseIndex = 5;
      return;
    }
    state.phaseIndex = 1;
  }

  function completeFullCycle() {
    const finishedCycle = state.cycle;
    state.cycle++;
    state.roundInCycle = 1;
    state.shops = createShopState(state.rules);
    state.recentOpponentSkills = [];
    state.lastOpponentSkillUsed = null;

    // Expire all active Unique / Passive effects on cycle transition & reshuffle decks
    state.players.forEach((p) => {
      if (Array.isArray(p.passives) && p.passives.length > 0) {
        p.passives.forEach((pas) => {
          addLog(`Passive [${pas.name}] milik ${p.name} hangus karena pergantian Cycle (${finishedCycle} -> ${state.cycle}).`);
        });
        p.passives = [];
      }
      reshufflePlayerCycleDeck(p);
    });

    state.boardTokens = state.boardTokens.filter((t) => {
      if (typeof t.remainingCycles === "number") {
        t.remainingCycles--;
        return t.remainingCycles > 0;
      }
      return true;
    });

    if (
      state.rules.shardSpawnUnit === "cycle" &&
      (state.cycle - 1) % state.rules.shardSpawnInterval === 0
    ) {
      spawnRandomShard(false);
    }

    addLog(`CYCLE ${state.cycle} STARTED: Semua Passive Cycle ${finishedCycle} hangus, Deck dikocok ulang (6 kartu), Merchant Shop di-refresh.`);
  }

  function clearDiceOfFateTimers() {
    clearInterval(dofRollAnimInterval);
    clearTimeout(dofBotTimer);
    clearTimeout(dofTieTimer);
    clearTimeout(dofAutoFinishTimer);
    dofRollAnimInterval = null;
    dofBotTimer = null;
    dofTieTimer = null;
    dofAutoFinishTimer = null;
  }

  function startDiceOfFateMinigame(reasonTitle = "Minigame", afterAction = "none") {
    if (!state) return;
    clearDiceOfFateTimers();
    const payouts = state.rules.minigamePayouts || [30, 15, 15, 10];
    state.activeMinigame = {
      id: "dof_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: "Dice of Fate",
      reasonTitle,
      status: "rolling", // "rolling" | "tie_pause" | "finished"
      tieRound: 0,
      tiedNames: [],
      activeOrder: state.players.map((_, i) => i),
      currentOrderPos: 0,
      isAnimatingRoll: false,
      afterAction,
      payouts,
      winnerName: "",
      winnerTotal: 0,
      entries: state.players.map((p) => {
        const ch = DATA.CHARACTERS[p.charId] || {};
        return {
          playerIndex: p.index,
          name: p.name,
          charName: p.charName || ch.name || p.name,
          charId: p.charId,
          color: p.color || ch.color || "#34d399",
          colorRgb: ch.colorRgb || "52, 211, 153",
          isBot: !!p.isBot,
          d1: null,
          d2: null,
          total: null,
          finalScore: 0,
          roundReached: 1,
          eliminated: false,
          isTied: false,
          tieBreak: 0,
          rank: null,
          reward: 0,
          isWinner: false,
          justLanded: false
        };
      })
    };

    playSfx("turn");
    renderAll();
    broadcastMultiplayerState();
    scheduleDiceOfFateBotIfNeeded();
  }

  function canLocalPlayerRollDiceOfFate(entry) {
    if (!entry) return false;
    if (mp.mode === "local" || mp.mySeat === -1) return true;
    if (isMultiplayerHost() && entry.isBot) return true;
    return mp.mySeat === entry.playerIndex;
  }

  function getCurrentDiceOfFateEntryIndex(mg) {
    if (!mg || !Array.isArray(mg.activeOrder)) return -1;
    const idx = mg.activeOrder[mg.currentOrderPos];
    return typeof idx === "number" ? idx : -1;
  }

  function scheduleDiceOfFateBotIfNeeded() {
    clearTimeout(dofBotTimer);
    dofBotTimer = null;
    if (!state || !state.activeMinigame) return;
    const mg = state.activeMinigame;
    if (mg.status !== "rolling" || mg.isAnimatingRoll) return;
    if (isRemoteClient()) return;

    const entryIdx = getCurrentDiceOfFateEntryIndex(mg);
    const entry = mg.entries[entryIdx];
    if (entry && entry.isBot) {
      dofBotTimer = setTimeout(() => {
        if (state && state.activeMinigame && state.activeMinigame.status === "rolling" && !state.activeMinigame.isAnimatingRoll) {
          rollDiceOfFateCurrent();
        }
      }, 680);
    }
  }

  function rollDiceOfFateCurrent() {
    if (!state || !state.activeMinigame) return;
    const mg = state.activeMinigame;
    if (mg.status !== "rolling" || mg.isAnimatingRoll) return;

    const idx = getCurrentDiceOfFateEntryIndex(mg);
    const entry = mg.entries[idx];
    if (!entry) return;

    if (isRemoteClient()) {
      if (!canLocalPlayerRollDiceOfFate(entry)) return;
      sendClientActionToHost("minigame_roll", {});
      return;
    }

    clearTimeout(dofBotTimer);
    dofBotTimer = null;
    mg.isAnimatingRoll = true;
    mg.entries.forEach((e) => {
      e.justLanded = false;
    });

    const d1 = Math.floor(Math.random() * 20) + 1;
    const d2 = null;
    const total = d1;
    const tieBreak = Math.floor(Math.random() * 20) + 1;
    const dofRollId = "dofr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    mg.animatingEntryIndex = idx;
    mg.lastRollEvent = {
      id: dofRollId,
      entryIndex: idx,
      targetVal: total
    };
    lastShownDofRollEventId = dofRollId;

    renderDiceOfFateOverlay();
    broadcastMultiplayerState();

    let ticks = 0;
    const maxTicks = 9;
    const numEl = document.getElementById(`dof-num-${idx}`);
    if (numEl) {
      numEl.classList.remove("is-pending", "is-landed");
      numEl.classList.add("is-rolling");
    }
    playSfx("dice_tick");

    clearInterval(dofRollAnimInterval);
    dofRollAnimInterval = setInterval(() => {
      ticks++;
      if (!state || !state.activeMinigame || state.activeMinigame.id !== mg.id) {
        clearInterval(dofRollAnimInterval);
        dofRollAnimInterval = null;
        return;
      }
      if (ticks < maxTicks) {
        if (ticks % 2 === 1) playSfx("dice_tick");
        const el = document.getElementById(`dof-num-${idx}`);
        if (el) {
          el.textContent = String(Math.floor(Math.random() * 20) + 1);
        }
        return;
      }

      clearInterval(dofRollAnimInterval);
      dofRollAnimInterval = null;

      entry.d1 = d1;
      entry.d2 = d2;
      entry.total = total;
      entry.finalScore = total;
      entry.roundReached = (mg.tieRound || 0) + 1;
      entry.tieBreak = tieBreak;
      entry.justLanded = true;
      mg.isAnimatingRoll = false;
      mg.animatingEntryIndex = -1;
      mg.currentOrderPos++;

      playSfx("dice_land");

      if (mg.currentOrderPos >= mg.activeOrder.length) {
        evaluateDiceOfFateRound();
      } else {
        renderAll();
        broadcastMultiplayerState();
        scheduleDiceOfFateBotIfNeeded();
      }
    }, 65);
  }

  function playRemoteDiceOfFateRollAnim(rollEv) {
    if (!rollEv || typeof rollEv.entryIndex !== "number") return;
    const idx = rollEv.entryIndex;
    const targetVal = rollEv.targetVal;
    let ticks = 0;
    const maxTicks = 8;
    const numEl = document.getElementById(`dof-num-${idx}`);
    if (numEl) {
      numEl.classList.remove("is-pending", "is-landed");
      numEl.classList.add("is-rolling");
    }
    playSfx("dice_tick");
    clearInterval(dofRollAnimInterval);
    dofRollAnimInterval = setInterval(() => {
      ticks++;
      const el = document.getElementById(`dof-num-${idx}`);
      if (ticks < maxTicks) {
        if (ticks % 2 === 1) playSfx("dice_tick");
        if (el) {
          el.textContent = String(Math.floor(Math.random() * 20) + 1);
        }
        return;
      }
      clearInterval(dofRollAnimInterval);
      dofRollAnimInterval = null;
      if (el) {
        el.classList.remove("is-rolling", "is-pending");
        el.classList.add("is-landed");
        el.textContent = String(targetVal);
      }
      playSfx("dice_land");
    }, 60);
  }

  function evaluateDiceOfFateRound() {
    if (!state || !state.activeMinigame) return;
    const mg = state.activeMinigame;
    const maxTotal = Math.max(...mg.activeOrder.map((i) => mg.entries[i].total || 0));
    const tiedIndices = mg.activeOrder.filter((i) => mg.entries[i].total === maxTotal);

    mg.activeOrder.forEach((i) => {
      const e = mg.entries[i];
      if (!tiedIndices.includes(i)) {
        e.eliminated = true;
        e.isTied = false;
      }
    });

    if (tiedIndices.length > 1) {
      mg.tieRound = (mg.tieRound || 0) + 1;
      mg.status = "tie_pause";
      mg.tiedNames = tiedIndices.map((i) => mg.entries[i].name);
      tiedIndices.forEach((i) => {
        mg.entries[i].isTied = true;
      });
      addLog(`Dice of Fate SERI (${maxTotal})! Adu ulang Tie-Breaker #${mg.tieRound}: ${mg.tiedNames.join(" vs ")}.`);
      playSfx("branch");
      renderAll();
      broadcastMultiplayerState();

      clearTimeout(dofTieTimer);
      dofTieTimer = setTimeout(() => {
        if (!state || !state.activeMinigame || state.activeMinigame.id !== mg.id) return;
        tiedIndices.forEach((i) => {
          const e = mg.entries[i];
          e.d1 = null;
          e.d2 = null;
          e.total = null;
          e.justLanded = false;
          e.isTied = true;
        });
        mg.activeOrder = tiedIndices;
        mg.currentOrderPos = 0;
        mg.status = "rolling";
        renderAll();
        broadcastMultiplayerState();
        scheduleDiceOfFateBotIfNeeded();
      }, 1500);
      return;
    }

    finalizeDiceOfFateResults();
  }

  function finalizeDiceOfFateResults() {
    if (!state || !state.activeMinigame) return;
    const mg = state.activeMinigame;
    const ranked = [...mg.entries].sort(
      (a, b) =>
        (b.roundReached || 1) - (a.roundReached || 1) ||
        (b.finalScore || 0) - (a.finalScore || 0) ||
        (b.tieBreak || 0) - (a.tieBreak || 0)
    );

    const summaryLines = ranked.map((entry, rankIdx) => {
      entry.rank = rankIdx + 1;
      entry.isWinner = rankIdx === 0;
      entry.isTied = false;
      const baseReward = mg.payouts[rankIdx] !== undefined ? mg.payouts[rankIdx] : 10;
      const playerObj = state.players[entry.playerIndex];
      const earned = playerObj ? modifyPlayerTC(playerObj, baseReward, "minigame") : baseReward;
      entry.reward = earned;
      return `#${rankIdx + 1} ${entry.name} (${entry.finalScore}) +${earned} TC`;
    });

    mg.status = "finished";
    mg.winnerName = ranked[0] ? ranked[0].name : "";
    mg.winnerTotal = ranked[0] ? ranked[0].finalScore : 0;

    addLog(`Dice of Fate (${mg.reasonTitle}): ${summaryLines.join(" | ")}`);
    playSfx("shard");
    renderAll();
    broadcastMultiplayerState();

    clearTimeout(dofAutoFinishTimer);
    if (!isRemoteClient()) {
      dofAutoFinishTimer = setTimeout(() => {
        if (state && state.activeMinigame && state.activeMinigame.id === mg.id && state.activeMinigame.status === "finished") {
          finishDiceOfFateMinigame();
        }
      }, 4800);
    }
  }

  function finishDiceOfFateMinigame() {
    if (!state || !state.activeMinigame) return;
    if (state.activeMinigame.status !== "finished") return;
    if (isRemoteClient()) {
      sendClientActionToHost("minigame_finish", {});
      return;
    }

    const afterAction = state.activeMinigame.afterAction;
    clearDiceOfFateTimers();
    state.activeMinigame = null;

    if (afterAction === "advance_round") {
      state.activePlayerIndex = 0;
      if (state.roundInCycle < state.rules.turnsPerCycle) {
        state.roundInCycle++;
      } else {
        completeFullCycle();
      }
      startPlayerTurn(getActivePlayer());
      if (camera.mode !== "wide") {
        camera.mode = "follow";
        focusCameraOnTile(getActivePlayer().tileId);
      }
    }

    playSfx("click");
    renderAll();
    broadcastMultiplayerState();
  }

  function renderDiceOfFateOverlay() {
    const overlay = document.getElementById("dice-of-fate-overlay");
    if (!overlay) return;
    const mg = state ? state.activeMinigame : null;
    if (!mg) {
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
      return;
    }

    const curEntryIdx = mg.status === "rolling" ? getCurrentDiceOfFateEntryIndex(mg) : -1;
    const curEntry = curEntryIdx >= 0 ? mg.entries[curEntryIdx] : null;
    let statusText = "Dice of Fate";
    if (mg.status === "finished") {
      statusText = `Pemenang: ${mg.winnerName} (Roll ${mg.winnerTotal})!`;
    } else if (mg.status === "tie_pause") {
      statusText = `SERI! Adu Ulang Tie-Breaker #${mg.tieRound}: ${(mg.tiedNames || []).join(" vs ")}`;
    } else if (curEntry) {
      const tieTag = mg.tieRound > 0 ? `Tie-Breaker #${mg.tieRound} · ` : "";
      statusText = `${tieTag}Giliran Roll: ${curEntry.name}`;
    }

    const rowsHtml = mg.entries
      .map((entry, idx) => {
        const ch = DATA.CHARACTERS[entry.charId] || {};
        const pt = ch.portrait || null;
        const isCurrent = mg.status === "rolling" && idx === curEntryIdx;
        const isWinner = mg.status === "finished" && entry.isWinner;
        const isInActivePool = Array.isArray(mg.activeOrder) && mg.activeOrder.includes(idx);
        const isTiedActive = (mg.status === "tie_pause" || mg.tieRound > 0) && entry.isTied && !entry.eliminated && mg.status !== "finished";
        const isDimmed = (mg.status === "finished" && !entry.isWinner) || (mg.status !== "finished" && entry.eliminated);
        const hasRolled = entry.total !== null;
        const showCharSub = entry.charName && entry.charName.toLowerCase() !== entry.name.toLowerCase();

        const portraitHtml =
          pt && pt.src
            ? `<img class="dof-portrait-img" src="${pt.src}" alt="${escapeHtml(entry.name)}" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
            : `<div class="ph-portrait-fallback"><div class="ph-fallback-icon" style="fill:${escapeHtml(entry.color)};">${getCharacterSvgIcon(entry.charId)}</div></div>`;

        let numText = "—";
        let numCls = "is-pending";
        if (hasRolled) {
          numText = String(entry.total);
          numCls = entry.justLanded ? "is-landed" : "";
        } else if (entry.eliminated && entry.finalScore) {
          numText = String(entry.finalScore);
          numCls = "";
        } else if (isCurrent && mg.isAnimatingRoll) {
          numText = "...";
          numCls = "is-rolling";
        }

        let rightHtml = "";
        if (mg.status === "finished") {
          rightHtml = `
            ${isWinner ? `<span class="dof-winner-badge">Winner</span>` : `<span class="dof-wait-tag">#${entry.rank || idx + 1}</span>`}
            <span class="dof-reward-pill">💰 +${entry.reward} TC</span>`;
        } else if (mg.status === "tie_pause") {
          rightHtml = entry.isTied
            ? `<span class="dof-tie-badge">Adu Ulang</span>`
            : `<span class="dof-wait-tag">Gugur</span>`;
        } else if (entry.eliminated) {
          rightHtml = `<span class="dof-wait-tag">Gugur</span>`;
        } else if (isCurrent) {
          if (mg.isAnimatingRoll) {
            rightHtml = `<span class="dof-wait-tag">Mengocok dadu...</span>`;
          } else if (canLocalPlayerRollDiceOfFate(entry)) {
            rightHtml = `${mg.tieRound > 0 ? `<span class="dof-tie-badge">Tie-Breaker</span>` : ""}<button class="dof-roll-btn" onclick="window.EFT_APP.rollDiceOfFateCurrent()">Roll Dice</button>`;
          } else {
            rightHtml = `<span class="dof-wait-tag">Menunggu ${escapeHtml(entry.name)}...</span>`;
          }
        } else if (hasRolled) {
          rightHtml = `<span class="dof-wait-tag">Selesai</span>`;
        } else if (isInActivePool) {
          const posInOrder = mg.activeOrder.indexOf(idx);
          rightHtml = `${mg.tieRound > 0 ? `<span class="dof-tie-badge">Tie-Breaker</span>` : ""}<span class="dof-wait-tag">Antrean #${posInOrder + 1}</span>`;
        }

        const rowClasses = ["dof-row"];
        if (isCurrent) rowClasses.push("is-current");
        if (isWinner) rowClasses.push("is-winner");
        if (isTiedActive && !isCurrent) rowClasses.push("is-tied");
        if (isDimmed) rowClasses.push("is-dimmed");

        return `
          <div class="${rowClasses.join(" ")}" style="--dof-color:${escapeHtml(entry.color)};--dof-rgb:${escapeHtml(entry.colorRgb)};">
            <div class="dof-portrait-col">${portraitHtml}</div>
            <div class="dof-name-col">
              <div class="dof-name-pill">${escapeHtml(entry.name)}</div>
              ${showCharSub ? `<div class="dof-char-sub">${escapeHtml(entry.charName)}</div>` : ""}
            </div>
            <div class="dof-roll-display">
              <span class="dof-roll-label">Roll :</span>
              <span id="dof-num-${idx}" class="dof-roll-num ${numCls}">${numText}</span>
              ${
                hasRolled
                  ? `<span class="dof-dice-breakdown">${
                      entry.d2 !== null && entry.d2 !== undefined ? `[${entry.d1} + ${entry.d2}]` : `[1d20]`
                    }</span>`
                  : ""
              }
            </div>
            <div class="dof-action-col">${rightHtml}</div>
          </div>`;
      })
      .join("");

    overlay.innerHTML = `
      <div class="dof-header-bar">
        <div class="dof-title-group">
          <span class="dof-title">Dice of Fate</span>
          <span class="dof-subtitle">${escapeHtml(statusText)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="dof-payout-hint">1st: 💰 +${mg.payouts[0] || 30} TC · 2nd/3rd: +${mg.payouts[1] || 15} TC · 4th: +${mg.payouts[3] || 10} TC</span>
          ${
            mg.status === "finished"
              ? `<button class="dof-finish-btn" onclick="window.EFT_APP.finishDiceOfFateMinigame()">Selesai</button>`
              : ""
          }
        </div>
      </div>
      <div class="dof-rows-stack">
        ${rowsHtml}
      </div>`;

    overlay.classList.add("visible");

    if (mg.lastRollEvent && mg.lastRollEvent.id && mg.lastRollEvent.id !== lastShownDofRollEventId) {
      lastShownDofRollEventId = mg.lastRollEvent.id;
      playRemoteDiceOfFateRollAnim(mg.lastRollEvent);
    }
  }

  function runClashOfFateMinigame(reasonTitle = "Dice of Fate") {
    startDiceOfFateMinigame(reasonTitle, "none");
  }

  // ============================================================================
  // SKILL CARD EXECUTION ENGINE
  // ============================================================================
  function canPlaySkillCard(player, card) {
    if (state.winner) return { ok: false, reason: "Match has already ended." };
    if (isWalkingAnim || isTileEffectAnimating) return { ok: false, reason: "Tunggu animasi selesai terlebih dahulu." };
    if (isAdminUnlocked && adminFreeSkillUse) {
      return { ok: true, freeAdmin: true };
    }
    if (player.silencedThisPhase) {
      return { ok: false, reason: "Silenced by All-Out Attack for this Phase." };
    }
    const hasteAllowed = state.rules.allowHaste && card.haste;
    if (state.phaseIndex !== 1 && state.phaseIndex !== 3 && !hasteAllowed) {
      return { ok: false, reason: "Skill Cards can only be deployed during Main Phase 1 or Main Phase 2 (before rolling dice)." };
    }
    if (player.skillsUsedThisTurn >= player.maxSkillsThisTurn && card.rarity !== "Ultimate") {
      return { ok: false, reason: `Maximum of ${player.maxSkillsThisTurn} Skill Cards per turn reached.` };
    }
    if (player.cooldowns[card.id] > 0) {
      return { ok: false, reason: `Card is on cooldown (${player.cooldowns[card.id]} turn).` };
    }
    if (card.rarity === "Epic" || card.rarity === "Ultimate") {
      const miasmaOwner = state.players.find(
        (other) =>
          other.index !== player.index &&
          !other.inSpawn &&
          hasPassive(other, "passive_miasma_cloud") &&
          getTileDistance(player.tileId, other.tileId) <= 4
      );
      if (miasmaOwner) {
        return {
          ok: false,
          reason: `Blocked by ${miasmaOwner.name}'s Miasma Cloud (4-block radius blocks Epic & Ultimate cards).`
        };
      }
    }
    return { ok: true };
  }

  function getReachableTilesDirected(startTileId, minSteps, maxSteps, dir = 1, fromTileId = null) {
    const result = new Map();
    const visitedStates = new Set([`${startTileId}|${fromTileId || ""}`]);
    const queue = [[startTileId, fromTileId, 0]];
    while (queue.length > 0) {
      const [curr, prev, dist] = queue.shift();
      if (dist >= maxSteps) continue;
      const stepDir = dist === 0 ? dir : 1;
      const opts = getNextPlayableOptions(curr, prev, stepDir);
      for (const opt of opts) {
        const nid = opt.tileId;
        if (nid === "T0" || isSplitTile(nid)) continue;
        const nd = dist + 1;
        const nextPrev = opt.viaSplitId || curr;
        if (nd >= minSteps && nd <= maxSteps) {
          if (!result.has(nid) || nd < result.get(nid)) {
            result.set(nid, nd);
          }
        }
        const stKey = `${nid}|${nextPrev}`;
        if (nd < maxSteps && !visitedStates.has(stKey)) {
          visitedStates.add(stKey);
          queue.push([nid, nextPrev, nd]);
        }
      }
    }
    return result;
  }

  function getSkillMoveSelectionSpec(card, options = {}) {
    if (!card) return null;
    switch (card.effectKey) {
      case "move_steps": {
        const ch = card.choices && card.choices.length > 0 ? card.choices : [1, 2, 3];
        const allNeg = ch.every((v) => v < 0);
        const allPos = ch.every((v) => v > 0);
        return {
          mode: allNeg ? "backward" : allPos ? "forward" : "both",
          minSteps: 1,
          maxSteps: Math.max(...ch.map((v) => Math.abs(v)))
        };
      }
      case "move_self_range": {
        const ch = card.choices && card.choices.length > 0 ? card.choices : [8];
        return {
          mode: "both",
          minSteps: 1,
          maxSteps: Math.max(...ch.map((v) => Math.abs(v)))
        };
      }
      case "dash_1_6_steal_card":
      case "sam_dash_aoe_5tc":
        return { mode: "forward", minSteps: 1, maxSteps: 6 };
      case "ff_move_1_2_normal_bonus":
        return { mode: "forward", minSteps: 1, maxSteps: 2 };
      case "choice_move1_2_or_10tc":
        if (options.choiceValue === "move") {
          return { mode: "forward", minSteps: 1, maxSteps: 2 };
        }
        return null;
      default:
        return null;
    }
  }

  function getSkillDramaticProfile(card, charId) {
    const ch = DATA.CHARACTERS[charId] || {};
    const accent = ch.color || "#34d399";
    const accentRgb = ch.colorRgb || "52, 211, 153";
    if (!card) return { theme: "sonic", tagline: "SKILL ACTIVATED", accent, accentRgb };

    if (card.rarity === "Ultimate") {
      const ultTags = {
        bocchi_ult: "ULTIMATE FINALE · STAGE CONVERGENCE",
        avt_ult: "ULTIMATE GAMBLE · ALL OR NOTHING",
        joker_ult: "ULTIMATE WILDCARD · METAVERSE HEIST",
        lilith_ult: "ULTIMATE NIGHTMARE · ETERNAL SLUMBER"
      };
      return {
        theme: "ultimate",
        tagline: ultTags[card.id] || "ULTIMATE FINALE ACTIVATED",
        accent: "#facc15",
        accentRgb: "250, 204, 21"
      };
    }

    if (card.rarity === "Unique") {
      const uqTags = {
        bocchi_uq: "UNIQUE PASSIVE · SPOTLIGHT AWAKENED",
        avt_uq: "UNIQUE PASSIVE · IPC GOLDEN DIVIDEND",
        joker_uq: "UNIQUE PASSIVE · PERSONA AWAKENED",
        lilith_uq: "UNIQUE PASSIVE · DAEMONISSA TRICKERY"
      };
      return {
        theme: "passive",
        tagline: uqTags[card.id] || "UNIQUE PASSIVE ACTIVATED",
        accent,
        accentRgb
      };
    }

    const customByEffect = {
      move_steps: { theme: "sonic", tagline: "CHORD RESONANCE · STEP SHIFT" },
      teleport_normal_radius: { theme: "sonic", tagline: "CROWD SURFING · STAGE LEAP" },
      move_self_range: { theme: "sonic", tagline: "FRETBOARD OVERDRIVE · DIVE" },
      swap_position: { theme: "sonic", tagline: "STAGE SWITCH · POSITION SWAP" },
      steal_5_or_10_tc: { theme: "fortune", tagline: "HIGH-STAKES PICKPOCKET" },
      turn_tc_multiplier: { theme: "fortune", tagline: "ROULETTE MULTIPLIER" },
      midas_gold: { theme: "fortune", tagline: "GOLDEN TOUCH · JACKPOT" },
      tax_all_opponents_15: { theme: "fortune", tagline: "HOUSE COLLECTION · TAXATION" },
      choice_10tc_or_draw1: { theme: "phantom", tagline: "IT'S SHOWTIME!" },
      dash_1_6_steal_card: { theme: "phantom", tagline: "PHANTOM THIEF · HEIST DASH" },
      aoa_15tc_silence: { theme: "phantom", tagline: "ALL-OUT AMBUSH · SILENCE" },
      copy_last_skill: { theme: "phantom", tagline: "REBELLIOUS MIRROR · COPY" },
      discard_1_or_minus3_steps: { theme: "abyss", tagline: "PUPPETEER'S CURSE · STRINGS" },
      place_trap_virus: { theme: "abyss", tagline: "VIRAL HAZARD DEPLOYED" },
      debuff_reverse_move: { theme: "abyss", tagline: "MIND DEVIATION · REVERSAL" },
      destroy_half_hand_radius: { theme: "abyss", tagline: "SOUL SHATTER · EXTRACTION" }
    };
    const meta = customByEffect[card.effectKey] || { theme: "sonic", tagline: "SKILL ACTIVATED" };
    return { ...meta, accent, accentRgb };
  }

  function dismissSkillPopup(force = false, skipQueueFlush = false) {
    if (!force && skillPopupShownAt && Date.now() - skillPopupShownAt < 180) {
      return;
    }
    clearTimeout(skillPopupTimerId);
    skillPopupTimerId = null;
    skillPopupShownAt = 0;
    const overlay = document.getElementById("skill-dramatic-overlay");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
    }
    if (!skipQueueFlush && !isSkillActivationInFlight) {
      flushNextQueuedTileEffect();
    }
  }

  function showDramaticSkillPopup(payload) {
    const overlay = document.getElementById("skill-dramatic-overlay");
    if (!overlay || !payload) return;
    dismissSkillPopup(true, true);

    const ch = DATA.CHARACTERS[payload.charId] || {};
    const ptSrc = (ch.compPortrait && ch.compPortrait.src) || (ch.portrait && ch.portrait.src) || "";
    const ptPos = (ch.compPortrait && ch.compPortrait.objectPosition) || "50% 10%";
    const prof = payload.profile || { theme: "sonic", tagline: "SKILL ACTIVATED", accent: "#34d399", accentRgb: "52, 211, 153" };
    const isPassiveOrUlt = prof.theme === "ultimate" || prof.theme === "passive";
    const autoMs = prof.theme === "ultimate" ? 5900 : 5250;

    overlay.innerHTML = `
      <div class="skill-cutin-banner theme-${escapeHtml(prof.theme)}"
           style="--skill-accent:${escapeHtml(prof.accent)};--skill-rgb:${escapeHtml(prof.accentRgb)};">
        <div class="skill-cutin-portrait-col">
          ${
            ptSrc
              ? `<img class="skill-cutin-portrait-img" src="${ptSrc}" alt="${escapeHtml(payload.casterName)}" style="object-position:${ptPos};" />`
              : `<div class="ph-portrait-fallback"><div class="ph-fallback-icon" style="fill:${escapeHtml(prof.accent)};">${getCharacterSvgIcon(payload.charId)}</div></div>`
          }
        </div>
        <div class="skill-cutin-center">
          <div class="skill-cutin-eyebrow">${escapeHtml(prof.tagline)}</div>
          <div class="skill-cutin-caster">${escapeHtml(payload.casterName)}</div>
          <div class="skill-cutin-title">${escapeHtml(payload.cardName)}</div>
          <span class="skill-cutin-rarity-pill">${escapeHtml(payload.rarity || "Skill")}</span>
          ${payload.outcomeText ? `<div class="skill-cutin-outcome">${escapeHtml(payload.outcomeText)}</div>` : ""}
          <div class="skill-cutin-desc">${escapeHtml(payload.description || "")}</div>
        </div>
        <div class="skill-cutin-card-col">
          ${payload.cardImg ? `<img class="skill-cutin-card-img" src="${payload.cardImg}" alt="${escapeHtml(payload.cardName)}" />` : ""}
        </div>
        <div class="skill-cutin-hint">${isPassiveOrUlt ? "Klik di mana saja untuk lanjut" : "Klik di mana saja untuk tutup"}</div>
      </div>`;

    skillPopupShownAt = Date.now();
    overlay.classList.add("visible");
    playSfx("skill", `${payload.charId || ""}:${prof.theme}`);
    skillPopupTimerId = setTimeout(() => {
      dismissSkillPopup(true);
    }, autoMs);
  }

  function triggerDramaticSkillEvent(payload) {
    if (!state || !payload) return;
    const eventWithId = {
      ...payload,
      id: "sk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)
    };
    state.lastSkillEvent = eventWithId;
    lastShownSkillEventId = eventWithId.id;
    showDramaticSkillPopup(eventWithId);
  }

  function openForcedAllInChoiceModal(player, targetPlayer, myRoll, oppRoll) {
    openInfoModal(
      `Forced All-In — ${escapeHtml(player.name)} Menang (${myRoll} vs ${oppRoll})!`,
      `<div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:rgba(234,179,8,0.12);border:1px solid rgba(250,204,21,0.45);border-radius:10px;padding:12px;font-size:0.86rem;color:#fef08a;">
          <strong>${escapeHtml(player.name)}</strong> memenangkan Duel 1v1 melawan <strong>${escapeHtml(targetPlayer.name)}</strong>!
          Pilih hadiahmu:
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button class="btn btn-gold" onclick="window.EFT_APP.resolveForcedAllInChoice('tc')">
            Curi Semua TC Lawan (💰 ${targetPlayer.tc} TC)
          </button>
          <button class="btn btn-emerald" onclick="window.EFT_APP.resolveForcedAllInChoice('shard')">
            Curi 1 Tartarus Shard (💎 ${targetPlayer.shards} -> 1)
          </button>
        </div>
      </div>`
    );
  }

  function resolveDirectTileEffectForPull(p, destTile) {
    if (!p || !destTile || destTile.type === "event") return;
    switch (destTile.type) {
      case "tc_plus10":
        modifyPlayerTC(p, 10, "tile");
        break;
      case "tc_minus5":
        modifyPlayerTC(p, -5, "tile");
        break;
      case "card_plus1":
        drawCards(p, 1);
        break;
      case "card_minus1":
        discardRandomCards(p, 1);
        break;
      case "pos_effect": {
        const deck = DATA.BOARD_CARDS.positive;
        const card = deck[Math.floor(Math.random() * deck.length)];
        startTileEffectCardShuffle({
          deckKind: "positive",
          player: p,
          tile: destTile,
          card,
          applyFn: (drawnCard) => applyBoardEffectCard(p, drawnCard, { showToast: false })
        });
        break;
      }
      case "neg_effect": {
        const deck = DATA.BOARD_CARDS.negative;
        const card = deck[Math.floor(Math.random() * deck.length)];
        startTileEffectCardShuffle({
          deckKind: "negative",
          player: p,
          tile: destTile,
          card,
          applyFn: (drawnCard) => applyBoardEffectCard(p, drawnCard, { showToast: false })
        });
        break;
      }
      case "warp":
        if (destTile.warpTarget) p.tileId = destTile.warpTarget;
        break;
      default:
        break;
    }
  }

  function playSkillCardFromHand(cardUid, options = {}) {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("play_card", { cardUid, options });
      closeModal();
      return;
    }
    const player = getActivePlayer();
    const cardIdx = player.hand.findIndex((c) => c.uid === cardUid);
    if (cardIdx === -1) return;
    const card = player.hand[cardIdx];

    const check = canPlaySkillCard(player, card);
    if (!check.ok) {
      alert(check.reason);
      return;
    }

    saveSnapshot();
    selectedCardUid = null;

    if (card.rarity === "Common" || card.rarity === "Uncommon") {
      state.players.forEach((other) => {
        if (other.index !== player.index && hasPassive(other, "passive_emperor_tax")) {
          const tax = Math.min(5, player.tc);
          player.tc -= tax;
          other.tc += tax;
          addLog(`The Emperor's Favor: ${player.name} paid ${tax} TC tax to ${other.name}.`);
        }
      });
    }

    player.hand.splice(cardIdx, 1);
    if (card.rarity !== "Ultimate") {
      player.discard.push(card);
    }
    if (!(isAdminUnlocked && adminFreeSkillUse)) {
      player.skillsUsedThisTurn++;
    }

    if (card.effectKey !== "copy_last_skill" && card.rarity !== "Ultimate") {
      state.lastOpponentSkillUsed = card;
      if (!Array.isArray(state.recentOpponentSkills)) state.recentOpponentSkills = [];
      state.recentOpponentSkills.unshift({
        id: "rsk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        card: JSON.parse(JSON.stringify(card)),
        casterIndex: player.index,
        casterName: player.name,
        charId: player.charId,
        cycle: state.cycle
      });
      if (state.recentOpponentSkills.length > 8) state.recentOpponentSkills.pop();
    }

    if (card.haste) player.cooldowns[card.id] = 1;

    closeModal();
    isSkillActivationInFlight = true;
    let outcomeText = executeCardEffect(player, card, options) || card.description;
    if (pendingInteraction && pendingInteraction.type === "stage_is_mine") {
      outcomeText += " -> Passive [The Stage Is Mine] Aktif! Pilih pindah +1 / +2 / -1 di peta.";
    }

    triggerDramaticSkillEvent({
      charId: player.charId,
      cardId: card.id,
      casterName: player.name,
      cardName: card.name,
      rarity: card.rarity,
      cardImg: getCardImage(card, player.charId),
      description: card.description,
      outcomeText,
      profile: getSkillDramaticProfile(card, player.charId)
    });
    isSkillActivationInFlight = false;

    if (camera.mode === "follow" && (!pendingInteraction || pendingInteraction.type !== "stage_is_mine")) {
      focusCameraOnTile(player.tileId);
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function executeCardEffect(player, card, options = {}) {
    const isRadiusPlayerCard =
      card.targetType === "opponent_in_radius" || card.targetType === "any_player_in_radius";
    const cardRadius = card.radius || 5;

    let targetPlayer = null;
    if (options.targetPlayerIndex !== undefined && state.players[options.targetPlayerIndex]) {
      targetPlayer = state.players[options.targetPlayerIndex];
    } else if (card.targetType === "opponent_in_radius") {
      targetPlayer =
        state.players.find(
          (p) => p.index !== player.index && !p.inSpawn && getTileDistance(player.tileId, p.tileId) <= cardRadius
        ) || null;
    } else if (card.targetType === "any_player_in_radius") {
      targetPlayer =
        state.players.find(
          (p) => p.index !== player.index && !p.inSpawn && getTileDistance(player.tileId, p.tileId) <= cardRadius
        ) || player;
    } else if (card.targetType === "other_player") {
      targetPlayer = state.players.find((p) => p.index !== player.index && !p.inSpawn) || null;
    } else {
      targetPlayer = state.players.find((p) => p.index !== player.index && !p.inSpawn) || player;
    }

    if (isRadiusPlayerCard) {
      if (!targetPlayer) {
        const msg = `Tidak ada target valid dalam radius ${cardRadius} blok.`;
        addLog(`[${card.name}]: ${msg}`);
        return msg;
      }
      if (card.targetType === "opponent_in_radius" && targetPlayer.index === player.index) {
        const msg = `Kartu [${card.name}] hanya bisa menarget pemain lain dalam radius ${cardRadius} blok.`;
        addLog(msg);
        return msg;
      }
      const distToTarget = getTileDistance(player.tileId, targetPlayer.tileId);
      if (distToTarget > cardRadius) {
        const msg = `${targetPlayer.name} berada di luar radius ${cardRadius} blok (${distToTarget} blok).`;
        addLog(`[${card.name}]: ${msg}`);
        return msg;
      }
    }

    if (targetPlayer && targetPlayer.index !== player.index) {
      if (targetPlayer.inSpawn) {
        const msg = `${targetPlayer.name} terlindungi Spawn Protection.`;
        addLog(msg);
        return msg;
      }
      if (card.rarity === "Common" && hasPassive(targetPlayer, "passive_sam_armor")) {
        const msg = `Firefly Type-IV Armor memblokir kartu Common [${card.name}].`;
        addLog(msg);
        return msg;
      }
      const onSafeZone = state.boardTokens.some(
        (t) => t.type === "safe_zone" && t.tileId === targetPlayer.tileId
      );
      if (onSafeZone) {
        const msg = `${targetPlayer.name} terlindungi Safe Zone (Oak Cake Break).`;
        addLog(msg);
        return msg;
      }
    }

    switch (card.effectKey) {
      case "move_steps": {
        const tgt = options.targetPlayerIndex !== undefined ? state.players[options.targetPlayerIndex] : player;
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = tgt.tileId;
          const isBack =
            String(options.stepDelta || "").startsWith("-") ||
            Boolean(card.choices && card.choices.length > 0 && card.choices.every((v) => v < 0));
          applySkillPathPassChecks(tgt, prevTileId, options.targetTileId);
          tgt.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            tgt.lastTileId,
            isBack
          );
          tgt.tileId = options.targetTileId;
          if (tgt.inSpawn && options.targetTileId !== "T0") tgt.inSpawn = false;
          const destTile = TILE_MAP[options.targetTileId];
          const msg = `${tgt.name} bergerak ke [${options.targetTileId}: ${destTile.name}]!`;
          addLog(`[${card.name}]: ${msg}`);
          resolveExactLandingTile(tgt, destTile);
          return msg;
        } else {
          const steps = Number(options.choiceValue || (card.choices && card.choices[0]) || 1);
          movePlayerInstantAlongPath(tgt, Math.abs(steps), steps >= 0 ? 1 : -1, true);
          const msg = `${tgt.name} bergerak ${steps > 0 ? "+" : ""}${steps} langkah!`;
          addLog(`[${card.name}]: ${msg}`);
          return msg;
        }
      }
      case "teleport_normal_radius": {
        const destTileId = options.targetTileId;
        const rad = card.radius || 5;
        if (destTileId && TILE_MAP[destTileId]) {
          const dist = getTileDistance(player.tileId, destTileId);
          if (dist > rad || TILE_MAP[destTileId].type !== "normal") {
            const msg = `Tile tujuan di luar radius ${rad} blok atau bukan Normal Tile.`;
            addLog(`[${card.name}]: ${msg}`);
            return msg;
          }
          player.tileId = destTileId;
          player.lastTileId = (PREV_MAP[destTileId] && PREV_MAP[destTileId][0]) || null;
          if (player.inSpawn && destTileId !== "T0") player.inSpawn = false;
          const destTile = TILE_MAP[destTileId];
          const msg = `${player.name} melompat ke Normal Tile [${destTileId}]!`;
          addLog(`[${card.name}]: ${msg}`);
          checkTokensOnStep(player, destTileId, true);
          resolveExactLandingTile(player, destTile);
          return msg;
        }
        return "Tidak ada tujuan dipilih.";
      }
      case "move_self_range": {
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          const isBack = String(options.stepDelta || "").startsWith("-");
          applySkillPathPassChecks(player, prevTileId, options.targetTileId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            isBack
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          const destTile = TILE_MAP[options.targetTileId];
          const msg = `${player.name} berpindah ke [${options.targetTileId}: ${destTile.name}]!`;
          addLog(`[${card.name}]: ${msg}`);
          resolveExactLandingTile(player, destTile);
          return msg;
        } else {
          const steps = Number(options.choiceValue || 4);
          movePlayerInstantAlongPath(player, Math.abs(steps), steps >= 0 ? 1 : -1, true);
          const msg = `${player.name} bergerak ${steps > 0 ? "+" : ""}${steps} blok!`;
          addLog(`[${card.name}]: ${msg}`);
          return msg;
        }
      }
      case "swap_position": {
        if (targetPlayer && targetPlayer.index !== player.index) {
          const temp = player.tileId;
          const tempLast = player.lastTileId;
          player.tileId = targetPlayer.tileId;
          player.lastTileId = targetPlayer.lastTileId;
          targetPlayer.tileId = temp;
          targetPlayer.lastTileId = tempLast;
          if (player.inSpawn && player.tileId !== "T0") player.inSpawn = false;
          if (targetPlayer.inSpawn && targetPlayer.tileId !== "T0") targetPlayer.inSpawn = false;
          const msg = `${player.name} (${player.tileId}) bertukar posisi dengan ${targetPlayer.name} (${targetPlayer.tileId})!`;
          addLog(`[${card.name}]: ${msg}`);
          resolveExactLandingTile(player, TILE_MAP[player.tileId]);
          return msg;
        }
        return "Tidak ada target bertukar posisi.";
      }
      case "passive_stage_is_mine": {
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        addOrRefreshPassive(player, {
          key: "passive_stage_is_mine",
          name: "Stage Is Mine",
          remainingTurns: turns,
          expiresOnCycleEnd: !isCopied
        });
        const durLabel = getActiveCycleDurationLabel(options.copiedUniqueDurationTurns);
        const msg = `Passive The Stage Is Mine aktif (${durLabel} — hangus saat ganti Cycle)! Mendarat di Normal Tile memberi opsi pindah +1/+2/-1.`;
        addLog(`Passive Active: [The Stage Is Mine] (${durLabel}).`);
        return msg;
      }
      case "pull_all_players": {
        const destTileId =
          options.targetTileId && TILE_MAP[options.targetTileId] && TILE_MAP[options.targetTileId].type !== "event"
            ? options.targetTileId
            : player.tileId;
        const destTile = TILE_MAP[destTileId];
        if (!destTile || destTile.type === "event") {
          const msg = "Global Event Tile tidak dapat dipilih untuk Bocchi The Rock!.";
          addLog(msg);
          return msg;
        }
        let pulledNames = [];
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn) {
            other.tileId = destTileId;
            other.lastTileId = (PREV_MAP[destTileId] && PREV_MAP[destTileId][0]) || null;
            pulledNames.push(other.name);
            resolveDirectTileEffectForPull(other, destTile);
          }
        });
        const msg =
          pulledNames.length > 0
            ? `Menarik ${pulledNames.join(", ")} ke [${destTileId}: ${destTile.name}] & mengaktifkan efek tile!`
            : `Tidak ada lawan di luar Spawn untuk ditarik ke [${destTileId}].`;
        addLog(`ULTIMATE [${card.name}]: ${msg}`);
        return msg;
      }
      case "steal_5_or_10_tc": {
        const rollAmt = Math.random() < 0.5 ? 5 : 10;
        const taken = Math.min(rollAmt, targetPlayer.tc);
        targetPlayer.tc -= taken;
        const gained = modifyPlayerTC(player, taken, "own_skill");
        const msg = `${player.name} mencuri ${gained} TC dari ${targetPlayer.name}!`;
        addLog(`[That's Mine]: ${msg}`);
        return msg;
      }
      case "turn_tc_multiplier": {
        const mults = card.multipliers || [1.25, 1.5, 2.0];
        const chosen = mults[Math.floor(Math.random() * mults.length)];
        player.turnTcMultiplier = chosen;
        const msg = `${player.name} mendapat x${chosen} TC Multiplier untuk giliran ini!`;
        addLog(`[The Red or The Black]: ${msg}`);
        return msg;
      }
      case "midas_gold": {
        const bases = card.baseAmounts || [15, 20, 25];
        const mults = card.multipliers || [0.75, 1.0, 1.5];
        const b = bases[Math.floor(Math.random() * bases.length)];
        const m = mults[Math.floor(Math.random() * mults.length)];
        const rawTotal = applyRounding(b * m, state.rules);
        const gained = modifyPlayerTC(player, rawTotal, "own_skill");
        const msg = `${b} TC x ${m} = +${gained} TC untuk ${player.name}!`;
        addLog(`[Hand of Midas]: ${msg}`);
        return msg;
      }
      case "tax_all_opponents_15": {
        let totalCollected = 0;
        let cardLootedCount = 0;
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn) {
            if (other.tc >= 15) {
              other.tc -= 15;
              totalCollected += 15;
            } else {
              const surrendered = discardRandomCards(other, 1);
              if (surrendered.length > 0 && player.hand.length < state.rules.maxHandSize) {
                player.hand.push(surrendered[0]);
              }
              cardLootedCount += surrendered.length;
              addLog(`${other.name} tidak sanggup membayar 15 TC -> menyerahkan 1 kartu acak ke ${player.name}.`);
            }
          }
        });
        const credited = totalCollected > 0 ? modifyPlayerTC(player, totalCollected, "own_skill") : 0;
        const msg = `Terkumpul +${credited} TC${cardLootedCount > 0 ? ` & ${cardLootedCount} kartu lawan` : ""}!`;
        addLog(`[The House Always Wins]: ${player.name} memperoleh ${msg}`);
        return msg;
      }
      case "passive_ipc_gems": {
        const mult = card.passiveMultiplier || 1.3;
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        addOrRefreshPassive(player, {
          key: "passive_ipc_gems",
          name: `IPC Gems (${mult}x)`,
          multiplier: mult,
          remainingTurns: turns,
          expiresOnCycleEnd: !isCopied
        });
        const durLabel = getActiveCycleDurationLabel(options.copiedUniqueDurationTurns);
        const msg = `IPC Gems aktif (${durLabel} — hangus saat ganti Cycle): semua perolehan TC di luar skill card x${mult}!`;
        addLog(`Passive Active: [IPC Gems] (${mult}x TC · ${durLabel}).`);
        return msg;
      }
      case "duel_forced_all_in": {
        const myRoll = Math.floor(Math.random() * 12) + 1;
        const oppRoll = Math.floor(Math.random() * 12) + 1;
        if (myRoll >= oppRoll) {
          if (targetPlayer.shards > 0) {
            pendingInteraction = {
              type: "forced_all_in_reward",
              player,
              targetPlayerIndex: targetPlayer.index,
              myRoll,
              oppRoll
            };
            openForcedAllInChoiceModal(player, targetPlayer, myRoll, oppRoll);
            const msg = `${player.name} menang Duel (${myRoll} vs ${oppRoll}) — pilih curi semua TC atau 1 Shard!`;
            addLog(`ULTIMATE [Forced All-In]: ${msg}`);
            return msg;
          } else {
            const allTc = targetPlayer.tc;
            targetPlayer.tc = 0;
            player.tc += allTc;
            const msg = `${player.name} menang (${myRoll} vs ${oppRoll}) & menyita seluruh ${allTc} TC ${targetPlayer.name}!`;
            addLog(`ULTIMATE [Forced All-In]: ${msg}`);
            return msg;
          }
        } else {
          const bet = applyRounding(targetPlayer.tc * 0.25, state.rules);
          const loss = Math.min(bet, player.tc);
          player.tc -= loss;
          targetPlayer.tc += loss;
          const msg = `${player.name} kalah (${myRoll} vs ${oppRoll}) & membayar ${loss} TC!`;
          addLog(`ULTIMATE [Forced All-In]: ${msg}`);
          return msg;
        }
      }
      case "discard_1_or_minus3_steps": {
        const hasDiscardable = targetPlayer.hand.some((c) => c && c.rarity !== "Ultimate");
        if (hasDiscardable) {
          const disc = discardRandomCards(targetPlayer, 1);
          const msg = `${targetPlayer.name} membuang 1 kartu [${disc[0]?.name || "Kartu"}]!`;
          addLog(`[Marionette String]: ${msg}`);
          return msg;
        } else {
          targetPlayer.nextRollStepMod -= 3;
          const msg = `Tangan ${targetPlayer.name} tidak memiliki kartu non-Ultimate -> -3 langkah pada roll berikutnya!`;
          addLog(`[Marionette String]: ${msg}`);
          return msg;
        }
      }
      case "place_trap_virus": {
        const tileId = options.targetTileId || player.tileId;
        const rad = card.radius || 4;
        if (getTileDistance(player.tileId, tileId) > rad) {
          const msg = `Tile [${tileId}] berada di luar radius ${rad} blok.`;
          addLog(`[Punishing Virus]: ${msg}`);
          return msg;
        }
        state.boardTokens.push({
          id: "tok_" + Date.now(),
          type: "virus_trap",
          name: "Punishing Virus",
          ownerIndex: player.index,
          ownerColor: player.color,
          tileId,
          remainingTurns: getFullCycleTurns(),
          placedOnTurn: state.totalTurnsCompleted
        });
        const msg = `Trap Punishing Virus dipasang di [${tileId}] selama 1 Full Cycle!`;
        addLog(`[Punishing Virus]: ${msg}`);
        return msg;
      }
      case "debuff_reverse_move": {
        targetPlayer.reverseNextRoll = true;
        const msg = `${targetPlayer.name} harus bergerak MUNDUR pada roll pertama giliran berikutnya!`;
        addLog(`[Mind Deviation]: ${msg}`);
        return msg;
      }
      case "destroy_half_hand_radius": {
        const rad = card.radius || 8;
        let totalDestroyed = 0;
        const victims = [];
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn) {
            const dist = getTileDistance(player.tileId, other.tileId);
            const nonUltCards = other.hand.filter((c) => c && c.rarity !== "Ultimate");
            if (dist <= rad && nonUltCards.length > 0) {
              const count = applyRounding(nonUltCards.length * 0.5, state.rules);
              const removed = discardRandomCards(other, count);
              totalDestroyed += removed.length;
              if (removed.length > 0) victims.push(`${other.name} (-${removed.length})`);
            }
          }
        });
        const msg =
          totalDestroyed > 0
            ? `Menghancurkan ${totalDestroyed} kartu (${victims.join(", ")})!`
            : "Tidak ada lawan ber-kartu non-Ultimate di dalam radius 8 blok.";
        addLog(`[Soul Extraction]: ${msg}`);
        return msg;
      }
      case "passive_unpredictable_tricks": {
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        const durLabel = getActiveCycleDurationLabel(options.copiedUniqueDurationTurns);
        if (state.compendiumId === "comp_v0_1") {
          addOrRefreshPassive(player, {
            key: "passive_daemonissa_domain",
            name: "Daemonissa's Domain",
            remainingTurns: turns,
            expiresOnCycleEnd: !isCopied
          });
          addLog(`Passive Active: [Daemonissa's Domain] (${durLabel}).`);
          return `Passive Daemonissa's Domain aktif (${durLabel} — hangus saat ganti Cycle)!`;
        } else {
          addOrRefreshPassive(player, {
            key: "passive_unpredictable_tricks",
            name: "Unpredictable Tricks",
            remainingTurns: turns,
            expiresOnCycleEnd: !isCopied
          });
          const msg = `Unpredictable Tricks aktif (${durLabel} — hangus saat ganti Cycle): melewati/dilewati lawan -> lawan buang 1 kartu & beri 5 TC!`;
          addLog(`Passive Active: [Unpredictable Tricks] (${durLabel}).`);
          return msg;
        }
      }
      case "skip_target_turn_buff_self": {
        targetPlayer.skipNextTurn = true;
        player.extraPhasesThisTurn += 1;
        player.maxRollsThisTurn = (player.maxRollsThisTurn || 2) + 1;
        const bonusSkills = state.compendiumId === "comp_v0_1" ? 0 : 1;
        player.maxSkillsThisTurn += bonusSkills;
        const msg = `${targetPlayer.name} melewatkan giliran depan! ${player.name} mendapat +1 Extra Phase & +${bonusSkills} Skill Use!`;
        addLog(`ULTIMATE [${card.name}]: ${msg}`);
        return msg;
      }
      case "choice_10tc_or_draw1": {
        const gainVal = card.tcGain || (state.compendiumId === "comp_v0_1" ? 5 : 10);
        if (options.choiceValue === "draw") {
          const d = drawCards(player, 1);
          const msg = `${player.name} mengambil +${d.length} Kartu dari deck!`;
          addLog(`[Showtime!]: ${msg}`);
          return msg;
        } else {
          const g = modifyPlayerTC(player, gainVal, "own_skill");
          const msg = `${player.name} memperoleh +${g} TC!`;
          addLog(`[Showtime!]: ${msg}`);
          return msg;
        }
      }
      case "dash_1_6_steal_card": {
        let destId = player.tileId;
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          destId = options.targetTileId;
          applySkillPathPassChecks(player, prevTileId, destId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(prevTileId, destId, player.lastTileId, false);
          player.tileId = destId;
          if (player.inSpawn && destId !== "T0") player.inSpawn = false;
        } else {
          const steps = Number(options.choiceValue || 4);
          movePlayerInstantAlongPath(player, steps, 1, false);
          destId = player.tileId;
        }
        let stealMsg = "";
        const victim = state.players.find(
          (other) =>
            other.index !== player.index &&
            !other.inSpawn &&
            other.tileId === destId &&
            other.hand.some((c) => c && c.rarity !== "Ultimate")
        );
        if (victim && !hasPassive(victim, "passive_immune_steal")) {
          const stealableIndices = [];
          victim.hand.forEach((c, idx) => {
            if (c && c.rarity !== "Ultimate") stealableIndices.push(idx);
          });
          if (stealableIndices.length > 0) {
            const pickIdx = stealableIndices[Math.floor(Math.random() * stealableIndices.length)];
            const stolenCard = victim.hand.splice(pickIdx, 1)[0];
            if (player.hand.length < state.rules.maxHandSize) player.hand.push(stolenCard);
            stealMsg = ` & mencuri [${stolenCard.name}] dari ${victim.name}!`;
            addLog(`[Phantom Thief]: ${player.name} stole [${stolenCard.name}] from ${victim.name}.`);
          }
        }
        if (TILE_MAP[destId]) {
          resolveExactLandingTile(player, TILE_MAP[destId]);
        }
        return `${player.name} berlari ke [${destId}]${stealMsg || "!"}`;
      }
      case "aoa_15tc_silence": {
        modifyPlayerTC(targetPlayer, -15, "own_skill");
        targetPlayer.silencedThisPhase = true;
        const msg = `${targetPlayer.name} kehilangan 15 TC & Silenced 1 Phase!`;
        addLog(`[All-Out Attack]: ${msg}`);
        return msg;
      }
      case "copy_last_skill": {
        const pool = (state.recentOpponentSkills || []).filter(
          (e) =>
            e.casterIndex !== player.index &&
            e.card &&
            e.card.effectKey !== "copy_last_skill" &&
            e.card.rarity !== "Ultimate" &&
            (!e.cycle || e.cycle === state.cycle)
        );
        let chosenEntry = null;
        if (options.copiedSkillEntryId) {
          chosenEntry = pool.find((e) => e.id === options.copiedSkillEntryId) || null;
        }
        if (!chosenEntry && pool.length > 0) chosenEntry = pool[0];

        const copiedCard = chosenEntry
          ? chosenEntry.card
          : state.lastOpponentSkillUsed &&
            state.lastOpponentSkillUsed.effectKey !== "copy_last_skill" &&
            state.lastOpponentSkillUsed.rarity !== "Ultimate"
          ? state.lastOpponentSkillUsed
          : null;

        if (copiedCard) {
          addLog(`[Will of Rebellion]: Menyalin efek [${copiedCard.name}].`);
          const copyOpts = { ...options };
          if (copiedCard.rarity === "Unique") {
            copyOpts.copiedUniqueDurationTurns = Math.max(1, state.players.length);
          }
          const innerOutcome = executeCardEffect(player, copiedCard, copyOpts);
          return `Menyalin [${copiedCard.name}]: ${innerOutcome || copiedCard.description}`;
        } else {
          const g = modifyPlayerTC(player, 15, "own_skill");
          const msg = `Tidak ada skill lawan baru-baru ini -> ${player.name} mendapat +${g} TC.`;
          addLog(`[Will of Rebellion]: ${msg}`);
          return msg;
        }
      }
      case "passive_awaken_arsene": {
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        addOrRefreshPassive(player, {
          key: "passive_awaken_arsene",
          name: "Awaken, Arsene!",
          remainingTurns: turns,
          expiresOnCycleEnd: !isCopied
        });
        const durLabel = getActiveCycleDurationLabel(options.copiedUniqueDurationTurns);
        const msg = `Awaken, Arsene! aktif (${durLabel} — hangus saat ganti Cycle): mendarat di Event / Versus beri +1 ekstra dadu!`;
        addLog(`Passive Active: [Awaken, Arsene!] (${durLabel}).`);
        return msg;
      }
      case "grant_meta_shard": {
        player.metaShardBought = true;
        if (player.metaShard < 1) {
          player.metaShard = 1;
          const msg = `${player.name} memperoleh 1 Permanent Meta-Shard yang tidak bisa dicuri!`;
          addLog(`ULTIMATE [Meta-Shard]: ${msg}`);
          checkVictory(player);
          return msg;
        }
        return "Meta-Shard sudah dimiliki.";
      }
      case "choice_move1_2_or_10tc": {
        if (options.choiceValue === "move" && options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          applySkillPathPassChecks(player, prevTileId, options.targetTileId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            false
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          addLog(`[${card.name}]: ${player.name} moved to [${options.targetTileId}].`);
          resolveExactLandingTile(player, TILE_MAP[options.targetTileId]);
        } else if (options.choiceValue === "move2") {
          movePlayerInstantAlongPath(player, 2, 1, true);
        } else {
          modifyPlayerTC(player, 10, "own_skill");
        }
        return card.description;
      }
      case "reactive_negate_target":
      case "haste_negate_skill": {
        addOrRefreshPassive(player, {
          key: "shield_negate_once",
          name: "Counter Shield",
          remainingTurns: 4,
          expiresOnCycleEnd: false
        });
        addLog(`[${card.name}]: Counter Shield active.`);
        return "Counter Shield aktif!";
      }
      case "place_herb_tile": {
        const tileId = options.targetTileId || player.tileId;
        state.boardTokens.push({
          id: "tok_" + Date.now(),
          type: "herb_tile",
          name: "Medicinal Herbs",
          ownerIndex: player.index,
          tileId,
          remainingCycles: 2
        });
        addLog(`[Medicinal Herbs]: Placed on [${tileId}].`);
        return card.description;
      }
      case "passive_emperor_tax": {
        addOrRefreshPassive(player, {
          key: "passive_emperor_tax",
          name: "Emperor's Tax",
          remainingTurns: 8,
          expiresOnCycleEnd: false
        });
        addLog(`Passive Active: [The Emperor's Favor].`);
        return card.description;
      }
      case "passive_miasma_cloud": {
        addOrRefreshPassive(player, { key: "passive_miasma_cloud", name: "Miasma Cloud", remainingTurns: getFullCycleTurns() });
        addLog(`Passive Active: [Miasma Cloud].`);
        return card.description;
      }
      case "place_restricted_zone": {
        const baseTile = TILE_MAP[options.targetTileId || player.tileId];
        const zoneTiles = [baseTile.id, ...(baseTile.next || []).slice(0, 2)];
        zoneTiles.forEach((tid) => {
          state.boardTokens.push({
            id: "tok_" + Date.now() + "_" + tid,
            type: "restricted_zone",
            name: "Grand Apothecary",
            ownerIndex: player.index,
            tileId: tid,
            remainingCycles: 99
          });
        });
        addLog(`ULTIMATE [Grand Apothecary]: Restricted Zone placed on [${zoneTiles.join(", ")}].`);
        return card.description;
      }
      case "ff_move_1_2_normal_bonus": {
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            false
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          resolveExactLandingTile(player, TILE_MAP[options.targetTileId]);
        } else {
          movePlayerInstantAlongPath(player, 2, 1, true);
        }
        if (TILE_MAP[player.tileId]?.type === "normal") modifyPlayerTC(player, 10, "own_skill");
        return card.description;
      }
      case "scry_2_keep_1": {
        drawCards(player, 1);
        return card.description;
      }
      case "place_safe_zone": {
        const tid = options.targetTileId || player.tileId;
        state.boardTokens.push({
          id: "tok_" + Date.now(),
          type: "safe_zone",
          name: "Safe Zone",
          ownerIndex: player.index,
          tileId: tid,
          remainingCycles: 1
        });
        return card.description;
      }
      case "retreat_2_negate": {
        movePlayerInstantAlongPath(player, 2, -1, true);
        return card.description;
      }
      case "relocate_board_traps": {
        if (state.boardTokens.length > 0) {
          state.boardTokens[0].tileId = targetPlayer.tileId;
          checkTokensOnStep(targetPlayer, targetPlayer.tileId, true);
        } else {
          modifyPlayerTC(player, 15, "own_skill");
        }
        return card.description;
      }
      case "passive_immune_steal": {
        addOrRefreshPassive(player, { key: "passive_immune_steal", name: "Immune Steal", remainingTurns: getFullCycleTurns() });
        return card.description;
      }
      case "transform_to_sam": {
        player.isSamMode = true;
        player.charName = "SAM";
        player.name = player.username ? player.username : "SAM";
        player.discard = [];
        player.hand = [];
        player.deck = buildDeckForCharacter("firefly", state.compendiumId, true);
        drawCards(player, state.rules.startHandSize);
        addOrRefreshPassive(player, { key: "passive_sam_armor", name: "SAM Armor", remainingTurns: getFullCycleTurns() });
        addLog(`ULTIMATE [Complete Combustion]: Transformed into SAM.`);
        return card.description;
      }
      case "sam_dash_aoe_5tc": {
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            false
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          resolveExactLandingTile(player, TILE_MAP[options.targetTileId]);
        } else {
          const steps = Number(options.choiceValue || 4);
          movePlayerInstantAlongPath(player, steps, 1, true);
        }
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn && getTileDistance(player.tileId, other.tileId) <= 1) {
            modifyPlayerTC(other, -5, "own_skill");
          }
        });
        return card.description;
      }
      case "sam_push_back_3": {
        movePlayerInstantAlongPath(targetPlayer, 3, -1, false);
        modifyPlayerTC(targetPlayer, -10, "own_skill");
        return card.description;
      }
      case "sam_discounted_versus": {
        const samWins = Math.random() < 0.55;
        if (samWins) {
          const prize = Math.min(20, targetPlayer.tc);
          targetPlayer.tc -= prize;
          player.tc += prize;
        } else {
          const loss = Math.min(10, player.tc);
          player.tc -= loss;
          targetPlayer.tc += loss;
        }
        return card.description;
      }
      case "sam_fire_tiles": {
        const tObj = TILE_MAP[options.targetTileId || player.tileId];
        const fireIds = [tObj.id, ...(tObj.next || []).slice(0, 1)];
        fireIds.forEach((fid) => {
          state.boardTokens.push({
            id: "tok_" + Date.now() + "_" + fid,
            type: "fire_tile",
            name: "Deathstar Fire",
            ownerIndex: player.index,
            tileId: fid,
            remainingCycles: 1
          });
        });
        return card.description;
      }
      case "passive_sam_armor": {
        addOrRefreshPassive(player, { key: "passive_sam_armor", name: "SAM Armor", remainingTurns: getFullCycleTurns() });
        return card.description;
      }
      case "transform_to_firefly": {
        player.isSamMode = false;
        player.charName = "Firefly / SAM";
        player.name = player.username ? player.username : "Firefly / SAM";
        player.discard = [];
        player.hand = [];
        player.deck = buildDeckForCharacter("firefly", state.compendiumId, false);
        drawCards(player, state.rules.startHandSize);
        modifyPlayerTC(player, 15, "own_skill");
        return card.description;
      }
      default:
        return card.description;
    }
  }

  function movePlayerInstantAlongPath(player, steps, direction = 1, resolveLanding = true) {
    let curr = player.tileId;
    let prev = player.lastTileId || null;
    const hitPlayers = new Set();
    for (let i = 0; i < steps; i++) {
      const opts = getNextPlayableOptions(curr, prev, i === 0 ? direction : 1);
      if (opts.length === 0) break;
      const chosen = opts[0];
      prev = chosen.viaSplitId || curr;
      curr = chosen.tileId;
      player.lastTileId = prev;
      player.tileId = curr;
      if (player.inSpawn && curr !== "T0") player.inSpawn = false;
      triggerUnpredictableTricksOnTile(player, curr, hitPlayers);
      checkTokensOnStep(player, curr, i === steps - 1);
    }
    if (direction < 0 && steps > 0) {
      player.lastTileId = getOppositeAdjacentNeighbor(player.tileId, player.lastTileId);
    }
    if (resolveLanding && TILE_MAP[curr]) {
      resolveExactLandingTile(player, TILE_MAP[curr]);
    }
  }

  // ============================================================================
  // UI RENDERING (QOL CAMERA, NON-OBSTRUCTING PINS, BRANCH HIGHLIGHT)
  // ============================================================================
  function buildShardCrystalSvg(uid = "s") {
    const safeId = String(uid).replace(/[^a-zA-Z0-9_-]/g, "");
    return `<svg class="shard-crystal-svg" viewBox="0 0 36 108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="eftShardGradMain_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e879f9"/>
          <stop offset="45%" stop-color="#a855f7"/>
          <stop offset="100%" stop-color="#7e22ce"/>
        </linearGradient>
        <linearGradient id="eftShardGradHi_${safeId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f5d0fe" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#a855f7" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <polygon points="18,2 32,26 32,82 18,106 4,82 4,26" fill="url(#eftShardGradMain_${safeId})"/>
      <polygon points="18,2 18,106 4,82 4,26" fill="url(#eftShardGradHi_${safeId})"/>
      <polygon points="18,2 32,26 18,32 4,26" fill="#f5d0fe" fill-opacity="0.34"/>
      <polygon points="18,106 32,82 18,76 4,82" fill="#4c1d95" fill-opacity="0.38"/>
    </svg>`;
  }

  function triggerShardFadeOut(shardObj) {
    if (!shardObj || !shardObj.tileId) return;
    const fadeId = shardObj.purchaseId || "fade_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    fadingShards.push({
      fadeId,
      tileId: shardObj.tileId,
      roman: shardObj.roman || "I"
    });
    setTimeout(() => {
      fadingShards = fadingShards.filter((s) => s.fadeId !== fadeId);
      if (state) renderDigitalBoard();
    }, 900);
  }

  function renderAll() {
    if (!state) return;
    if (
      state.lastDiceRollEvent &&
      state.lastDiceRollEvent.id &&
      state.lastDiceRollEvent.id !== lastShownDiceRollEventId
    ) {
      lastShownDiceRollEventId = state.lastDiceRollEvent.id;
      const ev = state.lastDiceRollEvent;
      playDiceRollAnimation(
        {
          player: { name: ev.playerName || getActivePlayer().name },
          rolls: Array.isArray(ev.rolls) && ev.rolls.length > 0 ? ev.rolls : [1],
          rawTotal: ev.rawTotal || 1,
          totalSteps: ev.totalSteps || 1,
          direction: ev.direction || 1,
          sides: ev.sides || 6,
          isForced: !!ev.isForced
        },
        () => {}
      );
    }
    if (state.lastSkillEvent && state.lastSkillEvent.id && state.lastSkillEvent.id !== lastShownSkillEventId) {
      lastShownSkillEventId = state.lastSkillEvent.id;
      showDramaticSkillPopup(state.lastSkillEvent);
    }
    if (state.lastTileEffectReveal && state.lastTileEffectReveal.id) {
      const rev = state.lastTileEffectReveal;
      if (rev.id !== lastShownTileEffectRevealId) {
        lastShownTileEffectRevealId = rev.id;
        startTileEffectCardShuffle({
          revealId: rev.id,
          deckKind: rev.deckKind,
          playerName: rev.playerName,
          tileName: rev.tileName,
          card: rev.card,
          outcomeText: rev.outcomeText || "",
          visualOnly: true
        });
      } else if (tileShuffleState && tileShuffleState.id === rev.id && rev.outcomeText && rev.outcomeText !== tileShuffleState.outcomeText) {
        tileShuffleState.outcomeText = rev.outcomeText;
        const slot = document.getElementById("tef-outcome-pill-slot");
        if (slot) {
          slot.innerHTML = `<div class="tef-outcome-pill">${escapeHtml(rev.outcomeText)}</div>`;
        }
      }
    }
    if (
      state.lastPurchasedShard &&
      state.lastPurchasedShard.purchaseId &&
      state.lastPurchasedShard.purchaseId !== lastProcessedPurchasedShardId
    ) {
      lastProcessedPurchasedShardId = state.lastPurchasedShard.purchaseId;
      triggerShardFadeOut(state.lastPurchasedShard);
    }
    if (!state.activeMinigame && !state.winner && state.turnTimerKey && state.turnTimerKey !== lastTrackedTurnTimerKey) {
      lastTrackedTurnTimerKey = state.turnTimerKey;
      localTurnKeyStartedAt = Date.now();
      turnThinkingRemainingMs = TURN_TIME_LIMIT_SEC * 1000;
      lastTurnTimerTickAt = Date.now();
      lastTimerWarnSec = -1;
      triggerTurnStartReminder(getActivePlayer());
    }
    syncRemoteActivityFeed();
    renderTopStatusStrip();
    updateTurnTimerUi();
    renderStepStatusBanner();
    renderFloatingPlayerCards();
    renderDigitalBoard();
    renderTuckedHandAndDice();
    renderActionLog();
    renderPromptBar();
    renderDiceOfFateOverlay();
    renderVictoryScreenOverlay();
    syncSharedTileModal();
    applyCameraTransform();
    scheduleAutoEndTurnIfReady();
    scheduleMultiplayerBotIfNeeded();
  }

  function renderTopStatusStrip() {
    const activeP = getActivePlayer();
    const phaseNames = ["Standby", "Main Phase 1", "Roll Dice 1", "Main Phase 2", "Roll Dice 2", "End Turn"];
    const turnEl = document.getElementById("turn-player-label");
    if (turnEl) {
      turnEl.textContent = activeP.name;
      turnEl.style.borderBottom = `2px solid ${activeP.color}`;
    }
    const phaseEl = document.getElementById("phase-name-label");
    if (phaseEl) {
      phaseEl.textContent = phaseNames[state.phaseIndex] || "Main Phase";
    }
    const cycleEl = document.getElementById("metric-cycle");
    if (cycleEl) cycleEl.textContent = state.cycle;
    const roundEl = document.getElementById("metric-round");
    if (roundEl) roundEl.textContent = `${state.roundInCycle} / ${state.rules.turnsPerCycle}`;
    const cardUseEl = document.getElementById("metric-card-use");
    if (cardUseEl) {
      cardUseEl.textContent =
        isAdminUnlocked && adminFreeSkillUse
          ? `${activeP.skillsUsedThisTurn} / FREE`
          : `${activeP.skillsUsedThisTurn} / ${activeP.maxSkillsThisTurn}`;
    }

    const targetSlots = state.rules.activeShardsOnBoard || 3;
    const romans = state.activeShards.map((s) => s.roman);
    while (romans.length < targetSlots) romans.push("-");
    const shardsEl = document.getElementById("metric-shards");
    if (shardsEl) {
      shardsEl.textContent = romans.slice(0, targetSlots).join(" / ");
    }
    const shardPill = document.getElementById("shard-zones-pill");
    if (shardPill) {
      shardPill.title =
        state.activeShards.map((s) => `Zone ${s.roman} (${s.tileId})`).join(", ") || "Tidak ada Shard aktif";
    }

    const weSlot = document.getElementById("world-event-pill-slot");
    if (weSlot) {
      if (state.activeGlobalEvent) {
        const ge = state.activeGlobalEvent.card;
        weSlot.innerHTML = `<div class="world-event-active-chip" onclick="window.EFT_APP.showEffectSpotlight('Active World Event', '${escapeHtml(
          ge.name
        )}', '${escapeHtml(ge.description)}', '${ge.image || ""}')">Event: ${escapeHtml(ge.name)} (${
          state.activeGlobalEvent.remainingTurns
        }T)</div>`;
      } else {
        weSlot.innerHTML = "";
      }
    }
  }

  function renderStepStatusBanner() {
    const banner = document.getElementById("step-status-banner");
    if (!banner) return;

    if (pendingInteraction && pendingInteraction.type === "choose_branch") {
      banner.classList.add("visible", "branch-mode");
      const touchOnly = isTouchOnlyDevice();
      if (hoveredBranchTileId && pendingInteraction.candidates.includes(hoveredBranchTileId)) {
        const viaId =
          pendingInteraction.candidateViaMap && pendingInteraction.candidateViaMap[hoveredBranchTileId]
            ? pendingInteraction.candidateViaMap[hoveredBranchTileId]
            : null;
        const preview = getBranchPreviewPath(
          hoveredBranchTileId,
          pendingInteraction.stepsRemaining,
          pendingInteraction.direction,
          pendingInteraction.player ? pendingInteraction.player.tileId : null,
          viaId
        );
        const landTile = TILE_MAP[preview.landingTileId] || { name: preview.landingTileId };
        const extra = preview.hitNextBranch ? ` · Belokan lagi (sisa ${preview.stepsLeftAtNextBranch})` : "";
        banner.innerHTML = `
          <span class="step-count-badge">Sisa ${pendingInteraction.stepsRemaining} Langkah</span>
          <span>Preview: <strong>${escapeHtml(landTile.name)} (${preview.landingTileId})</strong>${extra} — ${
            touchOnly ? "Ketuk lagi tile ini untuk jalan" : "Klik tile untuk belok"
          }</span>`;
      } else {
        banner.innerHTML = `
          <span class="step-count-badge">Sisa ${pendingInteraction.stepsRemaining} Langkah</span>
          <span>Pilih belokan langsung pada tile bercahaya (${
            touchOnly ? "ketuk untuk preview" : "arahkan untuk preview, klik untuk belok"
          })</span>`;
      }
      return;
    }

    if (pendingInteraction && pendingInteraction.type === "stage_is_mine") {
      banner.classList.add("visible", "branch-mode");
      banner.innerHTML = `
        <span class="step-count-badge">The Stage Is Mine</span>
        <span>Mendarat di Normal Tile — Klik tile <strong>+1 / +2 / -1</strong> bercahaya di peta untuk berpindah &amp; aktifkan efek, atau Skip</span>`;
      return;
    }

    if (isWalkingAnim && activeStepsRemaining > 0) {
      banner.classList.add("visible");
      banner.classList.remove("branch-mode");
      banner.innerHTML = `
        <span class="step-count-badge">Sisa ${activeStepsRemaining} Langkah</span>
        <span>${escapeHtml(getActivePlayer().name)} sedang berjalan...</span>`;
      return;
    }

    banner.classList.remove("visible", "branch-mode");
    banner.innerHTML = "";
  }

  function renderFloatingPlayerCards() {
    const listContainer = document.getElementById("hud-players-list");
    if (!listContainer) return;

    const buildCard = (p, idx) => {
      const isTurn = idx === state.activePlayerIndex;
      const charBase = DATA.CHARACTERS[p.charId] || {};
      const pt = charBase.portrait || null;
      const chips = [];
      if (p.inSpawn) chips.push(`<span class="fp-effect-chip">Spawn Immune</span>`);
      if (p.isSamMode) chips.push(`<span class="fp-effect-chip">SAM Mode</span>`);
      if (p.metaShard > 0) chips.push(`<span class="fp-effect-chip">Meta-Shard</span>`);
      if (p.turnTcMultiplier > 1) chips.push(`<span class="fp-effect-chip">x${p.turnTcMultiplier} TC</span>`);
      if (p.nextTurnDiceMod !== 0) {
        chips.push(
          `<span class="fp-effect-chip ${p.nextTurnDiceMod < 0 ? "debuff" : ""}">${
            p.nextTurnDiceMod > 0 ? "+" : ""
          }${p.nextTurnDiceMod} Die (Next Turn)</span>`
        );
      }
      if (p.nextPhaseDiceMod !== 0) {
        chips.push(
          `<span class="fp-effect-chip ${p.nextPhaseDiceMod < 0 ? "debuff" : ""}">${
            p.nextPhaseDiceMod > 0 ? "+" : ""
          }${p.nextPhaseDiceMod} Die (Next Roll)</span>`
        );
      }
      if (p.reverseNextRoll) chips.push(`<span class="fp-effect-chip debuff">Reverse</span>`);
      if (p.skipNextTurn) chips.push(`<span class="fp-effect-chip debuff">Skip Turn</span>`);
      if (p.silencedThisPhase) chips.push(`<span class="fp-effect-chip debuff">Silenced</span>`);
      p.passives.forEach((pas) => {
        let durStr = "";
        if (pas.expiresOnCycleEnd) {
          const totalR = (state.rules && state.rules.turnsPerCycle) || 4;
          const roundsLeft = Math.max(1, totalR - (state.roundInCycle || 1) + 1);
          durStr = ` (${roundsLeft}R)`;
        } else if (typeof pas.remainingTurns === "number") {
          const playersCnt = Math.max(1, state.players.length || 4);
          durStr = pas.remainingTurns === 1 ? " (1T)" : ` (${Math.max(1, Math.ceil(pas.remainingTurns / playersCnt))}R)`;
        }
        chips.push(`<span class="fp-effect-chip">${escapeHtml(pas.name)}${durStr}</span>`);
      });

      const portraitHtml =
        pt && pt.src
          ? `<img class="ph-portrait-img" src="${pt.src}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
          : `<div class="ph-portrait-fallback" style="background:radial-gradient(circle at 50% 42%, ${p.color}55 0%, #07191a 82%);"><div class="ph-fallback-icon" style="fill:${p.color};">${getCharacterSvgIcon(p.charId)}</div></div>`;

      const charSub =
        p.charName && p.name !== p.charName
          ? `<div class="ph-char-sub">${escapeHtml(p.charName)}</div>`
          : "";
      const editLink = isAdminUnlocked
        ? ` · <span class="ph-edit-link" onclick="event.stopPropagation();window.EFT_APP.openSandboxPlayerModal(${idx})">Edit</span>`
        : "";
      const rightClickAttr = isAdminUnlocked
        ? ` oncontextmenu="event.preventDefault();window.EFT_APP.openSandboxPlayerModal(${idx})"`
        : "";

      return `
      <div class="player-hud-card ${isTurn ? "is-active" : ""}" onclick="window.EFT_APP.focusCameraOnPlayer(${idx})" title="${escapeHtml(p.name)}${isAdminUnlocked ? " (Klik fokus, klik kanan edit)" : ""}"${rightClickAttr}>
        <div class="ph-portrait-col">${portraitHtml}</div>
        <div class="ph-info-col">
          <div class="ph-title-row">
            <span class="ph-name ${p.name.length > 11 ? "long-name" : ""}">${escapeHtml(p.name)}</span>
            <span class="ph-icon-badge" style="background:${p.color};">${getCharacterSvgIcon(p.charId)}</span>
          </div>
          ${charSub}
          <div class="ph-currency-bar">
            <span class="ph-curr-tc">💰 ${p.tc} TC</span>
            <span class="ph-curr-shard">💎 ${p.shards + p.metaShard}/${state.rules.victoryShards}</span>
          </div>
          <div class="ph-meta-row">
            <span class="ph-cards-pill">Cards: ${p.hand.length}/${getEffectiveHandLimit(p)}</span>
            <span class="ph-meta-right"><span class="ph-tile-tag">${p.tileId}</span>${editLink}</span>
          </div>
          ${chips.length > 0 ? `<div class="ph-effects-row">${chips.join("")}</div>` : ""}
        </div>
      </div>`;
    };

    listContainer.innerHTML = state.players.map((p, i) => buildCard(p, i)).join("");
  }

  function getTileSvgIcon(type) {
    switch (type) {
      case "spawn":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14"/><path d="M8 12h8"/><path d="M13 8l4 4-4 4"/></svg>`;
      case "normal":
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l6.5 8L12 20 5.5 12 12 4zm0 3.6L8.4 12 12 16.4 15.6 12 12 7.6z"/></svg>`;
      case "tc_plus10":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="12" r="6.5" fill="currentColor" fill-opacity="0.18"/><path d="M15.5 6.8a6.5 6.5 0 0 1 0 10.4"/><path d="M10.5 9v6"/><path d="M7.5 12h6"/></svg>`;
      case "tc_minus5":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7.5" fill="currentColor" fill-opacity="0.16"/><path d="M8.5 12h7"/></svg>`;
      case "card_plus1":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="11" height="15" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M11.5 9v5"/><path d="M9 11.5h5"/><path d="M17 7h1.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H10"/></svg>`;
      case "card_minus1":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="16" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M9.5 9.5l5 5"/><path d="M14.5 9.5l-5 5"/></svg>`;
      case "pos_effect":
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.4 6.1 6.1 2.4-6.1 2.4L12 19.5l-2.4-6.1-6.1-2.4 6.1-2.4L12 2.5z"/><circle cx="18.5" cy="5.5" r="1.4"/></svg>`;
      case "neg_effect":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L21 19H3L12 3z" fill="currentColor" fill-opacity="0.16"/><path d="M12 9.5v4"/><circle cx="12" cy="16.2" r="0.8" fill="currentColor"/></svg>`;
      case "event":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity="0.14"/><path d="M13 6.5L8.5 13h4l-1.5 5 5-6.5h-4l1-5z" fill="currentColor"/></svg>`;
      case "versus":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L19 5"/><path d="M15 5h4v4"/><path d="M19 19L5 5"/><path d="M9 5H5v4"/></svg>`;
      case "trading":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9h12l-3-3"/><path d="M18 15H6l3 3"/></svg>`;
      case "merchant":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-4h13L20 9" fill="currentColor" fill-opacity="0.18"/><path d="M4 9a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0"/><path d="M5.5 10.5V19h13v-8.5"/><rect x="9.5" y="13.5" width="5" height="5.5" fill="currentColor" fill-opacity="0.2"/></svg>`;
      case "warp":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" stroke-dasharray="4 2.5"/><circle cx="12" cy="12" r="4.5" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`;
      case "river_top":
      case "river_bottom":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>`;
      case "intersect":
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M4 12h16"/><path d="M9.5 6.5L12 4l2.5 2.5"/><path d="M17.5 9.5L20 12l-2.5 2.5"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>`;
    }
  }

  function getCleanTileLabel(t) {
    switch (t.type) {
      case "spawn": return "START";
      case "normal": return "";
      case "tc_plus10": return "+10";
      case "tc_minus5": return "-5";
      case "card_plus1": return "+1C";
      case "card_minus1": return "-1C";
      case "pos_effect": return "POS";
      case "neg_effect": return "NEG";
      case "event": return "EVT";
      case "versus": return "VS";
      case "trading": return "TRD";
      case "merchant": return `SHOP ${t.shopId || 1}`;
      case "warp": return "WARP";
      case "river_top": return "RIV IN";
      case "river_bottom": return "RIV OUT";
      case "intersect": return "+";
      default: return "";
    }
  }

  function buildSplitHubSvg(t) {
    const nbs = (ADJ_MAP[t.id] || []).map((id) => TILE_MAP[id]).filter(Boolean);
    if (nbs.length === 0) return getTileSvgIcon("intersect");

    const cx = 12;
    const cy = 12;
    const armLen = 8.4;
    const headBack = 2.8;
    const headSide = 2.1;

    const parts = nbs.map((nb) => {
      const dx = ((nb.x - t.x) / 100) * BOARD_W;
      const dy = ((nb.y - t.y) / 100) * BOARD_H;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;

      const tipX = cx + ux * armLen;
      const tipY = cy + uy * armLen;
      const baseX = tipX - ux * headBack;
      const baseY = tipY - uy * headBack;
      const lX = baseX + px * headSide;
      const lY = baseY + py * headSide;
      const rX = baseX - px * headSide;
      const rY = baseY - py * headSide;

      return `<line x1="${cx}" y1="${cy}" x2="${(tipX - ux * 1.1).toFixed(2)}" y2="${(tipY - uy * 1.1).toFixed(2)}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
        <polygon points="${tipX.toFixed(2)},${tipY.toFixed(2)} ${lX.toFixed(2)},${lY.toFixed(2)} ${rX.toFixed(2)},${rY.toFixed(2)}" fill="currentColor"/>`;
    });

    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${parts.join("")}<circle cx="${cx}" cy="${cy}" r="1.7" fill="currentColor"/></svg>`;
  }

  function getTrapTileMeta(tok) {
    if (!tok) return null;
    switch (tok.type) {
      case "virus_trap":
        return {
          tileCls: "tile-trap-virus",
          badgeCls: "badge-virus",
          label: "VIRUS",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M4.9 4.9l3.5 3.5M15.6 15.6l3.5 3.5M19.1 4.9l-3.5 3.5M8.4 15.6l-3.5 3.5"/></svg>`
        };
      case "fire_tile":
        return {
          tileCls: "tile-trap-fire",
          badgeCls: "badge-fire",
          label: "FIRE",
          icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2 3.2 4.8 5.2 4.8 9.2a4.8 4.8 0 0 1-9.6 0c0-1.8.6-3.3 1.4-4.5-.2 1.3.5 2.3 1.5 2.5C9.8 6.4 10.6 4.1 12 2z"/></svg>`
        };
      case "herb_tile":
        return {
          tileCls: "tile-trap-herb",
          badgeCls: "badge-herb",
          label: "HERB",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`
        };
      case "safe_zone":
        return {
          tileCls: "tile-trap-safe",
          badgeCls: "badge-safe",
          label: "SAFE",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l8 3.5v5.5c0 4.6-3.2 8.2-8 9.5-4.8-1.3-8-4.9-8-9.5V6.5L12 3z"/></svg>`
        };
      case "restricted_zone":
        return {
          tileCls: "tile-trap-restricted",
          badgeCls: "badge-restricted",
          label: "TAX 20",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`
        };
      default:
        return {
          tileCls: "tile-trap-virus",
          badgeCls: "badge-virus",
          label: "TRAP",
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3L2 21h20L12 3z"/><path d="M12 9v5M12 17h.01"/></svg>`
        };
    }
  }

  function buildTileInnerHtml(t, activeToken = null) {
    if (printPreviewMode) {
      return `<span class="lgr-print-id">${escapeHtml(t.id.replace("T", ""))}</span>`;
    }
    if (t.type === "intersect") {
      return `<div class="lgr-split-hub" title="Belokan Split (tidak terhitung langkah)">${buildSplitHubSvg(t)}</div>`;
    }
    if (activeToken) {
      const tm = getTrapTileMeta(activeToken);
      return `
        <div class="lgr-tile-shell">
          <div class="lgr-icon">${tm.icon}</div>
          <div class="lgr-pill-label">${escapeHtml(tm.label)}</div>
        </div>
        <div class="tile-trap-badge ${tm.badgeCls}">${tm.icon}<span>${escapeHtml(tm.label)}</span></div>`;
    }
    const labels = {
      spawn: "START",
      normal: "",
      tc_plus10: "+10",
      tc_minus5: "-5",
      card_plus1: "+1C",
      card_minus1: "-1C",
      pos_effect: "BONUS",
      neg_effect: "CURSE",
      event: "EVENT",
      versus: "VS",
      trading: "TRADE",
      merchant: `SHOP ${t.shopId || 1}`,
      warp: "WARP",
      river_top: "RIVER",
      river_bottom: "EXIT"
    };
    const lbl = labels[t.type] !== undefined ? labels[t.type] : getCleanTileLabel(t);
    return `
      <div class="lgr-tile-shell">
        <div class="lgr-icon">${getTileSvgIcon(t.type)}</div>
        ${lbl ? `<div class="lgr-pill-label">${escapeHtml(lbl)}</div>` : ""}
      </div>`;
  }

  function getTileRadius(tile) {
    if (!tile) return 40;
    if (tile.type === "intersect") return 22;
    if (tile.type === "spawn") return 45;
    if (tile.type === "merchant" || tile.type === "warp" || tile.type === "event" || tile.type === "versus") return 44;
    if (tile.type === "river_top" || tile.type === "river_bottom") return 43;
    if (tile.type === "normal") return 34;
    return 40;
  }

  function buildChibiDirectionIndicatorHtml(p) {
    const currTile = TILE_MAP[p.tileId];
    if (!currTile) return "";
    const isRev = !!p.reverseNextRoll;
    const opts = getNextPlayableOptions(p.tileId, p.lastTileId || null, isRev ? -1 : 1);
    if (!opts || opts.length === 0) return "";

    const arrowSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`;
    const angles = [];
    opts.slice(0, 2).forEach((opt) => {
      const targetTile = TILE_MAP[opt.viaSplitId || opt.tileId];
      if (!targetTile) return;
      const dx = ((targetTile.x - currTile.x) / 100) * BOARD_W;
      const dy = ((targetTile.y - currTile.y) / 100) * BOARD_H;
      if (Math.hypot(dx, dy) < 1) return;
      const deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      if (!angles.some((a) => Math.abs(a - deg) < 16)) {
        angles.push(deg);
      }
    });
    if (angles.length === 0) return "";

    const arrowsHtml = angles
      .map((deg) => `<span class="chibi-dir-arrow" style="transform:rotate(${deg}deg);">${arrowSvg}</span>`)
      .join("");
    return `<div class="chibi-dir-indicator ${isRev ? "is-reverse" : ""}" title="${isRev ? "Arah gerak MUNDUR (Mind Deviation)" : "Arah gerak langkah dadu berikutnya"}">${arrowsHtml}${isRev ? `<span class="chibi-dir-rev-tag">REV</span>` : ""}</div>`;
  }

  function renderBoardSvgOverlay() {
    const svg = document.getElementById("map-svg-overlay");
    if (!svg) return;
    const W = BOARD_W;
    const H = BOARD_H;
    const pathLines = [];

    if (!printPreviewMode) {
      const rTop = TILE_MAP.T38;
      const rBot = TILE_MAP.T69;
      if (rTop && rBot) {
        const x1 = (rTop.x / 100) * W;
        const y1 = (rTop.y / 100) * H;
        const x2 = (rBot.x / 100) * W;
        const y2 = (rBot.y / 100) * H;
        pathLines.push(
          `<path d="M ${x1} ${y1} C ${x1 + 95} ${y1 + 500}, ${x1 - 405} ${y2 - 580}, ${x2} ${y2}" fill="none" stroke="rgba(56, 189, 248, 0.24)" stroke-width="42" stroke-linecap="round"/>`,
          `<path d="M ${x1} ${y1} C ${x1 + 95} ${y1 + 500}, ${x1 - 405} ${y2 - 580}, ${x2} ${y2}" fill="none" stroke="#38bdf8" stroke-width="6" stroke-dasharray="18,14"/>`
        );
      }

      const w1 = TILE_MAP.T63;
      const w2 = TILE_MAP.T116;
      if (w1 && w2) {
        pathLines.push(
          `<line x1="${(w1.x / 100) * W}" y1="${(w1.y / 100) * H}" x2="${(w2.x / 100) * W}" y2="${(w2.y / 100) * H}" stroke="rgba(96, 165, 250, 0.42)" stroke-width="4" stroke-dasharray="16,12"/>`
        );
      }

      // Clean undirected board track roads (NO fixed directional arrows on tiles!)
      const drawnEdges = new Set();
      DATA.BOARD_TILES.forEach((t) => {
        const x1 = (t.x / 100) * W;
        const y1 = (t.y / 100) * H;
        (ADJ_MAP[t.id] || []).forEach((nid) => {
          const edgeKey = t.id < nid ? `${t.id}|${nid}` : `${nid}|${t.id}`;
          if (drawnEdges.has(edgeKey)) return;
          drawnEdges.add(edgeKey);
          const target = TILE_MAP[nid];
          if (!target) return;
          const x2 = (target.x / 100) * W;
          const y2 = (target.y / 100) * H;
          pathLines.push(
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(15, 23, 42, 0.76)" stroke-width="18" stroke-linecap="round"/>`,
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(203, 213, 225, 0.42)" stroke-width="4" stroke-linecap="round"/>`
          );
        });
      });
    }

    // Highlight glowing branch turn paths & live preview polyline ONLY during active branch choice
    if (pendingInteraction && pendingInteraction.type === "choose_branch") {
      const fromTile = TILE_MAP[pendingInteraction.player.tileId];
      const viaMap = pendingInteraction.candidateViaMap || {};
      if (fromTile) {
        pendingInteraction.candidates.forEach((cid) => {
          const target = TILE_MAP[cid];
          if (!target) return;
          const viaTile = viaMap[cid] ? TILE_MAP[viaMap[cid]] : null;
          const anchorTile = viaTile || fromTile;
          const x0 = (fromTile.x / 100) * W;
          const y0 = (fromTile.y / 100) * H;
          const xa = (anchorTile.x / 100) * W;
          const ya = (anchorTile.y / 100) * H;
          const x2 = (target.x / 100) * W;
          const y2 = (target.y / 100) * H;
          const dx = x2 - xa;
          const dy = y2 - ya;
          const len = Math.hypot(dx, dy) || 1;
          const trim = len > 45 ? Math.min(len * 0.5, getTileRadius(target) + 6) : 0;
          const ex = x2 - (dx / len) * trim;
          const ey = y2 - (dy / len) * trim;
          const isHov = hoveredBranchTileId === cid;
          const color = isHov ? "#38bdf8" : "#fde047";
          const marker = isHov ? "url(#arrow-cyan)" : "url(#arrow-gold)";
          if (viaTile) {
            pathLines.push(
              `<line x1="${x0}" y1="${y0}" x2="${xa}" y2="${ya}" stroke="${color}" stroke-width="${isHov ? 8 : 6.5}" stroke-linecap="round" />`
            );
          }
          pathLines.push(
            `<line x1="${xa}" y1="${ya}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="${
              isHov ? 8 : 6.5
            }" stroke-linecap="round" marker-end="${marker}" />`
          );
        });

        if (hoveredBranchTileId && pendingInteraction.candidates.includes(hoveredBranchTileId)) {
          const preview = getBranchPreviewPath(
            hoveredBranchTileId,
            pendingInteraction.stepsRemaining,
            pendingInteraction.direction,
            fromTile.id,
            viaMap[hoveredBranchTileId] || null
          );
          const polyNodes = (preview.polylineIds || [fromTile.id, ...preview.path])
            .map((pid) => TILE_MAP[pid])
            .filter(Boolean);
          const pts = polyNodes.map(
            (pt) => `${((pt.x / 100) * W).toFixed(1)},${((pt.y / 100) * H).toFixed(1)}`
          );
          if (pts.length >= 2) {
            pathLines.push(
              `<polyline points="${pts.join(" ")}" fill="none" stroke="rgba(56, 189, 248, 0.35)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />`,
              `<polyline points="${pts.join(" ")}" fill="none" stroke="#38bdf8" stroke-width="6" stroke-dasharray="14,10" stroke-linecap="round" stroke-linejoin="round" />`
            );
          }
        }
      }
    }

    svg.innerHTML = `
      <defs>
        <marker id="arrow-cyan" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="arrow-gold" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#fde047" />
        </marker>
      </defs>
      ${pathLines.join("")}
    `;
  }

  function applyBranchPreviewTileClasses() {
    const nodesLayer = document.getElementById("map-nodes-layer");
    if (!nodesLayer) return;

    nodesLayer.querySelectorAll(".digital-tile").forEach((el) => {
      el.classList.remove("branch-hovered", "branch-preview-step", "branch-preview-landing");
      el.removeAttribute("data-preview-step");
      el.removeAttribute("data-preview-tag");
      if (el.classList.contains("branch-option")) {
        el.setAttribute("data-branch-tag", "BELOK");
      }
    });

    if (
      !pendingInteraction ||
      pendingInteraction.type !== "choose_branch" ||
      !hoveredBranchTileId ||
      !pendingInteraction.candidates.includes(hoveredBranchTileId)
    ) {
      return;
    }

    const touchOnly = isTouchOnlyDevice();
    const hovEl = nodesLayer.querySelector(`[data-tile-id="${hoveredBranchTileId}"]`);
    if (hovEl) {
      hovEl.classList.add("branch-hovered");
      if (touchOnly) hovEl.setAttribute("data-branch-tag", "KLIK LAGI");
    }

    const viaId =
      pendingInteraction.candidateViaMap && pendingInteraction.candidateViaMap[hoveredBranchTileId]
        ? pendingInteraction.candidateViaMap[hoveredBranchTileId]
        : null;
    const preview = getBranchPreviewPath(
      hoveredBranchTileId,
      pendingInteraction.stepsRemaining,
      pendingInteraction.direction,
      pendingInteraction.player ? pendingInteraction.player.tileId : null,
      viaId
    );
    if (preview.path.length === 1 && hovEl) {
      hovEl.setAttribute("data-branch-tag", touchOnly ? "KLIK LAGI" : preview.hitNextBranch ? "BELOKAN" : "TUJUAN");
      return;
    }

    for (let i = 1; i < preview.path.length; i++) {
      const tid = preview.path[i];
      const el = nodesLayer.querySelector(`[data-tile-id="${tid}"]`);
      if (!el) continue;
      if (i < preview.path.length - 1) {
        el.classList.add("branch-preview-step");
        el.setAttribute("data-preview-step", String(i + 1));
      } else {
        el.classList.add("branch-preview-landing");
        el.setAttribute("data-preview-tag", preview.hitNextBranch ? "BELOKAN" : "TUJUAN");
      }
    }
  }

  const TILE_EFFECT_META = {
    tc_plus10: {
      title: "Tile +10 Tartarus Coin",
      badge: "+10 TC",
      accent: "#10b981",
      effect: "Pemain yang berhenti tepat di tile ini memperoleh +10 Tartarus Coin (💰 TC) dari bank."
    },
    tc_minus5: {
      title: "Tile -5 Tartarus Coin",
      badge: "-5 TC",
      accent: "#e11d48",
      effect: "Pemain yang berhenti tepat di tile ini kehilangan 5 Tartarus Coin (💰 TC) ke bank."
    },
    card_plus1: {
      title: "Tile +1 Skill Card",
      badge: "+1 Card",
      accent: "#0284c7",
      effect: "Pemain yang berhenti tepat di tile ini menarik +1 Skill Card dari deck pribadinya (maksimal sesuai Hand Limit)."
    },
    card_minus1: {
      title: "Tile -1 Skill Card",
      badge: "-1 Card",
      accent: "#eab308",
      effect: "Pemain yang berhenti tepat di tile ini harus membuang 1 kartu secara acak dari tangannya."
    },
    pos_effect: {
      title: "Positive Effect Tile",
      badge: "Positive Deck",
      accent: "#34d399",
      effect: "Menarik 1 Positive Effect Card secara acak (+10 TC, +15 TC, +1 Dice Next Turn, Draw 1 Card, atau Draw 2 Cards)."
    },
    neg_effect: {
      title: "Negative Effect Tile",
      badge: "Negative Deck",
      accent: "#fb7185",
      effect: "Menarik 1 Negative Effect Card secara acak (-5 TC, -10 TC, Discard 1 Card, Discard 2 Cards, atau -1 Dice Next Turn)."
    },
    event: {
      title: "Global Event Tile",
      badge: "Global Event",
      accent: "#d946ef",
      effect: "Mengambil 1 Global Event Card acak yang efeknya langsung berlaku ke seluruh pemain di arena."
    },
    versus: {
      title: "Versus Duel Tile",
      badge: "1v1 Versus",
      accent: "#f97316",
      effect: "Menantang salah satu lawan untuk duel dadu 1v1 dengan taruhan TC. Pemenang merebut taruhan tersebut."
    },
    trading: {
      title: "Trading Post",
      badge: "Trade",
      accent: "#84cc16",
      effect: "Membuka barter dengan pemain lain: beli 1 kartu acak (💰 15 TC), jual 1 kartu (💰 15 TC), atau tukar 1 kartu acak."
    },
    merchant: {
      title: "Merchant Shop",
      badge: "Shop",
      accent: "#f59e0b",
      effect: "Berada di sisi jalur/belokan (tidak mengurangi langkah dadu). Saat melewati jalur yang ditunjuk panah Shop dengan 💰 >= 15 TC, pemain ditawarkan opsi membuka Merchant Shop."
    },
    warp: {
      title: "Warp Teleporter",
      badge: "Warp",
      accent: "#60a5fa",
      effect: "Saat berhenti tepat di tile ini, pemain langsung berpindah secara instan ke Warp Tile pasangannya di sisi lain peta."
    },
    river_top: {
      title: "River Shortcut (Masuk)",
      badge: "River",
      accent: "#38bdf8",
      effect: "Saat melewati tile ini dengan sisa langkah (> 0), pemain dapat membayar 💰 15 TC untuk menyeberang langsung ke River Exit."
    },
    river_bottom: {
      title: "River Shortcut (Keluar)",
      badge: "River Exit",
      accent: "#38bdf8",
      effect: "Titik keluar penyeberangan Sungai Tartarus setelah memakai River Shortcut."
    }
  };

  const TOKEN_EFFECT_DESCRIPTIONS = {
    virus_trap: "Punishing Virus (Trap): Lawan yang melewati atau mendarat di tile ini akan kehilangan 1 dadu pada roll dadu berikutnya.",
    herb_tile: "Medicinal Herbs: Pemain yang melewati atau mendarat di sini langsung mendapat +10 💰 TC.",
    restricted_zone: "Restricted Zone: Lawan yang mendarat di tile ini harus membayar 20 💰 TC kepada pemilik token.",
    fire_tile: "Deathstar Fire: Pemain yang mendarat di sini kehilangan 15 💰 TC dan roll berikutnya maksimal 6 langkah.",
    safe_zone: "Safe Zone (Oak Cake Break): Pemain yang berada di tile ini tidak dapat ditarget oleh efek kartu lawan."
  };

  function renderDigitalBoard() {
    const surface = document.getElementById("map-canvas-wrap");
    surface.classList.toggle("print-mode", printPreviewMode);
    renderBoardSvgOverlay();

    const localCanAct = canLocalPlayerAct();
    const candidateSet = new Set(
      localCanAct && pendingInteraction && pendingInteraction.type === "choose_branch" ? pendingInteraction.candidates : []
    );
    const radiusSet = new Set(
      localCanAct &&
      pendingInteraction &&
      (pendingInteraction.type === "select_tile_target" || pendingInteraction.type === "stage_is_mine")
        ? pendingInteraction.validTileIds
        : []
    );

    const tokenTileMap = {};
    state.boardTokens.forEach((tok) => {
      tokenTileMap[tok.tileId] = tok;
    });
    const shardTileSet = new Set(state.activeShards.map((s) => s.tileId));

    const nodesLayer = document.getElementById("map-nodes-layer");
    const tilesHtml = DATA.BOARD_TILES.map((t) => {
      const classes = ["digital-tile", `dt-${t.type}`];
      if (t.shopArrow) classes.push(`shop-arrow-${t.shopArrow}`);
      const effectMeta = TILE_EFFECT_META[t.type] || null;
      const hasShard = shardTileSet.has(t.id);
      const tokOnTile = tokenTileMap[t.id] || null;
      const hasTok = !!tokOnTile;
      if (effectMeta || hasShard || hasTok) {
        classes.push("has-tile-effect");
      }
      if (hasShard) {
        classes.push("has-active-shard");
      }
      if (hasTok) {
        const tm = getTrapTileMeta(tokOnTile);
        classes.push("tile-has-trap", tm.tileCls);
      }

      let branchTagAttr = "";
      let tip = "";
      if (effectMeta) {
        tip = `${effectMeta.title}: ${effectMeta.effect}`;
      }
      if (hasTok) {
        const tDesc = TOKEN_EFFECT_DESCRIPTIONS[tokOnTile.type] || tokOnTile.name;
        tip = tip ? `${tip} | ${tDesc}` : tDesc;
      }
      if (hasShard) {
        const sTip = "Tartarus Shard aktif di tile ini (lewati dengan >= 100 TC untuk membeli).";
        tip = tip ? `${tip} | ${sTip}` : sTip;
      }

      if (candidateSet.has(t.id)) {
        classes.push("branch-option");
        branchTagAttr = ` data-branch-tag="BELOK"`;
        const viaId =
          pendingInteraction.candidateViaMap && pendingInteraction.candidateViaMap[t.id]
            ? pendingInteraction.candidateViaMap[t.id]
            : null;
        const prev = getBranchPreviewPath(
          t.id,
          pendingInteraction.stepsRemaining,
          pendingInteraction.direction,
          pendingInteraction.player ? pendingInteraction.player.tileId : null,
          viaId
        );
        const landTile = TILE_MAP[prev.landingTileId];
        tip = `Belok ke jalur ini -> Perkiraan berhenti di ${landTile ? landTile.name : prev.landingTileId}`;
      }
      if (radiusSet.has(t.id)) classes.push("in-radius");
      const stepLbl =
        localCanAct &&
        pendingInteraction &&
        (pendingInteraction.type === "select_tile_target" || pendingInteraction.type === "stage_is_mine") &&
        pendingInteraction.tileStepLabels &&
        pendingInteraction.tileStepLabels[t.id]
          ? pendingInteraction.tileStepLabels[t.id]
          : "";
      const stepAttr = stepLbl ? ` data-step="${stepLbl}"` : "";

      return `
      <div class="${classes.join(" ")}" data-tile-id="${t.id}"${branchTagAttr}${stepAttr}
           style="left:${t.x}%;top:${t.y}%;"
           ${tip ? `title="${escapeHtml(tip)}"` : ""}
           onmouseenter="window.EFT_APP.onTileHover('${t.id}', true)"
           onmouseleave="window.EFT_APP.onTileHover('${t.id}', false)"
           onclick="window.EFT_APP.onTileClicked('${t.id}')">
        ${buildTileInnerHtml(t, tokOnTile)}
      </div>`;
    });

    const shardHtml = state.activeShards.map((sh, idx) => {
      const tile = TILE_MAP[sh.tileId];
      if (!tile) return "";
      return `
      <div class="shard-crystal-marker" style="left:${tile.x}%;top:${tile.y}%;">
        <div class="shard-crystal-float-wrap">
          ${buildShardCrystalSvg("act_" + sh.tileId + "_" + idx)}
          <div class="shard-crystal-glow"></div>
        </div>
        <div class="shard-crystal-label">Shard ${escapeHtml(sh.roman)}</div>
      </div>`;
    });

    const fadingShardHtml = fadingShards.map((sh) => {
      const tile = TILE_MAP[sh.tileId];
      if (!tile) return "";
      return `
      <div class="shard-crystal-marker is-fading-out" style="left:${tile.x}%;top:${tile.y}%;">
        <div class="shard-crystal-float-wrap">
          ${buildShardCrystalSvg("fade_" + sh.fadeId)}
          <div class="shard-crystal-glow"></div>
        </div>
        <div class="shard-crystal-label">Shard ${escapeHtml(sh.roman)}</div>
      </div>`;
    });

    // Group players by tile and position floating pins around the upper rim so they NEVER cover the tile block!
    const tileOccupants = {};
    state.players.forEach((p) => {
      if (!tileOccupants[p.tileId]) tileOccupants[p.tileId] = [];
      tileOccupants[p.tileId].push(p);
    });

    const pawnsHtml = state.players.map((p, idx) => {
      const tile = TILE_MAP[p.tileId] || TILE_MAP.T0;
      const group = tileOccupants[p.tileId] || [p];
      const posInGroup = group.indexOf(p);
      const spreadX = (posInGroup - (group.length - 1) / 2) * 1.45;
      const px = tile.x + spreadX;
      const py = tile.y;
      const isAct = idx === state.activePlayerIndex;
      const walkCls = isAct && isWalkingAnim ? "walking-step" : "";
      const chData = DATA.CHARACTERS[p.charId] || {};
      const chibiSrc = chData.chibi || "";
      const pawnVisual = chibiSrc
        ? `<img class="board-chibi-img" src="${chibiSrc}" alt="${escapeHtml(p.name)}" decoding="async" />`
        : `<div class="board-pawn-fallback">${getCharacterSvgIcon(p.charId)}</div>`;
      const dirIndicator = buildChibiDirectionIndicatorHtml(p);
      return `
      <div class="board-chibi-pawn ${isAct ? "active-pawn" : ""} ${walkCls}"
           style="left:${px}%;top:${py}%;--pawn-color:${p.color};"
           title="${escapeHtml(p.name)} @ ${p.tileId}"
           onclick="event.stopPropagation();window.EFT_APP.${isAdminUnlocked ? "openSandboxPlayerModal" : "focusCameraOnPlayer"}(${idx})">
        ${dirIndicator}
        ${pawnVisual}
        <span class="chibi-base-ring"></span>
      </div>`;
    });

    nodesLayer.innerHTML = tilesHtml.join("") + shardHtml.join("") + fadingShardHtml.join("") + pawnsHtml.join("");
    applyBranchPreviewTileClasses();
  }

  function onTileHover(tileId, entering) {
    if (!canLocalPlayerAct()) return;
    if (!pendingInteraction || pendingInteraction.type !== "choose_branch") return;
    if (!pendingInteraction.candidates.includes(tileId)) return;
    if (!entering && isTouchOnlyDevice()) return;
    hoveredBranchTileId = entering ? tileId : hoveredBranchTileId === tileId ? null : hoveredBranchTileId;
    renderBoardSvgOverlay();
    applyBranchPreviewTileClasses();
    renderStepStatusBanner();
  }

  function renderTuckedHandAndDice() {
    const viewPlayerIdx = mp.mySeat !== -1 ? mp.mySeat : state.activePlayerIndex;
    const player = state.players[viewPlayerIdx] || getActivePlayer();
    const activeP = getActivePlayer();

    const drawCountEl = document.getElementById("draw-pile-count");
    if (drawCountEl && player) {
      const rem = (player.deck || []).length;
      drawCountEl.textContent = `${rem} Kartu`;
    }

    const rollBtn = document.getElementById("btn-roll-dice");
    const rollCountEl = document.getElementById("roll-counter-label");
    const endTurnBtn = document.getElementById("btn-end-turn");
    const readoutEl = document.getElementById("last-roll-readout");

    const usedRolls = activeP.rollsUsedThisTurn || 0;
    const maxRolls = activeP.maxRollsThisTurn || 2;
    if (rollCountEl) {
      rollCountEl.textContent = `${usedRolls}/${maxRolls}`;
    }

    const canRoll =
      (state.phaseIndex === 1 || state.phaseIndex === 3) &&
      !pendingInteraction &&
      !state.activeTileModal &&
      !state.winner &&
      !isWalkingAnim &&
      !isTileEffectAnimating &&
      canLocalPlayerAct();
    if (rollBtn) {
      rollBtn.disabled = !canRoll;
    }

    const canEndTurn =
      (usedRolls >= 1 || state.phaseIndex === 5) &&
      !pendingInteraction &&
      !state.activeTileModal &&
      !state.winner &&
      !isWalkingAnim &&
      !isTileEffectAnimating &&
      canLocalPlayerAct();
    if (endTurnBtn) {
      endTurnBtn.disabled = !canEndTurn;
    }

    if (readoutEl) {
      if (state.lastDiceRoll && state.lastDiceRoll.length > 0) {
        const dirSign = state.lastDiceTotal < 0 ? "-" : "";
        readoutEl.textContent = `Dadu: [${state.lastDiceRoll.join(" + ")}] (${dirSign}${Math.abs(state.lastDiceTotal)} langkah)`;
        readoutEl.classList.add("visible");
      } else {
        readoutEl.textContent = "";
        readoutEl.classList.remove("visible");
      }
    }

    const handContainer = document.getElementById("hand-cards-scroll");
    if (player.hand.length === 0) {
      handContainer.innerHTML = "";
      return;
    }

    const total = player.hand.length;
    const tuckY = isMobilePortrait() ? 68 : 104;
    handContainer.innerHTML = player.hand
      .map((card, i) => {
        const imgUrl = getCardImage(card, player.charId);
        const isUlt = card.rarity === "Ultimate";
        const isSelected = selectedCardUid === card.uid;
        const angle = ((i - (total - 1) / 2) * 2.2).toFixed(1);
        const inlineTransform = isSelected
          ? ""
          : `transform: translateY(${tuckY}px) rotate(${angle}deg);`;

        return `
        <div class="tucked-card ${isUlt ? "ult-card" : ""} ${isSelected ? "selected" : ""}"
             style="${inlineTransform}"
             onclick="event.stopPropagation();window.EFT_APP.onHandCardClicked('${card.uid}', ${player.index})">
          <img src="${imgUrl}" alt="${card.name}" loading="lazy" decoding="async" />
          <div class="tucked-card-actions">
            <button class="btn btn-emerald btn-sm" style="width:100%;" onclick="event.stopPropagation();window.EFT_APP.openPlayCardModal('${card.uid}', ${player.index})">
              Use / Details
            </button>
          </div>
        </div>`;
      })
      .join("");
  }

  function onHandCardClicked(cardUid, ownerIdx) {
    playSfx("click");
    if (selectedCardUid === cardUid) {
      openPlayCardModal(cardUid, ownerIdx);
    } else {
      selectedCardUid = cardUid;
      renderTuckedHandAndDice();
    }
  }

  function selectHandCard(cardUid) {
    selectedCardUid = cardUid;
    renderTuckedHandAndDice();
  }

  function renderActionLog() {
    const feed = document.getElementById("action-log-feed");
    if (!feed) return;
    feed.innerHTML = state.logs
      .map(
        (l) => `
      <div class="log-entry">
        <span style="color:var(--text-muted);font-size:0.65rem;">${l.prefix}</span>
        ${l.text}
      </div>`
      )
      .join("");
  }

  function openDrawPileModal() {
    if (!state) return;
    playSfx("click");
    const viewPlayerIdx = mp.mySeat !== -1 ? mp.mySeat : state.activePlayerIndex;
    const player = state.players[viewPlayerIdx] || getActivePlayer();
    if (!player) return;

    const deck = player.deck || [];
    const rarityOrder = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Unique: 5, Ultimate: 6 };
    const grouped = new Map();
    deck.forEach((c) => {
      const key = c.id || c.name;
      if (!grouped.has(key)) {
        grouped.set(key, { card: c, count: 0 });
      }
      grouped.get(key).count++;
    });

    const sortedEntries = Array.from(grouped.values()).sort((a, b) => {
      const ra = rarityOrder[a.card.rarity] || 9;
      const rb = rarityOrder[b.card.rarity] || 9;
      if (ra !== rb) return ra - rb;
      return String(a.card.name).localeCompare(String(b.card.name));
    });

    const bodyHtml =
      sortedEntries.length === 0
        ? `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:0.86rem;">
             Draw Pile kosong — semua kartu sudah berada di tangan atau discard pile hingga reshuffle Cycle berikutnya.
           </div>`
        : `<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:10px;">
             Sisa <strong>${deck.length} kartu</strong> di Draw Pile milik <strong>${escapeHtml(player.name)}</strong> (diurutkan berdasarkan rarity, bukan urutan tarik acak):
           </div>
           <div class="draw-pile-grid">
             ${sortedEntries
               .map(({ card, count }) => {
                 const imgUrl = getCardImage(card, player.charId);
                 return `
                 <div class="draw-pile-card-item" title="${escapeHtml(card.description || card.name)}">
                   ${count > 1 ? `<span class="draw-pile-qty-badge">x${count}</span>` : ""}
                   <img src="${imgUrl}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async" />
                   <div class="draw-pile-card-name">${escapeHtml(card.name)}</div>
                   <div class="draw-pile-card-rarity">${escapeHtml(card.rarity || "Skill")}</div>
                 </div>`;
               })
               .join("")}
           </div>`;

    openInfoModal(`Draw Pile — ${escapeHtml(player.name)} (${deck.length} Kartu)`, bodyHtml);
  }

  function renderPromptBar() {
    const bar = document.getElementById("action-prompt-bar");
    if (!bar) return;

    if ((!pendingInteraction || pendingInteraction.type === "choose_branch") && state && state.activeTileModal && state.activeTileModal.status === "selecting") {
      const tm = state.activeTileModal;
      const actor = state.players[tm.actorIndex] || getActivePlayer();
      const isActor = canLocalPlayerAct();
      bar.classList.add("visible");
      if (tm.type === "versus") {
        bar.innerHTML = `
          <div><strong>Versus Duel Aktif (${escapeHtml(actor.name)})</strong> — ${isActor ? "Pilih lawan &amp; jumlah taruhan TC" : "Sedang memilih lawan duel..."}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-gold btn-sm" onclick="window.EFT_APP.reopenSharedTileModal()">Buka Pop-Up Versus</button>
          </div>`;
      } else {
        bar.innerHTML = `
          <div><strong>Trading Post Aktif (${escapeHtml(actor.name)})</strong> — ${isActor ? "Pilih partner &amp; jenis barter kartu" : "Sedang memilih transaksi barter..."}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-emerald btn-sm" onclick="window.EFT_APP.reopenSharedTileModal()">Buka Pop-Up Trade</button>
            ${isActor ? `<button class="btn btn-sm" onclick="window.EFT_APP.dismissSharedTileModal()">Lewati Trade</button>` : ""}
          </div>`;
      }
      return;
    }

    if (!pendingInteraction || pendingInteraction.type === "choose_branch") {
      bar.classList.remove("visible");
      bar.innerHTML = "";
      return;
    }
    bar.classList.add("visible");

    if (!canLocalPlayerAct()) {
      const actorName =
        pendingInteraction.player && pendingInteraction.player.name
          ? pendingInteraction.player.name
          : getActivePlayer().name;
      bar.innerHTML = `<div>Menunggu <strong>${escapeHtml(actorName)}</strong> menentukan pilihan...</div>`;
      return;
    }

    if (pendingInteraction.type === "prompt_shard_buy") {
      const sh = pendingInteraction.shard;
      bar.innerHTML = `
        <div><strong>Passing Tartarus Shard (Zone ${sh.roman})</strong> — Buy for <strong>💰 ${state.rules.shardCost} TC</strong>?</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-emerald btn-sm" onclick="window.EFT_APP.confirmShardPurchase(true)">Buy Shard (${state.rules.shardCost} TC)</button>
          <button class="btn btn-sm" onclick="window.EFT_APP.confirmShardPurchase(false)">Skip</button>
        </div>`;
    } else if (pendingInteraction.type === "prompt_river") {
      bar.innerHTML = `
        <div><strong>River Shortcut</strong> — Pay <strong>💰 ${state.rules.riverCost} TC</strong> to cross to [${pendingInteraction.targetTileId}]?</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="window.EFT_APP.confirmRiverShortcut(true)">Take River (${state.rules.riverCost} TC)</button>
          <button class="btn btn-sm" onclick="window.EFT_APP.confirmRiverShortcut(false)">Continue Normal Path</button>
        </div>`;
    } else if (pendingInteraction.type === "prompt_merchant_pass") {
      bar.innerHTML = `
        <div><strong>Passing Merchant Shop ${pendingInteraction.shopId}</strong> — Open shop before continuing?</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-gold btn-sm" onclick="window.EFT_APP.openMerchantModal(${pendingInteraction.shopId})">Open Shop ${pendingInteraction.shopId}</button>
          <button class="btn btn-sm" onclick="window.EFT_APP.resumeFromMerchantPrompt()">Continue (${pendingInteraction.stepsLeft} steps)</button>
        </div>`;
    } else if (pendingInteraction.type === "select_tile_target") {
      const mover =
        pendingInteraction.movingPlayerIndex !== undefined && state.players[pendingInteraction.movingPlayerIndex]
          ? state.players[pendingInteraction.movingPlayerIndex]
          : getActivePlayer();
      const changeBtn = pendingInteraction.canChangeTarget
        ? `<button class="btn btn-sm" onclick="window.EFT_APP.reopenPendingCardModal()">Ganti Target</button>`
        : "";
      const isBocchiPull =
        pendingInteraction.card &&
        pendingInteraction.card.effectKey === "pull_all_players" &&
        pendingInteraction.validTileIds.includes(pendingInteraction.player.tileId);
      const selfPullBtn = isBocchiPull
        ? `<button class="btn btn-emerald btn-sm" onclick="window.EFT_APP.onTileClicked('${pendingInteraction.player.tileId}')">Tarik ke Tile Bocchi</button>`
        : "";
      bar.innerHTML = `
        <div><strong>Pilih Tile Tujuan di Peta</strong> (${escapeHtml(mover.name)} · <strong>${escapeHtml(pendingInteraction.card.name)}</strong>)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
          ${selfPullBtn}
          ${changeBtn}
          <button class="btn btn-danger btn-sm" onclick="window.EFT_APP.cancelPendingInteraction()">Cancel</button>
        </div>`;
    } else if (pendingInteraction.type === "stage_is_mine") {
      const btns = pendingInteraction.validTileIds
        .map((tid) => {
          const stepLbl = pendingInteraction.tileStepLabels[tid] || "";
          const tName = TILE_MAP[tid] ? TILE_MAP[tid].name : tid;
          return `<button class="btn btn-emerald btn-sm" onclick="window.EFT_APP.resolveStageIsMineChoice('${tid}')">${escapeHtml(stepLbl)} (${escapeHtml(tName)})</button>`;
        })
        .join("");
      bar.innerHTML = `
        <div><strong>The Stage Is Mine (Passive)</strong> — Pindah +1 / +2 / -1 dari Normal Tile?</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
          ${btns}
          <button class="btn btn-sm" onclick="window.EFT_APP.resolveStageIsMineChoice(null)">Tetap di Sini</button>
        </div>`;
    }
  }

  function showEffectSpotlight(category, title, desc, imgSrc) {
    const toast = document.getElementById("board-card-toast");
    if (!toast) return;
    toast.innerHTML = `
      ${imgSrc ? `<img src="${imgSrc}" alt="${title}" loading="lazy" decoding="async" style="width:60px;height:84px;object-fit:cover;border-radius:7px;border:1px solid rgba(255,255,255,0.25);" />` : ""}
      <div>
        <div style="font-size:0.65rem;font-weight:800;color:var(--mint-light);text-transform:uppercase;">${category}</div>
        <div style="font-size:0.9rem;font-weight:800;color:#fff;margin:2px 0;">${title}</div>
        <div style="font-size:0.74rem;color:#cbd5e1;line-height:1.3;">${desc}</div>
      </div>
      <button class="btn btn-sm" onclick="document.getElementById('board-card-toast').style.display='none'">Close</button>`;
    toast.style.display = "flex";
    clearTimeout(window._spotlightTimer);
    window._spotlightTimer = setTimeout(() => {
      toast.style.display = "none";
    }, 4200);
  }

  // ============================================================================
  // COMPENDIUM & RULES VIEWS
  // ============================================================================
  function changeCompendiumVersion(compVersionId) {
    if (!DATA.COMPENDIUM_VERSIONS[compVersionId]) return;
    initGame(state.patchId, compVersionId);
    renderCompendiumView(activeCompendiumFilter);
  }

  function changeRulesPatch(patchId) {
    if (!DATA.RULE_PATCHES[patchId]) return;
    initGame(patchId, state.compendiumId);
    renderRulesView();
  }

  function selectCompendiumCharacter(charId) {
    if (charId && DATA.CHARACTERS[charId] && DATA.CHARACTERS[charId].unavailable) return;
    playSfx("click");
    selectedCompendiumCharId = charId;
    selectedCompendiumCardId = null;
    renderCompendiumView();
  }

  function buildCompendiumCardDetailHtml(selectedCard, ch) {
    if (!selectedCard || !ch) return "";
    return `
      <div class="comp-exp-card-detail">
        <img class="comp-exp-detail-thumb" src="${getCardImage(selectedCard, ch.id)}" alt="${escapeHtml(selectedCard.name)}" />
        <div class="comp-exp-detail-body">
          <div class="comp-exp-detail-top">
            <span class="comp-exp-detail-name">${escapeHtml(selectedCard.name)}</span>
            <span class="comp-exp-detail-rarity">${escapeHtml(selectedCard.rarity)}</span>
          </div>
          <div class="comp-exp-detail-meta">
            ${
              selectedCard.count
                ? `Jumlah di Deck: ${selectedCard.count}x`
                : `Ultimate Shop: 💰 ${selectedCard.cost || ch.ultCost || 70} TC · [Retain]`
            }
          </div>
          <div class="comp-exp-detail-desc">${escapeHtml(selectedCard.description)}</div>
        </div>
      </div>`;
  }

  function selectCompendiumSkillCard(cardId) {
    playSfx("click");
    selectedCompendiumCardId = cardId;
    const detailSlot = document.getElementById("comp-exp-card-detail-slot");
    if (!detailSlot || !selectedCompendiumCharId) {
      renderCompendiumView();
      return;
    }
    const compId = state ? state.compendiumId : "comp_beta1";
    const ch = getCharacterForCompendium(selectedCompendiumCharId, compId);
    const allCards = [...ch.cards, ...(ch.ultimate ? [ch.ultimate] : [])];
    const selectedCard = allCards.find((c) => c.id === cardId) || allCards[0];
    if (!selectedCard) return;

    document.querySelectorAll(".comp-exp-card-tile[data-card-id]").forEach((el) => {
      el.classList.toggle("selected", el.dataset.cardId === selectedCard.id);
    });
    detailSlot.innerHTML = buildCompendiumCardDetailHtml(selectedCard, ch);
  }

  function updateCompendiumScrollControls() {
    const track = document.getElementById("comp-strip-track");
    const prevBtn = document.getElementById("comp-arrow-prev");
    const nextBtn = document.getElementById("comp-arrow-next");
    const fadeL = document.getElementById("comp-fade-left");
    const fadeR = document.getElementById("comp-fade-right");
    if (!track) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const atStart = track.scrollLeft <= 6;
    const atEnd = maxScroll <= 6 || track.scrollLeft >= maxScroll - 6;

    if (prevBtn) prevBtn.classList.toggle("is-hidden", atStart);
    if (fadeL) fadeL.classList.toggle("is-hidden", atStart);
    if (nextBtn) nextBtn.classList.toggle("is-hidden", atEnd);
    if (fadeR) fadeR.classList.toggle("is-hidden", atEnd);
  }

  function scrollCompendiumStrip(dir = 1) {
    const track = document.getElementById("comp-strip-track");
    if (!track) return;
    const step = Math.max(260, Math.round(track.clientWidth * 0.56));
    track.scrollBy({ left: dir * step, behavior: "smooth" });
    setTimeout(updateCompendiumScrollControls, 340);
  }

  function renderCompendiumView() {
    const root = document.getElementById("compendium-showcase-root");
    if (!root) return;
    const compId = state ? state.compendiumId : "comp_beta1";
    const compDef = DATA.COMPENDIUM_VERSIONS[compId] || DATA.COMPENDIUM_VERSIONS.comp_beta1;
    const activeIds = getPlayableCharacterIds(compId);
    const unavailableIds = (compDef.unavailableCharacters || []).filter((id) => DATA.CHARACTERS[id]);

    if (selectedCompendiumCharId && !activeIds.includes(selectedCompendiumCharId)) {
      selectedCompendiumCharId = null;
      selectedCompendiumCardId = null;
    }

    if (!selectedCompendiumCharId) {
      const stripCardsHtml = [
        ...activeIds.map((cid) => {
          const ch = getCharacterForCompendium(cid, compId);
          const cp = ch.compPortrait || (ch.portrait ? { src: ch.portrait.src, objectPosition: "50% 10%" } : null);
          const rgb = ch.colorRgb || "72, 158, 130";
          const label = ch.shortName || ch.name;
          return `
            <div class="comp-char-card"
                 style="--char-accent:${escapeHtml(ch.color || "#34d399")};--char-rgb:${escapeHtml(rgb)};"
                 onclick="window.EFT_APP.selectCompendiumCharacter('${cid}')">
              ${
                cp && cp.src
                  ? `<img class="comp-char-portrait" src="${cp.src}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" style="object-position:${escapeHtml(cp.objectPosition || "50% 10%")};" />`
                  : ""
              }
              <div class="comp-char-bottom-scrim"></div>
              <div class="comp-char-card-footer">
                <span class="comp-char-role-hint">${escapeHtml(ch.title)}</span>
                <div class="comp-char-name-pill">${escapeHtml(label)}</div>
              </div>
            </div>`;
        }),
        ...unavailableIds.map((cid) => {
          const ch = DATA.CHARACTERS[cid];
          const label = ch.shortName || ch.name;
          return `
            <div class="comp-char-card is-unavailable" title="${escapeHtml(ch.name)} — Saat ini belum tersedia">
              <div class="comp-unavailable-center">
                <div class="comp-unavailable-crest">${getCharacterSvgIcon(cid)}</div>
                <span class="comp-unavailable-tag">Unavailable</span>
              </div>
              <div class="comp-char-bottom-scrim"></div>
              <div class="comp-char-card-footer">
                <div class="comp-char-name-pill">${escapeHtml(label)}</div>
              </div>
            </div>`;
        })
      ].join("");

      root.innerHTML = `
        <div class="comp-strip-shell">
          <div id="comp-fade-left" class="comp-edge-fade-left is-hidden"></div>
          <button id="comp-arrow-prev" class="comp-nav-arrow prev is-hidden" onclick="window.EFT_APP.scrollCompendiumStrip(-1)" aria-label="Karakter Sebelumnya">&lt;</button>
          <div id="comp-strip-track" class="comp-strip-track" onscroll="window.EFT_APP.updateCompendiumScrollControls()">
            ${stripCardsHtml}
          </div>
          <div id="comp-fade-right" class="comp-edge-fade-right"></div>
          <button id="comp-arrow-next" class="comp-nav-arrow next" onclick="window.EFT_APP.scrollCompendiumStrip(1)" aria-label="Karakter Berikutnya">&gt;</button>
        </div>`;

      requestAnimationFrame(() => updateCompendiumScrollControls());
      return;
    }

    // EXPANDED CHARACTER VIEW
    const ch = getCharacterForCompendium(selectedCompendiumCharId, compId);
    const allCards = [...ch.cards, ...(ch.ultimate ? [ch.ultimate] : [])];
    const selectedCard = allCards.find((c) => c.id === selectedCompendiumCardId) || allCards[0];
    selectedCompendiumCardId = selectedCard ? selectedCard.id : null;

    const curIdx = activeIds.indexOf(selectedCompendiumCharId);
    const prevCid = activeIds[(curIdx - 1 + activeIds.length) % activeIds.length];
    const nextCid = activeIds[(curIdx + 1) % activeIds.length];
    const cp = ch.compPortrait || (ch.portrait ? { src: ch.portrait.src, objectPosition: "50% 10%" } : null);
    const rgb = ch.colorRgb || "72, 158, 130";

    const cardsGalleryHtml = allCards
      .map((c) => {
        const isSel = selectedCard && c.id === selectedCard.id;
        const isUlt = c.rarity === "Ultimate";
        return `
          <div class="comp-exp-card-tile ${isSel ? "selected" : ""} ${isUlt ? "is-ult" : ""}"
               data-card-id="${escapeHtml(c.id)}"
               onclick="window.EFT_APP.selectCompendiumSkillCard('${c.id}')"
               title="${escapeHtml(c.name)}">
            <img src="${getCardImage(c, ch.id)}" alt="${escapeHtml(c.name)}" loading="lazy" decoding="async" />
          </div>`;
      })
      .join("");

    const selectedDetailHtml = `<div id="comp-exp-card-detail-slot">${buildCompendiumCardDetailHtml(selectedCard, ch)}</div>`;

    root.innerHTML = `
      <div class="comp-expanded-panel" style="--char-accent:${escapeHtml(ch.color || "#34d399")};--char-rgb:${escapeHtml(rgb)};">
        <div class="comp-exp-portrait-col">
          <button class="comp-exp-back-btn" onclick="window.EFT_APP.selectCompendiumCharacter(null)">&lt; Kembali</button>
          ${
            cp && cp.src
              ? `<img class="comp-exp-portrait-img" src="${cp.src}" alt="${escapeHtml(ch.name)}" style="object-position:${escapeHtml(cp.objectPosition || "48% 12%")};" />`
              : ""
          }
          <div class="comp-char-bottom-scrim"></div>
          <div class="comp-char-name-pill comp-exp-name-float">${escapeHtml(ch.shortName || ch.name)}</div>
        </div>

        <div class="comp-exp-content-col">
          <div class="comp-exp-header-row">
            <div class="comp-exp-char-meta">
              <div class="comp-exp-title-line">
                <span class="comp-exp-char-title">${escapeHtml(ch.name)}</span>
                <span class="comp-exp-role-pill">${escapeHtml(ch.title)}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn btn-sm" onclick="window.EFT_APP.selectCompendiumCharacter('${prevCid}')">&lt; Prev</button>
              <button class="btn btn-sm" onclick="window.EFT_APP.selectCompendiumCharacter('${nextCid}')">Next &gt;</button>
            </div>
          </div>

          <div class="comp-exp-specialty-box">
            <div class="comp-exp-spec-label">Spesialis Karakter</div>
            <div class="comp-exp-spec-val">${escapeHtml(ch.specialty)}</div>
          </div>

          <p class="comp-exp-lore">${escapeHtml(ch.lore)}</p>

          <div>
            <div class="comp-exp-cards-label" style="margin-bottom:8px;">Skill Cards &amp; Ultimate (Klik kartu untuk detail)</div>
            <div class="comp-exp-cards-row">
              ${cardsGalleryHtml}
            </div>
          </div>

          ${selectedDetailHtml}
        </div>
      </div>`;
  }

  function renderRulesView() {
    const patch = DATA.RULE_PATCHES[state.patchId] || DATA.RULE_PATCHES.alpha2;
    const detailsEl = document.getElementById("rules-patch-details");
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div style="margin-bottom:14px;">
          <h3 style="color:#fff;font-size:1.05rem;">${patch.name}</h3>
          <p style="font-size:0.82rem;color:var(--mint-light);margin-top:2px;">${patch.subtitle}</p>
        </div>
        <div class="grid-2col" style="margin-bottom:16px;">
          <div style="background:rgba(0,0,0,0.3);padding:12px;border-radius:10px;font-size:0.8rem;line-height:1.7;">
            <div><strong>Victory Condition:</strong> 💎 ${patch.victoryShards} Tartarus Shards (💰 ${patch.shardCost} TC each)</div>
            <div><strong>Movement System:</strong> ${patch.diceCount}x d${patch.diceSides} per Phase (2 Phases per Turn)</div>
            <div><strong>Active Shards on Board:</strong> ${patch.activeShardsOnBoard} Shards (Spawns every ${patch.shardSpawnInterval} ${patch.shardSpawnUnit}s)</div>
            <div><strong>Fractional Rounding:</strong> ${patch.roundingMode === "ceil" ? "Always Round Up (Ceiling Law)" : "Standard Nearest Rounding"}</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:12px;border-radius:10px;font-size:0.8rem;line-height:1.7;">
            <div><strong>Cycle Deck &amp; Passive Reset:</strong> Every ${patch.turnsPerCycle} Rounds (Deal ${patch.startHandSize} cards, Hand Limit ${patch.maxHandSize}, Unique/Passive effects expire on Cycle change)</div>
            <div><strong>Skill Deployment Limit:</strong> Max ${patch.maxSkillsPerTurn} Skill Cards per Turn ${patch.allowHaste ? "(+ [Haste] Reactive Cards)" : ""}</div>
            <div><strong>Merchant Shops:</strong> ${patch.independentShops ? "Independent Shop 1 & Shop 2 stocks" : "Shared Global Shop stock"}</div>
            <div><strong>Minigame Payouts:</strong> 1st: 💰 +30 TC · 2nd: +15 TC · 3rd: +15 TC · 4th: +10 TC</div>
          </div>
        </div>
        <div style="background:rgba(72,158,130,0.1);border:1px solid var(--border-soft);padding:12px 16px;border-radius:10px;">
          <div style="font-weight:800;font-size:0.82rem;color:var(--mint-light);margin-bottom:6px;">Key Patch Rules Summary:</div>
          <ul style="padding-left:18px;font-size:0.8rem;color:#e2e8f0;line-height:1.6;">
            ${patch.summary.map((line) => `<li>${line}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    const boardGrid = document.getElementById("rules-board-cards-grid");
    if (boardGrid) {
      const boardAll = [
        ...DATA.BOARD_CARDS.positive,
        ...DATA.BOARD_CARDS.negative,
        ...DATA.BOARD_CARDS.globalEvents
      ];
      boardGrid.innerHTML = boardAll
        .map(
          (bc) => `
        <div class="compendium-card">
          <img class="compendium-card-img" src="${bc.image}" alt="${bc.name}" loading="lazy" decoding="async" />
          <div class="compendium-card-body">
            <span class="tag-badge">${bc.category}</span>
            <div style="font-weight:800;font-size:0.9rem;color:#fff;">${bc.name}</div>
            <div style="font-size:0.76rem;color:#cbd5e1;">${bc.description}</div>
          </div>
        </div>`
        )
        .join("");
    }
  }

  // ============================================================================
  // MULTIPLAYER ENGINE & LOBBY (FIREBASE + PEERJS + WIFI LAN / MULTI-TAB)
  // ============================================================================
  function openMultiplayerModal() {
    openWelcomeSetupModal("multiplayer");
  }

  function refreshLobbyModalIfOpen() {
    const modal = document.getElementById("app-modal");
    const titleEl = document.getElementById("modal-title");
    if (modal && modal.classList.contains("open") && titleEl && titleEl.dataset.modalKind === "welcome_lobby") {
      openWelcomeSetupModal(setupDraft.tab);
    }
  }

  function broadcastLobbyState() {
    if (mp.mode === "local") return;
    if (mp.mode === "firebase_host" && mp.fbRoomRef) {
      mp.fbRoomRef
        .update({
          lobbyJson: JSON.stringify(mp.lobby),
          updatedAt: Date.now()
        })
        .catch(() => {});
      return;
    }
    const payload = {
      type: "lobby_sync",
      roomCode: mp.roomCode,
      senderId: mp.clientId,
      lobby: mp.lobby,
      timestamp: Date.now()
    };
    if (mp.mode === "p2p_host") {
      mp.connections.forEach((c) => {
        if (c.open) c.send(payload);
      });
    }
    if (mp.bc) mp.bc.postMessage(payload);
    if (mp.mode === "lan_host") {
      fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mp.roomCode, type: "sync_state", state: payload })
      }).catch(() => {});
    }
  }

  function processLobbyJoinAction(d) {
    if (!d || !d.clientId) return;
    const allowed = getPlayableCharacterIds(mp.lobby.compendiumId);
    const takenByOthers = new Set(
      mp.lobby.members.filter((m) => m.clientId !== d.clientId).map((m) => m.charId)
    );
    let chosenChar = allowed.includes(d.charId) ? d.charId : allowed[0];
    if (takenByOthers.has(chosenChar)) {
      chosenChar = allowed.find((cid) => !takenByOthers.has(cid)) || chosenChar;
    }

    const existing = mp.lobby.members.find((m) => m.clientId === d.clientId);
    const cleanName = String(d.username || "Player").trim().slice(0, 18) || "Player";
    if (existing) {
      existing.username = cleanName;
      existing.charId = chosenChar;
      existing.ready = d.ready !== undefined ? !!d.ready : existing.ready;
    } else if (mp.lobby.members.length < 4) {
      mp.lobby.members.push({
        clientId: d.clientId,
        username: cleanName,
        charId: chosenChar,
        isHost: d.clientId === mp.lobby.hostClientId,
        ready: !!d.ready
      });
    }
    broadcastLobbyState();
    refreshLobbyModalIfOpen();
  }

  function saveQuickFirebaseConfig() {
    const raw = (document.getElementById("fb-quick-config-input")?.value || "").trim();
    if (!raw) {
      alert("Tempelkan objek firebaseConfig dari Firebase Console terlebih dahulu.");
      return;
    }
    try {
      window.EFT_SET_RUNTIME_FIREBASE_CONFIG(raw);
      alert("Konfigurasi Firebase berhasil disimpan di browser!");
      openWelcomeSetupModal("multiplayer");
    } catch (e) {
      alert("Format konfigurasi Firebase tidak valid: " + e.message);
    }
  }

  function clearQuickFirebaseConfig() {
    if (typeof window.EFT_CLEAR_RUNTIME_FIREBASE_CONFIG === "function") {
      window.EFT_CLEAR_RUNTIME_FIREBASE_CONFIG();
    }
    openWelcomeSetupModal("multiplayer");
  }

  function detachFirebaseListeners() {
    if (mp.fbRoomRef && mp.fbStateListener) {
      mp.fbRoomRef.off("value", mp.fbStateListener);
    }
    if (mp.fbActionsRef && mp.fbActionListener) {
      mp.fbActionsRef.off("child_added", mp.fbActionListener);
    }
    if (mp.fbSeatsRef && mp.fbSeatsListener) {
      mp.fbSeatsRef.off("value", mp.fbSeatsListener);
    }
    if (mp.fbSeatsRef && mp.mySeat !== undefined) {
      mp.fbSeatsRef.child(String(mp.mySeat)).remove().catch(() => {});
    }
    mp.fbRoomRef = null;
    mp.fbActionsRef = null;
    mp.fbSeatsRef = null;
    mp.fbStateListener = null;
    mp.fbActionListener = null;
    mp.fbSeatsListener = null;
    mp.onlineSeats = {};
  }

  function initHostLobbyPayload(code) {
    mp.lobby = {
      status: "waiting",
      hostClientId: mp.clientId,
      patchId: setupDraft.patchId || (state ? state.patchId : "alpha2"),
      compendiumId: setupDraft.compendiumId || (state ? state.compendiumId : "comp_beta1"),
      fillWithBots: true,
      members: [
        {
          clientId: mp.clientId,
          username: (setupDraft.username || "").trim() || "Host",
          charId: setupDraft.charId || "bocchi",
          isHost: true,
          ready: true
        }
      ]
    };
    mp.roomCode = code;
    mp.mySeat = -1;
  }

  function createLobbyRoom(transport = "lan") {
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      alert("Masukkan Username kamu terlebih dahulu sebelum membuat Room.");
      return;
    }
    savePlayerProfile(uname, setupDraft.charId);
    if (transport === "firebase") startFirebaseHostRoom();
    else if (transport === "p2p") startOnlineHostRoom();
    else startLanOrTabRoom("HOST");
  }

  function joinLobbyRoom(transport = "lan") {
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      alert("Masukkan Username kamu terlebih dahulu sebelum bergabung.");
      return;
    }
    const codeInput = document.getElementById("setup-join-code");
    const code = ((codeInput && codeInput.value) || mp.roomCode || "").trim().toUpperCase();
    if (!code) {
      alert("Masukkan Kode Room terlebih dahulu.");
      return;
    }
    mp.roomCode = code;
    savePlayerProfile(uname, setupDraft.charId);
    if (transport === "firebase") joinFirebaseClientRoom(code);
    else if (transport === "p2p") joinOnlineClientRoom(code);
    else startLanOrTabRoom("JOIN", code);
  }

  function toggleLobbyReady() {
    const me = mp.lobby.members.find((m) => m.clientId === mp.clientId);
    const nextReady = me ? !me.ready : true;
    if (isMultiplayerHost()) {
      if (me) me.ready = nextReady;
      broadcastLobbyState();
      refreshLobbyModalIfOpen();
    } else if (isRemoteClient()) {
      sendClientActionToHost("lobby_join", {
        clientId: mp.clientId,
        username: setupDraft.username || "Player",
        charId: setupDraft.charId,
        ready: nextReady
      });
    }
  }

  function toggleLobbyFillBots(checked) {
    if (!isMultiplayerHost()) return;
    mp.lobby.fillWithBots = !!checked;
    broadcastLobbyState();
  }

  function startMultiplayerMatchFromLobby() {
    if (!isMultiplayerHost()) return;
    const allowed = getPlayableCharacterIds(mp.lobby.compendiumId);
    const roster = mp.lobby.members.map((m) => ({
      charId: allowed.includes(m.charId) ? m.charId : allowed[0],
      username: m.username,
      clientId: m.clientId,
      isBot: false
    }));

    if (mp.lobby.fillWithBots && roster.length < 4) {
      const usedChars = new Set(roster.map((r) => r.charId));
      const freeChars = allowed.filter((c) => !usedChars.has(c));
      let botNum = 1;
      while (roster.length < 4) {
        const cid = freeChars.shift() || allowed[(roster.length + botNum) % allowed.length];
        const ch = getCharacterForCompendium(cid, mp.lobby.compendiumId);
        roster.push({
          charId: cid,
          username: `${ch ? ch.name : "Bot"} (Bot)`,
          clientId: `bot_${botNum++}`,
          isBot: true
        });
      }
    }

    if (roster.length < 2) {
      alert("Minimal 2 pemain (atau aktifkan opsi Bot) untuk memulai game.");
      return;
    }

    mp.lobby.status = "playing";
    hideMainTitleScreen();
    initGame(mp.lobby.patchId, mp.lobby.compendiumId, roster, { randomizeOrder: true });
    if (state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
      mp.mySeat = state.seatMap[mp.clientId];
    } else {
      mp.mySeat = 0;
    }
    broadcastLobbyState();
    broadcastMultiplayerState();
    closeModal();
    renderAll();
  }

  function startFirebaseHostRoom() {
    if (!window.EFT_IS_FIREBASE_READY()) {
      alert(
        "Firebase belum dikonfigurasi.\n\nIsi firebaseConfig di playtest/firebaseConfig.js atau pakai tombol 'WiFi LAN / Multi-Tab' untuk localhost."
      );
      return;
    }
    const code = "EFT" + Math.floor(100 + Math.random() * 900);

    try {
      detachFirebaseListeners();
      const db = ensureFirebaseDb();
      const roomRef = db.ref("rooms/" + code);
      const actionsRef = roomRef.child("actions");
      const seatsRef = roomRef.child("seats");

      mp.mode = "firebase_host";
      initHostLobbyPayload(code);
      mp.fbRoomRef = roomRef;
      mp.fbActionsRef = actionsRef;
      mp.fbSeatsRef = seatsRef;

      roomRef
        .set({
          meta: {
            createdAt: Date.now(),
            hostId: mp.clientId,
            patchId: mp.lobby.patchId,
            compendiumId: mp.lobby.compendiumId
          },
          lobbyJson: JSON.stringify(mp.lobby),
          stateJson: JSON.stringify(state),
          pendingJson: JSON.stringify(serializePendingInteraction()),
          updatedAt: Date.now()
        })
        .then(() => {
          const mySeatRef = seatsRef.child(mp.clientId);
          mySeatRef.set({ clientId: mp.clientId, status: "Host Online", joinedAt: Date.now() });
          mySeatRef.onDisconnect().remove();

          mp.fbSeatsListener = seatsRef.on("value", (snap) => {
            mp.onlineSeats = snap.val() || {};
            refreshLobbyModalIfOpen();
          });

          mp.fbActionListener = actionsRef.on("child_added", (snap) => {
            const act = snap.val();
            snap.ref.remove().catch(() => {});
            if (!act || !act.action) return;
            processRemoteClientAction(act);
          });

          addLog(`Firebase Lobby created. Room Code: [${code}].`);
          openWelcomeSetupModal("multiplayer");
        })
        .catch((err) => {
          mp.mode = "local";
          mp.roomCode = "";
          mp.lobby.status = "idle";
          alert("Gagal menulis ke Firebase Database: " + err.message);
        });
    } catch (e) {
      alert("Gagal memulai Firebase Host: " + e.message);
    }
  }

  function joinFirebaseClientRoom(forcedCode = null) {
    if (!window.EFT_IS_FIREBASE_READY()) {
      alert("Firebase belum dikonfigurasi. Untuk localhost, gunakan tombol 'WiFi LAN / Multi-Tab'.");
      return;
    }
    const codeEl = document.getElementById("setup-join-code");
    const code = (forcedCode || (codeEl && codeEl.value) || "").trim().toUpperCase();
    if (!code) {
      alert("Masukkan Kode Room dari Host terlebih dahulu.");
      return;
    }

    try {
      detachFirebaseListeners();
      const db = ensureFirebaseDb();
      const roomRef = db.ref("rooms/" + code);

      roomRef
        .once("value")
        .then((snap) => {
          const data = snap.val();
          if (!data || (!data.stateJson && !data.lobbyJson)) {
            alert(`Room [${code}] tidak ditemukan.`);
            return;
          }

          mp.mode = "firebase_client";
          mp.roomCode = code;
          mp.mySeat = -1;
          mp.fbRoomRef = roomRef;
          mp.fbActionsRef = roomRef.child("actions");
          mp.fbSeatsRef = roomRef.child("seats");

          const mySeatRef = mp.fbSeatsRef.child(mp.clientId);
          mySeatRef.set({ clientId: mp.clientId, status: "Player Online", joinedAt: Date.now() });
          mySeatRef.onDisconnect().remove();

          if (data.lobbyJson) {
            mp.lobby = JSON.parse(data.lobbyJson);
          }
          if (data.stateJson) {
            state = JSON.parse(data.stateJson);
            pendingInteraction = data.pendingJson ? deserializePendingInteraction(JSON.parse(data.pendingJson)) : null;
            if (state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
              mp.mySeat = state.seatMap[mp.clientId];
            }
          }

          mp.fbStateListener = roomRef.on("value", (updateSnap) => {
            const val = updateSnap.val();
            if (!val) return;
            const prevStatus = mp.lobby.status;
            if (val.lobbyJson) {
              mp.lobby = JSON.parse(val.lobbyJson);
            }
            if (val.stateJson) {
              state = JSON.parse(val.stateJson);
              pendingInteraction = val.pendingJson ? deserializePendingInteraction(JSON.parse(val.pendingJson)) : null;
              if (state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
                mp.mySeat = state.seatMap[mp.clientId];
              }
            }
            mp.onlineSeats = val.seats || {};

            if (mp.lobby.status === "playing") {
              hideMainTitleScreen();
              if (prevStatus !== "playing") {
                closeModal();
              }
              if (camera.mode === "follow" && state && state.players && state.players[state.activePlayerIndex]) {
                focusCameraOnTile(getActivePlayer().tileId);
              }
              renderAll();
            } else {
              refreshLobbyModalIfOpen();
            }
          });

          sendClientActionToHost("lobby_join", {
            clientId: mp.clientId,
            username: setupDraft.username || "Player",
            charId: setupDraft.charId,
            ready: false
          });

          if (mp.lobby.status === "playing") {
            hideMainTitleScreen();
            closeModal();
            if (camera.mode === "follow") focusCameraOnTile(getActivePlayer().tileId);
            renderAll();
          } else {
            openWelcomeSetupModal("multiplayer");
          }
        })
        .catch((err) => {
          alert("Gagal bergabung ke Firebase Room: " + err.message);
        });
    } catch (e) {
      alert("Error bergabung ke Firebase: " + e.message);
    }
  }

  function processRemoteClientAction(act) {
    if (!act) return;
    const aid = act.actionId || act.id;
    if (!aid) return;
    if (mp.processedActionIds.has(aid)) return;
    mp.processedActionIds.add(aid);

    const d = act.data || {};
    if (act.action === "lobby_join") {
      processLobbyJoinAction(d);
      return;
    }

    if (!state) return;
    let senderSeat = -1;
    if (act.senderId && state.seatMap && typeof state.seatMap[act.senderId] === "number") {
      senderSeat = state.seatMap[act.senderId];
    } else if (typeof act.seat === "number") {
      senderSeat = act.seat;
    } else if (typeof act.slot === "number") {
      senderSeat = act.slot;
    }

    const expectedSeat = getExpectedActingSeat();
    if (act.action === "minigame_finish") {
      if (senderSeat < 0) return;
    } else if (senderSeat !== expectedSeat) {
      return;
    }

    isProcessingRemoteAction = true;
    try {
      if (act.action === "roll_dice") rollMovementDice();
      else if (act.action === "end_turn") endCurrentTurn();
      else if (act.action === "play_card") playSkillCardFromHand(d.cardUid, d.options || {});
      else if (act.action === "choose_branch") chooseBranchTile(d.tileId);
      else if (act.action === "buy_shard") confirmShardPurchase(d.buy);
      else if (act.action === "use_river") confirmRiverShortcut(d.useRiver);
      else if (act.action === "resume_merchant") resumeFromMerchantPrompt();
      else if (act.action === "buy_shop") buyShopItem(d.shopId, d.itemType, true);
      else if (act.action === "resolve_versus") resolveVersusDuel(d.oppIdx, d.bet);
      else if (act.action === "execute_trade") executeTradeAction(d.partnerIdx, d.tradeType);
      else if (act.action === "close_tile_modal") dismissSharedTileModal();
      else if (act.action === "stage_is_mine_choice") resolveStageIsMineChoice(d.tileId);
      else if (act.action === "forced_all_in_choice") resolveForcedAllInChoice(d.choice);
      else if (act.action === "minigame_roll") rollDiceOfFateCurrent();
      else if (act.action === "minigame_finish") finishDiceOfFateMinigame();
    } finally {
      isProcessingRemoteAction = false;
    }
  }

  function startOnlineHostRoom() {
    if (typeof Peer === "undefined") {
      alert("PeerJS library belum termuat. Gunakan 'WiFi LAN / Multi-Tab' untuk localhost.");
      return;
    }
    const code = "EFT" + Math.floor(100 + Math.random() * 900);
    const peerId = "eft-tartarus-room-" + code;

    if (mp.peer) mp.peer.destroy();
    const peer = new Peer(peerId);

    peer.on("open", () => {
      mp.mode = "p2p_host";
      initHostLobbyPayload(code);
      mp.peer = peer;
      mp.connections = [];
      addLog(`PeerJS Lobby created. Room Code: [${code}].`);
      openWelcomeSetupModal("multiplayer");
    });

    peer.on("connection", (conn) => {
      mp.connections.push(conn);
      conn.on("open", () => {
        conn.send({
          type: "lobby_sync",
          roomCode: mp.roomCode,
          lobby: mp.lobby
        });
        if (mp.lobby.status === "playing") {
          conn.send({
            type: "full_sync",
            roomCode: mp.roomCode,
            lobby: mp.lobby,
            state,
            pending: serializePendingInteraction()
          });
        }
      });
      conn.on("data", (data) => handleIncomingMpMessage(data));
    });

    peer.on("error", (err) => {
      alert("Could not create online P2P room: " + err.message);
    });
  }

  function joinOnlineClientRoom(forcedCode = null) {
    if (typeof Peer === "undefined") {
      alert("PeerJS library belum termuat.");
      return;
    }
    const codeEl = document.getElementById("setup-join-code");
    const code = (forcedCode || (codeEl && codeEl.value) || "").trim().toUpperCase();
    if (!code) {
      alert("Masukkan Kode Room dari Host.");
      return;
    }

    if (mp.peer) mp.peer.destroy();
    const peer = new Peer();

    peer.on("open", () => {
      const conn = peer.connect("eft-tartarus-room-" + code);
      conn.on("open", () => {
        mp.mode = "p2p_client";
        mp.roomCode = code;
        mp.mySeat = -1;
        mp.peer = peer;
        mp.hostConn = conn;
        sendClientActionToHost("lobby_join", {
          clientId: mp.clientId,
          username: setupDraft.username || "Player",
          charId: setupDraft.charId,
          ready: false
        });
        openWelcomeSetupModal("multiplayer");
      });
      conn.on("data", (data) => handleIncomingMpMessage(data));
    });

    peer.on("error", (err) => {
      alert("Could not connect to Room [" + code + "]: " + err.message);
    });
  }

  function startLanOrTabRoom(role, forcedCode = null) {
    const codeEl = document.getElementById("setup-join-code");
    const code =
      role === "HOST"
        ? "LAN" + Math.floor(100 + Math.random() * 900)
        : (forcedCode || (codeEl && codeEl.value) || "LAN100").trim().toUpperCase();

    if (role === "HOST") {
      mp.mode = "lan_host";
      initHostLobbyPayload(code);
      broadcastLobbyState();
    } else {
      mp.mode = "lan_client";
      mp.roomCode = code;
      mp.mySeat = -1;
      mp.lastLanTimestamp = 0;
      sendClientActionToHost("lobby_join", {
        clientId: mp.clientId,
        username: setupDraft.username || "Player",
        charId: setupDraft.charId,
        ready: false
      });
    }

    clearInterval(mp.lanTimer);
    mp.lanTimer = setInterval(pollLanServer, 700);
    addLog(`Connected to WiFi LAN / Multi-Tab Lobby [${code}].`);
    openWelcomeSetupModal("multiplayer");
  }

  function disconnectMultiplayer() {
    detachFirebaseListeners();
    if (mp.peer) mp.peer.destroy();
    clearInterval(mp.lanTimer);
    mp.mode = "local";
    mp.roomCode = "";
    mp.mySeat = -1;
    mp.connections = [];
    mp.hostConn = null;
    mp.lobby = {
      status: "idle",
      hostClientId: "",
      patchId: state ? state.patchId : "alpha2",
      compendiumId: state ? state.compendiumId : "comp_beta1",
      fillWithBots: true,
      members: []
    };
    openWelcomeSetupModal("multiplayer");
    renderAll();
  }

  function broadcastMultiplayerState() {
    if (!state || mp.mode === "local") return;

    if (mp.mode === "firebase_host" && mp.fbRoomRef) {
      mp.fbRoomRef
        .update({
          lobbyJson: JSON.stringify(mp.lobby),
          stateJson: JSON.stringify(state),
          pendingJson: JSON.stringify(serializePendingInteraction()),
          updatedAt: Date.now()
        })
        .catch(() => {});
      return;
    }

    const payload = {
      type: "full_sync",
      roomCode: mp.roomCode,
      senderId: mp.clientId,
      lobby: mp.lobby,
      state,
      pending: serializePendingInteraction(),
      timestamp: Date.now()
    };

    if (mp.mode === "p2p_host") {
      mp.connections.forEach((c) => {
        if (c.open) c.send(payload);
      });
    }
    if (mp.bc) mp.bc.postMessage(payload);
    if (mp.mode === "lan_host") {
      fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mp.roomCode, type: "sync_state", state: payload })
      }).catch(() => {});
    }
  }

  function sendClientActionToHost(actionName, data) {
    const msg = {
      type: "client_action",
      roomCode: mp.roomCode,
      senderId: mp.clientId,
      actionId: "act_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      seat: mp.mySeat,
      action: actionName,
      data,
      ts: Date.now()
    };

    if (mp.mode === "firebase_client" && mp.fbActionsRef) {
      mp.fbActionsRef.push(msg).catch((err) => {
        alert("Gagal mengirim aksi ke Firebase: " + err.message);
      });
      return;
    }

    if (mp.mode === "p2p_client" && mp.hostConn && mp.hostConn.open) {
      mp.hostConn.send(msg);
      return;
    }

    if (mp.bc) mp.bc.postMessage(msg);
    if (mp.mode === "lan_client") {
      fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: mp.roomCode,
          type: "client_action",
          actionId: msg.actionId,
          slot: mp.mySeat,
          action: actionName,
          data
        })
      }).catch(() => {});
    }
  }

  function pollLanServer() {
    if ((mp.mode !== "lan_host" && mp.mode !== "lan_client") || !mp.roomCode) return;
    fetch(`/api/room?code=${encodeURIComponent(mp.roomCode)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.exists) return;
        if (mp.mode === "lan_host" && Array.isArray(res.actions)) {
          res.actions.forEach((act) => {
            if (act && act.type === "client_action") {
              processRemoteClientAction(act);
            }
          });
        }
        if (mp.mode === "lan_client" && res.state && res.updatedAt > mp.lastLanTimestamp) {
          mp.lastLanTimestamp = res.updatedAt;
          handleIncomingMpMessage(res.state);
        }
      })
      .catch(() => {});
  }

  function handleIncomingMpMessage(msg) {
    if (!msg) return;
    if (msg.senderId && msg.senderId === mp.clientId) return;

    if (msg.type === "lobby_sync" && msg.lobby && isRemoteClient()) {
      mp.lobby = msg.lobby;
      refreshLobbyModalIfOpen();
    } else if (msg.type === "full_sync" && msg.state && isRemoteClient()) {
      const prevStatus = mp.lobby.status;
      if (msg.lobby) mp.lobby = msg.lobby;
      state = msg.state;
      pendingInteraction = msg.pending ? deserializePendingInteraction(msg.pending) : null;
      if (state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
        mp.mySeat = state.seatMap[mp.clientId];
      }
      if (mp.lobby.status === "playing" && prevStatus !== "playing") {
        hideMainTitleScreen();
        closeModal();
      }
      if (camera.mode === "follow" && state.players && state.players[state.activePlayerIndex]) {
        focusCameraOnTile(getActivePlayer().tileId);
      }
      renderAll();
    } else if (msg.type === "client_action" && !isRemoteClient()) {
      processRemoteClientAction(msg);
    }
  }

  // ============================================================================
  // INTERACTIVE PROMPTS & MODALS
  // ============================================================================
  function confirmShardPurchase(buy) {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("buy_shard", { buy });
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "prompt_shard_buy") return;
    const { player, shard, stepsLeft, direction, activateFinalTile } = pendingInteraction;
    pendingInteraction = null;

    if (buy && player.tc >= state.rules.shardCost) {
      player.tc -= state.rules.shardCost;
      player.shards += 1;
      const purchasedShard = {
        ...shard,
        purchaseId: "shbuy_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)
      };
      state.lastPurchasedShard = purchasedShard;
      lastProcessedPurchasedShardId = purchasedShard.purchaseId;
      triggerShardFadeOut(purchasedShard);
      state.activeShards = state.activeShards.filter((s) => s.tileId !== shard.tileId);
      playSfx("shard");
      addLog(
        `${player.name} purchased Tartarus Shard at Zone ${shard.roman} (${shard.tileId}) (${
          player.shards + player.metaShard
        }/${state.rules.victoryShards}).`
      );
      if (checkVictory(player)) {
        renderAll();
        broadcastMultiplayerState();
        return;
      }
      if (state.activeShards.length === 0) spawnRandomShard(false);
    }
    startSteppingMovement(player, stepsLeft, direction, activateFinalTile);
  }

  function confirmRiverShortcut(useRiver) {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("use_river", { useRiver });
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "prompt_river") return;
    const { player, targetTileId, stepsLeft, direction, activateFinalTile } = pendingInteraction;
    pendingInteraction = null;

    if (useRiver && player.tc >= state.rules.riverCost) {
      player.tc -= state.rules.riverCost;
      player.tileId = targetTileId;
      player.lastTileId = (PREV_MAP[targetTileId] && PREV_MAP[targetTileId][0]) || null;
      addLog(`${player.name} took River Shortcut to [${targetTileId}] (-${state.rules.riverCost} TC).`);
      if (camera.mode === "follow") focusCameraOnTile(targetTileId);
      finishMovementPhase(player, activateFinalTile);
    } else {
      startSteppingMovement(player, stepsLeft, direction, activateFinalTile);
    }
  }

  function resumeFromMerchantPrompt() {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("resume_merchant", {});
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "prompt_merchant_pass") return;
    const { player, stepsLeft, direction, activateFinalTile } = pendingInteraction;
    pendingInteraction = null;
    startSteppingMovement(player, stepsLeft, direction, activateFinalTile);
  }

  function buyShopItem(shopId, itemType, closeAfter = false) {
    if (!canLocalPlayerAct() && !isAdminUnlocked) return;
    if (pendingInteraction && pendingInteraction.type === "prompt_merchant_pass" && pendingInteraction.shopId !== shopId && !isAdminUnlocked) {
      alert(`Kamu sedang berada di Shop ${pendingInteraction.shopId} dan tidak bisa mengakses Shop ${shopId}.`);
      return;
    }
    if (isRemoteClient()) {
      sendClientActionToHost("buy_shop", { shopId, itemType });
      closeModal();
      return;
    }
    const player = getActivePlayer();
    const effectiveShopId = state.rules.independentShops ? shopId : 1;
    const shop = state.shops[effectiveShopId];
    if (!shop) return;
    if (shop.ultStock === undefined) shop.ultStock = 1;
    if (!shop.playerBuys[player.id]) shop.playerBuys[player.id] = { ult: 0, draw: 0, actAgain: 0 };
    const pBuys = shop.playerBuys[player.id];
    if (pBuys.ult === undefined) pBuys.ult = 0;
    const charDef = getCharacterForCompendium(player.charId, state.compendiumId);
    const ultDef = player.isSamMode && charDef.samUltimate ? charDef.samUltimate : charDef.ultimate;
    const ultCost = (ultDef && ultDef.cost) || charDef.ultCost || state.rules.defaultUltCost;

    saveSnapshot();

    if (itemType === "ultimate") {
      if (ultDef && ultDef.effectKey === "grant_meta_shard" && (player.metaShardBought || player.metaShard >= 1)) {
        alert("Meta-Shard hanya dapat dibeli 1 kali per game.");
        return;
      }
      if (shop.ultStock <= 0 || pBuys.ult >= 1) {
        alert("Stok Ultimate Card di Shop ini sudah habis untuk Cycle ini (1/Cycle).");
        return;
      }
      if (player.hand.some((c) => c.rarity === "Ultimate")) {
        alert("Kamu hanya boleh memegang maksimal 1 Ultimate Card di tangan pada saat yang sama.");
        return;
      }
      if (player.tc < ultCost) {
        alert(`Not enough T-Coins. Requires ${ultCost} TC.`);
        return;
      }
      player.tc -= ultCost;
      shop.ultStock--;
      pBuys.ult++;
      if (ultDef && ultDef.effectKey === "grant_meta_shard") {
        player.metaShardBought = true;
      }
      player.hand.push({ ...ultDef, uid: `${ultDef.id}_${Date.now()}`, charId: player.charId });
      addLog(`Shop ${shopId}: ${player.name} purchased Ultimate Card [${ultDef.name}].`);
    } else if (itemType === "draw") {
      if (shop.drawStock <= 0 || pBuys.draw >= state.rules.drawShopPlayerLimit || player.tc < state.rules.drawShopCost) {
        alert("Cannot purchase Card Draw (check stock, player limit, or TC).");
        return;
      }
      player.tc -= state.rules.drawShopCost;
      shop.drawStock--;
      pBuys.draw++;
      drawCards(player, 1);
      addLog(`Shop ${shopId}: ${player.name} purchased +1 Card Draw.`);
    } else if (itemType === "actAgain") {
      if (shop.actAgainStock <= 0 || pBuys.actAgain >= state.rules.actAgainPlayerLimit || player.tc < state.rules.actAgainCost) {
        alert("Cannot purchase Act Again (check stock, player limit, or TC).");
        return;
      }
      player.tc -= state.rules.actAgainCost;
      shop.actAgainStock--;
      pBuys.actAgain++;
      player.extraPhasesThisTurn++;
      player.maxRollsThisTurn = (player.maxRollsThisTurn || 2) + 1;
      addLog(`Shop ${shopId}: ${player.name} purchased Act Again (+1 Extra Roll).`);
    }
    renderAll();
    broadcastMultiplayerState();
    if (!closeAfter) openMerchantModal(shopId);
  }

  function onTileClicked(tileId) {
    // Ignore tile click if user was dragging the map canvas
    if (camera.movedDuringDrag) {
      camera.movedDuringDrag = false;
      return;
    }

    if (pendingInteraction && canLocalPlayerAct()) {
      if (pendingInteraction.type === "choose_branch" && pendingInteraction.candidates.includes(tileId)) {
        if (isTouchOnlyDevice() && hoveredBranchTileId !== tileId) {
          hoveredBranchTileId = tileId;
          renderBoardSvgOverlay();
          applyBranchPreviewTileClasses();
          renderStepStatusBanner();
          return;
        }
        chooseBranchTile(tileId);
        return;
      }
      if (pendingInteraction.type === "select_tile_target" && pendingInteraction.validTileIds.includes(tileId)) {
        const { cardUid, options, tileStepLabels } = pendingInteraction;
        const stepDelta = tileStepLabels && tileStepLabels[tileId] ? tileStepLabels[tileId] : "";
        pendingInteraction = null;
        playSkillCardFromHand(cardUid, { ...(options || {}), targetTileId: tileId, stepDelta });
        return;
      }
      if (pendingInteraction.type === "stage_is_mine" && pendingInteraction.validTileIds.includes(tileId)) {
        resolveStageIsMineChoice(tileId);
        return;
      }
    }

    const t = TILE_MAP[tileId];
    if (!t) return;

    const effectMeta = TILE_EFFECT_META[t.type] || null;
    const shardOnTile = state.activeShards.find((s) => s.tileId === tileId);
    const tokensOnTile = state.boardTokens.filter((tok) => tok.tileId === tileId);

    // Do NOT show description modal for plain Normal / Spawn / Intersect tiles (unless Admin)
    if (!effectMeta && !shardOnTile && tokensOnTile.length === 0 && !isAdminUnlocked) {
      return;
    }

    const p = getActivePlayer();
    const sections = [];

    if (effectMeta) {
      sections.push(`
        <div style="background:rgba(0,0,0,0.34);border:1px solid rgba(255,255,255,0.14);padding:12px 14px;border-radius:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <strong style="color:#ffffff;font-size:0.95rem;">${escapeHtml(effectMeta.title)}</strong>
            <span class="tag-badge" style="border-color:${effectMeta.accent};color:#f8fafc;">${escapeHtml(effectMeta.badge)}</span>
          </div>
          <p style="font-size:0.84rem;color:#e2e8f0;line-height:1.45;margin:0;">${escapeHtml(effectMeta.effect)}</p>
        </div>`);
    }

    if (shardOnTile) {
      sections.push(`
        <div style="background:rgba(126,34,206,0.2);border:1px solid rgba(216,180,254,0.45);padding:10px 14px;border-radius:10px;font-size:0.82rem;color:#f3e8ff;">
          <strong>💎 Tartarus Shard (Zone ${escapeHtml(shardOnTile.roman)}):</strong> Lewati tile ini dengan minimal 💰 ${state.rules.shardCost} TC untuk membeli 1 💎 Tartarus Shard.
        </div>`);
    }

    tokensOnTile.forEach((tok) => {
      const desc = TOKEN_EFFECT_DESCRIPTIONS[tok.type] || tok.name;
      sections.push(`
        <div style="background:rgba(194,65,12,0.22);border:1px solid rgba(254,215,170,0.45);padding:10px 14px;border-radius:10px;font-size:0.82rem;color:#ffedd5;">
          ${escapeHtml(desc)}
        </div>`);
    });

    if (isAdminUnlocked) {
      sections.push(`
        <div style="border-top:1px solid var(--border-soft);padding-top:10px;display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:0.72rem;color:var(--mint-light);font-weight:700;">Admin Tile Controls (${escapeHtml(t.id)} · ${escapeHtml(t.type)})</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="window.EFT_APP.sandboxTeleportPlayer(${state.activePlayerIndex}, '${t.id}', true)">Teleport ${escapeHtml(p.name)} &amp; Trigger Tile</button>
            <button class="btn btn-sm" onclick="window.EFT_APP.sandboxTeleportPlayer(${state.activePlayerIndex}, '${t.id}', false)">Move Without Effect</button>
            <button class="btn btn-gold btn-sm" onclick="window.EFT_APP.sandboxPlaceShardAt('${t.id}')">Place Shard Here</button>
          </div>
        </div>`);
    }

    const modalHeading = effectMeta
      ? effectMeta.title
      : shardOnTile
      ? `Tartarus Shard (Zone ${shardOnTile.roman})`
      : tokensOnTile.length > 0
      ? tokensOnTile[0].name
      : `${t.name}`;

    playSfx("click");
    openInfoModal(
      escapeHtml(modalHeading),
      `<div style="display:flex;flex-direction:column;gap:10px;">${sections.join("")}</div>`
    );
  }

  function chooseBranchTile(tileId) {
    if (!canLocalPlayerAct()) return;
    if (isRemoteClient()) {
      sendClientActionToHost("choose_branch", { tileId });
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "choose_branch") return;
    const { player, stepsRemaining, direction, activateFinalTile, candidateViaMap } = pendingInteraction;
    const viaSplitId = candidateViaMap && candidateViaMap[tileId] ? candidateViaMap[tileId] : null;
    pendingInteraction = null;
    hoveredBranchTileId = null;
    executeSingleStep(player, tileId, stepsRemaining - 1, direction, activateFinalTile, viaSplitId);
  }

  function buildSkillControlsForModal(targetCard, player) {
    if (!targetCard || !player) return { html: "", missingTarget: false };
    let controlsHtml = "";
    let missingValidTarget = false;

    if (
      targetCard.targetType === "any_player" ||
      targetCard.targetType === "any_player_in_radius" ||
      targetCard.targetType === "other_player" ||
      targetCard.targetType === "opponent_in_radius"
    ) {
      const rad = targetCard.radius || 5;
      const validPlayers = state.players.filter((other) => {
        if (targetCard.targetType === "any_player") {
          return other.index === player.index || !other.inSpawn;
        }
        if (targetCard.targetType === "any_player_in_radius") {
          if (other.index === player.index) return true;
          if (other.inSpawn) return false;
          return getTileDistance(player.tileId, other.tileId) <= rad;
        }
        if (targetCard.targetType === "other_player") {
          return other.index !== player.index && !other.inSpawn;
        }
        if (targetCard.targetType === "opponent_in_radius") {
          if (other.index === player.index || other.inSpawn) return false;
          return getTileDistance(player.tileId, other.tileId) <= rad;
        }
        return true;
      });

      // Put opponents first for debuff cards so default selection is an opponent, while still allowing self
      validPlayers.sort((a, b) => {
        const aSelf = a.index === player.index ? 1 : 0;
        const bSelf = b.index === player.index ? 1 : 0;
        return targetCard.effectKey === "move_steps" ? bSelf - aSelf : aSelf - bSelf;
      });

      if (validPlayers.length === 0) {
        missingValidTarget = true;
        const isRadType = targetCard.targetType === "opponent_in_radius" || targetCard.targetType === "any_player_in_radius";
        controlsHtml += `<div style="color:#fda4af;font-size:0.8rem;">Tidak ada target valid (${isRadType ? `pemain di Spawn atau di luar radius ${rad} blok` : "semua lawan masih berada di Spawn"}).</div>`;
      } else {
        controlsHtml += `
          <div class="form-field">
            <label>Target Player${targetCard.radius ? ` (Radius ${targetCard.radius} Blok)` : ""}:</label>
            <select id="card-modal-target-player">
              ${validPlayers
                .map((vp) => {
                  const charNote = vp.charName && vp.charName !== vp.name ? `${vp.charName} · ` : "";
                  const selfTag = vp.index === player.index ? " · Diri Sendiri" : "";
                  return `<option value="${vp.index}">${escapeHtml(vp.name)}${selfTag} (${charNote}${vp.tileId} · ${getTileDistance(
                    player.tileId,
                    vp.tileId
                  )} blok)</option>`;
                })
                .join("")}
            </select>
          </div>`;
      }
    } else if (targetCard.targetType === "opponents_in_radius_aoe") {
      const rad = targetCard.radius || 8;
      const inRange = state.players.filter(
        (other) => other.index !== player.index && !other.inSpawn && getTileDistance(player.tileId, other.tileId) <= rad
      );
      if (inRange.length === 0) {
        missingValidTarget = true;
        controlsHtml += `<div style="color:#fda4af;font-size:0.8rem;">Tidak ada lawan dalam radius ${rad} blok dari posisimu (${player.tileId}).</div>`;
      } else {
        controlsHtml += `<div style="color:#a7f3d0;font-size:0.78rem;">Target dalam radius ${rad} blok: <strong>${inRange
          .map((o) => `${escapeHtml(o.name)} (${getTileDistance(player.tileId, o.tileId)} blok)`)
          .join(", ")}</strong></div>`;
      }
    }

    if (targetCard.effectKey === "choice_10tc_or_draw1") {
      const gainVal = targetCard.tcGain || (state.compendiumId === "comp_v0_1" ? 5 : 10);
      controlsHtml += `
        <div class="form-field">
          <label>Pilih Efek:</label>
          <select id="card-modal-choice-val">
            <option value="tc">Gain +${gainVal} T-Coins</option>
            <option value="draw">Draw +1 Card</option>
          </select>
        </div>`;
    } else if (targetCard.effectKey === "choice_move1_2_or_10tc") {
      controlsHtml += `
        <div class="form-field">
          <label>Pilih Efek:</label>
          <select id="card-modal-choice-val">
            <option value="move">Move +1 / +2 Tiles (Pilih di Peta)</option>
            <option value="tc">Gain +10 T-Coins</option>
          </select>
        </div>`;
    }

    return { html: controlsHtml, missingTarget: missingValidTarget };
  }

  function onCopySkillSelectChange(playerIdx) {
    const sel = document.getElementById("card-modal-copy-skill");
    const extraBox = document.getElementById("card-modal-copy-extra");
    const useBtn = document.querySelector(".card-detail-use-btn");
    if (!sel || !extraBox) return;

    const entry = (state.recentOpponentSkills || []).find((e) => e.id === sel.value);
    const player = state.players[playerIdx] || getActivePlayer();
    if (!entry || !entry.card) {
      extraBox.innerHTML = "";
      return;
    }
    const built = buildSkillControlsForModal(entry.card, player);
    extraBox.innerHTML = `
      <div style="font-size:0.74rem;color:var(--mint-light);margin-bottom:6px;">
        Efek disalin: ${escapeHtml(entry.card.description)}${entry.card.rarity === "Unique" ? " (Durasi 1 Turn)" : ""}
      </div>
      ${built.html}`;
    if (useBtn && useBtn.dataset.baseOk === "1") {
      useBtn.disabled = built.missingTarget;
    }
  }

  function openPlayCardModal(cardUid, ownerIdx = state.activePlayerIndex) {
    const player = state.players[ownerIdx] || getActivePlayer();
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return;
    const imgUrl = getCardImage(card, player.charId);
    const isMyTurn = ownerIdx === state.activePlayerIndex && canLocalPlayerAct();
    const check = isMyTurn ? canPlaySkillCard(player, card) : { ok: false, reason: "Tunggu giliranmu untuk memakai kartu ini." };

    let controlsHtml = "";
    let missingValidTarget = false;

    if (card.effectKey === "copy_last_skill") {
      const pool = (state.recentOpponentSkills || []).filter(
        (e) =>
          e.casterIndex !== player.index &&
          e.card &&
          e.card.effectKey !== "copy_last_skill" &&
          e.card.rarity !== "Ultimate" &&
          (!e.cycle || e.cycle === state.cycle)
      );
      if (pool.length === 0) {
        controlsHtml = `<div style="font-size:0.78rem;color:var(--mint-light);">Belum ada skill lawan non-Ultimate pada Cycle ${state.cycle} — memakai kartu ini akan memberi +15 TC.</div>`;
      } else {
        const firstBuilt = buildSkillControlsForModal(pool[0].card, player);
        missingValidTarget = firstBuilt.missingTarget;
        controlsHtml = `
          <div class="form-field">
            <label>Pilih Skill Lawan pada Cycle ${state.cycle} (Non-Ultimate):</label>
            <select id="card-modal-copy-skill" onchange="window.EFT_APP.onCopySkillSelectChange(${player.index})">
              ${pool
                .map(
                  (e) =>
                    `<option value="${e.id}">${escapeHtml(e.card.name)} — ${escapeHtml(e.casterName)} (${escapeHtml(e.card.rarity)})</option>`
                )
                .join("")}
            </select>
          </div>
          <div id="card-modal-copy-extra">
            <div style="font-size:0.74rem;color:var(--mint-light);margin-bottom:6px;">
              Efek disalin: ${escapeHtml(pool[0].card.description)}${pool[0].card.rarity === "Unique" ? " (Durasi 1 Ronde)" : ""}
            </div>
            ${firstBuilt.html}
          </div>`;
      }
    } else {
      const built = buildSkillControlsForModal(card, player);
      controlsHtml = built.html;
      missingValidTarget = built.missingTarget;
    }

    const keywords = [];
    if (card.retain) keywords.push("Retain");
    if (card.haste) keywords.push("Haste");
    const rarityLine = card.rarity + (keywords.length ? " · " + keywords.join(" · ") : "");

    openCardDetailModal(
      `<div class="card-detail-layout">
        <img class="card-detail-art" src="${imgUrl}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async" />
        <div class="card-detail-body">
          <div class="card-detail-top">
            <div class="card-detail-heading">
              <span class="card-detail-title">${escapeHtml(card.name)}</span>
              <span class="card-detail-rarity">${escapeHtml(rarityLine)}</span>
            </div>
            <button class="card-detail-close-x" onclick="window.EFT_APP.closeModal()" aria-label="Close">X</button>
          </div>
          <p class="card-detail-desc">${escapeHtml(card.description)}</p>
          ${controlsHtml}
          ${
            !check.ok
              ? `<div style="background:rgba(225,29,72,0.16);border:1px solid rgba(225,29,72,0.4);padding:8px 10px;border-radius:8px;color:#fda4af;font-size:0.78rem;">${escapeHtml(check.reason)}</div>`
              : ""
          }
          <button class="card-detail-use-btn" data-base-ok="${check.ok ? "1" : "0"}" ${!check.ok || missingValidTarget ? "disabled" : ""} onclick="window.EFT_APP.confirmPlayCardFromModal('${card.uid}')">Use Card</button>
        </div>
      </div>`
    );
  }

  function confirmPlayCardFromModal(cardUid) {
    if (!canLocalPlayerAct()) return;
    const player = getActivePlayer();
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return;

    const tgtEl = document.getElementById("card-modal-target-player");
    const choiceEl = document.getElementById("card-modal-choice-val");
    const copyEl = document.getElementById("card-modal-copy-skill");
    const options = {};
    if (tgtEl) {
      if (tgtEl.value === "") return;
      options.targetPlayerIndex = Number(tgtEl.value);
    }
    if (choiceEl) options.choiceValue = choiceEl.value;

    let flowCard = card;
    if (card.effectKey === "copy_last_skill" && copyEl && copyEl.value) {
      options.copiedSkillEntryId = copyEl.value;
      const entry = (state.recentOpponentSkills || []).find((e) => e.id === copyEl.value);
      if (entry && entry.card) flowCard = entry.card;
    }

    if (
      flowCard.targetType === "normal_tile_in_radius" ||
      flowCard.targetType === "any_tile" ||
      flowCard.targetType === "non_event_tile"
    ) {
      startTileTargetSelection(
        cardUid,
        flowCard.radius || 4,
        flowCard.targetType === "normal_tile_in_radius",
        options,
        flowCard
      );
      return;
    }

    const moveSpec = getSkillMoveSelectionSpec(flowCard, options);
    if (moveSpec) {
      startMoveTileSelection(cardUid, moveSpec, options);
      return;
    }

    playSkillCardFromHand(cardUid, options);
  }

  function startTileTargetSelection(cardUid, radius, onlyNormal, options = {}, specCard = null) {
    const player = getActivePlayer();
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return;
    const effectiveCard = specCard || card;

    let matches = [];
    if (effectiveCard.targetType === "non_event_tile") {
      matches = DATA.BOARD_TILES.filter(
        (t) => t.type !== "spawn" && t.type !== "event" && t.type !== "intersect" && !t.offTrack
      ).map((t) => ({
        tile: t,
        distance: getTileDistance(player.tileId, t.id)
      }));
    } else {
      const excludeSelfTile = effectiveCard.effectKey === "teleport_normal_radius";
      matches = getTilesWithinRadius(player.tileId, radius, onlyNormal, excludeSelfTile);
    }

    if (matches.length === 0) {
      alert("Tidak ada tile yang sesuai.");
      return;
    }
    closeModal();
    pendingInteraction = {
      type: "select_tile_target",
      cardUid,
      card: effectiveCard,
      player,
      movingPlayerIndex: player.index,
      options,
      validTileIds: matches.map((m) => m.tile.id),
      tileStepLabels: {},
      canChangeTarget: card.effectKey === "copy_last_skill"
    };
    if (effectiveCard.targetType === "non_event_tile" || radius >= 5) setCameraMode("wide");
    else focusCameraOnTile(player.tileId, isMobilePortrait() ? 0.56 : 0.78);
    renderAll();
  }

  function startMoveTileSelection(cardUid, moveSpec, options = {}) {
    const player = getActivePlayer();
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return;
    const movingPlayer =
      options.targetPlayerIndex !== undefined && state.players[options.targetPlayerIndex]
        ? state.players[options.targetPlayerIndex]
        : player;

    const tileStepLabels = {};
    if (moveSpec.mode === "forward" || moveSpec.mode === "both") {
      const fwdMap = getReachableTilesDirected(
        movingPlayer.tileId,
        moveSpec.minSteps,
        moveSpec.maxSteps,
        1,
        movingPlayer.lastTileId || null
      );
      fwdMap.forEach((dist, tid) => {
        tileStepLabels[tid] = "+" + dist;
      });
    }
    if (moveSpec.mode === "backward" || moveSpec.mode === "both") {
      const bwdMap = getReachableTilesDirected(
        movingPlayer.tileId,
        moveSpec.minSteps,
        moveSpec.maxSteps,
        -1,
        movingPlayer.lastTileId || null
      );
      bwdMap.forEach((dist, tid) => {
        if (!tileStepLabels[tid]) tileStepLabels[tid] = "-" + dist;
      });
    }

    const validTileIds = Object.keys(tileStepLabels);
    if (validTileIds.length === 0) {
      alert(`Tidak ada tile tujuan valid dari posisi ${movingPlayer.name} (${movingPlayer.tileId}).`);
      return;
    }

    closeModal();
    pendingInteraction = {
      type: "select_tile_target",
      cardUid,
      card,
      player,
      movingPlayerIndex: movingPlayer.index,
      options,
      validTileIds,
      tileStepLabels,
      canChangeTarget:
        card.targetType === "any_player" ||
        card.targetType === "other_player" ||
        card.effectKey === "choice_move1_2_or_10tc" ||
        card.effectKey === "copy_last_skill"
    };

    if (moveSpec.maxSteps >= 6) setCameraMode("wide");
    else focusCameraOnTile(movingPlayer.tileId, isMobilePortrait() ? 0.56 : 0.78);
    renderAll();
  }

  function reopenPendingCardModal() {
    if (!pendingInteraction || pendingInteraction.type !== "select_tile_target") return;
    const { cardUid, player } = pendingInteraction;
    pendingInteraction = null;
    renderAll();
    openPlayCardModal(cardUid, player ? player.index : state.activePlayerIndex);
  }

  function openMerchantModal(shopId = 1) {
    if (!canLocalPlayerAct() && !isAdminUnlocked) return;
    const player = getActivePlayer();
    const effectiveShopId = state.rules.independentShops ? shopId : 1;
    const shop = state.shops[effectiveShopId];
    if (shop.ultStock === undefined) shop.ultStock = 1;
    const charDef = getCharacterForCompendium(player.charId, state.compendiumId);
    const ultDef = player.isSamMode && charDef.samUltimate ? charDef.samUltimate : charDef.ultimate;
    const ultCost = (ultDef && ultDef.cost) || charDef.ultCost || state.rules.defaultUltCost;
    const ultImg = getCardImage(ultDef, player.charId);
    const pBuys = shop.playerBuys[player.id] || { ult: 0, draw: 0, actAgain: 0 };
    const ultUsedThisCycle = shop.ultStock <= 0 || (pBuys.ult || 0) >= 1;
    const hasUltInHand = player.hand.some((c) => c.rarity === "Ultimate");
    const metaShardUsed =
      ultDef && ultDef.effectKey === "grant_meta_shard" && (player.metaShardBought || player.metaShard >= 1);
    const ultDisabled = metaShardUsed || ultUsedThisCycle || hasUltInHand;
    let ultBtnLabel = `Buy Ultimate (${ultCost} TC)`;
    if (metaShardUsed) ultBtnLabel = "Sudah Dibeli (Max 1/Game)";
    else if (ultUsedThisCycle) ultBtnLabel = "Stok Habis (0/1 Cycle Ini)";
    else if (hasUltInHand) ultBtnLabel = "Sudah Pegang 1 Ultimate di Tangan";

    openInfoModal(
      `Merchant Shop ${shopId} — (${player.name}: 💰 ${player.tc} TC)`,
      `<div style="display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:0.76rem;color:var(--mint-light);background:rgba(245,158,11,0.12);border:1px solid rgba(251,191,36,0.36);border-radius:8px;padding:7px 11px;">
          ${
            state.rules.independentShops
              ? `Akses khusus <strong>Merchant Shop ${shopId}</strong> (${shopId === 1 ? "Jalur Atas" : "Jalur Bawah"}) — Stok terpisah dari Shop ${shopId === 1 ? 2 : 1}.`
              : `Rulebook v0.1: Shared Global Merchant Shop Stock`
          }
        </div>
        <div style="display:grid;grid-template-columns:150px 1fr;gap:14px;background:rgba(0,0,0,0.3);padding:12px;border-radius:12px;border:1px solid var(--accent-gold);">
          <img src="${ultImg}" alt="${ultDef.name}" loading="lazy" decoding="async" style="width:100%;border-radius:8px;" />
          <div style="display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--accent-gold);">ULTIMATE: ${ultDef.name} (💰 ${ultCost} TC)</div>
              <p style="font-size:0.82rem;color:#f8fafc;margin-top:6px;">${ultDef.description}</p>
              <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">Stock: <strong>${shop.ultStock}/1</strong> · Your Limit: <strong>${pBuys.ult || 0}/1</strong></p>
            </div>
            <button class="btn btn-gold" ${ultDisabled ? "disabled" : ""} onclick="window.EFT_APP.buyShopItem(${shopId}, 'ultimate')">
              ${ultBtnLabel}
            </button>
          </div>
        </div>
        <div class="grid-2col">
          <div class="panel-box">
            <div class="panel-header">+1 Card Draw (💰 ${state.rules.drawShopCost} TC)</div>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Stock: <strong>${shop.drawStock}/${state.rules.drawShopStock}</strong> · Your Limit: <strong>${pBuys.draw}/${state.rules.drawShopPlayerLimit}</strong></p>
            <button class="btn btn-primary" style="width:100%;" onclick="window.EFT_APP.buyShopItem(${shopId}, 'draw')">Buy +1 Card Draw</button>
          </div>
          <div class="panel-box">
            <div class="panel-header">Act Again (💰 ${state.rules.actAgainCost} TC)</div>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Stock: <strong>${shop.actAgainStock}/${state.rules.actAgainStock}</strong> · Your Limit: <strong>${pBuys.actAgain}/${state.rules.actAgainPlayerLimit}</strong></p>
            <button class="btn btn-primary" style="width:100%;" onclick="window.EFT_APP.buyShopItem(${shopId}, 'actAgain')">Buy Act Again (+1 Roll)</button>
          </div>
        </div>
      </div>`
    );
  }

  function dismissSharedTileModal() {
    if (isRemoteClient()) {
      sendClientActionToHost("close_tile_modal", {});
      closeModal();
      return;
    }
    clearTimeout(tileModalAutoCloseTimerId);
    tileModalAutoCloseTimerId = null;
    if (state) {
      state.activeTileModal = null;
    }
    lastRenderedTileModalKey = null;
    tileModalMinimizedForId = null;
    closeModal();
    renderAll();
    broadcastMultiplayerState();
  }

  function reopenSharedTileModal() {
    if (!state || !state.activeTileModal) return;
    playSfx("click");
    tileModalMinimizedForId = null;
    lastRenderedTileModalKey = null;
    syncSharedTileModal();
    renderPromptBar();
  }

  function buildTileModalPlayersStatsHtml(actorIndex) {
    if (!state || !Array.isArray(state.players)) return "";
    const rows = state.players
      .map((p) => {
        const isAct = p.index === actorIndex;
        const totShards = (p.shards || 0) + (p.metaShard || 0);
        const nonUltCnt = (p.hand || []).filter((c) => c && c.rarity !== "Ultimate").length;
        const ultCnt = (p.hand || []).filter((c) => c && c.rarity === "Ultimate").length;
        const tagHtml = isAct
          ? `<span class="tag-badge" style="border-color:var(--mint-light);color:var(--mint-light);">Giliran</span>`
          : p.inSpawn
          ? `<span class="tag-badge" style="opacity:0.75;">Spawn</span>`
          : "";
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:9px;background:${
            isAct ? "rgba(52,211,153,0.13)" : "rgba(0,0,0,0.32)"
          };border:1px solid ${isAct ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.1)"};">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;">
              <span class="ph-icon-badge" style="background:${escapeHtml(p.color || "#34d399")};flex-shrink:0;">${getCharacterSvgIcon(
          p.charId
        )}</span>
              <span style="font-weight:800;font-size:0.82rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
                p.name
              )}</span>
              ${tagHtml}
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.78rem;font-weight:700;flex-shrink:0;">
              <span style="color:#fde047;">💰 ${p.tc} TC</span>
              <span style="color:#e9d5ff;">💎 ${totShards}/${state.rules.victoryShards}</span>
              <span style="color:#cbd5e1;">${nonUltCnt} Kartu${ultCnt > 0 ? ` (+${ultCnt} Ult)` : ""}</span>
            </div>
          </div>`;
      })
      .join("");

    return `
      <div style="display:flex;flex-direction:column;gap:6px;background:rgba(6,16,20,0.55);border:1px solid var(--border-soft);border-radius:11px;padding:10px;">
        <div style="font-size:0.72rem;font-weight:800;color:var(--mint-light);text-transform:uppercase;letter-spacing:0.4px;">
          Status Seluruh Pemain (TC · Shards · Kartu)
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${rows}
        </div>
      </div>`;
  }

  function syncSharedTileModal() {
    if (!state) return;
    const tm = state.activeTileModal;
    const titleEl = document.getElementById("modal-title");
    const curKind = titleEl && titleEl.dataset ? titleEl.dataset.modalKind || "" : "";

    if (!tm) {
      tileModalMinimizedForId = null;
      if (curKind === "shared_tile_modal") {
        lastRenderedTileModalKey = null;
        closeModal();
      }
      return;
    }

    if (tm.status === "selecting" && tileModalMinimizedForId === tm.id) {
      return;
    }

    const isActor = canLocalPlayerAct();
    const renderKey = `${tm.id}_${tm.status}_${isActor ? "act" : "spec"}`;
    if (lastRenderedTileModalKey === renderKey && document.getElementById("app-modal")?.classList.contains("open")) {
      return;
    }
    lastRenderedTileModalKey = renderKey;

    const actor = state.players[tm.actorIndex] || getActivePlayer();
    const statsHtml = buildTileModalPlayersStatsHtml(actor.index);

    if (tm.status === "resolved") {
      tileModalMinimizedForId = null;
      openInfoModal(
        tm.type === "versus" ? `Hasil Versus Duel — ${escapeHtml(actor.name)}` : `Hasil Trading Post — ${escapeHtml(actor.name)}`,
        `<div style="display:flex;flex-direction:column;gap:12px;padding:6px 4px;">
          <div style="background:rgba(16,185,129,0.14);border:1px solid rgba(52,211,153,0.45);border-radius:12px;padding:14px;font-size:0.9rem;color:#ecfdf5;line-height:1.45;text-align:center;">
            ${escapeHtml(tm.summaryText || "Transaksi selesai.")}
          </div>
          ${statsHtml}
          ${
            isActor
              ? `<button class="btn btn-emerald" onclick="window.EFT_APP.dismissSharedTileModal()">Lanjut</button>`
              : `<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;">Menutup otomatis...</div>`
          }
        </div>`,
        "shared_tile_modal"
      );
      return;
    }

    if (tm.type === "versus") {
      const rivals = state.players.filter((p) => p.index !== actor.index && !p.inSpawn);
      if (rivals.length === 0) {
        if (!isRemoteClient()) {
          state.activeTileModal = null;
        }
        return;
      }
      if (isActor) {
        openInfoModal(
          `Versus Duel — 1v1 Wager (${escapeHtml(actor.name)})`,
          `<div style="display:flex;flex-direction:column;gap:12px;">
            ${statsHtml}
            <div class="form-grid">
              <div class="form-field">
                <label>Pilih Lawan Duel:</label>
                <select id="versus-opponent-select">
                  ${rivals
                    .map(
                      (r) =>
                        `<option value="${r.index}">${escapeHtml(r.name)} (💰 ${r.tc} TC · 💎 ${
                          (r.shards || 0) + (r.metaShard || 0)
                        }/${state.rules.victoryShards})</option>`
                    )
                    .join("")}
                </select>
              </div>
              <div class="form-field">
                <label>Jumlah Taruhan (1–30 TC):</label>
                <input
                  type="number"
                  id="versus-bet-input"
                  min="1"
                  max="30"
                  step="1"
                  value="15"
                  placeholder="1 - 30 TC"
                  oninput="if(this.value!==''){const v=Math.max(1,Math.min(30,Math.floor(Number(this.value)||1)));const lbl=document.getElementById('versus-pot-preview');if(lbl)lbl.textContent='Total Pot: 💰 '+(v*2)+' TC (Maks 30 TC)';}"
                />
                <div id="versus-pot-preview" style="font-size:0.72rem;color:var(--mint-light);margin-top:3px;">
                  Total Pot: 💰 30 TC (Maks 30 TC)
                </div>
              </div>
            </div>
            <button class="btn btn-gold" onclick="window.EFT_APP.resolveVersusDuel()">Mulai Duel 1v1</button>
          </div>`,
          "shared_tile_modal"
        );
      } else {
        openInfoModal(
          `Versus Duel — ${escapeHtml(actor.name)}`,
          `<div style="display:flex;flex-direction:column;gap:12px;padding:6px 4px;">
            <div style="background:rgba(249,115,22,0.14);border:1px solid rgba(251,146,60,0.45);border-radius:12px;padding:14px;font-size:0.88rem;color:#ffedd5;line-height:1.45;text-align:center;">
              <strong>${escapeHtml(actor.name)}</strong> mendarat di <strong>Versus Tile</strong> dan sedang memilih lawan serta jumlah taruhan TC...
            </div>
            ${statsHtml}
          </div>`,
          "shared_tile_modal"
        );
      }
    } else if (tm.type === "trading") {
      const others = state.players.filter((p) => p.index !== actor.index);
      if (isActor) {
        openInfoModal(
          `Trading Post — Barter Kartu (${escapeHtml(actor.name)})`,
          `<div style="display:flex;flex-direction:column;gap:12px;">
            ${statsHtml}
            <div class="form-grid">
              <div class="form-field">
                <label>Pilih Partner Barter:</label>
                <select id="trade-partner-select">
                  ${others
                    .map((o) => {
                      const nonUltCnt = (o.hand || []).filter((c) => c && c.rarity !== "Ultimate").length;
                      const totShards = (o.shards || 0) + (o.metaShard || 0);
                      return `<option value="${o.index}">${escapeHtml(o.name)} (💰 ${o.tc} TC · 💎 ${totShards}/${
                        state.rules.victoryShards
                      } · ${nonUltCnt} Kartu)</option>`;
                    })
                    .join("")}
                </select>
              </div>
              <div class="form-field">
                <label>Jenis Transaksi:</label>
                <select id="trade-type-select">
                  <option value="buy_card_15">Beli 1 Kartu Acak (Bayar 💰 15 TC)</option>
                  <option value="sell_card_15">Jual 1 Kartu Acak (Terima 💰 15 TC)</option>
                  <option value="swap_random_card">Tukar 1 Kartu Acak (1:1)</option>
                </select>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary" style="flex:1;" onclick="window.EFT_APP.executeTradeAction()">Konfirmasi Trade</button>
              <button class="btn" onclick="window.EFT_APP.dismissSharedTileModal()">Lewati</button>
            </div>
          </div>`,
          "shared_tile_modal"
        );
      } else {
        openInfoModal(
          `Trading Post — ${escapeHtml(actor.name)}`,
          `<div style="display:flex;flex-direction:column;gap:12px;padding:6px 4px;">
            <div style="background:rgba(132,204,22,0.14);border:1px solid rgba(163,230,53,0.45);border-radius:12px;padding:14px;font-size:0.88rem;color:#ecfccb;line-height:1.45;text-align:center;">
              <strong>${escapeHtml(actor.name)}</strong> mendarat di <strong>Trading Post</strong> dan sedang memilih partner serta jenis barter kartu...
            </div>
            ${statsHtml}
          </div>`,
          "shared_tile_modal"
        );
      }
    }
  }

  function openVersusModal(challenger) {
    const rivals = state.players.filter((p) => p.index !== challenger.index && !p.inSpawn);
    if (rivals.length === 0) {
      addLog(`Versus Tile: Tidak ada lawan di luar Spawn untuk ditantang oleh ${challenger.name}.`);
      return;
    }
    state.activeTileModal = {
      id: "tm_vs_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      type: "versus",
      actorIndex: challenger.index,
      status: "selecting",
      summaryText: ""
    };
    tileModalMinimizedForId = null;
    lastRenderedTileModalKey = null;
    syncSharedTileModal();
    renderPromptBar();
    broadcastMultiplayerState();
  }

  function resolveVersusDuel(forcedOppIdx = null, forcedBet = null) {
    if (!canLocalPlayerAct()) return;
    const oppEl = document.getElementById("versus-opponent-select");
    const betEl = document.getElementById("versus-bet-input") || document.getElementById("versus-bet-select");
    const oppIdx = forcedOppIdx !== null ? Number(forcedOppIdx) : oppEl ? Number(oppEl.value) : -1;
    const rawBet = forcedBet !== null ? Number(forcedBet) : betEl ? Number(betEl.value) : 15;
    if (!Number.isFinite(rawBet) || rawBet < 1 || rawBet > 30) {
      alert("Masukkan jumlah taruhan (bet) antara 1 hingga 30 TC.");
      return;
    }
    const bet = Math.max(1, Math.min(30, Math.floor(rawBet)));
    if (isRemoteClient() && forcedOppIdx === null) {
      sendClientActionToHost("resolve_versus", { oppIdx, bet });
      return;
    }
    const challenger = getActivePlayer();
    const opponent = state.players[oppIdx];
    if (!opponent) return;

    const c1 = Math.floor(Math.random() * 12) + 1;
    const c2 = Math.floor(Math.random() * 12) + 1;
    let summaryText = "";
    if (c1 >= c2) {
      const taken = Math.min(bet, opponent.tc);
      opponent.tc -= taken;
      const gained = modifyPlayerTC(challenger, taken, "versus");
      summaryText = `${challenger.name} (Roll ${c1}) mengalahkan ${opponent.name} (Roll ${c2}) & merebut 💰 ${gained} TC!`;
      addLog(`Versus: ${summaryText}`);
    } else {
      const lost = Math.min(bet, challenger.tc);
      challenger.tc -= lost;
      const gained = modifyPlayerTC(opponent, lost, "versus");
      summaryText = `${opponent.name} (Roll ${c2}) mengalahkan ${challenger.name} (Roll ${c1}) & memenangkan 💰 ${gained} TC!`;
      addLog(`Versus: ${summaryText}`);
    }

    state.activeTileModal = {
      id: (state.activeTileModal && state.activeTileModal.id) || ("tm_vs_" + Date.now()),
      type: "versus",
      actorIndex: challenger.index,
      status: "resolved",
      summaryText
    };
    lastRenderedTileModalKey = null;
    clearTimeout(tileModalAutoCloseTimerId);
    tileModalAutoCloseTimerId = setTimeout(() => {
      if (state && state.activeTileModal && state.activeTileModal.status === "resolved") {
        dismissSharedTileModal();
      }
    }, 2600);
    renderAll();
    broadcastMultiplayerState();
  }

  function openTradingModal(trader) {
    state.activeTileModal = {
      id: "tm_tr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      type: "trading",
      actorIndex: trader.index,
      status: "selecting",
      summaryText: ""
    };
    tileModalMinimizedForId = null;
    lastRenderedTileModalKey = null;
    syncSharedTileModal();
    renderPromptBar();
    broadcastMultiplayerState();
  }

  function executeTradeAction(forcedPartnerIdx = null, forcedTradeType = null) {
    if (!canLocalPlayerAct()) return;
    const partEl = document.getElementById("trade-partner-select");
    const typeEl = document.getElementById("trade-type-select");
    const partnerIdx = forcedPartnerIdx !== null ? Number(forcedPartnerIdx) : partEl ? Number(partEl.value) : -1;
    const tradeType = forcedTradeType !== null ? forcedTradeType : typeEl ? typeEl.value : "swap_random_card";
    if (isRemoteClient() && forcedPartnerIdx === null) {
      sendClientActionToHost("execute_trade", { partnerIdx, tradeType });
      return;
    }
    const trader = getActivePlayer();
    const partner = state.players[partnerIdx];
    if (!partner) return;

    const pickNonUltIdx = (hand) => {
      const idxs = [];
      (hand || []).forEach((c, i) => {
        if (c && c.rarity !== "Ultimate") idxs.push(i);
      });
      if (idxs.length === 0) return -1;
      return idxs[Math.floor(Math.random() * idxs.length)];
    };

    let summaryText = `${trader.name} melewati Trading Post tanpa transaksi.`;
    const pCardIdx = pickNonUltIdx(partner.hand);
    const tCardIdx = pickNonUltIdx(trader.hand);

    if (tradeType === "buy_card_15") {
      if (trader.tc >= 15 && pCardIdx !== -1) {
        trader.tc -= 15;
        partner.tc += 15;
        const bought = partner.hand.splice(pCardIdx, 1)[0];
        trader.hand.push(bought);
        summaryText = `${trader.name} membeli 1 kartu acak dari ${partner.name} seharga 💰 15 TC!`;
      } else {
        summaryText = `Trade gagal: TC ${trader.name} kurang dari 15 TC atau ${partner.name} tidak punya kartu non-Ultimate.`;
      }
    } else if (tradeType === "sell_card_15") {
      if (partner.tc >= 15 && tCardIdx !== -1) {
        partner.tc -= 15;
        trader.tc += 15;
        const sold = trader.hand.splice(tCardIdx, 1)[0];
        partner.hand.push(sold);
        summaryText = `${trader.name} menjual 1 kartu acak ke ${partner.name} dan menerima 💰 15 TC!`;
      } else {
        summaryText = `Trade gagal: TC ${partner.name} kurang dari 15 TC atau ${trader.name} tidak punya kartu non-Ultimate.`;
      }
    } else if (tradeType === "swap_random_card") {
      if (tCardIdx !== -1 && pCardIdx !== -1) {
        const c1 = trader.hand.splice(tCardIdx, 1)[0];
        const c2 = partner.hand.splice(pickNonUltIdx(partner.hand), 1)[0];
        trader.hand.push(c2);
        partner.hand.push(c1);
        summaryText = `${trader.name} menukar 1 kartu acak (1:1) dengan ${partner.name}!`;
      } else {
        summaryText = `Trade gagal: salah satu pemain tidak memiliki kartu non-Ultimate untuk ditukar.`;
      }
    }
    addLog(`Trading Post: ${summaryText}`);

    state.activeTileModal = {
      id: (state.activeTileModal && state.activeTileModal.id) || ("tm_tr_" + Date.now()),
      type: "trading",
      actorIndex: trader.index,
      status: "resolved",
      summaryText
    };
    lastRenderedTileModalKey = null;
    clearTimeout(tileModalAutoCloseTimerId);
    tileModalAutoCloseTimerId = setTimeout(() => {
      if (state && state.activeTileModal && state.activeTileModal.status === "resolved") {
        dismissSharedTileModal();
      }
    }, 2600);
    renderAll();
    broadcastMultiplayerState();
  }

  // ============================================================================
  // ADMIN ACCESS (PASSWORD: 010406) & PLAYTEST SANDBOX CONTROLS
  // ============================================================================
  function syncAdminUiState() {
    document.body.classList.toggle("admin-mode", isAdminUnlocked);
    const btn = document.getElementById("btn-admin-mode");
    if (btn) {
      btn.textContent = isAdminUnlocked ? "Admin: ON" : "Admin";
      btn.classList.toggle("admin-unlocked", isAdminUnlocked);
    }
    const freeToggle = document.getElementById("admin-free-skill-toggle");
    if (freeToggle) {
      freeToggle.checked = isAdminUnlocked && adminFreeSkillUse;
    }
    if (!isAdminUnlocked) {
      adminFreeSkillUse = false;
      const drawer = document.getElementById("drawer-sandbox");
      if (drawer) drawer.classList.remove("open");
    }
  }

  function openAdminModal() {
    if (!isAdminUnlocked) {
      openInfoModal(
        "Admin Access",
        `<div style="display:flex;flex-direction:column;gap:12px;">
          <p style="font-size:0.84rem;color:#cbd5e1;line-height:1.45;">
            Masukkan password Admin untuk membuka fitur editing player, teleport, free skill use, dan +/- card.
          </p>
          <div class="form-field">
            <label>Password Admin:</label>
            <input type="password" id="admin-pass-input" placeholder="Masukkan password admin" onkeydown="if(event.key==='Enter')window.EFT_APP.submitAdminPassword()" />
          </div>
          <div id="admin-pass-err" style="font-size:0.76rem;color:#fda4af;min-height:16px;"></div>
          <button class="btn btn-gold" onclick="window.EFT_APP.submitAdminPassword()">Unlock Admin</button>
        </div>`
      );
      setTimeout(() => {
        const inp = document.getElementById("admin-pass-input");
        if (inp) inp.focus();
      }, 60);
      return;
    }

    openInfoModal(
      "Admin Controls (Unlocked)",
      `<div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:rgba(16,185,129,0.14);border:1px solid rgba(52,211,153,0.45);border-radius:10px;padding:10px 12px;font-size:0.82rem;color:#a7f3d0;">
          Admin Mode aktif. Seluruh fitur editing, Test Tools, +/- Card, dan Free Skill Use tersedia.
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.3);border:1px solid var(--border-soft);border-radius:8px;padding:9px 12px;font-size:0.82rem;">
          <span>Free Skill Use (Bypass Limit &amp; Phase)</span>
          <input type="checkbox" ${adminFreeSkillUse ? "checked" : ""} onchange="window.EFT_APP.toggleAdminFreeSkill(this.checked)" />
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="window.EFT_APP.closeModal();window.EFT_APP.toggleDrawer('drawer-sandbox')">Open Test Tools</button>
          <button class="btn btn-danger" onclick="window.EFT_APP.lockAdminMode()">Lock Admin Mode</button>
        </div>
      </div>`
    );
  }

  function submitAdminPassword() {
    const inp = document.getElementById("admin-pass-input");
    const errEl = document.getElementById("admin-pass-err");
    const val = (inp ? inp.value : "").trim();
    if (val === ADMIN_PASSCODE) {
      isAdminUnlocked = true;
      try {
        sessionStorage.setItem("eft_admin_unlocked", "1");
      } catch (e) {}
      syncAdminUiState();
      closeModal();
      addLog("Admin Mode unlocked.");
      renderAll();
    } else if (errEl) {
      errEl.textContent = "Password admin salah.";
    }
  }

  function lockAdminMode() {
    isAdminUnlocked = false;
    adminFreeSkillUse = false;
    try {
      sessionStorage.removeItem("eft_admin_unlocked");
    } catch (e) {}
    syncAdminUiState();
    closeModal();
    renderAll();
  }

  function toggleAdminFreeSkill(enabled) {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    adminFreeSkillUse = !!enabled;
    syncAdminUiState();
    addLog(`Admin Free Skill Use: ${adminFreeSkillUse ? "ON" : "OFF"}.`);
    renderAll();
  }

  function openSandboxPlayerModal(pIdx) {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    const p = state.players[pIdx];
    if (!p) return;
    const playable = getPlayableCharacterIds(state.compendiumId);
    const charOptions = playable
      .map((cid) => {
        const c = getCharacterForCompendium(cid, state.compendiumId);
        return `<option value="${c.id}" ${c.id === p.charId ? "selected" : ""}>${c.name} (${c.title})</option>`;
      })
      .join("");

    openInfoModal(
      `Admin Edit Player — ${escapeHtml(p.name)}`,
      `<div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-grid">
          <div class="form-field">
            <label>Character:</label>
            <select id="sb-char-id">${charOptions}</select>
          </div>
          <div class="form-field">
            <label>Board Tile ID:</label>
            <input type="text" id="sb-tile-id" value="${p.tileId}" />
          </div>
          <div class="form-field">
            <label>T-Coins (💰 TC):</label>
            <input type="number" id="sb-tc" value="${p.tc}" />
          </div>
          <div class="form-field">
            <label>Tartarus Shards (💎):</label>
            <input type="number" id="sb-shards" value="${p.shards}" min="0" max="5" />
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="window.EFT_APP.saveSandboxPlayer(${pIdx})">Save Changes</button>
          <button class="btn btn-gold" onclick="window.EFT_APP.sandboxGiveUltimate(${pIdx})">Grant Ultimate</button>
          <button class="btn btn-emerald" onclick="window.EFT_APP.sandboxDrawCard(${pIdx})">+1 Card</button>
          <button class="btn btn-danger" onclick="window.EFT_APP.sandboxRemoveCard(${pIdx})">-1 Card</button>
          <button class="btn" onclick="window.EFT_APP.sandboxSetActiveTurn(${pIdx})">Set Active Turn</button>
        </div>
      </div>`
    );
  }

  function saveSandboxPlayer(pIdx) {
    if (!isAdminUnlocked) return;
    saveSnapshot();
    const p = state.players[pIdx];
    const newCharId = document.getElementById("sb-char-id").value;
    const newTileId = document.getElementById("sb-tile-id").value.trim().toUpperCase();
    const newTc = Number(document.getElementById("sb-tc").value);
    const newShards = Number(document.getElementById("sb-shards").value);

    if (newCharId !== p.charId && DATA.CHARACTERS[newCharId] && !DATA.CHARACTERS[newCharId].unavailable) {
      const charDef = getCharacterForCompendium(newCharId, state.compendiumId);
      p.charId = newCharId;
      p.isSamMode = false;
      p.charName = charDef.name;
      p.name = p.username ? p.username : charDef.name;
      p.color = charDef.color;
      p.deck = buildDeckForCharacter(newCharId, state.compendiumId, false);
      p.discard = [];
      p.hand = p.deck.splice(0, state.rules.startHandSize);
    }
    if (TILE_MAP[newTileId]) {
      p.tileId = newTileId;
      p.inSpawn = newTileId === "T0";
    }
    p.tc = Math.max(0, newTc);
    p.shards = Math.max(0, newShards);
    closeModal();
    checkVictory(p);
    if (camera.mode === "follow") focusCameraOnTile(p.tileId);
    renderAll();
    broadcastMultiplayerState();
  }

  function sandboxTeleportPlayer(pIdx, tileId, triggerEffect = false) {
    if (!isAdminUnlocked) return;
    saveSnapshot();
    const p = state.players[pIdx];
    if (!p || !TILE_MAP[tileId]) return;
    p.tileId = tileId;
    p.lastTileId = null;
    p.inSpawn = tileId === "T0";
    closeModal();
    if (triggerEffect) resolveExactLandingTile(p, TILE_MAP[tileId]);
    if (camera.mode === "follow") focusCameraOnTile(tileId);
    renderAll();
    broadcastMultiplayerState();
  }

  function sandboxPlaceShardAt(tileId) {
    if (!isAdminUnlocked) return;
    saveSnapshot();
    state.activeShards.push({
      die: 6,
      roman: "CUSTOM",
      tileId,
      x: TILE_MAP[tileId].x,
      y: TILE_MAP[tileId].y,
      label: `Custom Shard @ ${tileId}`
    });
    closeModal();
    renderAll();
    broadcastMultiplayerState();
  }

  function sandboxGiveUltimate(pIdx) {
    if (!isAdminUnlocked) return;
    saveSnapshot();
    const p = state.players[pIdx];
    const charDef = getCharacterForCompendium(p.charId, state.compendiumId);
    const ultDef = p.isSamMode && charDef.samUltimate ? charDef.samUltimate : charDef.ultimate;
    p.hand.push({ ...ultDef, uid: `${ultDef.id}_${Date.now()}`, charId: p.charId });
    closeModal();
    renderAll();
    broadcastMultiplayerState();
  }

  function sandboxDrawCard(pIdx = null) {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    const idx = pIdx === null || pIdx === undefined ? state.activePlayerIndex : pIdx;
    const p = state.players[idx];
    if (!p) return;
    saveSnapshot();
    drawCards(p, 1);
    closeModal();
    renderAll();
    broadcastMultiplayerState();
  }

  function sandboxRemoveCard(pIdx = null) {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    const idx = pIdx === null || pIdx === undefined ? state.activePlayerIndex : pIdx;
    const p = state.players[idx];
    if (!p || p.hand.length === 0) return;
    saveSnapshot();
    const removed = p.hand.pop();
    p.discard.push(removed);
    addLog(`Admin: Removed [${removed.name}] from ${p.name}'s hand.`);
    closeModal();
    renderAll();
    broadcastMultiplayerState();
  }

  function sandboxSetActiveTurn(pIdx) {
    if (!isAdminUnlocked) return;
    saveSnapshot();
    state.activePlayerIndex = pIdx;
    state.phaseIndex = 1;
    state.players[pIdx].rollsUsedThisTurn = 0;
    state.players[pIdx].maxRollsThisTurn = 2;
    state.turnTimerKey = generateTurnTimerKey();
    pendingInteraction = null;
    closeModal();
    if (camera.mode !== "wide") {
      camera.mode = "follow";
      focusCameraOnTile(state.players[pIdx].tileId);
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function scheduleMultiplayerBotIfNeeded() {
    clearTimeout(window._mpBotTimer);
    if (!state || state.winner || isWalkingAnim || isTileEffectAnimating || tileShuffleState) return;
    if (state.activeMinigame) {
      scheduleDiceOfFateBotIfNeeded();
      return;
    }
    if (isMultiplayerHost() && mp.lobby.status === "playing") {
      const activeP = getActivePlayer();
      if (activeP && activeP.isBot) {
        window._mpBotTimer = setTimeout(() => {
          if (state && !state.winner && !isWalkingAnim && !isTileEffectAnimating && !tileShuffleState && getActivePlayer()?.isBot) {
            _executeBotStepInternal();
          }
        }, 560);
      }
    }
  }

  function _executeBotStepInternal() {
    if (!state || state.winner || isWalkingAnim || isTileEffectAnimating || tileShuffleState) return;
    isProcessingRemoteAction = true;
    try {
      if (state.activeMinigame) {
        if (state.activeMinigame.status === "rolling") rollDiceOfFateCurrent();
        else finishDiceOfFateMinigame();
        return;
      }
      if (state.activeTileModal) {
        if (state.activeTileModal.status === "resolved") {
          dismissSharedTileModal();
          return;
        }
        const actor = state.players[state.activeTileModal.actorIndex] || getActivePlayer();
        const rivals = state.players.filter((p) => p.index !== actor.index && !p.inSpawn);
        if (rivals.length === 0) {
          dismissSharedTileModal();
          return;
        }
        if (state.activeTileModal.type === "versus") {
          resolveVersusDuel(rivals[0].index, 15);
        } else if (state.activeTileModal.type === "trading") {
          dismissSharedTileModal();
        }
        return;
      }
      if (pendingInteraction) {
        const p = pendingInteraction;
        if (p.type === "choose_branch") {
          let bestTile = p.candidates[0];
          let bestDist = 999;
          p.candidates.forEach((cid) => {
            state.activeShards.forEach((sh) => {
              const d = getTileDistance(cid, sh.tileId);
              if (d < bestDist) {
                bestDist = d;
                bestTile = cid;
              }
            });
          });
          const viaId = p.candidateViaMap && p.candidateViaMap[bestTile] ? p.candidateViaMap[bestTile] : null;
          pendingInteraction = null;
          hoveredBranchTileId = null;
          executeSingleStep(p.player, bestTile, p.stepsRemaining - 1, p.direction, p.activateFinalTile, viaId);
        } else if (p.type === "prompt_shard_buy") {
          confirmShardPurchase(true);
        } else if (p.type === "prompt_river") {
          confirmRiverShortcut(Math.random() < 0.5);
        } else if (p.type === "prompt_merchant_pass") {
          resumeFromMerchantPrompt();
        } else if (p.type === "stage_is_mine") {
          const goodTypes = new Set(["tc_plus10", "pos_effect", "card_plus1", "merchant", "event"]);
          const goodTid = (p.validTileIds || []).find((tid) => TILE_MAP[tid] && goodTypes.has(TILE_MAP[tid].type));
          resolveStageIsMineChoice(goodTid || null);
        } else if (p.type === "forced_all_in_reward") {
          resolveForcedAllInChoice("shard");
        } else {
          pendingInteraction = null;
          renderAll();
        }
        return;
      }

      const player = getActivePlayer();
      if (state.phaseIndex === 1 || state.phaseIndex === 3) {
        if (player.skillsUsedThisTurn < player.maxSkillsThisTurn && player.hand.length > 0 && !player.silencedThisPhase) {
          const playable = player.hand.find((c) => {
            if (!canPlaySkillCard(player, c).ok) return false;
            if (c.targetType === "normal_tile_in_radius" || c.targetType === "any_tile" || c.targetType === "non_event_tile") {
              return false;
            }
            if (c.targetType === "opponent_in_radius" || c.targetType === "any_player_in_radius" || c.targetType === "opponents_in_radius_aoe") {
              const rad = c.radius || 5;
              return state.players.some(
                (o) => o.index !== player.index && !o.inSpawn && getTileDistance(player.tileId, o.tileId) <= rad
              );
            }
            if (c.targetType === "other_player") {
              return state.players.some((o) => o.index !== player.index && !o.inSpawn);
            }
            return true;
          });
          if (playable && Math.random() < 0.5) {
            const opts = {};
            if (
              playable.targetType === "opponent_in_radius" ||
              playable.targetType === "any_player_in_radius" ||
              playable.targetType === "other_player" ||
              (playable.targetType === "any_player" && playable.effectKey !== "move_steps")
            ) {
              const rad = playable.radius || 99;
              const opp = state.players.find(
                (o) => o.index !== player.index && !o.inSpawn && getTileDistance(player.tileId, o.tileId) <= rad
              );
              if (opp) opts.targetPlayerIndex = opp.index;
              else if (playable.effectKey !== "move_steps") {
                rollMovementDice();
                return;
              }
            }
            playSkillCardFromHand(playable.uid, opts);
            return;
          }
        }
        rollMovementDice();
        return;
      }
      if (state.phaseIndex === 5) endCurrentTurn();
    } finally {
      isProcessingRemoteAction = false;
    }
  }

  function runSmartBotTurn() {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    _executeBotStepInternal();
  }

  function runAutoBotRound() {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    let actions = 0;
    const iv = setInterval(() => {
      if (!state || state.winner || actions >= 16) {
        clearInterval(iv);
        return;
      }
      if (!isWalkingAnim && !isTileEffectAnimating && !tileShuffleState) {
        runSmartBotTurn();
        actions++;
      }
    }, 320);
  }

  function openInfoModal(title, bodyHtml, modalKind = "") {
    const modalCard = document.getElementById("app-modal-card");
    if (modalCard) {
      modalCard.classList.remove("card-detail-modal");
      modalCard.classList.toggle("welcome-lobby-modal", modalKind === "welcome_lobby");
    }
    const titleEl = document.getElementById("modal-title");
    titleEl.innerHTML = title;
    titleEl.dataset.modalKind = modalKind;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("app-modal").classList.add("open");
  }

  function openCardDetailModal(bodyHtml) {
    const modalCard = document.getElementById("app-modal-card");
    if (modalCard) {
      modalCard.classList.remove("welcome-lobby-modal");
      modalCard.classList.add("card-detail-modal");
    }
    const titleEl = document.getElementById("modal-title");
    titleEl.innerHTML = "";
    titleEl.dataset.modalKind = "card_detail";
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("app-modal").classList.add("open");
  }

  function closeModal() {
    const modalCard = document.getElementById("app-modal-card");
    if (modalCard) {
      modalCard.classList.remove("card-detail-modal", "welcome-lobby-modal");
    }
    const titleEl = document.getElementById("modal-title");
    const curKind = titleEl && titleEl.dataset ? titleEl.dataset.modalKind || "" : "";
    if (curKind === "shared_tile_modal" && state && state.activeTileModal && state.activeTileModal.status === "selecting") {
      tileModalMinimizedForId = state.activeTileModal.id;
    }
    if (titleEl) titleEl.dataset.modalKind = "";
    document.getElementById("app-modal").classList.remove("open");
    renderPromptBar();
    scheduleAutoEndTurnIfReady();
  }

  function switchTab(tabId) {
    playSfx("click");
    document.querySelectorAll(".nav-oval-pill").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".view-container").forEach((v) => {
      v.classList.toggle("active", v.id === `view-${tabId}`);
    });
    if (tabId === "compendium") renderCompendiumView();
    if (tabId === "rules") renderRulesView();
  }

  function toggleDrawer(drawerId) {
    if (drawerId === "drawer-sandbox" && !isAdminUnlocked) {
      openAdminModal();
      return;
    }
    const el = document.getElementById(drawerId);
    if (!el) return;
    const isOpen = el.classList.contains("open");
    document.querySelectorAll(".floating-drawer").forEach((d) => d.classList.remove("open"));
    if (!isOpen) el.classList.add("open");
  }

  // ============================================================================
  // ONBOARDING (USERNAME, CHARACTER PICKER, RANDOMIZED ORDER) & SETUP LOBBY
  // ============================================================================
  function renderSetupCharPickerGrid(compId, selectedCharId, takenMap = {}) {
    const compDef = DATA.COMPENDIUM_VERSIONS[compId] || DATA.COMPENDIUM_VERSIONS.comp_beta1;
    const playableIds = getPlayableCharacterIds(compId);
    const unavailableIds = (compDef.unavailableCharacters || []).filter((cid) => DATA.CHARACTERS[cid]);

    const activeCards = playableIds.map((cid) => {
      const ch = getCharacterForCompendium(cid, compId);
      const charBase = DATA.CHARACTERS[cid] || {};
      const menuSrc = charBase.menuPortrait || null;
      const pt = charBase.portrait || null;
      const takenBy = takenMap[cid] || "";
      const isTaken = !!takenBy;
      const isSel = !isTaken && selectedCharId === cid;
      const thumbHtml = menuSrc
        ? `<img class="char-pick-menu-img" src="${menuSrc}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" />`
        : pt && pt.src
        ? `<img class="ph-portrait-img" src="${pt.src}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
        : `<div class="ph-portrait-fallback" style="background:radial-gradient(circle at 50% 42%, ${ch.color}55 0%, #07191a 82%);"><div class="ph-fallback-icon" style="fill:${ch.color};">${getCharacterSvgIcon(cid)}</div></div>`;
      const clickAttr = isTaken ? "" : `onclick="window.EFT_APP.selectSetupChar('${cid}')"`;

      return `
      <div class="char-pick-card ${isSel ? "selected" : ""} ${isTaken ? "taken" : ""}" ${clickAttr}>
        <div class="char-pick-thumb" style="--char-glow:${escapeHtml(ch.color || "#34d399")};">${thumbHtml}</div>
        <div class="char-pick-info">
          <div class="char-pick-name">${escapeHtml(ch.name)}</div>
          <div class="char-pick-role">${isTaken ? "Dipilih: " + escapeHtml(takenBy) : escapeHtml(ch.title)}</div>
        </div>
      </div>`;
    });

    const lockedCards = unavailableIds.map((cid) => {
      const ch = DATA.CHARACTERS[cid];
      const teaseImg = ch.menuPortrait
        ? `<img class="char-pick-menu-img is-tease" src="${ch.menuPortrait}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" />
           <span class="char-pick-tease-tag">Coming Soon</span>`
        : `<div class="ph-portrait-fallback" style="background:radial-gradient(circle at 50% 42%, rgba(148,163,184,0.22) 0%, #071214 82%);">
             <div class="ph-fallback-icon" style="fill:#64748b;">${getCharacterSvgIcon(cid)}</div>
           </div>`;
      return `
      <div class="char-pick-card unavailable" title="${escapeHtml(ch.name)} — Coming Soon (Unavailable)">
        <div class="char-pick-thumb" style="--char-glow:${escapeHtml(ch.color || "#64748b")};">
          ${teaseImg}
        </div>
        <div class="char-pick-info">
          <div class="char-pick-name">${escapeHtml(ch.name)}</div>
          <div class="char-pick-role">Unavailable</div>
        </div>
      </div>`;
    });

    return [...activeCards, ...lockedCards].join("");
  }

  function updateSetupDraft(key, val) {
    setupDraft[key] = val;
    if (key === "username") {
      savePlayerProfile(setupDraft.username, setupDraft.charId);
    }
    if (key === "compendiumId") {
      const playableIds = getPlayableCharacterIds(val);
      if (!playableIds.includes(setupDraft.charId)) {
        setupDraft.charId = playableIds[0];
      }
      if (isMultiplayerHost() && mp.lobby.status === "waiting") {
        mp.lobby.compendiumId = val;
        broadcastLobbyState();
      }
      openWelcomeSetupModal(setupDraft.tab);
    } else if (key === "patchId") {
      if (isMultiplayerHost() && mp.lobby.status === "waiting") {
        mp.lobby.patchId = val;
        broadcastLobbyState();
      }
    } else if (key === "playerCount") {
      setupDraft.playerCount = Number(val) || 4;
      openWelcomeSetupModal(setupDraft.tab);
    }
  }

  function updateSetupExtraPlayer(slotIdx, field, val) {
    if (!setupDraft.extraPlayers[slotIdx]) return;
    setupDraft.extraPlayers[slotIdx][field] = val;
  }

  function selectSetupChar(charId) {
    if (DATA.CHARACTERS[charId] && DATA.CHARACTERS[charId].unavailable) return;
    setupDraft.charId = charId;
    savePlayerProfile(setupDraft.username, setupDraft.charId);
    if (mp.mode !== "local" && mp.lobby.status === "waiting") {
      if (isMultiplayerHost()) {
        const me = mp.lobby.members.find((m) => m.clientId === mp.clientId);
        const taken = mp.lobby.members.some((m) => m.clientId !== mp.clientId && m.charId === charId);
        if (!taken && me) {
          me.charId = charId;
          broadcastLobbyState();
        }
      } else if (isRemoteClient()) {
        const me = mp.lobby.members.find((m) => m.clientId === mp.clientId);
        sendClientActionToHost("lobby_join", {
          clientId: mp.clientId,
          username: setupDraft.username || "Player",
          charId,
          ready: me ? me.ready : false
        });
      }
    }
    openWelcomeSetupModal(setupDraft.tab);
  }

  function switchSetupTab(tab) {
    setupDraft.tab = tab;
    openWelcomeSetupModal(tab);
  }

  function openWelcomeSetupModal(activeTab = "local", prefillRoomCode = "") {
    if (activeTab) setupDraft.tab = activeTab;
    if (prefillRoomCode) mp.roomCode = prefillRoomCode.trim().toUpperCase();

    const inLobbyWaiting = mp.mode !== "local" && mp.lobby && mp.lobby.status === "waiting";
    if (inLobbyWaiting) {
      setupDraft.tab = "multiplayer";
    }

    const compId = inLobbyWaiting ? mp.lobby.compendiumId : setupDraft.compendiumId;
    const patchId = inLobbyWaiting ? mp.lobby.patchId : setupDraft.patchId;
    const playableIds = getPlayableCharacterIds(compId);
    if (!playableIds.includes(setupDraft.charId)) {
      setupDraft.charId = playableIds[0];
    }

    const patchSelectHtml = `
      <div class="form-field">
        <label>Rulebook Patch Version:</label>
        <select id="setup-patch" onchange="window.EFT_APP.updateSetupDraft('patchId', this.value)">
          ${Object.values(DATA.RULE_PATCHES)
            .map((p) => `<option value="${p.id}" ${p.id === patchId ? "selected" : ""}>${p.name}</option>`)
            .join("")}
        </select>
      </div>`;

    const compSelectHtml = `
      <div class="form-field">
        <label>Character Compendium Version:</label>
        <select id="setup-compendium" onchange="window.EFT_APP.updateSetupDraft('compendiumId', this.value)">
          ${Object.values(DATA.COMPENDIUM_VERSIONS)
            .map((c) => `<option value="${c.id}" ${c.id === compId ? "selected" : ""}>${c.name}</option>`)
            .join("")}
        </select>
      </div>`;

    if (inLobbyWaiting) {
      const takenMap = {};
      mp.lobby.members.forEach((m) => {
        if (m.clientId !== mp.clientId) takenMap[m.charId] = m.username;
      });
      const me = mp.lobby.members.find((m) => m.clientId === mp.clientId);
      const isHost = isMultiplayerHost();
      const rosterHtml = mp.lobby.members
        .map((m) => {
          const ch = getCharacterForCompendium(m.charId, compId);
          return `
          <div class="lobby-roster-row">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="ph-icon-badge" style="background:${ch ? ch.color : "#38bdf8"};">${getCharacterSvgIcon(m.charId)}</span>
              <div>
                <strong style="color:#fff;">${escapeHtml(m.username)}</strong>
                <span style="font-size:0.72rem;color:var(--mint-light);margin-left:6px;">${ch ? escapeHtml(ch.name) : m.charId}</span>
              </div>
            </div>
            <span class="tag-badge">${m.isHost ? "Host" : m.ready ? "Ready" : "Waiting"}</span>
          </div>`;
        })
        .join("");

      openInfoModal(
        `Escape From Tartarus — Room [${escapeHtml(mp.roomCode)}]`,
        `<div class="setup-modal-stack">
          <div class="panel-box" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:0.72rem;color:var(--text-muted);">Mode: <strong>${mp.mode.toUpperCase()}</strong></div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--mint-light);">Kode Room: ${escapeHtml(mp.roomCode)}</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-emerald btn-sm" onclick="window.EFT_APP.copyInviteLink()">Copy Invite Link</button>
              <button class="btn btn-danger btn-sm" onclick="window.EFT_APP.disconnectMultiplayer()">Leave Room</button>
            </div>
          </div>

          <div class="setup-char-box">
            <div class="setup-char-box-label">Pilih Karakter Kamu (otomatis terkunci jika sudah diambil pemain lain):</div>
            <div class="char-picker-grid">
              ${renderSetupCharPickerGrid(compId, me ? me.charId : setupDraft.charId, takenMap)}
            </div>
          </div>

          <div class="panel-box" style="display:flex;flex-direction:column;gap:8px;">
            <div class="panel-header" style="margin-bottom:4px;">Pemain di Lobby (${mp.lobby.members.length}/4)</div>
            ${rosterHtml}
          </div>

          ${
            isHost
              ? `<label style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:#cbd5e1;cursor:pointer;">
                   <input type="checkbox" ${mp.lobby.fillWithBots ? "checked" : ""} onchange="window.EFT_APP.toggleLobbyFillBots(this.checked)" />
                   Isi slot kosong dengan Bot hingga 4 pemain (urutan tetap diacak)
                 </label>
                 <button class="btn btn-emerald setup-action-btn" onclick="window.EFT_APP.startMultiplayerMatchFromLobby()">Acak Urutan &amp; Mulai Game</button>`
              : `<button class="btn ${me && me.ready ? "btn-gold" : "btn-emerald"} setup-action-btn" onclick="window.EFT_APP.toggleLobbyReady()">${
                  me && me.ready ? "Batalkan Ready" : "Siap (Ready)"
                }</button>
                 <div style="font-size:0.74rem;color:var(--text-muted);text-align:center;">Menunggu Host memulai game &amp; mengacak urutan pemain...</div>`
          }
        </div>`,
        "welcome_lobby"
      );
      return;
    }

    const allowedChars = playableIds.map((cid) => getCharacterForCompendium(cid, compId));

    let tabBodyHtml = "";
    if (setupDraft.tab === "local") {
      const otherCount = Math.max(1, (setupDraft.playerCount || 4) - 1);
      const freeDefaults = playableIds.filter((cid) => cid !== setupDraft.charId);
      let extraRows = "";
      for (let i = 0; i < otherCount; i++) {
        const ext = setupDraft.extraPlayers[i] || { username: "", charId: freeDefaults[i % freeDefaults.length] };
        const chosenId = playableIds.includes(ext.charId)
          ? ext.charId
          : freeDefaults[i % freeDefaults.length] || playableIds[0];
        extraRows += `
          <div class="form-grid" style="align-items:end;">
            <div class="form-field">
              <label>Pemain ${i + 2} Username (opsional):</label>
              <input type="text" value="${escapeHtml(ext.username)}" placeholder="Bot / Pemain ${i + 2}" oninput="window.EFT_APP.updateSetupExtraPlayer(${i}, 'username', this.value)" />
            </div>
            <div class="form-field">
              <label>Karakter Pemain ${i + 2}:</label>
              <select onchange="window.EFT_APP.updateSetupExtraPlayer(${i}, 'charId', this.value)">
                ${allowedChars
                  .map((c) => `<option value="${c.id}" ${c.id === chosenId ? "selected" : ""}>${c.name}</option>`)
                  .join("")}
              </select>
            </div>
          </div>`;
      }

      tabBodyHtml = `
        <div class="panel-box setup-bottom-panel">
          <div class="panel-header" style="margin-bottom:4px;">Pengaturan Match Lokal / Solo</div>
          <div class="form-field">
            <label>Jumlah Pemain:</label>
            <select onchange="window.EFT_APP.updateSetupDraft('playerCount', this.value)">
              <option value="2" ${setupDraft.playerCount === 2 ? "selected" : ""}>2 Pemain</option>
              <option value="3" ${setupDraft.playerCount === 3 ? "selected" : ""}>3 Pemain</option>
              <option value="4" ${setupDraft.playerCount === 4 ? "selected" : ""}>4 Pemain (Standar)</option>
            </select>
          </div>
          ${extraRows}
          <button class="btn btn-emerald setup-action-btn" onclick="window.EFT_APP.startLocalRandomizedMatch()">Acak Urutan &amp; Mulai Match</button>
        </div>`;
    } else {
      tabBodyHtml = `
        <div class="grid-2col setup-mp-cards">
          <div class="panel-box setup-bottom-panel">
            <div class="panel-header" style="margin-bottom:2px;">Buat Room (Host)</div>
            <p style="font-size:0.74rem;color:var(--text-muted);line-height:1.45;margin:0 0 4px;">
              Buat room online untuk bermain bersama teman di luar LAN, atau gunakan WiFi LAN / Multi-Tab untuk tes lokal.
            </p>
            <button class="btn btn-emerald setup-action-btn" onclick="window.EFT_APP.createLobbyRoom('firebase')">Buat Room</button>
            <button class="btn btn-sm setup-sub-btn" onclick="window.EFT_APP.createLobbyRoom('lan')">Buat Room WiFi LAN / Multi-Tab</button>
          </div>
          <div class="panel-box setup-bottom-panel">
            <div class="panel-header" style="margin-bottom:2px;">Gabung Room</div>
            <div class="form-field">
              <label>Kode Room:</label>
              <input type="text" id="setup-join-code" placeholder="EFT456 / LAN123" value="${escapeHtml(mp.roomCode)}" style="text-transform:uppercase;font-weight:800;" />
            </div>
            <button class="btn btn-gold setup-action-btn" onclick="window.EFT_APP.joinLobbyRoom('firebase')">Gabung Room</button>
            <button class="btn btn-sm setup-sub-btn" onclick="window.EFT_APP.joinLobbyRoom('lan')">Gabung WiFi LAN / Multi-Tab</button>
          </div>
        </div>`;
    }

    openInfoModal(
      "Escape From Tartarus",
      `<div class="setup-modal-stack">
        <div class="setup-mode-pills">
          <button type="button" class="setup-mode-pill-btn ${setupDraft.tab === "local" ? "active" : ""}" onclick="window.EFT_APP.switchSetupTab('local')">Main Lokal / Solo</button>
          <button type="button" class="setup-mode-pill-btn ${setupDraft.tab === "multiplayer" ? "active" : ""}" onclick="window.EFT_APP.switchSetupTab('multiplayer')">Multiplayer</button>
        </div>

        <div class="setup-username-inline">
          <label class="setup-username-label" for="setup-username-input">Username:</label>
          <input type="text" id="setup-username-input" class="setup-username-pill-input" maxlength="18" placeholder="" value="${escapeHtml(setupDraft.username)}" oninput="window.EFT_APP.updateSetupDraft('username', this.value)" />
        </div>

        <div class="setup-char-box">
          <div class="setup-char-box-label">Pilih Karakter Kamu:</div>
          <div class="char-picker-grid">
            ${renderSetupCharPickerGrid(compId, setupDraft.charId, {})}
          </div>
        </div>

        ${tabBodyHtml}
      </div>`,
      "welcome_lobby"
    );
  }

  function startLocalRandomizedMatch() {
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      alert("Masukkan Username kamu terlebih dahulu sebelum mulai bermain.");
      const inp = document.getElementById("setup-username-input");
      if (inp) inp.focus();
      return;
    }
    savePlayerProfile(uname, setupDraft.charId);

    const playableIds = getPlayableCharacterIds(setupDraft.compendiumId);
    const freeDefaults = playableIds.filter((cid) => cid !== setupDraft.charId);
    const total = Math.max(2, Math.min(4, setupDraft.playerCount || 4));

    const roster = [
      {
        charId: setupDraft.charId,
        username: uname,
        clientId: mp.clientId,
        isBot: false
      }
    ];

    for (let i = 0; i < total - 1; i++) {
      const ext = setupDraft.extraPlayers[i] || {};
      const cid = playableIds.includes(ext.charId)
        ? ext.charId
        : freeDefaults[i % freeDefaults.length] || playableIds[0];
      const ch = getCharacterForCompendium(cid, setupDraft.compendiumId);
      const extName = (ext.username || "").trim() || `${ch ? ch.name : "Player"} (P${i + 2})`;
      roster.push({
        charId: cid,
        username: extName,
        clientId: null,
        isBot: !ext.username
      });
    }

    closeModal();
    hideMainTitleScreen();
    initGame(setupDraft.patchId, setupDraft.compendiumId, roster, { randomizeOrder: true });
    if (state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
      focusCameraOnPlayer(state.seatMap[mp.clientId]);
    }
  }

  function focusCameraOnPlayer(pIdx) {
    if (!state || !Array.isArray(state.players)) return;
    const p = state.players[pIdx];
    if (!p) return;
    camera.mode = "follow";
    focusCameraOnTile(p.tileId, isMobilePortrait() ? 0.72 : 0.96);
  }

  function openNewMatchSetupModal() {
    openWelcomeSetupModal("local");
  }

  window.EFT_APP = {
    initGame,
    showMainTitleScreen,
    hideMainTitleScreen,
    openTitleSingleplayer,
    openTitleMultiplayer,
    switchTab,
    toggleDrawer,
    handleRollButton,
    handleEndTurnButton,
    handlePrimaryPhaseButton,
    rollMovementDice,
    endCurrentTurn,
    undoLastAction,
    runSmartBotTurn,
    runAutoBotRound,
    onTileClicked,
    onTileHover,
    onHandCardClicked,
    selectHandCard,
    chooseBranchTile,
    confirmShardPurchase,
    confirmRiverShortcut,
    resumeFromMerchantPrompt,
    openPlayCardModal,
    confirmPlayCardFromModal,
    startTileTargetSelection,
    startMoveTileSelection,
    reopenPendingCardModal,
    openMerchantModal,
    buyShopItem,
    openDrawPileModal,
    resetGameToMainMenu,
    resolveVersusDuel,
    executeTradeAction,
    dismissSharedTileModal,
    reopenSharedTileModal,
    openAdminModal,
    submitAdminPassword,
    lockAdminMode,
    toggleAdminFreeSkill,
    openSandboxPlayerModal,
    saveSandboxPlayer,
    sandboxTeleportPlayer,
    sandboxPlaceShardAt,
    sandboxGiveUltimate,
    sandboxDrawCard,
    sandboxRemoveCard,
    sandboxSetActiveTurn,
    changeCompendiumVersion,
    changeRulesPatch,
    renderCompendiumView,
    selectCompendiumCharacter,
    selectCompendiumSkillCard,
    scrollCompendiumStrip,
    updateCompendiumScrollControls,
    renderRulesView,
    resolveStageIsMineChoice,
    resolveForcedAllInChoice,
    rollDiceOfFateCurrent,
    finishDiceOfFateMinigame,
    dismissSkillPopup,
    onTileEffectOverlayClick,
    dismissTileEffectOverlay,
    toggleSoundMute,
    setSoundVolume,
    playSfx,
    onCopySkillSelectChange,
    closeModal,
    showEffectSpotlight,
    openWelcomeSetupModal,
    switchSetupTab,
    selectSetupChar,
    updateSetupDraft,
    updateSetupExtraPlayer,
    startLocalRandomizedMatch,
    openMultiplayerModal,
    createLobbyRoom,
    joinLobbyRoom,
    toggleLobbyReady,
    toggleLobbyFillBots,
    startMultiplayerMatchFromLobby,
    startFirebaseHostRoom,
    joinFirebaseClientRoom,
    saveQuickFirebaseConfig,
    clearQuickFirebaseConfig,
    startOnlineHostRoom,
    joinOnlineClientRoom,
    startLanOrTabRoom,
    disconnectMultiplayer,
    copyInviteLink: () => {
      if (!mp.roomCode) return;
      const baseUrl = window.location.origin + window.location.pathname;
      const inviteUrl = `${baseUrl}?room=${encodeURIComponent(mp.roomCode)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
          alert(`Link Invite berhasil disalin:\n${inviteUrl}\n\nBagikan link ini ke teman Anda!`);
        });
      } else {
        prompt("Salin Link Invite ini untuk teman Anda:", inviteUrl);
      }
    },
    openNewMatchSetupModal,
    setCameraMode,
    focusCameraOnPlayer,
    cancelPendingInteraction: () => {
      if (!canLocalPlayerAct()) return;
      pendingInteraction = null;
      hoveredBranchTileId = null;
      renderAll();
    },
    toggleBoardRenderMode: () => {
      printPreviewMode = !printPreviewMode;
      renderDigitalBoard();
    },
    triggerRandomGlobalEvent: () => {
      if (!isAdminUnlocked) {
        openAdminModal();
        return;
      }
      saveSnapshot();
      const deck = DATA.BOARD_CARDS.globalEvents;
      const card = deck[Math.floor(Math.random() * deck.length)];
      startTileEffectCardShuffle({
        deckKind: "event",
        player: getActivePlayer(),
        tile: { name: "Global Event Deck" },
        card,
        applyFn: (drawnCard) => triggerGlobalEventCard(drawnCard, { showToast: false, deferMinigame: true })
      });
    },
    triggerManualShardSpawn: () => {
      if (!isAdminUnlocked) {
        openAdminModal();
        return;
      }
      saveSnapshot();
      spawnRandomShard(false);
      renderAll();
      broadcastMultiplayerState();
    },
    triggerManualMinigame: () => {
      if (!isAdminUnlocked) {
        openAdminModal();
        return;
      }
      saveSnapshot();
      runClashOfFateMinigame("Manual Minigame");
      renderAll();
      broadcastMultiplayerState();
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    syncAdminUiState();
    syncSoundControlUi();
    setupBoardDragAndZoom();
    initGame("alpha2", "comp_beta1", ["bocchi", "aventurine", "lilith", "joker"]);

    document.addEventListener(
      "pointerdown",
      (ev) => {
        ensureAudioCtx(true);
        const ov = document.getElementById("skill-dramatic-overlay");
        if (ov && ov.classList.contains("visible")) {
          if (!skillPopupShownAt || Date.now() - skillPopupShownAt >= 180) {
            dismissSkillPopup(false);
            playSfx("click");
          }
        }
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const ov = document.getElementById("skill-dramatic-overlay");
        if (ov && ov.classList.contains("visible")) {
          dismissSkillPopup(true);
        }
        if (tileShuffleState && tileShuffleState.phase === "revealed") {
          dismissTileEffectOverlay(true);
        }
      }
    });

    window.addEventListener("resize", () => {
      if (!state) return;
      renderTuckedHandAndDice();
      if (document.getElementById("comp-strip-track")) updateCompendiumScrollControls();
      if (camera.mode === "wide") setCameraMode("wide");
      else if (camera.mode === "follow") focusCameraOnTile(getActivePlayer().tileId);
    });

    runInitialAssetPreload(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get("room");
        if (roomParam) {
          const cleanRoom = roomParam.trim().toUpperCase();
          openWelcomeSetupModal("multiplayer", cleanRoom);
        }
      } catch (e) {}
    });
  });
})();
