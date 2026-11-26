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
      case "mostima":
        // Chronometer Clock crest (Arknights)
        return `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm1-13h-2v6l5.2 3.1 1-1.7-4.2-2.4z"/></svg>`;
      case "arlecchino":
        // Balemoon Crimson X-Cross crest (Genshin Impact)
        return `<svg viewBox="0 0 24 24"><path d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z"/></svg>`;
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
  let sideCardPopupTimerId = null;
  let skillPopupShownAt = 0;
  let pendingEmperorTaxPlay = null;
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
  let lastOpenedScryId = null;
  let lastOpenedHasteId = null;
  let lastMapMoveSfxAt = 0;
  let tileModalMinimizedForId = null;
  let tileModalAutoCloseTimerId = null;
  let lastShownDiceRollEventId = null;
  let lastShownDofRollEventId = null;
  let lastProcessedBoardVfxId = null;
  let lastProcessedSkillMoveAnimId = null;
  let activeBoardVfxList = [];
  let skillMoveAnimOverrides = {};
  let skillMoveAnimTimers = {};
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
      return copiedTurns === 1 ? "1 Turn" : "1 Round";
    }
    if (!state) return "1 Cycle";
    const totalRounds = state.rules && state.rules.turnsPerCycle ? state.rules.turnsPerCycle : 4;
    const curRound = state.roundInCycle || 1;
    const roundsLeft = Math.max(1, totalRounds - curRound + 1);
    return `Cycle ${state.cycle} (${curRound}/${totalRounds} · ${roundsLeft} ${roundsLeft === 1 ? "Round" : "Rounds"} Left)`;
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
  let audioBuses = null;

  function loadSoundPrefs() {
    const defaultChars = { bocchi: true, aventurine: true, joker: true, lilith: true, maomao: true, firefly: true };
    try {
      const raw = localStorage.getItem(SOUND_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === "object") {
          const vol = Number.isFinite(Number(p.volume)) ? Math.max(0, Math.min(1, Number(p.volume))) : 0.45;
          const skillVol = Number.isFinite(Number(p.skillSfxVolume)) ? Math.max(0, Math.min(1, Number(p.skillSfxVolume))) : 0.75;
          const charMap = { ...defaultChars };
          if (p.charSkillSfx && typeof p.charSkillSfx === "object") {
            Object.keys(defaultChars).forEach((cid) => {
              if (typeof p.charSkillSfx[cid] === "boolean") charMap[cid] = p.charSkillSfx[cid];
            });
          }
          return {
            muted: !!p.muted,
            volume: vol,
            turnSfxEnabled: p.turnSfxEnabled !== false,
            skillSfxEnabled: p.skillSfxEnabled !== false,
            screenShakeEnabled: p.screenShakeEnabled !== false,
            skillSfxVolume: skillVol,
            bgmEnabled: p.bgmEnabled !== false,
            bgmVolume: Number.isFinite(Number(p.bgmVolume)) ? Math.max(0, Math.min(1, Number(p.bgmVolume))) : 0.42,
            charSkillSfx: charMap
          };
        }
      }
    } catch (e) {}
    return {
      muted: false,
      volume: 0.45,
      turnSfxEnabled: true,
      skillSfxEnabled: true,
      screenShakeEnabled: true,
      skillSfxVolume: 0.75,
      bgmEnabled: true,
      bgmVolume: 0.42,
      charSkillSfx: defaultChars
    };
  }

  let soundPrefs = loadSoundPrefs();

  function saveSoundPrefs() {
    try {
      localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(soundPrefs));
    } catch (e) {}
  }

  function syncAudioBusGains() {
    if (!audioCtx || !audioBuses) return;
    const now = audioCtx.currentTime;
    const mSlider = soundPrefs.muted ? 0 : Math.max(0, Math.min(1, Number(soundPrefs.volume) || 0));
    // Quadratic slider-to-gain mapping (audio-design Pattern 1: true silence at 0, even perceptual travel)
    const mGain = mSlider <= 0.005 ? 0 : mSlider * mSlider;
    const skSlider = soundPrefs.skillSfxEnabled === false ? 0 : Math.max(0, Math.min(1, Number(soundPrefs.skillSfxVolume ?? 0.75)));
    const skGain = skSlider <= 0.005 ? 0 : skSlider * skSlider;
    const bgmSlider = soundPrefs.bgmEnabled === false ? 0 : Math.max(0, Math.min(1, Number(soundPrefs.bgmVolume ?? 0.42)));
    const bgmGain = bgmSlider <= 0.005 ? 0 : bgmSlider * bgmSlider;
    audioBuses.master.gain.setTargetAtTime(mGain, now, 0.015);
    audioBuses.sfx.gain.setTargetAtTime(0.46, now, 0.015);
    audioBuses.skill.gain.setTargetAtTime(skGain * 0.62, now, 0.015);
    audioBuses.turn.gain.setTargetAtTime(soundPrefs.turnSfxEnabled === false ? 0 : 0.48, now, 0.015);
    audioBuses.ui.gain.setTargetAtTime(0.38, now, 0.015);
    if (audioBuses.bgm) {
      audioBuses.bgm.gain.setTargetAtTime(bgmGain * 0.34, now, 0.08);
    }
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
    if (audioCtx && !audioBuses) {
      try {
        const master = audioCtx.createGain();
        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-6, audioCtx.currentTime);
        limiter.knee.setValueAtTime(12, audioCtx.currentTime);
        limiter.ratio.setValueAtTime(6, audioCtx.currentTime);
        limiter.attack.setValueAtTime(0.003, audioCtx.currentTime);
        limiter.release.setValueAtTime(0.18, audioCtx.currentTime);

        const sfx = audioCtx.createGain();
        const skill = audioCtx.createGain();
        const turn = audioCtx.createGain();
        const ui = audioCtx.createGain();
        const bgm = audioCtx.createGain();

        sfx.connect(limiter);
        skill.connect(limiter);
        turn.connect(limiter);
        ui.connect(limiter);
        bgm.connect(limiter);
        limiter.connect(master);
        master.connect(audioCtx.destination);

        audioBuses = { master, limiter, sfx, skill, turn, ui, bgm };
        syncAudioBusGains();
        ensureAmbientBgmLoop();
      } catch (e) {
        audioBuses = null;
      }
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
    return soundPrefs.volume * soundPrefs.volume * 0.46;
  }

  function getEffectiveSkillSfxGain(charId = "", isPreview = false) {
    if (soundPrefs.muted || soundPrefs.volume <= 0.005) return 0;
    const skillVol = Number.isFinite(Number(soundPrefs.skillSfxVolume)) ? soundPrefs.skillSfxVolume : 0.75;
    if (!isPreview) {
      if (soundPrefs.skillSfxEnabled === false) return 0;
      if (charId && soundPrefs.charSkillSfx && soundPrefs.charSkillSfx[charId] === false) return 0;
    }
    const effectiveVol = isPreview ? Math.max(0.3, skillVol) : skillVol;
    if (effectiveVol <= 0.005) return 0;
    return soundPrefs.volume * soundPrefs.volume * (effectiveVol * effectiveVol) * 0.62;
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
    let isSkillPreview = false;
    let skillCharId = "";
    let skillTheme = "";
    if (type === "skill") {
      const rawVar = String(variant || "");
      isSkillPreview = rawVar.startsWith("preview:");
      const cleanVar = isSkillPreview ? rawVar.slice(8) : rawVar;
      const parts = cleanVar.split(":");
      skillCharId = parts.length === 2 ? parts[0] : "";
      skillTheme = parts.length === 2 ? parts[1] : cleanVar;
    }

    const isTurnPreview = type === "turn_reminder" && String(variant || "").startsWith("preview:");
    if (type === "turn_reminder" && !isTurnPreview && soundPrefs.turnSfxEnabled === false) {
      return;
    }

    const masterLevel =
      type === "skill" ? getEffectiveSkillSfxGain(skillCharId, isSkillPreview) : getEffectiveSfxGain();
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
      turn: 120,
      turn_reminder: 150
    };
    const minGap = isSkillPreview || isTurnPreview ? 20 : debounceWindows[type] || 30;
    if (sfxLastPlayed[type] && nowMs - sfxLastPlayed[type] < minGap) return;
    sfxLastPlayed[type] = nowMs;

    const ctx = ensureAudioCtx(true);
    if (!ctx || ctx.state === "closed") return;

    const t = ctx.currentTime;
    const warmFilter = ctx.createBiquadFilter();
    warmFilter.type = "lowpass";
    warmFilter.frequency.setValueAtTime(type === "skill" ? 4200 : type === "turn_reminder" ? 3400 : 2500, t);
    warmFilter.Q.setValueAtTime(0.55, t);

    // Subtle pitch & gain micro-variation on repetitive SFX (audio-design Pattern 3)
    const varyTypes = new Set(["click", "step", "dice_tick", "coin_gain", "coin_loss"]);
    const gainJitter = varyTypes.has(type) ? 0.88 + Math.random() * 0.24 : 1;
    const pitchJitter = varyTypes.has(type) ? 0.96 + Math.random() * 0.08 : 1;

    const voiceGain = ctx.createGain();
    if (audioBuses && !isSkillPreview && !isTurnPreview) {
      const targetBus =
        type === "skill"
          ? audioBuses.skill
          : type === "turn_reminder" || type === "turn"
          ? audioBuses.turn
          : type === "click" || type === "preview"
          ? audioBuses.ui
          : audioBuses.sfx;
      voiceGain.gain.setValueAtTime(gainJitter, t);
      warmFilter.connect(voiceGain);
      voiceGain.connect(targetBus);
    } else {
      voiceGain.gain.setValueAtTime(masterLevel * gainJitter, t);
      warmFilter.connect(voiceGain);
      voiceGain.connect(audioBuses ? audioBuses.limiter : ctx.destination);
    }

    switch (type) {
      case "click":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 520 * pitchJitter, endFreq: 420 * pitchJitter, duration: 0.045, attack: 0.006, gain: 0.24, type: "sine" });
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
      case "step": {
        const sp = 0.94 + Math.random() * 0.13;
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 270 * sp, endFreq: 175 * sp, duration: 0.055, attack: 0.006, gain: 0.19, type: "triangle" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.008, freq: 520 * sp, endFreq: 340 * sp, duration: 0.032, attack: 0.004, gain: 0.08, type: "sine" });
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 980 * sp, duration: 0.036, gain: 0.06, q: 1.3 });
        break;
      }
      case "map_move": {
        const mpPitch = 0.95 + Math.random() * 0.1;
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 680 * mpPitch, duration: 0.065, gain: 0.048, q: 1.1 });
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 235 * mpPitch, endFreq: 275 * mpPitch, duration: 0.058, attack: 0.014, gain: 0.052, type: "sine" });
        break;
      }
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
      case "card_burn": {
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 920, duration: 0.24, gain: 0.22, q: 0.85 });
        playSoftNoise(ctx, warmFilter, { startTime: t + 0.14, filterType: "highpass", filterFreq: 2100, duration: 0.28, gain: 0.14, q: 0.7 });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.02, freq: 245, endFreq: 112, duration: 0.30, attack: 0.014, gain: 0.22, type: "triangle" });
        break;
      }
      case "card_steal": {
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1950, duration: 0.16, gain: 0.20, q: 1.4 });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.015, freq: 440, endFreq: 784, duration: 0.15, attack: 0.008, gain: 0.22, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.09, freq: 659.25, endFreq: 987.77, duration: 0.16, attack: 0.008, gain: 0.18, type: "triangle" });
        break;
      }
      case "card_drag_ok": {
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1750, duration: 0.08, gain: 0.16, q: 1.0 });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.01, freq: 523.25, endFreq: 698.46, duration: 0.10, attack: 0.008, gain: 0.18, type: "sine" });
        break;
      }
      case "card_drag_deny": {
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 220, endFreq: 148, duration: 0.14, attack: 0.008, gain: 0.20, type: "triangle" });
        break;
      }
      case "turn":
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 329.63, duration: 0.14, attack: 0.016, gain: 0.20, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.075, freq: 440, duration: 0.20, attack: 0.016, gain: 0.22, type: "sine" });
        break;
      case "turn_reminder": {
        const cleanTurnVar = String(variant || "").replace(/^preview:/, "");
        const isMy = cleanTurnVar === "my_turn";
        const notes = isMy ? [523.25, 659.25, 783.99, 1046.5] : [440.0, 587.33];
        notes.forEach((hz, idx) => {
          playSoftTone(ctx, warmFilter, {
            startTime: t + idx * (isMy ? 0.068 : 0.09),
            freq: hz,
            duration: idx === notes.length - 1 ? 0.40 : 0.20,
            attack: 0.01,
            gain: isMy ? 0.34 : 0.28,
            type: idx === notes.length - 1 ? "triangle" : "sine"
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
      case "monster_portal": {
        // Dark Hour ominous midnight bell toll + abyssal tear
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 420, duration: 0.95, gain: 0.26, q: 0.9 });
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 65.41, endFreq: 48.99, duration: 1.5, attack: 0.04, gain: 0.34, type: "triangle" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.12, freq: 130.81, endFreq: 123.47, duration: 1.35, attack: 0.015, gain: 0.28, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.14, freq: 277.18, endFreq: 261.63, duration: 1.15, attack: 0.01, gain: 0.20, type: "triangle" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.52, freq: 523.25, endFreq: 493.88, duration: 0.95, attack: 0.012, gain: 0.15, type: "sine" });
        break;
      }
      case "monster_skill": {
        // Whispering dread chime + hollow sub-drone
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "highpass", filterFreq: 1650, duration: 0.55, gain: 0.14, q: 1.2 });
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 73.42, endFreq: 61.74, duration: 0.95, attack: 0.03, gain: 0.30, type: "triangle" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.08, freq: 311.13, endFreq: 293.66, duration: 0.72, attack: 0.012, gain: 0.20, type: "sine" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.22, freq: 622.25, endFreq: 587.33, duration: 0.65, attack: 0.015, gain: 0.14, type: "sine" });
        break;
      }
      case "move_skill": {
        const mvChar = String(variant || "").toLowerCase();
        if (mvChar === "bocchi") {
          // Rising guitar slide harmonic sweep
          playSoftTone(ctx, warmFilter, { startTime: t, freq: 277.18, endFreq: 554.37, duration: 0.24, attack: 0.01, gain: 0.22, type: "sawtooth" });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.06, freq: 415.3, endFreq: 659.25, duration: 0.24, attack: 0.01, gain: 0.18, type: "triangle" });
        } else if (mvChar === "aventurine") {
          // Golden warp chime + coin zip
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 3200, duration: 0.05, gain: 0.16, q: 2.2 });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.02, freq: 659.25, endFreq: 1318.5, duration: 0.22, attack: 0.008, gain: 0.22, type: "sine" });
        } else if (mvChar === "joker") {
          // Phantom Thief dash whoosh + grappling zip
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "highpass", filterFreq: 1800, duration: 0.11, gain: 0.24, q: 1.2 });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.015, freq: 220, endFreq: 587.33, duration: 0.18, attack: 0.008, gain: 0.20, type: "triangle" });
        } else if (mvChar === "lilith") {
          // Shadow-warp swoosh + eerie descending chime
          playSoftTone(ctx, warmFilter, { startTime: t, freq: 523.25, endFreq: 246.94, duration: 0.26, attack: 0.015, gain: 0.22, type: "sine" });
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1100, duration: 0.12, gain: 0.15, q: 1.4 });
        } else if (mvChar === "maomao") {
          // Herbal breeze whoosh + soft bamboo step
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1650, duration: 0.09, gain: 0.14, q: 1.0 });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.02, freq: 523.25, endFreq: 783.99, duration: 0.19, attack: 0.012, gain: 0.20, type: "sine" });
        } else if (mvChar === "sam") {
          // Heavy mecha thruster jet dash ignition
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1200, duration: 0.22, gain: 0.28, q: 0.8 });
          playSoftTone(ctx, warmFilter, { startTime: t, freq: 110, endFreq: 330, duration: 0.26, attack: 0.01, gain: 0.28, type: "sawtooth" });
        } else if (mvChar === "firefly") {
          // Luminous Stellaron blink shimmer
          playSoftTone(ctx, warmFilter, { startTime: t, freq: 783.99, endFreq: 1174.66, duration: 0.20, attack: 0.008, gain: 0.20, type: "sine" });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.05, freq: 1046.5, endFreq: 1567.98, duration: 0.22, attack: 0.008, gain: 0.16, type: "triangle" });
        } else {
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1700, duration: 0.09, gain: 0.16, q: 1.0 });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.01, freq: 392, endFreq: 659.25, duration: 0.18, attack: 0.01, gain: 0.20, type: "sine" });
        }
        break;
      }
      case "sam_impact": {
        // Fiery SAM comet landing slam + crackle
        playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "lowpass", filterFreq: 1400, duration: 0.28, gain: 0.34, q: 0.7 });
        playSoftTone(ctx, warmFilter, { startTime: t, freq: 165, endFreq: 48, duration: 0.34, attack: 0.006, gain: 0.36, type: "sawtooth" });
        playSoftTone(ctx, warmFilter, { startTime: t + 0.05, freq: 523.25, endFreq: 261.63, duration: 0.24, attack: 0.01, gain: 0.18, type: "triangle" });
        break;
      }
      case "skill": {
        const charId = skillCharId;
        const theme = skillTheme;
        const isUlt = theme === "ultimate";

        if (charId === "bocchi") {
          // Crisp plucked electric/acoustic guitar power-chord strum
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 2600, duration: 0.032, gain: 0.14, q: 1.5 });
          const strings = isUlt
            ? [329.63, 415.30, 493.88, 659.25, 830.61]
            : [277.18, 329.63, 415.30, 554.37];
          strings.forEach((hz, idx) => {
            const st = t + idx * 0.034;
            playSoftTone(ctx, warmFilter, {
              startTime: st,
              freq: hz,
              endFreq: hz * 0.996,
              duration: isUlt ? 0.60 : 0.44,
              attack: 0.006,
              gain: isUlt ? 0.24 : 0.20,
              type: "sawtooth"
            });
            playSoftTone(ctx, warmFilter, {
              startTime: st,
              freq: hz * 2,
              duration: isUlt ? 0.34 : 0.24,
              attack: 0.005,
              gain: 0.08,
              type: "triangle"
            });
          });
        } else if (charId === "aventurine") {
          // Crisp poker chip clink + sparkling golden casino coin cascade
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 3100, duration: 0.034, gain: 0.22, q: 2.8 });
          playSoftNoise(ctx, warmFilter, { startTime: t + 0.048, filterType: "bandpass", filterFreq: 3600, duration: 0.028, gain: 0.18, q: 3.0 });
          const notes = isUlt
            ? [587.33, 739.99, 880.00, 1174.66, 1479.98]
            : [587.33, 739.99, 987.77, 1174.66];
          notes.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + 0.025 + idx * 0.052,
              freq: hz,
              duration: isUlt ? 0.50 : 0.34,
              attack: 0.008,
              gain: isUlt ? 0.27 : 0.23,
              type: idx % 2 === 0 ? "sine" : "triangle"
            });
          });
        } else if (charId === "joker") {
          // Stylish Phantom Thief finger-snap + sleek acid-jazz Rhodes minor-9th hit
          playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "highpass", filterFreq: 2200, duration: 0.034, gain: 0.24, q: 1.6 });
          playSoftTone(ctx, warmFilter, { startTime: t + 0.01, freq: 146.83, endFreq: 110.0, duration: 0.22, attack: 0.008, gain: 0.24, type: "triangle" });
          const jazz = isUlt
            ? [293.66, 349.23, 440.00, 523.25, 659.25, 880.0]
            : [293.66, 349.23, 440.00, 523.25, 659.25];
          jazz.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + 0.032 + idx * 0.034,
              freq: hz,
              duration: isUlt ? 0.58 : 0.42,
              attack: 0.012,
              gain: isUlt ? 0.24 : 0.20,
              type: idx === 0 ? "triangle" : "sine"
            });
          });
        } else if (charId === "lilith") {
          // Haunting dark music-box celesta + velvet abyss sub-pad
          playSoftTone(ctx, warmFilter, { startTime: t, freq: 196.0, endFreq: 164.81, duration: isUlt ? 0.72 : 0.52, attack: 0.035, gain: 0.24, type: "sine" });
          const box = isUlt
            ? [783.99, 698.46, 622.25, 523.25, 392.00]
            : [698.46, 622.25, 523.25, 466.16];
          box.forEach((hz, idx) => {
            const st = t + idx * 0.072;
            playSoftTone(ctx, warmFilter, {
              startTime: st,
              freq: hz,
              duration: 0.42,
              attack: 0.008,
              gain: 0.24,
              type: "sine"
            });
            playSoftTone(ctx, warmFilter, {
              startTime: st,
              freq: hz * 2,
              duration: 0.18,
              attack: 0.006,
              gain: 0.09,
              type: "triangle"
            });
          });
        } else if (charId === "maomao") {
          // Serene apothecary herbal chime + pentatonic bamboo flute trill
          const notes = isUlt
            ? [523.25, 587.33, 659.25, 783.99, 1046.5]
            : [523.25, 659.25, 783.99, 880.0];
          notes.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + idx * 0.055,
              freq: hz,
              duration: isUlt ? 0.50 : 0.36,
              attack: 0.012,
              gain: isUlt ? 0.24 : 0.20,
              type: "sine"
            });
          });
        } else if (charId === "firefly") {
          // Crystalline Stellaron shimmer + fiery SAM combustion pulse
          if (isUlt) {
            playSoftNoise(ctx, warmFilter, { startTime: t, filterType: "bandpass", filterFreq: 1600, duration: 0.14, gain: 0.24, q: 1.0 });
            playSoftTone(ctx, warmFilter, { startTime: t, freq: 130.81, endFreq: 261.63, duration: 0.45, attack: 0.015, gain: 0.26, type: "sawtooth" });
          }
          const notes = isUlt
            ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
            : [659.25, 830.61, 987.77, 1318.5];
          notes.forEach((hz, idx) => {
            playSoftTone(ctx, warmFilter, {
              startTime: t + 0.02 + idx * 0.044,
              freq: hz,
              duration: isUlt ? 0.52 : 0.36,
              attack: 0.008,
              gain: isUlt ? 0.24 : 0.20,
              type: idx % 2 === 0 ? "triangle" : "sine"
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
              attack: 0.025,
              gain: isUlt ? 0.26 : 0.22,
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
      btn.title = isEffectivelyMuted ? "Unmute Sound Effects" : "Mute Sound Effects";
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
    const mixerBtn = document.getElementById("btn-audio-mixer");
    const shakeToggle = document.getElementById("screen-shake-toggle");
    const turnToggle = document.getElementById("turn-sfx-toggle");
    const skillToggle = document.getElementById("skill-sfx-toggle");
    const skillSlider = document.getElementById("skill-sfx-volume-slider");
    const skillLabel = document.getElementById("skill-sfx-volume-label");
    const skillPct = Math.round((soundPrefs.skillSfxVolume !== undefined ? soundPrefs.skillSfxVolume : 0.75) * 100);
    const skillActive = !isEffectivelyMuted && soundPrefs.skillSfxEnabled !== false && skillPct > 0;

    if (mixerBtn) mixerBtn.classList.toggle("is-off", !skillActive && soundPrefs.turnSfxEnabled === false);
    if (shakeToggle) shakeToggle.checked = soundPrefs.screenShakeEnabled !== false;
    if (turnToggle) turnToggle.checked = soundPrefs.turnSfxEnabled !== false;
    if (skillToggle) skillToggle.checked = soundPrefs.skillSfxEnabled !== false;
    if (skillSlider) skillSlider.value = String(skillPct);
    if (skillLabel) skillLabel.textContent = soundPrefs.skillSfxEnabled === false ? "Off" : `${skillPct}%`;
    const bgmToggle = document.getElementById("bgm-toggle");
    const bgmSlider = document.getElementById("bgm-volume-slider");
    const bgmLabel = document.getElementById("bgm-volume-label");
    const bgmPct = Math.round((soundPrefs.bgmVolume !== undefined ? soundPrefs.bgmVolume : 0.42) * 100);
    if (bgmToggle) bgmToggle.checked = soundPrefs.bgmEnabled !== false;
    if (bgmSlider) bgmSlider.value = String(bgmPct);
    if (bgmLabel) bgmLabel.textContent = soundPrefs.bgmEnabled === false ? "Off" : `${bgmPct}%`;
    syncAudioBusGains();
  }

  let ambientBgmIntervalId = null;
  let ambientBgmStepIdx = 0;

  function playAmbientBgmPhrase() {
    if (!audioCtx || !audioBuses || !audioBuses.bgm || audioCtx.state !== "running") return;
    if (!state || !isMatchStarted || isTitleScreenVisible || state.winner) return;
    if (soundPrefs.muted || soundPrefs.bgmEnabled === false || (soundPrefs.bgmVolume ?? 0.42) <= 0.005) return;

    const cycleNum = Math.max(1, Number(state.cycle) || 1);
    const isNight = cycleNum % 2 === 0;
    const cycleVariant = Math.floor((cycleNum - 1) / 2) % 3;
    const transpose = [1.0, 1.05946, 0.94387][cycleVariant]; // subtle harmonic shift each Day/Night pair

    // Odd Cycles (DAY): warm sunlit Lydian/Major chords; Even Cycles (NIGHT): serene nocturnal Dorian/Minor chords
    const dayChords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [293.66, 369.99, 440.0, 523.25], // D6/9 shimmer
      [246.94, 329.63, 392.0, 493.88], // Em7
      [220.0, 261.63, 329.63, 392.0]   // Am7
    ];
    const nightChords = [
      [196.0, 233.08, 293.66, 349.23], // Gm7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [146.83, 174.61, 220.0, 293.66], // Dm9
      [164.81, 220.0, 246.94, 329.63]  // Asus4/E
    ];

    const palette = isNight ? nightChords : dayChords;
    const chord = palette[ambientBgmStepIdx % palette.length];
    ambientBgmStepIdx++;

    const now = audioCtx.currentTime;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isNight ? 820 : 1420, now);
    filter.Q.setValueAtTime(0.6, now);
    filter.connect(audioBuses.bgm);

    // Warm soft pad chord
    chord.forEach((baseHz, i) => {
      const hz = baseHz * transpose;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = isNight ? "sine" : i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(hz, now);
      const peak = (isNight ? 0.095 : 0.082) / (1 + i * 0.25);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.55 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.15);
      osc.connect(g);
      g.connect(filter);
      osc.start(now + i * 0.06);
      osc.stop(now + 3.25);
    });

    // Gentle melodic arpeggio droplet (soft harp for Day, distant celesta chime for Night)
    const melodyNote = chord[(ambientBgmStepIdx + 1) % chord.length] * transpose * 2;
    const mOsc = audioCtx.createOscillator();
    const mGain = audioCtx.createGain();
    mOsc.type = "sine";
    mOsc.frequency.setValueAtTime(melodyNote, now + 0.85);
    mGain.gain.setValueAtTime(0.0001, now + 0.85);
    mGain.gain.linearRampToValueAtTime(isNight ? 0.048 : 0.056, now + 0.96);
    mGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);
    mOsc.connect(mGain);
    mGain.connect(filter);
    mOsc.start(now + 0.85);
    mOsc.stop(now + 2.45);
  }

  function ensureAmbientBgmLoop() {
    if (ambientBgmIntervalId) return;
    ambientBgmIntervalId = setInterval(() => {
      playAmbientBgmPhrase();
    }, 2800);
    setTimeout(() => playAmbientBgmPhrase(), 400);
  }

  function toggleBgm(enabled) {
    soundPrefs.bgmEnabled = !!enabled;
    saveSoundPrefs();
    syncSoundControlUi();
    if (soundPrefs.bgmEnabled) {
      ensureAudioCtx(true);
      ensureAmbientBgmLoop();
      playAmbientBgmPhrase();
    }
  }

  function setBgmVolume(valPct) {
    const num = Math.max(0, Math.min(100, Number(valPct) || 0));
    soundPrefs.bgmVolume = num / 100;
    if (num > 0 && soundPrefs.bgmEnabled === false) soundPrefs.bgmEnabled = true;
    saveSoundPrefs();
    syncSoundControlUi();
    ensureAudioCtx(true);
    ensureAmbientBgmLoop();
  }

  function toggleScreenShake(enabled) {
    soundPrefs.screenShakeEnabled = !!enabled;
    saveSoundPrefs();
    syncSoundControlUi();
    if (soundPrefs.screenShakeEnabled) {
      addCameraTrauma(0.32);
    }
  }

  function toggleAudioMixerPopover() {
    const pop = document.getElementById("audio-mixer-popover");
    if (!pop) return;
    pop.classList.toggle("open");
    playSfx("click");
  }

  function toggleTurnSfx(enabled) {
    soundPrefs.turnSfxEnabled = !!enabled;
    saveSoundPrefs();
    syncSoundControlUi();
    if (soundPrefs.turnSfxEnabled) playSfx("turn_reminder", "preview:my_turn");
  }

  function toggleSkillSfx(enabled) {
    soundPrefs.skillSfxEnabled = !!enabled;
    saveSoundPrefs();
    syncSoundControlUi();
    if (soundPrefs.skillSfxEnabled) playSfx("skill", "preview:bocchi:sonic");
  }

  function setSkillSfxVolume(valPct) {
    const clamped = Math.max(0, Math.min(100, Number(valPct) || 0));
    soundPrefs.skillSfxVolume = clamped / 100;
    if (clamped > 0 && soundPrefs.skillSfxEnabled === false) soundPrefs.skillSfxEnabled = true;
    saveSoundPrefs();
    syncSoundControlUi();
    if (clamped > 0) playSfx("skill", "preview:aventurine:fortune");
  }

  function toggleCharacterSkillSfx(charId, enabled) {
    if (!soundPrefs.charSkillSfx || typeof soundPrefs.charSkillSfx !== "object") {
      soundPrefs.charSkillSfx = { bocchi: true, aventurine: true, joker: true, lilith: true, maomao: true, firefly: true };
    }
    soundPrefs.charSkillSfx[charId] = !!enabled;
    saveSoundPrefs();
    syncSoundControlUi();
    if (enabled) playSfx("skill", `preview:${charId}:sonic`);
  }

  function previewCharacterSkillSfx(charId) {
    if (soundPrefs.muted || soundPrefs.volume <= 0.005) {
      soundPrefs.muted = false;
      if (soundPrefs.volume <= 0.005) soundPrefs.volume = 0.45;
      saveSoundPrefs();
      syncSoundControlUi();
    }
    playSfx("skill", `preview:${charId}:sonic`);
  }

  function previewTurnChangeSfx() {
    if (soundPrefs.muted || soundPrefs.volume <= 0.005) {
      soundPrefs.muted = false;
      if (soundPrefs.volume <= 0.005) soundPrefs.volume = 0.45;
      saveSoundPrefs();
      syncSoundControlUi();
    }
    playSfx("turn_reminder", "preview:my_turn");
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

    if (/^(Match initialized|Undo:|Turn Order|Urutan Giliran|Admin Mode|Admin Free Skill|Connected|Firebase Lobby|Lobby|PeerJS|Room )/i.test(raw)) {
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
      return { text: `... ${m[1]} gained +${m[2]} TC`, kind: "gain" };
    }
    if ((m = raw.match(/^(.+?) lost (-?\d+) TC/i))) {
      return { text: `... ${m[1]} lost ${Math.abs(Number(m[2]))} TC`, kind: "loss" };
    }
    if ((m = raw.match(/^IPC Gems \([^)]+\): (.+?) (?:gained|memperoleh) \+(\d+) TC/i))) {
      return { text: `... ${m[1]} +${m[2]} TC (IPC Gems)`, kind: "gain" };
    }
    if ((m = raw.match(/^The Emperor's Favor: (.+?) paid (\d+) TC tax to (.+?)\.?$/i))) {
      return { text: `... ${m[1]} paid ${m[2]} TC tax to ${m[3]}`, kind: "loss" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) ([+\-]?\d+) TC/i))) {
      const val = Number(m[3]);
      return val >= 0
        ? { text: `... ${m[2]} gained +${val} TC (${m[1]})`, kind: "gain" }
        : { text: `... ${m[2]} lost ${Math.abs(val)} TC (${m[1]})`, kind: "loss" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) drew (\d+) card/i))) {
      return { text: `... ${m[2]} drew +${m[3]} card${Number(m[3]) === 1 ? "" : "s"} (${m[1]})`, kind: "gain" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) discarded (\d+) card/i))) {
      return { text: `... ${m[2]} discarded ${m[3]} card${Number(m[3]) === 1 ? "" : "s"} (${m[1]})`, kind: "loss" };
    }
    if ((m = raw.match(/^Board Card \[(.+?)\]: (.+?) ([+\-]?\d+) die/i))) {
      return { text: `... ${m[2]} ${m[3]} dice next turn (${m[1]})`, kind: Number(m[3]) >= 0 ? "gain" : "loss" };
    }
    if ((m = raw.match(/^(.+?) rolled \[(.+?)\] -> Moving (backward )?(\d+) steps/i))) {
      return { text: `... ${m[1]} rolled ${m[4]} steps${m[3] ? " (backward)" : ""}`, kind: "move" };
    }
    if ((m = raw.match(/^\[The Stage Is Mine\]: (.+?) (?:moved|pindah) ([+-]\d+ tiles?) (?:to|ke) \[([^:\]]+)/i))) {
      return { text: `... ${m[1]} moved ${m[2]} (${m[3]})`, kind: "move" };
    }
    if ((m = raw.match(/^\[The Stage Is Mine\]: (.+?) (?:moved to|berpindah ke) \[([^:\]]+)/i))) {
      return { text: `... ${m[1]} moved to ${m[2]} (Stage)`, kind: "move" };
    }
    if ((m = raw.match(/^(.+?) purchased Tartarus Shard at Zone ([IVX]+)/i))) {
      return { text: `... ${m[1]} bought Shard Zone ${m[2]}`, kind: "shard" };
    }
    if ((m = raw.match(/^Shard d6 rolled \[\d+\] -> Tartarus Shard spawned at Zone ([IVX]+) \((T\d+)\)/i))) {
      return { text: `... New Shard at Zone ${m[1]} (${m[2]})`, kind: "shard" };
    }
    if ((m = raw.match(/^(.+?) drew \+(\d+) card/i))) {
      return { text: `... ${m[1]} drew +${m[2]} card${Number(m[2]) === 1 ? "" : "s"}`, kind: "gain" };
    }
    if ((m = raw.match(/^(.+?) discarded (\d+) card/i))) {
      return { text: `... ${m[1]} discarded ${m[2]} card${Number(m[2]) === 1 ? "" : "s"}`, kind: "loss" };
    }
    if ((m = raw.match(/^GLOBAL EVENT: \[(.+?)\]/i))) {
      return { text: `... Event: ${m[1]}`, kind: "skill" };
    }
    if ((m = raw.match(/^Versus: (.+?) defeated (.+?) \(\+(\d+) TC\)/i))) {
      return { text: `... ${m[1]} won Duel (+${m[3]} TC)`, kind: "gain" };
    }
    if ((m = raw.match(/^Versus \(([^)]+)\): (.+?) (?:defeated|mengalahkan) (.+?) & (?:claimed|merebut) .*?(\d+) TC/i))) {
      return { text: `... ${m[2]} won ${m[1]} (+${m[4]} TC)`, kind: "gain" };
    }
    if ((m = raw.match(/^Minigame ([^(:]+)(?:\([^)]+\))?: (.+)$/i))) {
      const shortRes = m[2].length > 52 ? m[2].slice(0, 49) + "..." : m[2];
      return { text: `... ${m[1].trim()}: ${shortRes}`, kind: "skill" };
    }
    if ((m = raw.match(/^Awaken, Arsene!: (.+?) (?:landed|gained|mendapat).*?\+1/i))) {
      return { text: `... ${m[1]} +1 extra die (Arsene)`, kind: "skill" };
    }
    if ((m = raw.match(/^\[([^\]]+)\]: (.+)$/))) {
      const cleaned = m[2]
        .replace(/\s+TC\b/g, " coin")
        .replace(/\[(T\d+):[^\]]+\]/g, "$1")
        .replace(/!$/, "");
      const line = `${cleaned} (${m[1]})`;
      const trimmed = line.length > 68 ? line.slice(0, 65) + "..." : line;
      let kind = "skill";
      if (/lost|paid|discard|destroy|backward|kehilangan|membayar|membuang|hancur|mundur|-\d+/i.test(line)) kind = "loss";
      else if (/moved|jumped|swapped|pushed|pulled|pindah|bergerak|melompat|bertukar/i.test(line)) kind = "move";
      else if (/stole|gained|mencuri|\+\d+/i.test(line)) kind = "gain";
      return { text: `... ${trimmed}`, kind };
    }

    let cleaned = raw
      .replace(/\s+TC\b/g, " coin")
      .replace(/\[(T\d+):[^\]]+\]/g, "$1");
    if (cleaned.length > 68) cleaned = cleaned.slice(0, 65) + "...";

    let kind = "neutral";
    if (/Shard|VICTORY/i.test(cleaned)) kind = "shard";
    else if (/lost|discard|trap|virus|Fire|kehilangan|buang|-15|-5|-\d+/i.test(cleaned)) kind = "loss";
    else if (/\+\d+|gained|Herbs|Minigame/i.test(cleaned)) kind = "gain";
    else if (/moved|teleport|River|Warp|pindah/i.test(cleaned)) kind = "move";
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
      { username: "", charId: "aventurine", controlType: "bot" },
      { username: "", charId: "joker", controlType: "bot" },
      { username: "", charId: "lilith", controlType: "bot" }
    ]
  };

  // Camera state: "follow" zooms & tracks active player; "free" when user drags
  const camera = {
    mode: "follow", // "follow" | "free"
    zoom: 0.96,
    panX: 0,
    panY: 0,
    shakeX: 0,
    shakeY: 0,
    shakeRot: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginPanX: 0,
    dragOriginPanY: 0,
    movedDuringDrag: false
  };

  // ============================================================================
  // GAME FEEL ENGINE (Trauma Screen Shake + Overlapping-Safe Hit-Stop)
  // ============================================================================
  const gameFeel = {
    trauma: 0,
    t: 0,
    rafId: null,
    lastTime: 0,
    hitStopId: 0
  };

  function isScreenShakeAllowed() {
    if (soundPrefs && soundPrefs.screenShakeEnabled === false) return false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  }

  function stepCameraShake(now) {
    gameFeel.rafId = null;
    if (!gameFeel.lastTime) gameFeel.lastTime = now;
    const realDt = Math.min(0.05, Math.max(0.001, (now - gameFeel.lastTime) / 1000));
    gameFeel.lastTime = now;

    if (gameFeel.trauma <= 0 || !isScreenShakeAllowed()) {
      gameFeel.trauma = 0;
      camera.shakeX = 0;
      camera.shakeY = 0;
      camera.shakeRot = 0;
      applyCameraTransform();
      return;
    }

    gameFeel.trauma = Math.max(0, gameFeel.trauma - 2.8 * realDt);
    const shake = gameFeel.trauma * gameFeel.trauma;
    gameFeel.t += realDt * 38;
    // Summed sines at unrelated rates (smooth 2D GPU-composited shake without rotate re-rasterization)
    camera.shakeX = 11 * shake * Math.sin(gameFeel.t * 1.7);
    camera.shakeY = 8 * shake * Math.sin(gameFeel.t * 2.3);
    camera.shakeRot = 0;
    applyCameraTransform();

    if (gameFeel.trauma > 0) {
      gameFeel.rafId = requestAnimationFrame(stepCameraShake);
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
      camera.shakeRot = 0;
      applyCameraTransform();
    }
  }

  function addCameraTrauma(amount) {
    if (!isScreenShakeAllowed()) return;
    gameFeel.trauma = Math.min(1, gameFeel.trauma + Math.max(0, Number(amount) || 0));
    if (!gameFeel.rafId) {
      gameFeel.lastTime = performance.now();
      gameFeel.rafId = requestAnimationFrame(stepCameraShake);
    }
  }

  function triggerHitStop(durationMs = 55) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const clamped = Math.max(25, Math.min(120, Number(durationMs) || 55));
    const myId = ++gameFeel.hitStopId;
    if (window.EFT_WEBGL_VFX) window.EFT_WEBGL_VFX.setHitStopActive(true);
    setTimeout(() => {
      if (myId === gameFeel.hitStopId && window.EFT_WEBGL_VFX) {
        window.EFT_WEBGL_VFX.setHitStopActive(false);
      }
    }, clamped);
  }

  function triggerGameFeedback(tier = "small", opts = {}) {
    const t = String(tier || "small");
    if (t === "large") {
      addCameraTrauma(0.76);
      triggerHitStop(95);
    } else if (t === "medium") {
      addCameraTrauma(0.38);
      triggerHitStop(48);
    } else {
      addCameraTrauma(0.14);
    }
    if (opts.tileId && window.EFT_WEBGL_VFX) {
      window.EFT_WEBGL_VFX.burstAtTile(opts.tileId, opts.vfxKind || "skill_cast", opts.color || null);
    }
  }

  function applyCameraTransform() {
    const surface = document.getElementById("map-canvas-wrap");
    if (!surface) return;
    surface.classList.toggle("is-shaking", gameFeel.trauma > 0);
    const tx = camera.panX + (camera.shakeX || 0);
    const ty = camera.panY + (camera.shakeY || 0);
    surface.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${camera.zoom.toFixed(3)})`;

    const followBtn = document.getElementById("btn-cam-follow");
    if (followBtn) {
      followBtn.classList.toggle("active-cam", camera.mode === "follow");
    }
  }

  function isMobileLandscape() {
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return (
      window.innerWidth > window.innerHeight &&
      (window.innerHeight <= 560 || (window.innerWidth <= 960 && coarse))
    );
  }

  function isMobilePortrait() {
    return window.innerWidth <= 820 && window.innerHeight >= window.innerWidth;
  }

  function requestMobileLandscapeFullscreen() {
    const hint = document.getElementById("mlg-status-hint");
    const docEl = document.documentElement;
    const reqFs =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    const lockOrientation = () => {
      try {
        if (screen.orientation && typeof screen.orientation.lock === "function") {
          screen.orientation.lock("landscape").catch(() => {
            if (hint) {
              hint.innerHTML =
                "This browser requires manual rotation. <strong>Rotate your phone</strong> to landscape mode now.";
            }
          });
        } else if (hint) {
          hint.innerHTML =
            "Rotate your phone horizontally &amp; make sure <strong>Auto-Rotate</strong> is enabled.";
        }
      } catch (e) {
        if (hint) {
          hint.innerHTML =
            "Rotate your phone horizontally &amp; make sure <strong>Auto-Rotate</strong> is enabled.";
        }
      }
    };

    if (reqFs) {
      try {
        const res = reqFs.call(docEl);
        if (res && typeof res.then === "function") {
          res.then(lockOrientation).catch(lockOrientation);
        } else {
          lockOrientation();
        }
      } catch (e) {
        lockOrientation();
      }
    } else {
      lockOrientation();
    }
  }

  function toggleMobileFullscreen() {
    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement
    );
    if (isFs) {
      const exitFs =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen;
      if (exitFs) {
        try {
          exitFs.call(document);
        } catch (e) {}
      }
      return;
    }
    requestMobileLandscapeFullscreen();
  }

  function focusCameraOnTile(tileId, customZoom = null) {
    const t = TILE_MAP[tileId];
    if (!t) return;
    const mobileLand = isMobileLandscape();
    const mobilePort = isMobilePortrait();
    const defaultFollowZoom = mobileLand ? 0.58 : mobilePort ? 0.72 : 0.96;
    if (customZoom !== null) {
      camera.zoom = mobileLand ? Math.min(customZoom, 0.68) : customZoom;
    } else if (camera.zoom < (mobileLand ? 0.42 : mobilePort ? 0.54 : 0.74)) {
      camera.zoom = defaultFollowZoom;
    }
    const offsetFromCenterX = ((50 - t.x) / 100) * BOARD_W;
    const offsetFromCenterY = ((50 - t.y) / 100) * BOARD_H;
    camera.panX = offsetFromCenterX * camera.zoom;
    camera.panY = offsetFromCenterY * camera.zoom + (mobileLand ? -16 : mobilePort ? 10 : -36);
    applyCameraTransform();
  }

  function focusCameraOnTileGroup(tileIds = [], anchorTileId = null) {
    const uniqueIds = new Set(Array.isArray(tileIds) ? tileIds : []);
    if (anchorTileId && TILE_MAP[anchorTileId]) uniqueIds.add(anchorTileId);
    const tiles = Array.from(uniqueIds)
      .map((tid) => TILE_MAP[tid])
      .filter(Boolean);
    const mobileLand = isMobileLandscape();
    const mobilePort = isMobilePortrait();
    if (tiles.length === 0) {
      if (anchorTileId) focusCameraOnTile(anchorTileId, mobileLand ? 0.46 : mobilePort ? 0.52 : 0.76);
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    tiles.forEach((t) => {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    });

    const spanPxX = Math.max(240, ((maxX - minX) / 100) * BOARD_W + 240);
    const spanPxY = Math.max(240, ((maxY - minY) / 100) * BOARD_H + 240);
    const availW = Math.max(220, window.innerWidth - (mobileLand ? 360 : mobilePort ? 28 : 260));
    const availH = Math.max(180, window.innerHeight - (mobileLand ? 116 : mobilePort ? 270 : 210));
    const minWideZoom = mobileLand
      ? Math.max(0.13, Math.min(0.30, Math.min(availW / BOARD_W, availH / BOARD_H)))
      : mobilePort
      ? Math.max(0.16, Math.min(0.36, (window.innerWidth - 16) / BOARD_W))
      : Math.max(0.24, Math.min(0.46, (window.innerWidth - 220) / BOARD_W));
    const maxFocusZoom = mobileLand ? 0.56 : mobilePort ? 0.64 : 0.86;
    const fitZoom = Math.min(availW / spanPxX, availH / spanPxY);
    const targetZoom = Math.max(minWideZoom, Math.min(maxFocusZoom, fitZoom));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    camera.mode = "free";
    camera.zoom = targetZoom;
    camera.panX = ((50 - centerX) / 100) * BOARD_W * targetZoom;
    camera.panY = ((50 - centerY) / 100) * BOARD_H * targetZoom + (mobileLand ? -14 : mobilePort ? 12 : -24);
    applyCameraTransform();
  }

  function setCameraMode(mode) {
    camera.mode = mode === "free" ? "free" : "follow";
    const mobileLand = isMobileLandscape();
    const mobilePort = isMobilePortrait();
    if (camera.mode === "follow" && state) {
      const p = getActivePlayer();
      const followZoom = mobileLand ? 0.58 : mobilePort ? 0.72 : 0.96;
      camera.zoom = followZoom;
      focusCameraOnTile(p.tileId, followZoom);
    } else {
      applyCameraTransform();
    }
  }

  function setupBoardDragAndZoom() {
    const viewport = document.getElementById("board-viewport");
    const surface = document.getElementById("map-canvas-wrap");
    if (!viewport || !surface) return;

    let dragSfxAccumX = 0;
    let dragSfxAccumY = 0;
    const maybePlaySoftMapMoveSfx = () => {
      const now = Date.now();
      if (now - lastMapMoveSfxAt >= 260) {
        lastMapMoveSfxAt = now;
        playSfx("map_move");
      }
    };

    viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      camera.isDragging = true;
      camera.movedDuringDrag = false;
      camera.dragStartX = e.clientX;
      camera.dragStartY = e.clientY;
      dragSfxAccumX = e.clientX;
      dragSfxAccumY = e.clientY;
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
      if (Math.hypot(e.clientX - dragSfxAccumX, e.clientY - dragSfxAccumY) >= 135) {
        dragSfxAccumX = e.clientX;
        dragSfxAccumY = e.clientY;
        maybePlaySoftMapMoveSfx();
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
        camera.mode = "free";
        applyCameraTransform();
      },
      { passive: false }
    );
  }

  function loadOrCreatePersistentClientId() {
    const key = "eft_persistent_client_id";
    try {
      const existing = localStorage.getItem(key);
      if (existing && /^cli_[a-z0-9]{6,20}$/i.test(existing)) return existing;
      const fresh = "cli_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(key, fresh);
      return fresh;
    } catch (e) {
      return "cli_" + Math.random().toString(36).slice(2, 10);
    }
  }

  // Multiplayer state (Online Firebase Realtime Database)
  const mp = {
    mode: "local", // "local" | "firebase_host" | "firebase_client"
    roomCode: "",
    mySeat: -1,
    clientId: loadOrCreatePersistentClientId(),
    fbDb: null,
    fbRoomRef: null,
    fbActionsRef: null,
    fbSeatsRef: null,
    fbConnRef: null,
    fbStateListener: null,
    fbActionListener: null,
    fbSeatsListener: null,
    fbConnListener: null,
    isConnected: false,
    onlineSeats: {},
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

  // ============================================================================
  // PERSISTENCE, MULTIPLAYER RECONNECT & LOCAL AUTOSAVE (save-systems v1)
  // ============================================================================
  const SAVE_SCHEMA_VERSION = 1;
  const MP_SESSION_KEY = "eft_mp_session_v1";
  const LOCAL_SAVE_KEY = "eft_local_autosave_v1";
  const LOCAL_SAVE_BAK_KEY = "eft_local_autosave_v1_bak";
  let localAutosaveTimerId = null;
  let lastAutosaveBackupTurn = -1;

  function updateMpConnectionPill(statusKind = "hidden", text = "") {
    const el = document.getElementById("mp-conn-pill");
    if (!el) return;
    if (statusKind === "hidden" || !text) {
      el.className = "mp-conn-pill";
      el.textContent = "";
      return;
    }
    el.className = `mp-conn-pill visible is-${statusKind}`;
    el.textContent = text;
  }

  function saveActiveMpSession(role, code) {
    if (!code) return;
    try {
      localStorage.setItem(
        MP_SESSION_KEY,
        JSON.stringify({
          version: SAVE_SCHEMA_VERSION,
          role,
          roomCode: String(code).toUpperCase(),
          username: (setupDraft.username || "").trim() || "Player",
          charId: setupDraft.charId || "bocchi",
          clientId: mp.clientId,
          savedAt: Date.now()
        })
      );
    } catch (e) {}
  }

  function loadActiveMpSession() {
    try {
      const raw = localStorage.getItem(MP_SESSION_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.version !== SAVE_SCHEMA_VERSION || !d.roomCode) return null;
      if (Date.now() - (d.savedAt || 0) > 6 * 60 * 60 * 1000) {
        localStorage.removeItem(MP_SESSION_KEY);
        return null;
      }
      return d;
    } catch (e) {
      return null;
    }
  }

  function clearActiveMpSession() {
    try {
      localStorage.removeItem(MP_SESSION_KEY);
    } catch (e) {}
  }

  function flushLocalMatchAutosave() {
    if (!state || state.winner || !isMatchStarted || isInitializingMatch || mp.mode !== "local") return;
    if (isWalkingAnim || isTileEffectAnimating || diceAnimIntervalId) {
      scheduleLocalMatchAutosave();
      return;
    }
    try {
      const turnNum = state.totalTurnsCompleted || 0;
      if (turnNum !== lastAutosaveBackupTurn) {
        const prev = localStorage.getItem(LOCAL_SAVE_KEY);
        if (prev) localStorage.setItem(LOCAL_SAVE_BAK_KEY, prev);
        lastAutosaveBackupTurn = turnNum;
      }
      const trimmedState = {
        ...state,
        logs: Array.isArray(state.logs) ? state.logs.slice(-20) : []
      };
      const payload = {
        version: SAVE_SCHEMA_VERSION,
        savedAt: Date.now(),
        state: trimmedState,
        pending: serializePendingInteraction()
      };
      localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function scheduleLocalMatchAutosave() {
    if (!state || state.winner || !isMatchStarted || isInitializingMatch || mp.mode !== "local") return;
    if (localAutosaveTimerId) {
      clearTimeout(localAutosaveTimerId);
    }
    localAutosaveTimerId = setTimeout(() => {
      localAutosaveTimerId = null;
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(flushLocalMatchAutosave, { timeout: 1500 });
      } else {
        flushLocalMatchAutosave();
      }
    }, 3000);
  }

  function clearLocalMatchAutosave() {
    if (localAutosaveTimerId) {
      clearTimeout(localAutosaveTimerId);
      localAutosaveTimerId = null;
    }
    lastAutosaveBackupTurn = -1;
    try {
      localStorage.removeItem(LOCAL_SAVE_KEY);
      localStorage.removeItem(LOCAL_SAVE_BAK_KEY);
    } catch (e) {}
  }

  function loadLocalMatchAutosave() {
    const keys = [LOCAL_SAVE_KEY, LOCAL_SAVE_BAK_KEY];
    for (let i = 0; i < keys.length; i++) {
      try {
        const raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.version === SAVE_SCHEMA_VERSION &&
          parsed.state &&
          Array.isArray(parsed.state.players) &&
          parsed.state.players.length >= 2 &&
          !parsed.state.winner &&
          Date.now() - (parsed.savedAt || 0) < 24 * 60 * 60 * 1000
        ) {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  }

  function attachFirebaseConnectionMonitor(seatsRef, roleLabel) {
    if (!mp.fbDb || !seatsRef) return;
    if (mp.fbConnRef && mp.fbConnListener) {
      mp.fbConnRef.off("value", mp.fbConnListener);
    }
    mp.fbConnRef = mp.fbDb.ref(".info/connected");
    mp.fbConnListener = mp.fbConnRef.on("value", (snap) => {
      const connected = snap.val() === true;
      mp.isConnected = connected;
      if (mp.mode === "local" || !mp.roomCode) {
        updateMpConnectionPill("hidden", "");
        return;
      }
      if (connected) {
        const mySeatRef = seatsRef.child(mp.clientId);
        mySeatRef.set({ clientId: mp.clientId, status: roleLabel, joinedAt: Date.now() }).catch(() => {});
        mySeatRef.onDisconnect().remove().catch(() => {});
        updateMpConnectionPill("online", `Online · ${mp.roomCode}`);
      } else {
        updateMpConnectionPill("reconnecting", `Reconnecting (${mp.roomCode})...`);
      }
    });
  }

  function renderTitleResumeSlot() {
    const slot = document.getElementById("mts-resume-slot");
    if (!slot) return;
    const mpSess = loadActiveMpSession();

    if (mpSess && window.EFT_IS_FIREBASE_READY && window.EFT_IS_FIREBASE_READY()) {
      const roleLabel = mpSess.role === "host" ? "Host" : "Player";
      slot.innerHTML = `
        <div class="mts-resume-card">
          <div class="mts-resume-info">
            <span class="mts-resume-tag">Active Multiplayer Session</span>
            <strong class="mts-resume-title">Room ${escapeHtml(mpSess.roomCode)} (${roleLabel})</strong>
          </div>
          <div class="mts-resume-actions">
            <button type="button" class="btn btn-emerald btn-sm" onclick="window.EFT_APP.reconnectSavedMultiplayerSession()">
              Reconnect
            </button>
            <button type="button" class="btn btn-sm" onclick="window.EFT_APP.dismissSavedSessions('mp')">
              Delete
            </button>
          </div>
        </div>`;
      return;
    }

    slot.innerHTML = "";
  }

  function dismissSavedSessions(kind = "all") {
    playSfx("click");
    if (kind === "mp" || kind === "all") clearActiveMpSession();
    if (kind === "local" || kind === "all") clearLocalMatchAutosave();
    renderTitleResumeSlot();
  }

  function resumeSavedLocalMatch() {
    const saved = loadLocalMatchAutosave();
    if (!saved || !saved.state) {
      renderTitleResumeSlot();
      return;
    }
    playSfx("click");
    detachFirebaseListeners();
    mp.mode = "local";
    mp.roomCode = "";
    mp.mySeat = -1;
    state = saved.state;
    pendingInteraction = saved.pending ? deserializePendingInteraction(saved.pending) : null;
    isMatchStarted = true;
    invalidateHudCache();
    hideMainTitleScreen();
    closeModal();
    if (state.players && state.players[state.activePlayerIndex]) {
      focusCameraOnTile(getActivePlayer().tileId);
    }
    renderAll();
  }

  function reconnectSavedMultiplayerSession() {
    const sess = loadActiveMpSession();
    if (!sess || !sess.roomCode) {
      renderTitleResumeSlot();
      return;
    }
    playSfx("click");
    if (sess.username) setupDraft.username = sess.username;
    if (sess.charId) setupDraft.charId = sess.charId;
    if (sess.role === "host") {
      rejoinFirebaseHostRoom(sess.roomCode);
    } else {
      joinFirebaseClientRoom(sess.roomCode);
    }
  }

  function rejoinFirebaseHostRoom(code) {
    if (!window.EFT_IS_FIREBASE_READY()) {
      alert("Firebase is not configured in playtest/firebaseConfig.js.");
      return;
    }
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) return;
    try {
      detachFirebaseListeners();
      const db = ensureFirebaseDb();
      const roomRef = db.ref("rooms/" + cleanCode);
      roomRef
        .once("value")
        .then((snap) => {
          const data = snap.val();
          if (!data || (!data.stateJson && !data.lobbyJson)) {
            clearActiveMpSession();
            renderTitleResumeSlot();
            alert(`Room [${cleanCode}] is no longer active.`);
            return;
          }
          const lastActTs = Number(data.lastActivityAt || data.updatedAt || (data.meta && data.meta.createdAt) || 0);
          if (lastActTs > 0 && Date.now() - lastActTs >= ROOM_INACTIVITY_LIMIT_MS) {
            roomRef.remove().catch(() => {});
            clearActiveMpSession();
            renderTitleResumeSlot();
            alert(`Room [${cleanCode}] expired after 10 minutes of inactivity and has been removed.`);
            return;
          }
          mp.mode = "firebase_host";
          mp.roomCode = cleanCode;
          mp.fbRoomRef = roomRef;
          mp.fbActionsRef = roomRef.child("actions");
          mp.fbSeatsRef = roomRef.child("seats");
          if (data.lobbyJson) mp.lobby = JSON.parse(data.lobbyJson);
          if (data.stateJson) {
            state = JSON.parse(data.stateJson);
            pendingInteraction = data.pendingJson ? deserializePendingInteraction(JSON.parse(data.pendingJson)) : null;
          }
          if (state && state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
            mp.mySeat = state.seatMap[mp.clientId];
          } else {
            mp.mySeat = 0;
          }

          attachFirebaseConnectionMonitor(mp.fbSeatsRef, "Host Online");
          mp.fbSeatsListener = mp.fbSeatsRef.on("value", (sSnap) => {
            mp.onlineSeats = sSnap.val() || {};
            refreshLobbyModalIfOpen();
          });
          mp.fbActionListener = mp.fbActionsRef.on("child_added", (aSnap) => {
            const act = aSnap.val();
            aSnap.ref.remove().catch(() => {});
            if (!act || !act.action) return;
            processRemoteClientAction(act);
          });

          startMpInactivityMonitor(lastActTs || Date.now());
          markRoomRealPlayerActivity(true);
          saveActiveMpSession("host", cleanCode);
          invalidateHudCache();
          syncLeaveRoomCornerBtn();
          if (mp.lobby.status === "playing") {
            isMatchStarted = true;
            hideMainTitleScreen();
            closeModal();
            if (state && state.players && state.players[state.activePlayerIndex]) {
              focusCameraOnTile(getActivePlayer().tileId);
            }
            renderAll();
          } else {
            openWelcomeSetupModal("multiplayer");
          }
        })
        .catch((err) => {
          alert("Failed to reconnect as Host: " + err.message);
        });
    } catch (e) {
      alert("Failed to reconnect Host: " + e.message);
    }
  }

  // ============================================================================
  // INTERACTIVE 4-STEP QUICK GUIDE (player-experience & game-ux-review)
  // ============================================================================
  const QUICK_GUIDE_SLIDES = [
    {
      step: "1 / 4",
      title: "Main Objective & Starting Economy",
      lead: "Collect 💎 3 Tartarus Shards to win the match.",
      points: [
        "All players start at Spawn with 💰 20 TC and 6 Skill Cards.",
        "Tartarus Shards appear on glowing Zones I through VI on the board. Pass or land on a Shard tile and pay 💰 100 TC to buy it.",
        "At the end of every full round, all players enter a Free-For-All Minigame (up to 💰 45 TC reward)."
      ]
    },
    {
      step: "2 / 4",
      title: "Turn Flow",
      lead: "Each turn consists of 2 movement phases with a 3-minute timer.",
      points: [
        "Main Phase 1: Play Skill Cards before your first dice roll.",
        "Dice Roll 1 (2x d6): Your character moves automatically and pauses at junctions, Shops, or Shards.",
        "Main Phase 2 & Dice Roll 2: You may play another Skill Card (max 2 Skill Cards per turn) then roll your second dice before ending your turn."
      ]
    },
    {
      step: "3 / 4",
      title: "Skill Cards, Block Effects & Ultimates",
      lead: "Check the keywords on each card description before activating it.",
      points: [
        "Movement cards only trigger the destination tile effect if they explicitly state [Activate Block Effect].",
        "Cards tagged [Haste] are reactive and can be triggered out of turn when their condition is met.",
        "Ultimate Cards ([Retain]) stay in your hand across Cycle resets and can be bought at the Merchant Shop (💰 70 TC standard, 💰 50 TC for Firefly/SAM)."
      ]
    },
    {
      step: "4 / 4",
      title: "Global Events, Map Controls & Mobile Mode",
      lead: "Use the board controls and HUD indicators to track every opponent action.",
      points: [
        "Duration-based Global Events last for 2 Rounds and are displayed in the top-right corner.",
        "Click the Last Card Used panel in the top-right at any time to review the most recent card effect and outcome.",
        "On mobile, rotate your device to Landscape mode. Pan the map with 1 finger, pinch to zoom with 2 fingers, and tap Focus Player to center on the active player."
      ]
    }
  ];

  function openQuickGuideModal(stepIndex = 0) {
    playSfx("click");
    const total = QUICK_GUIDE_SLIDES.length;
    const idx = Math.max(0, Math.min(total - 1, Number(stepIndex) || 0));
    const slide = QUICK_GUIDE_SLIDES[idx];
    const dotsHtml = QUICK_GUIDE_SLIDES.map(
      (_, i) =>
        `<button type="button" class="qg-dot ${i === idx ? "active" : ""}" onclick="window.EFT_APP.openQuickGuideModal(${i})" aria-label="Step ${i + 1}"></button>`
    ).join("");
    const pointsHtml = slide.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join("");

    openInfoModal(
      `Quick Guide (${slide.step})`,
      `<div class="qg-modal-wrap">
        <div class="qg-step-head">
          <span class="qg-step-badge">Step ${slide.step}</span>
          <h3 class="qg-step-title">${escapeHtml(slide.title)}</h3>
          <p class="qg-step-lead">${escapeHtml(slide.lead)}</p>
        </div>
        <ul class="qg-points-list">${pointsHtml}</ul>
        <div class="qg-footer">
          <div class="qg-dots">${dotsHtml}</div>
          <div class="qg-nav-btns">
            ${
              idx > 0
                ? `<button type="button" class="btn btn-sm" onclick="window.EFT_APP.openQuickGuideModal(${idx - 1})">Previous</button>`
                : ""
            }
            ${
              idx < total - 1
                ? `<button type="button" class="btn btn-emerald btn-sm" onclick="window.EFT_APP.openQuickGuideModal(${idx + 1})">Next</button>`
                : `<button type="button" class="btn btn-emerald btn-sm" onclick="window.EFT_APP.closeModal()">Ready to Play</button>`
            }
          </div>
        </div>
      </div>`
    );
  }

  function isRemoteClient() {
    return mp.mode === "firebase_client";
  }

  function isMultiplayerHost() {
    return mp.mode === "firebase_host";
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
      throw new Error("Firebase SDK failed to load. Please check your internet connection.");
    }
    const cfg = typeof window.EFT_GET_FIREBASE_CONFIG === "function" ? window.EFT_GET_FIREBASE_CONFIG() : null;
    if (!cfg) {
      throw new Error("Firebase config has not been set in playtest/firebaseConfig.js.");
    }
    if (firebase.apps.length === 0) {
      firebase.initializeApp(cfg);
    }
    mp.fbDb = firebase.database();
    return mp.fbDb;
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

  function buildDeckForCharacter(charId, compVersionId, isSamMode = false, ownerPlayerId = null) {
    const charDef = getCharacterForCompendium(charId, compVersionId);
    if (!charDef) return [];
    const sourceCards = isSamMode && charDef.samCards ? charDef.samCards : charDef.cards;
    const deck = [];
    sourceCards.forEach((c) => {
      for (let i = 0; i < (c.count || 1); i++) {
        deck.push({
          ...c,
          uid: `${c.id}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          charId,
          ownerCharId: charId,
          ownerPlayerId: ownerPlayerId || null
        });
      }
    });
    return shuffleArray(deck);
  }

  function isCardForeignToPlayer(card, player) {
    if (!card || !player) return false;
    if (card.ownerPlayerId && card.ownerPlayerId !== player.id) return true;
    const origChar = card.ownerCharId || card.charId;
    if (origChar && origChar !== player.charId) return true;
    return false;
  }

  function returnForeignCardToOwner(card, fromPlayer = null) {
    if (!card || !state || !Array.isArray(state.players)) return false;
    if (card.rarity === "Ultimate") return false;
    let owner = null;
    if (card.ownerPlayerId) {
      owner = state.players.find((o) => o.id === card.ownerPlayerId) || null;
    }
    if (!owner) {
      const origChar = card.ownerCharId || card.charId;
      owner = state.players.find((o) => o.charId === origChar && (!fromPlayer || o.index !== fromPlayer.index)) || null;
    }
    if (!owner) return false;
    if (owner.charId === "firefly") {
      const isSamCard = String(card.id || "").startsWith("sam_");
      if ((owner.isSamMode && !isSamCard) || (!owner.isSamMode && isSamCard)) {
        return false;
      }
    }
    const alreadyExists =
      (owner.hand || []).some((c) => c && c.uid === card.uid) ||
      (owner.deck || []).some((c) => c && c.uid === card.uid) ||
      (owner.discard || []).some((c) => c && c.uid === card.uid);
    if (!alreadyExists) {
      if (!Array.isArray(owner.discard)) owner.discard = [];
      owner.discard.push(card);
    }
    return true;
  }

  function returnAllForeignCardsBeforeReshuffle() {
    if (!state || !Array.isArray(state.players)) return;
    state.players.forEach((p) => {
      const keepOwn = (arr) => {
        const own = [];
        (arr || []).forEach((c) => {
          if (!c) return;
          if (isCardForeignToPlayer(c, p)) {
            returnForeignCardToOwner(c, p);
          } else {
            own.push(c);
          }
        });
        return own;
      };
      p.hand = keepOwn(p.hand);
      p.deck = keepOwn(p.deck);
      p.discard = keepOwn(p.discard);
    });
  }

  function createShopState(rules) {
    return {
      1: { ultStock: 1, drawStock: rules.drawShopStock, actAgainStock: rules.actAgainStock, playerBuys: {} },
      2: { ultStock: 1, drawStock: rules.drawShopStock, actAgainStock: rules.actAgainStock, playerBuys: {} }
    };
  }

  function initGame(patchId = "alpha2", compendiumId = "comp_beta1", customRoster = null, options = {}) {
    isInitializingMatch = true;
    invalidateHudCache();
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
      const pid = `P${idx + 1}`;
      const deck = buildDeckForCharacter(entry.charId, compendiumId, false, pid);
      const hand = deck.splice(0, rules.startHandSize);
      const cleanUser = entry.username;
      if (entry.clientId) {
        seatMap[entry.clientId] = idx;
      }
      return {
        index: idx,
        id: pid,
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
        cursedRounds: 0,
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
      activeMonster: null,
      isMonsterTurn: false,
      lastMonsterSpawnEvent: null,
      lastMonsterAlertEvent: null,
      activeGlobalEvent: null,
      lastOpponentSkillUsed: null,
      recentOpponentSkills: [],
      lastSkillCardUsed: null,
      lastSkillEvent: null,
      lastDiceRollEvent: null,
      lastTileEffectReveal: null,
      lastPurchasedShard: null,
      lastBoardVfxEvent: null,
      lastSkillMoveAnim: null,
      lastWalkStepEvent: null,
      recentCardLosses: [],
      chatMessages: [],
      activeMinigame: null,
      minigameHistory: { versus: null, ffa: null },
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
    lastProcessedWalkStepId = null;
    _playedCardLossEventIds.clear();
    _lastRenderedHandCardRects.clear();
    if (typeof processedChatMsgIds !== "undefined") processedChatMsgIds.clear();
    if (typeof lastChatLogSig !== "undefined") lastChatLogSig = "";
    const chatLogEl = document.getElementById("hud-chat-log");
    if (chatLogEl) chatLogEl.innerHTML = "";
    const chatBubblesEl = document.getElementById("board-chat-bubbles-layer");
    if (chatBubblesEl) chatBubblesEl.innerHTML = "";
    if (typeof clearMonsterRuntimeUi === "function") clearMonsterRuntimeUi();
    ensureAmbientBgmLoop();
    lastProcessedBoardVfxId = null;
    lastProcessedSkillMoveAnimId = null;
    activeBoardVfxList = [];
    Object.values(skillMoveAnimTimers).forEach((tId) => clearTimeout(tId));
    skillMoveAnimTimers = {};
    skillMoveAnimOverrides = {};
    lastTrackedTurnTimerKey = null;
    lastRenderedTileModalKey = null;
    lastOpenedScryId = null;
    lastOpenedHasteId = null;
    resetPlayerVisualStatsTracker();
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
      addLog(`Turn Order (Randomized): ${orderStr}`);
      showEffectSpotlight("Turn Order Randomized", "Player Order Shuffled", orderStr, null);
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
    invalidateHudCache();
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
      if (player && player.cursedRounds > 0) {
        if (!isInitializingMatch) {
          addLog(`[Cursed]: ${player.name} cannot obtain +${Math.round(amount)} TC while Cursed!`);
          playSfx("card_drag_deny");
        }
        return 0;
      }
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
        addLog(`IPC Gems (${ipcPassive.multiplier || 1.3}x): ${player.name} gained +${amount} TC (from base ${rawAmount} TC).`);
      }
    } else if (amount < 0) {
      amount = -applyRounding(Math.abs(amount), state.rules);
    }
    player.tc = Math.max(0, player.tc + amount);
    if (!isInitializingMatch && amount !== 0) {
      playSfx(amount > 0 ? "coin_gain" : "coin_loss");
      if (Math.abs(amount) >= 25) {
        if (player.tileId && window.EFT_WEBGL_VFX) {
          window.EFT_WEBGL_VFX.burstAtTile(player.tileId, amount > 0 ? "coin_gain" : "coin_loss");
        }
        addCameraTrauma(amount < 0 ? 0.3 : 0.18);
      }
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

  const _playedCardLossEventIds = new Set();
  let _cardLossSeq = 0;

  function recordCardLossEvent(victimPlayer, card, kind = "discard", opts = {}) {
    if (!state || !victimPlayer || !card || isInitializingMatch) return;
    captureRenderedHandCardRects();
    if (!Array.isArray(state.recentCardLosses)) state.recentCardLosses = [];
    const cleanKind = kind === "stolen" ? "stolen" : "discard";
    const ev = {
      id: "cl_" + (++_cardLossSeq) + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      victimIndex: victimPlayer.index,
      victimName: victimPlayer.name,
      victimCharId: victimPlayer.charId,
      cardUid: card.uid || "",
      cardId: card.id || "",
      cardName: card.name || "Skill Card",
      cardRarity: card.rarity || "Common",
      cardImage: getCardImage(card, victimPlayer.charId),
      kind: cleanKind,
      byIndex: opts.byIndex !== undefined ? opts.byIndex : -1,
      byName: opts.byName || "",
      sourceLabel: opts.sourceLabel || (cleanKind === "stolen" ? "Stolen" : "Discarded"),
      badgeLabel: opts.badgeLabel || "",
      createdAt: Date.now()
    };
    state.recentCardLosses.push(ev);
    if (state.recentCardLosses.length > 14) {
      state.recentCardLosses = state.recentCardLosses.slice(-14);
    }
  }

  function getViewedHandPlayerIndex() {
    if (!state || !Array.isArray(state.players) || state.players.length === 0) return 0;
    const activeP = getActivePlayer();
    let viewPlayerIdx = mp.mySeat !== -1 ? mp.mySeat : state.activePlayerIndex;
    if (mp.mode === "local" && activeP && activeP.isBot && state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
      viewPlayerIdx = state.seatMap[mp.clientId];
    }
    return viewPlayerIdx;
  }

  function spawnCardLossAnimation(ev, batchIndex = 0, batchTotal = 1) {
    if (!ev || isTitleScreenVisible) return;
    let layer = document.getElementById("card-loss-fx-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "card-loss-fx-layer";
      layer.className = "card-loss-fx-layer";
      document.body.appendChild(layer);
    }

    const mobileLs = isMobileLandscape();
    const cardW = mobileLs ? 112 : 148;
    const cardH = mobileLs ? 160 : 212;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewedIdx = getViewedHandPlayerIndex();
    const isFromViewedHand = ev.victimIndex === viewedIdx;

    let sx = (vw - cardW) * 0.5;
    let sy = vh - cardH * 0.58;
    const savedRect = isFromViewedHand && ev.cardUid ? _lastRenderedHandCardRects.get(ev.cardUid) : null;
    if (savedRect) {
      sx = savedRect.left;
      sy = savedRect.top;
    } else if (!isFromViewedHand) {
      const victimHud = document.querySelector(`.player-hud-card[data-player-idx="${ev.victimIndex}"]`);
      if (victimHud) {
        const vr = victimHud.getBoundingClientRect();
        sx = Math.max(16, Math.min(vw - cardW - 16, vr.left + vr.width * 0.5 - cardW * 0.5));
        sy = Math.max(40, Math.min(vh - cardH - 40, vr.top + vr.height * 0.5 - cardH * 0.5));
      }
    }

    const spreadStep = Math.min(cardW + 26, (vw - 48) / Math.max(1, batchTotal));
    const centerOffset = (batchIndex - (batchTotal - 1) / 2) * spreadStep;
    const mx = Math.max(18, Math.min(vw - cardW - 18, (vw - cardW) * 0.5 + centerOffset));
    const my = Math.max(78, Math.min(vh - cardH - (mobileLs ? 98 : 178), vh * 0.46 - cardH * 0.5));

    let tx = 24;
    let ty = 88;
    let trot = -18;
    if (ev.kind === "stolen") {
      const thiefHud =
        ev.byIndex >= 0
          ? document.querySelector(`.player-hud-card[data-player-idx="${ev.byIndex}"]`)
          : null;
      if (thiefHud) {
        const tr = thiefHud.getBoundingClientRect();
        tx = tr.left + tr.width * 0.5 - cardW * 0.5;
        ty = tr.top + tr.height * 0.5 - cardH * 0.5;
        trot = tx < mx ? -22 : 22;
      } else {
        tx = mx - 180;
        ty = 64;
        trot = -20;
      }
    }

    const isStolen = ev.kind === "stolen";
    const badgeText =
      ev.badgeLabel ||
      (isStolen ? (ev.byName ? `STOLEN BY ${ev.byName}` : "STOLEN") : "DISCARDED");
    const ownerPrefix = !isFromViewedHand && ev.victimName ? `${ev.victimName}: ` : "";
    const metaSub = ev.sourceLabel ? `<small>${escapeHtml(ownerPrefix + ev.sourceLabel)}</small>` : ownerPrefix ? `<small>${escapeHtml(ev.victimName)}</small>` : "";

    let particlesHtml = "";
    if (isStolen) {
      const wisps = [
        { wx: "-28px", wy: "-18px", wa: "-24deg", wd: "0.42s" },
        { wx: "26px", wy: "-22px", wa: "20deg", wd: "0.48s" },
        { wx: "-22px", wy: "20px", wa: "-14deg", wd: "0.52s" },
        { wx: "24px", wy: "16px", wa: "26deg", wd: "0.56s" }
      ];
      particlesHtml = wisps
        .map((w) => `<span class="cl-wisp" style="--wx:${w.wx};--wy:${w.wy};--wa:${w.wa};--wd:${w.wd};"></span>`)
        .join("");
    } else {
      const embers = [
        { left: "12%", ex: "-18px", ey: "-135px", ed: "0.28s" },
        { left: "24%", ex: "12px", ey: "-152px", ed: "0.38s" },
        { left: "36%", ex: "-10px", ey: "-124px", ed: "0.44s" },
        { left: "48%", ex: "16px", ey: "-165px", ed: "0.32s" },
        { left: "60%", ex: "-14px", ey: "-142px", ed: "0.50s" },
        { left: "72%", ex: "18px", ey: "-130px", ed: "0.36s" },
        { left: "84%", ex: "-12px", ey: "-158px", ed: "0.46s" },
        { left: "52%", ex: "6px", ey: "-174px", ed: "0.58s" }
      ];
      particlesHtml = embers
        .map((em) => `<span class="cl-ember" style="left:${em.left};--ex:${em.ex};--ey:${em.ey};--ed:${em.ed};"></span>`)
        .join("");
    }

    const node = document.createElement("div");
    node.className = `card-loss-fx ${isStolen ? "is-stolen" : "is-discard"}`;
    node.style.setProperty("--sx", `${sx.toFixed(1)}px`);
    node.style.setProperty("--sy", `${sy.toFixed(1)}px`);
    node.style.setProperty("--mx", `${mx.toFixed(1)}px`);
    node.style.setProperty("--my", `${my.toFixed(1)}px`);
    node.style.setProperty("--tx", `${tx.toFixed(1)}px`);
    node.style.setProperty("--ty", `${ty.toFixed(1)}px`);
    node.style.setProperty("--trot", `${trot}deg`);
    node.style.setProperty("--srot", `${((batchIndex % 2 === 0 ? -1 : 1) * 4).toFixed(1)}deg`);

    node.innerHTML = `
      <div class="card-loss-fx-badge ${isStolen ? "is-stolen" : "is-discard"}">${escapeHtml(badgeText)}</div>
      <div class="card-loss-fx-shell">
        <img class="card-loss-fx-img" src="${escapeHtml(ev.cardImage)}" alt="${escapeHtml(ev.cardName)}" />
        ${isStolen ? '<div class="card-loss-fx-steal-slash"></div>' : '<div class="card-loss-fx-burn-edge"></div>'}
      </div>
      ${particlesHtml}
      <div class="card-loss-fx-meta">
        ${escapeHtml(ev.cardName)}
        ${metaSub}
      </div>`;

    layer.appendChild(node);
    playSfx(isStolen ? "card_steal" : "card_burn");

    setTimeout(() => {
      if (node.parentNode) node.remove();
    }, 1680);
  }

  function processPendingCardLossAnimations() {
    if (!state || !Array.isArray(state.recentCardLosses) || isInitializingMatch || !isMatchStarted || isTitleScreenVisible) {
      if (state && Array.isArray(state.recentCardLosses)) {
        state.recentCardLosses.forEach((ev) => {
          if (ev && ev.id) _playedCardLossEventIds.add(ev.id);
        });
      }
      return;
    }

    const now = Date.now();
    const fresh = [];
    state.recentCardLosses.forEach((ev) => {
      if (!ev || !ev.id || _playedCardLossEventIds.has(ev.id)) return;
      _playedCardLossEventIds.add(ev.id);
      if (ev.createdAt && now - ev.createdAt > 15000) return;
      // In Multiplayer, keep opponent hands private: only reveal the victim's lost card face to the victim
      if (mp.mySeat !== -1 && ev.victimIndex !== mp.mySeat) return;
      fresh.push(ev);
    });

    if (fresh.length === 0) return;
    const batch = fresh.slice(-4);
    batch.forEach((ev, idx) => {
      setTimeout(() => {
        spawnCardLossAnimation(ev, idx, batch.length);
      }, idx * 170);
    });
  }

  function discardRandomCards(player, count, lossMeta = null) {
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
      if (!lossMeta || !lossMeta.skipDiscardPile) {
        if (isCardForeignToPlayer(c, player)) {
          returnForeignCardToOwner(c, player);
        } else {
          player.discard.push(c);
        }
      }
      recordCardLossEvent(
        player,
        c,
        lossMeta && lossMeta.kind ? lossMeta.kind : "discard",
        lossMeta || { sourceLabel: "Discarded" }
      );
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
        ? pt.cover
          ? `<img src="${pt.src}" alt="${escapeHtml(w.name)}" style="inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 22%;" />`
          : `<img src="${pt.src}" alt="${escapeHtml(w.name)}" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
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
    const victorySubtitle = w.victoryReason
      ? escapeHtml(w.victoryReason)
      : `Collected ${totalShards} Tartarus Shards in Cycle ${w.cycle || state.cycle}.`;
    overlay.innerHTML = `
      <div class="victory-stage-card">
        <div class="victory-eyebrow">ESCAPED FROM TARTARUS · VICTORY</div>
        <div class="victory-hero-row">
          <div class="victory-portrait-frame">${portraitHtml}</div>
          <div class="victory-hero-info">
            <div class="victory-winner-name">${escapeHtml(w.name)} Wins!</div>
            <div class="victory-subtitle">${victorySubtitle}</div>
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
          <button class="victory-menu-btn" type="button" onclick="window.EFT_APP.resetGameToMainMenu()">Back to Main Menu</button>
        </div>
      </div>`;
    overlay.classList.add("visible");
  }

  function resetGameToMainMenu(opts = {}) {
    playSfx("click");
    clearTimeout(stepTimerId);
    clearDiceOverlay();
    clearDiceOfFateTimers();
    cancelTileEffectShuffle(true);
    dismissSkillPopup(true, true);
    closeModal();
    stopMpInactivityMonitor();
    if (mp.mode !== "local") {
      const prevRoomRef = mp.fbRoomRef;
      const shouldDeleteFinishedRoom = !opts.preservePendingDelete && mp.mode === "firebase_host" && prevRoomRef && state && state.winner;
      detachFirebaseListeners();
      clearActiveMpSession();
      if (shouldDeleteFinishedRoom) {
        deleteFirebaseRoomNow(prevRoomRef);
      }
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
    syncLeaveRoomCornerBtn();
    const vOv = document.getElementById("victory-screen-overlay");
    if (vOv) {
      vOv.classList.remove("visible");
      vOv.innerHTML = "";
    }
    showMainTitleScreen();
    initGame("alpha2", "comp_beta1", ["bocchi", "aventurine", "lilith", "joker"]);
  }

  let titleHasConfirmedUsername = false;
  let pendingInviteRoomCode = "";

  function setTitleScreenStage(stage) {
    const screen = document.getElementById("main-title-screen");
    const loadingSec = document.getElementById("mts-loading-section");
    const userSec = document.getElementById("mts-username-section");
    const menuSec = document.getElementById("mts-menu-section");
    if (screen) screen.setAttribute("data-stage", stage);
    if (loadingSec) loadingSec.classList.toggle("is-hidden", stage !== "loading");
    if (userSec) userSec.classList.toggle("is-hidden", stage !== "username");
    if (menuSec) menuSec.classList.toggle("is-hidden", stage !== "menu");

    if (stage === "username") {
      const inp = document.getElementById("mts-username-input");
      const err = document.getElementById("mts-username-error");
      if (err) err.textContent = "";
      if (inp) {
        inp.value = setupDraft.username || "";
        setTimeout(() => {
          try { inp.focus(); } catch (e) {}
        }, 80);
      }
    } else if (stage === "menu") {
      const nameEl = document.getElementById("mts-welcome-name");
      if (nameEl) nameEl.textContent = (setupDraft.username || "Player").trim() || "Player";
      renderTitleResumeSlot();
    }
  }

  function submitTitleUsername() {
    const inp = document.getElementById("mts-username-input");
    const err = document.getElementById("mts-username-error");
    const val = (inp ? inp.value : setupDraft.username || "").trim().slice(0, 18);
    if (!val) {
      if (err) err.textContent = "Please enter a username first.";
      if (inp) inp.focus();
      return;
    }
    playSfx("click");
    setupDraft.username = val;
    savePlayerProfile(val, setupDraft.charId);
    titleHasConfirmedUsername = true;
    setTitleScreenStage("menu");

    if (pendingInviteRoomCode) {
      const code = pendingInviteRoomCode;
      pendingInviteRoomCode = "";
      toggleTitlePlayMenu(true);
      toggleTitleJoinCode(true);
      const codeInp = document.getElementById("mts-join-code-input");
      if (codeInp) codeInp.value = code;
      onTitleJoinCodeInput(code);
      setTimeout(() => {
        joinFirebaseClientRoom(code);
      }, 260);
    }
  }

  function editTitleUsername() {
    playSfx("click");
    toggleTitlePlayMenu(false);
    setTitleScreenStage("username");
  }

  function toggleTitlePlayMenu(forceOpen = null) {
    const sub = document.getElementById("mts-play-subpanel");
    const playBtn = document.getElementById("mts-play-btn");
    if (!sub) return;
    const nextOpen = forceOpen !== null ? !!forceOpen : !sub.classList.contains("is-open");
    if (forceOpen === null) playSfx("click");
    sub.classList.toggle("is-open", nextOpen);
    sub.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    if (playBtn) {
      playBtn.classList.toggle("is-active", nextOpen);
      playBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    }
    if (!nextOpen) {
      toggleTitleJoinCode(false);
    }
  }

  function toggleTitleJoinCode(forceOpen = null) {
    const wrap = document.getElementById("mts-join-code-wrap");
    const joinBtn = document.getElementById("mts-join-toggle-btn");
    const inp = document.getElementById("mts-join-code-input");
    if (!wrap) return;
    const nextOpen = forceOpen !== null ? !!forceOpen : !wrap.classList.contains("is-open");
    if (forceOpen === null) playSfx("click");
    wrap.classList.toggle("is-open", nextOpen);
    wrap.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    if (joinBtn) joinBtn.classList.toggle("is-active", nextOpen);
    if (nextOpen && inp) {
      onTitleJoinCodeInput(inp.value || "");
      setTimeout(() => {
        try { inp.focus(); } catch (e) {}
      }, 90);
    }
  }

  function onTitleJoinCodeInput(rawVal) {
    const clean = String(rawVal || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    const inp = document.getElementById("mts-join-code-input");
    if (inp && inp.value !== clean) inp.value = clean;
    const slots = document.querySelectorAll("#mts-join-code-slots .mts-code-slot");
    slots.forEach((slot, idx) => {
      slot.textContent = clean[idx] || "";
      slot.classList.toggle("is-caret", idx === clean.length);
    });
  }

  function hostGameFromTitle() {
    playSfx("click");
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      setTitleScreenStage("username");
      return;
    }
    savePlayerProfile(uname, setupDraft.charId);
    startFirebaseHostRoom();
  }

  function submitTitleJoinCode() {
    const inp = document.getElementById("mts-join-code-input");
    const code = ((inp && inp.value) || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    if (code.length < 4) {
      playSfx("card_drag_deny");
      showHandDragToast("Enter a valid Room Code (e.g. EFT123).");
      if (inp) inp.focus();
      return;
    }
    playSfx("click");
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      pendingInviteRoomCode = code;
      setTitleScreenStage("username");
      return;
    }
    mp.roomCode = code;
    savePlayerProfile(uname, setupDraft.charId);
    joinFirebaseClientRoom(code);
  }

  function showMainTitleScreen() {
    isTitleScreenVisible = true;
    isMatchStarted = false;
    const screen = document.getElementById("main-title-screen");
    if (screen) screen.classList.remove("is-hidden");
    toggleTitlePlayMenu(false);
    if (hasPreloadedAssets) {
      if (titleHasConfirmedUsername && (setupDraft.username || "").trim()) {
        setTitleScreenStage("menu");
      } else {
        setTitleScreenStage("username");
      }
    } else {
      setTitleScreenStage("loading");
    }
  }

  function hideMainTitleScreen() {
    isTitleScreenVisible = false;
    isMatchStarted = true;
    const screen = document.getElementById("main-title-screen");
    if (screen) screen.classList.add("is-hidden");
    ensureAmbientBgmLoop();
  }

  function openTitleSingleplayer() {
    openTitleMultiplayer();
  }

  function openTitleMultiplayer() {
    playSfx("click");
    toggleTitlePlayMenu(true);
  }

  function collectCriticalPreloadUrls() {
    const urls = new Set();
    if (DATA && DATA.CHARACTERS) {
      Object.values(DATA.CHARACTERS).forEach((ch) => {
        if (!ch) return;
        if (ch.menuPortrait) urls.add(ch.menuPortrait);
        if (ch.portrait && ch.portrait.src) urls.add(ch.portrait.src);
        if (ch.chibi) urls.add(ch.chibi);
      });
    }
    return Array.from(urls);
  }

  function collectSecondaryPreloadUrls() {
    const urls = new Set();
    if (DATA && DATA.CHARACTERS) {
      Object.values(DATA.CHARACTERS).forEach((ch) => {
        if (!ch) return;
        if (ch.samChibi) urls.add(ch.samChibi);
        if (Array.isArray(ch.cards)) {
          ch.cards.forEach((c) => {
            if (c && c.image) urls.add(c.image);
          });
        }
        if (ch.ultimate && ch.ultimate.image) urls.add(ch.ultimate.image);
        if (Array.isArray(ch.samCards)) {
          ch.samCards.forEach((c) => {
            if (c && c.image) urls.add(c.image);
          });
        }
        if (ch.samUltimate && ch.samUltimate.image) urls.add(ch.samUltimate.image);
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

  function preloadSingleImage(url, onSettled) {
    const img = new Image();
    let settled = false;
    let triedFallback = false;
    const markDone = () => {
      if (settled) return;
      settled = true;
      if (typeof onSettled === "function") onSettled();
    };
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(markDone).catch(markDone);
      } else {
        markDone();
      }
    };
    img.onerror = () => {
      if (!triedFallback && /\.webp$/i.test(url)) {
        triedFallback = true;
        img.src = url.replace(/\.webp$/i, ".png");
        return;
      }
      markDone();
    };
    img.src = url;
  }

  function preloadSecondaryAssetsInBackground() {
    const queue = collectSecondaryPreloadUrls();
    let idx = 0;
    const BATCH_SIZE = 4;
    const pump = () => {
      if (idx >= queue.length) return;
      const batch = queue.slice(idx, idx + BATCH_SIZE);
      idx += BATCH_SIZE;
      let left = batch.length;
      const onOne = () => {
        left--;
        if (left <= 0 && idx < queue.length) {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(pump, { timeout: 600 });
          } else {
            setTimeout(pump, 140);
          }
        }
      };
      batch.forEach((u) => preloadSingleImage(u, onOne));
    };
    setTimeout(pump, 350);
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
      setTitleScreenStage("username");
      preloadSecondaryAssetsInBackground();
      if (typeof onComplete === "function") onComplete();
    };

    try {
      const urls = collectCriticalPreloadUrls();
      const total = Math.max(1, urls.length);
      let loadedCount = 0;
      let displayPct = 8;
      let finished = false;
      const startTime = Date.now();
      const minDurationMs = 380;

      const setBarPct = (pct) => {
        const clamped = Math.max(8, Math.min(100, Math.round(pct)));
        if (fillEl) fillEl.style.width = `${clamped}%`;
        if (trackEl) trackEl.setAttribute("aria-valuenow", String(clamped));
      };

      setBarPct(8);

      urls.forEach((url) => {
        preloadSingleImage(url, () => {
          loadedCount++;
        });
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

        if ((loadedCount >= total && elapsed >= minDurationMs) || elapsed >= 2200) {
          finished = true;
          clearInterval(tickInterval);
          setBarPct(100);
          setTimeout(finishLoading, 120);
        }
      }, 40);
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
    if (state.activeMinigame) {
      const mg = state.activeMinigame;
      if (mg.gameId === "dice_of_fate" && mg.phase === "playing" && mg.data && mg.data.status === "rolling" && window.EFT_MINIGAMES) {
        const curIdx = window.EFT_MINIGAMES.getCurrentDiceOfFateEntryIndex(mg);
        if (curIdx >= 0 && mg.entries[curIdx]) {
          return mg.entries[curIdx].playerIndex;
        }
      } else if (mg.status === "rolling") {
        const curIdx = getCurrentDiceOfFateEntryIndex(mg);
        if (curIdx >= 0 && mg.entries[curIdx]) {
          return mg.entries[curIdx].playerIndex;
        }
      }
    }
    if (pendingInteraction && pendingInteraction.player && typeof pendingInteraction.player.index === "number") {
      return pendingInteraction.player.index;
    }
    if (state.activeTileModal && typeof state.activeTileModal.actorIndex === "number") {
      return state.activeTileModal.actorIndex;
    }
    return state.activePlayerIndex;
  }

  function canLocalPlayerAct() {
    if (isProcessingRemoteAction) return true;
    if (state && state.isMonsterTurn) return false;
    if (mp.mode === "local" || mp.mySeat === -1) {
      if (state && Array.isArray(state.players)) {
        const expectedSeat = getExpectedActingSeat();
        const actingP = state.players[expectedSeat];
        if (actingP && actingP.isBot) return false;
      }
      return true;
    }
    return mp.mySeat === getExpectedActingSeat();
  }

  function isLocalHumanTurnForPlayer(player) {
    if (!state || !player) return false;
    if (isProcessingRemoteAction) return false;
    if (mp.mode !== "local" && mp.mySeat !== -1) {
      return mp.mySeat === player.index;
    }
    return !player.isBot;
  }

  function handleRollButton() {
    if (isWalkingAnim || isTileEffectAnimating || pendingInteraction || (state && state.activeMinigame)) return;
    if (!canLocalPlayerAct()) {
      alert(`It is currently ${getActivePlayer().name}'s turn.`);
      return;
    }
    markRoomRealPlayerActivity();
    if (state.phaseIndex === 1 || state.phaseIndex === 3) {
      rollMovementDice();
    }
  }

  function handleEndTurnButton() {
    if (isWalkingAnim || isTileEffectAnimating || pendingInteraction || (state && state.activeMinigame)) return;
    if (!canLocalPlayerAct()) {
      alert(`It is currently ${getActivePlayer().name}'s turn.`);
      return;
    }
    const player = getActivePlayer();
    if ((player.rollsUsedThisTurn || 0) < 1 && state.phaseIndex !== 5) {
      alert("You must roll the dice at least once before ending your turn.");
      return;
    }
    markRoomRealPlayerActivity();
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
    if (info.totalSteps !== info.rawTotal) stepNoteParts.push(`Base: ${info.rawTotal}`);
    if (info.direction < 0) stepNoteParts.push("Backward");
    const subNote = stepNoteParts.length > 0 ? ` (${stepNoteParts.join(" · ")})` : "";

    if (info.isForced) {
      overlay.innerHTML = `
        <div class="dice-anim-card landed">
          <div class="dice-anim-sub">${escapeHtml(info.player.name)}</div>
          <div class="dice-anim-cubes">${renderCubesHtml(info.rolls, "landed")}</div>
          <div class="dice-anim-total">${info.totalSteps} ${info.totalSteps === 1 ? "Step" : "Steps"}${escapeHtml(subNote)}</div>
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
        <div class="dice-anim-sub">${escapeHtml(info.player.name)} is rolling dice...</div>
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
          <div class="dice-anim-sub">${escapeHtml(info.player.name)} rolled</div>
          <div class="dice-anim-cubes">${renderCubesHtml(info.rolls, "landed")}</div>
          <div class="dice-anim-total">${info.totalSteps} ${info.totalSteps === 1 ? "Step" : "Steps"}${escapeHtml(subNote)}</div>
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
        const disc = discardRandomCards(other, 1, { kind: "discard", sourceLabel: "Unpredictable Tricks" });
        const stolen = Math.min(5, other.tc);
        other.tc -= stolen;
        if (!(mover.cursedRounds > 0)) {
          mover.tc += stolen;
        } else if (stolen > 0) {
          addLog(`[Cursed]: ${mover.name} could not obtain ${stolen} TC from Unpredictable Tricks!`);
        }
        addLog(`Unpredictable Tricks: ${mover.name} passed ${other.name} -> ${other.name} lost ${disc.length} card(s) & paid ${stolen} TC.`);
        triggerDramaticSkillEvent({
          charId: mover.charId,
          cardId: "lilith_uq",
          casterName: mover.name,
          cardName: "Unpredictable Tricks",
          rarity: "Passive",
          cardImg: "assets/cards/characters/lilith/uq.webp",
          description: "Pass opponent: opponent loses 1 random card and gives 5 TC.",
          outcomeText: `${mover.name} passed ${other.name}: -${disc.length} Card(s) & -${stolen} TC!`,
          profile: { theme: "passive", tagline: "PASSIVE TRIGGERED · UNPREDICTABLE TRICKS", accent: "#ef4444", accentRgb: "239, 68, 68" }
        });
        procs++;
        triggeredThisPair = true;
      }
      if (hasPassive(other, "passive_unpredictable_tricks")) {
        const disc = discardRandomCards(mover, 1, { kind: "discard", sourceLabel: "Unpredictable Tricks" });
        const stolen = Math.min(5, mover.tc);
        mover.tc -= stolen;
        if (!(other.cursedRounds > 0)) {
          other.tc += stolen;
        } else if (stolen > 0) {
          addLog(`[Cursed]: ${other.name} could not obtain ${stolen} TC from Unpredictable Tricks!`);
        }
        addLog(`Unpredictable Tricks (${other.name}): ${mover.name} passed ${other.name} -> ${mover.name} lost ${disc.length} card(s) & paid ${stolen} TC.`);
        triggerDramaticSkillEvent({
          charId: other.charId,
          cardId: "lilith_uq",
          casterName: other.name,
          cardName: "Unpredictable Tricks",
          rarity: "Passive",
          cardImg: "assets/cards/characters/lilith/uq.webp",
          description: "Opponent passed you: they lose 1 random card and give 5 TC.",
          outcomeText: `${mover.name} passed ${other.name}: ${mover.name} lost ${disc.length} Card(s) & ${stolen} TC!`,
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
    addLog(`Passive [The Stage Is Mine]: ${player.name} landed on Normal Tile (${normalTile.id}), choose to move +1 / +2 / -1 or stay.`);
    triggerDramaticSkillEvent({
      charId: player.charId,
      cardId: "bocchi_uq",
      casterName: player.name,
      cardName: "The Stage Is Mine",
      rarity: "Passive",
      cardImg: "assets/cards/characters/bocchi/uq.webp",
      description: "[Activate Block Effect] When land on Normal Tiles, choose to move (+1/+2/-1).",
      outcomeText: `${player.name} landed on a Normal Tile: Choose to move +1 / +2 / -1 on the map!`,
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
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
    if (isRemoteClient()) {
      sendClientActionToHost("stage_is_mine_choice", { tileId });
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "stage_is_mine") return;
    const { player, fromTileId, validTileIds, tileStepLabels } = pendingInteraction;
    pendingInteraction = null;

    if (!tileId || !validTileIds.includes(tileId) || !TILE_MAP[tileId]) {
      addLog(`[The Stage Is Mine]: ${player.name} chose to stay on [${fromTileId}].`);
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
      addLog(`[The Stage Is Mine]: ${player.name} moved ${stepDelta} tile to [${tileId}: ${destTile.name}] and activated the block effect!`);
    } else {
      addLog(`[The Stage Is Mine]: ${player.name} moved to [${tileId}: ${destTile.name}] and activated the block effect!`);
    }
    resolveExactLandingTile(player, destTile, { fromStagePassive: true });
    if (camera.mode === "follow") focusCameraOnTile(tileId);
    renderAll();
    broadcastMultiplayerState();
  }

  function resolveForcedAllInChoice(choice = "shard") {
    if (!canLocalPlayerAct()) return;
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
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
        addLog(`ULTIMATE [Forced All-In]: ${player.name} won (${myRoll} vs ${oppRoll}) and chose to steal 1 Tartarus Shard from ${targetPlayer.name}!`);
        checkVictory(player);
      } else {
        const allTc = targetPlayer.tc;
        targetPlayer.tc = 0;
        if (!(player.cursedRounds > 0)) {
          player.tc += allTc;
          addLog(`ULTIMATE [Forced All-In]: ${player.name} won (${myRoll} vs ${oppRoll}) and seized all ${allTc} TC from ${targetPlayer.name}!`);
        } else {
          addLog(`ULTIMATE [Forced All-In]: ${player.name} won (${myRoll} vs ${oppRoll}), but [Cursed] blocked gaining ${allTc} TC!`);
        }
      }
    }
    renderAll();
    broadcastMultiplayerState();
  }

  let lastProcessedWalkStepId = null;

  function executeSingleStep(player, nextTileId, stepsLeft, direction, activateFinalTile, viaSplitId = null) {
    const prevTileId = player.tileId;
    player.lastTileId = viaSplitId || prevTileId;
    player.tileId = nextTileId;
    activeStepsRemaining = stepsLeft;
    playSfx("step");

    const stepEvId = "ws_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    state.lastWalkStepEvent = {
      id: stepEvId,
      playerIndex: player.index,
      tileId: nextTileId,
      stepsLeft,
      ts: Date.now()
    };
    lastProcessedWalkStepId = stepEvId;

    // Dynamically track player with camera on every step!
    if (camera.mode === "follow") {
      focusCameraOnTile(nextTileId);
    }
    renderAll();
    broadcastMultiplayerState();

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

  function computeTokenCoveredTiles(centerTileId, radius = 0) {
    if (!centerTileId || !TILE_MAP[centerTileId]) return [];
    if (!radius || radius <= 0) return [centerTileId];
    const within = getTilesWithinRadius(centerTileId, radius, false, false).map((m) => m.tile.id);
    if (!within.includes(centerTileId)) within.unshift(centerTileId);
    return within;
  }

  function getTokensCoveringTile(tileId) {
    if (!state || !Array.isArray(state.boardTokens) || !tileId) return [];
    return state.boardTokens.filter(
      (tok) => tok.tileId === tileId || (Array.isArray(tok.coveredTileIds) && tok.coveredTileIds.includes(tileId))
    );
  }

  function triggerTokenEffectOnPlayers(tok, playersOnZone, caster = null) {
    if (!tok) return { summary: "", consumed: false };
    const targets = Array.isArray(playersOnZone) ? playersOnZone : [];
    const hitNames = [];
    let consumed = false;

    if (tok.type === "virus_trap") {
      targets.forEach((p) => {
        p.nextTurnDiceMod = Math.max(-1, (p.nextTurnDiceMod || 0) - 1);
        hitNames.push(p.name);
      });
      if (targets.length > 0) {
        consumed = true;
        showEffectSpotlight(
          "Punishing Virus!",
          `${hitNames.join(", ")} triggered Trap`,
          "Next turn dice reduced by -1 die (max 1 per player).",
          "assets/cards/characters/lilith/uc.webp"
        );
      }
      return {
        summary:
          hitNames.length > 0
            ? `${hitNames.join(", ")} hit by Punishing Virus (-1 die next turn)!`
            : "Punishing Virus is active on the new tile (no players currently on it).",
        consumed
      };
    }

    if (tok.type === "herb_tile") {
      const beneficiary = caster || state.players[tok.ownerIndex] || targets[0];
      if (targets.length > 0 || beneficiary) {
        consumed = true;
        const hits = Math.max(1, targets.length);
        const notes = [];
        for (let k = 0; k < hits; k++) {
          const recv = targets[k] || beneficiary;
          if (recv.hand.length < state.rules.maxHandSize && recv.tc >= 60 && recv.deck.length > 0) {
            const d = drawCards(recv, 1);
            notes.push(`${recv.name} +${d.length} card(s)`);
          } else {
            const g = modifyPlayerTC(recv, 10, "tile");
            notes.push(`${recv.name} +${g} TC`);
          }
        }
        return {
          summary: `Medicinal Herbs triggered immediately: ${notes.join(", ")}!`,
          consumed
        };
      }
      return { summary: "Medicinal Herbs relocated.", consumed: false };
    }

    if (tok.type === "safe_zone") {
      targets.forEach((p) => {
        p.safeZoneImmune = true;
        hitNames.push(p.name);
      });
      if (targets.length > 0) consumed = true;
      return {
        summary:
          hitNames.length > 0
            ? `Safe Zone (Oak Cake Break) activated immediately: ${hitNames.join(", ")} cannot be targeted by cards until next Phase!`
            : "Safe Zone (3-tile radius) relocated and active in the new area.",
        consumed
      };
    }

    if (tok.type === "restricted_zone") {
      const owner = state.players[tok.ownerIndex] || caster;
      targets.forEach((p) => {
        if (owner && p.index === owner.index) return;
        if (p.tc >= 20) {
          p.tc -= 20;
          if (owner) owner.tc += 20;
          hitNames.push(`${p.name} (-20 TC)`);
        } else {
          const giveIdx = p.hand.findIndex((c) => c && c.rarity !== "Ultimate");
          if (giveIdx !== -1) {
            const surrendered = p.hand.splice(giveIdx, 1)[0];
            if (owner && owner.hand.length < state.rules.maxHandSize) owner.hand.push(surrendered);
            recordCardLossEvent(p, surrendered, "stolen", {
              byIndex: owner ? owner.index : -1,
              byName: owner ? owner.name : "Mao-Mao",
              sourceLabel: "Restricted Zone"
            });
            hitNames.push(`${p.name} (-1 card)`);
          } else {
            const fee = Math.min(20, p.tc);
            p.tc -= fee;
            if (owner) owner.tc += fee;
            hitNames.push(`${p.name} (-${fee} TC)`);
          }
        }
      });
      return {
        summary:
          hitNames.length > 0
            ? `Restricted Zone immediately collected medical fees from ${hitNames.join(", ")}!`
            : "Restricted Zone relocated to the new tile.",
        consumed: false
      };
    }

    if (tok.type === "fire_tile") {
      targets.forEach((p) => {
        modifyPlayerTC(p, -15, "tile");
        p.nextRollMaxCap = 6;
        hitNames.push(p.name);
      });
      if (targets.length > 0) consumed = true;
      return {
        summary:
          hitNames.length > 0
            ? `Deathstar Fire erupted: ${hitNames.join(", ")} lost 15 TC & next roll capped at 6!`
            : "Deathstar Fire relocated and ignited on the new tile.",
        consumed
      };
    }

    return { summary: `${tok.name} relocated.`, consumed: false };
  }

  function checkTokensOnStep(player, tileId, isExactLanding) {
    for (let i = state.boardTokens.length - 1; i >= 0; i--) {
      const tok = state.boardTokens[i];
      const coversTile =
        tok.tileId === tileId ||
        (Array.isArray(tok.coveredTileIds) && tok.coveredTileIds.includes(tileId));
      if (!coversTile) continue;

      if (tok.type === "virus_trap" && tok.ownerIndex !== player.index) {
        player.nextTurnDiceMod = Math.max(-1, (player.nextTurnDiceMod || 0) - 1);
        state.boardTokens.splice(i, 1);
        addLog(`${player.name} stepped on Punishing Virus (-1 die on next turn, max 1 per player).`);
        showEffectSpotlight("Punishing Virus!", `${player.name} triggered Trap`, "Next turn dice reduced by -1 die (max 1 per player).", "assets/cards/characters/lilith/uc.webp");
      } else if (tok.type === "herb_tile") {
        const owner = state.players[tok.ownerIndex] || player;
        state.boardTokens.splice(i, 1);
        if (owner.hand.length < state.rules.maxHandSize && owner.tc >= 60 && owner.deck.length > 0) {
          const d = drawCards(owner, 1);
          addLog(`Medicinal Herbs (${player.name} passed [${tileId}]): ${owner.name} drew +${d.length} card(s)!`);
        } else {
          const g = modifyPlayerTC(owner, 10, "tile");
          addLog(`Medicinal Herbs (${player.name} passed [${tileId}]): ${owner.name} gained +${g} TC!`);
        }
      } else if (tok.type === "safe_zone" && isExactLanding) {
        player.safeZoneImmune = true;
        state.boardTokens.splice(i, 1);
        addLog(`${player.name} activated Safe Zone (Oak Cake Break) at [${tileId}]: immune to card targeting until next Phase!`);
      } else if (tok.type === "restricted_zone" && isExactLanding && tok.ownerIndex !== player.index) {
        const owner = state.players[tok.ownerIndex];
        if (player.tc >= 20) {
          player.tc -= 20;
          if (owner) owner.tc += 20;
          addLog(`${player.name} landed on Restricted Zone and paid a 20 TC medical fee to ${owner ? owner.name : "Mao-Mao"}.`);
        } else {
          const giveIdx = player.hand.findIndex((c) => c && c.rarity !== "Ultimate");
          if (giveIdx !== -1) {
            const surrendered = player.hand.splice(giveIdx, 1)[0];
            if (owner && owner.hand.length < state.rules.maxHandSize) owner.hand.push(surrendered);
            recordCardLossEvent(player, surrendered, "stolen", {
              byIndex: owner ? owner.index : -1,
              byName: owner ? owner.name : "Mao-Mao",
              sourceLabel: "Restricted Zone"
            });
            addLog(`${player.name} could not pay 20 TC on Restricted Zone -> surrendered [${surrendered.name}] to ${owner ? owner.name : "Mao-Mao"}!`);
          } else {
            const fee = Math.min(20, player.tc);
            player.tc -= fee;
            if (owner) owner.tc += fee;
            addLog(`${player.name} landed on Restricted Zone and paid the remaining ${fee} TC to ${owner ? owner.name : "Mao-Mao"}.`);
          }
        }
      } else if (tok.type === "fire_tile" && isExactLanding) {
        modifyPlayerTC(player, -15, "tile");
        player.nextRollMaxCap = 6;
        state.boardTokens.splice(i, 1);
        addLog(`${player.name} landed on Deathstar Fire (-15 TC, next Phase 1 roll max 6).`);
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
        shufflingText: "Shuffling Negative Effect Card"
      };
    }
    if (deckKind === "event") {
      return {
        theme: "event",
        eyebrow: "GLOBAL EVENT DECK",
        crestLabel: "EVENT",
        crestSub: "WORLD FATE",
        shufflingText: "Shuffling Global Event Card"
      };
    }
    return {
      theme: "positive",
      eyebrow: "POSITIVE EFFECT DECK",
      crestLabel: "BONUS",
      crestSub: "TARTARUS BLESSING",
      shufflingText: "Shuffling Positive Effect Card"
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
    const dismissedId = tileShuffleState.id;
    const wasVisualOnly = !!tileShuffleState.visualOnly;
    clearTileShuffleTimers();
    tileShuffleState = null;
    tileShuffleShownAt = 0;
    if (!wasVisualOnly && state && state.lastTileEffectReveal && state.lastTileEffectReveal.id === dismissedId) {
      state.lastTileEffectReveal.dismissed = true;
      broadcastMultiplayerState();
    }
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
          <div class="tef-deck-sub"><strong>${escapeHtml(playerName)}</strong> entered <strong>${escapeHtml(tileName)}</strong></div>
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
              <div class="tef-continue-hint">${needsMinigame ? "Click anywhere to start Dice of Fate" : "Click anywhere to continue"}</div>
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
        const disc = discardRandomCards(player, 1, { kind: "discard", sourceLabel: "-1 Card Tile" });
        addLog(`${player.name} discarded ${disc.length} card.`);
        return false;
      }
      case "pos_effect": {
        let jokerPassiveNote = "";
        if (hasPassive(player, "passive_awaken_arsene") && !player.awakenArseneUsedThisTurn) {
          player.awakenArseneUsedThisTurn = true;
          player.nextPhaseDiceMod += 1;
          addLog(`Awaken, Arsene!: ${player.name} landed on Positive Effect -> +1 extra die (max 1/turn)!`);
          jokerPassiveNote = `Awaken, Arsene!: ${player.name} +1 Extra Die (max 1/turn)`;
        }
        const deck = DATA.BOARD_CARDS.positive;
        const card = deck[Math.floor(Math.random() * deck.length)];
        return startTileEffectCardShuffle({
          deckKind: "positive",
          player,
          tile,
          card,
          extraOutcomeNote: jokerPassiveNote,
          applyFn: (drawnCard) => applyBoardEffectCard(player, drawnCard, { showToast: false }),
          onComplete: meta.onComplete
        });
      }
      case "neg_effect": {
        let jokerPassiveNote = "";
        if (hasPassive(player, "passive_awaken_arsene") && !player.awakenArseneUsedThisTurn) {
          player.awakenArseneUsedThisTurn = true;
          player.nextPhaseDiceMod += 1;
          addLog(`Awaken, Arsene!: ${player.name} landed on Negative Effect -> +1 extra die (max 1/turn)!`);
          jokerPassiveNote = `Awaken, Arsene!: ${player.name} +1 Extra Die (max 1/turn)`;
        }
        const deck = DATA.BOARD_CARDS.negative;
        const card = deck[Math.floor(Math.random() * deck.length)];
        return startTileEffectCardShuffle({
          deckKind: "negative",
          player,
          tile,
          card,
          extraOutcomeNote: jokerPassiveNote,
          applyFn: (drawnCard) => applyBoardEffectCard(player, drawnCard, { showToast: false }),
          onComplete: meta.onComplete
        });
      }
      case "event": {
        const deck = DATA.BOARD_CARDS.globalEvents;
        const card = deck[Math.floor(Math.random() * deck.length)];
        return startTileEffectCardShuffle({
          deckKind: "event",
          player,
          tile,
          card,
          applyFn: (drawnCard) => triggerGlobalEventCard(drawnCard, { showToast: false, deferMinigame: true }),
          onComplete: meta.onComplete
        });
      }
      case "versus": {
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
        openMerchantModal(tile.shopId || 1, false, player);
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
      outcomeText = `${player.name} drew +${drawn.length} card(s)`;
    } else if (card.effectType === "discard") {
      const disc = discardRandomCards(player, card.value, { kind: "discard", sourceLabel: card.name || "Negative Effect" });
      addLog(`Board Card [${card.name}]: ${player.name} discarded ${disc.length} card(s).`);
      outcomeText = `${player.name} discarded ${disc.length} card(s)`;
    } else if (card.effectType === "dice_next_turn") {
      player.nextTurnDiceMod += card.value;
      const sign = card.value > 0 ? "+" : "";
      addLog(`Board Card [${card.name}]: ${player.name} ${sign}${card.value} die next turn.`);
      outcomeText = `${player.name} gets ${sign}${card.value} die next turn`;
    }
    if (showToast) {
      showEffectSpotlight(card.category, card.name, card.description, card.image);
    }
    return outcomeText;
  }

  function triggerGlobalEventCard(card, opts = {}) {
    const showToast = opts.showToast !== false;
    const deferMinigame = !!opts.deferMinigame;
    addLog(`GLOBAL EVENT: [${card.name}]: ${card.description}`);
    if (showToast) {
      showEffectSpotlight("Global Event", card.name, card.description, card.image);
    }

    let outcomeText = card.description || "Global Event active!";
    let needsMinigame = false;

    if (card.effectType === "global_buff") {
      const eventRounds = card.durationRounds || card.durationTurns || 2;
      state.activeGlobalEvent = {
        card,
        remainingRounds: eventRounds
      };
      outcomeText = `Global Event active for ${eventRounds} ${eventRounds === 1 ? "Round" : "Rounds"}!`;
    } else if (card.effectType === "instant_all_tc") {
      state.players.forEach((p) => modifyPlayerTC(p, card.value, "tile"));
      const sign = card.value >= 0 ? "+" : "";
      outcomeText = `All players immediately receive ${sign}${card.value} TC!`;
    } else if (card.effectType === "instant_minigame") {
      if (deferMinigame) {
        needsMinigame = true;
        outcomeText = "A Random Minigame is starting for all players!";
      } else {
        runClashOfFateMinigame("Global Event: Sudden Minigame");
      }
    } else if (card.effectType === "instant_shuffle_all") {
      returnAllForeignCardsBeforeReshuffle();
      state.players.forEach((p) => reshufflePlayerCycleDeck(p));
      outcomeText = "All player decks reshuffled & new hands dealt!";
    }
    if (!deferMinigame) {
      renderAll();
      broadcastMultiplayerState();
    }
    return { outcomeText, needsMinigame };
  }

  function reshufflePlayerCycleDeck(p) {
    const retained = (p.hand || []).filter((c) => c && (c.retain || c.rarity === "Ultimate") && !isCardForeignToPlayer(c, p));
    const nonRetained = (p.hand || []).filter((c) => c && !c.retain && c.rarity !== "Ultimate");
    const cleanDeck = (p.deck || []).filter((c) => c && c.rarity !== "Ultimate");
    const cleanDiscard = (p.discard || []).filter((c) => c && c.rarity !== "Ultimate");

    const ownPool = [];
    [...cleanDeck, ...cleanDiscard, ...nonRetained].forEach((c) => {
      if (isCardForeignToPlayer(c, p)) {
        returnForeignCardToOwner(c, p);
      } else {
        ownPool.push(c);
      }
    });

    p.deck = shuffleArray(ownPool);
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

    const badgeText = isMyMultiplayerTurn ? "YOUR TURN" : `CYCLE ${state.cycle} · ROUND ${state.roundInCycle}`;
    const mainText = isMyMultiplayerTurn
      ? `Your turn has started, ${player.name}! (Time limit: 180s)`
      : `${player.name}'s turn has started (Timer: 03:00)`;

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
    addLog(`Turn timer expired (180s), ${player.name}'s turn ended automatically!`);
    showEffectSpotlight("Time Up (180s)", `${player.name}: Auto End Turn`, "The 3-minute turn limit expired; turn ended automatically.", null);
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

    state.players.forEach((p) => {
      p.passives = p.passives.filter((pas) => {
        if (pas.expiresOnCycleEnd) {
          return true;
        }
        if (typeof pas.remainingTurns === "number") {
          pas.remainingTurns--;
          if (pas.remainingTurns <= 0) {
            addLog(`${p.name}'s Passive [${pas.name}] has expired.`);
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
      startRandomMinigame("ffa", {
        reasonTitle: `End of Round ${state.roundInCycle} · Cycle ${state.cycle}`,
        afterAction: "advance_round"
      });
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
    player.awakenArseneUsedThisTurn = false;
    player.safeZoneImmune = false;
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

    // Thanatos Passive 2 - Fear Me: start turn within 3-block radius -> lose 1 dice
    if (state.activeMonster && state.activeMonster.id === "thanatos" && state.activeMonster.tileId) {
      const mDist = getTileDistance(player.tileId, state.activeMonster.tileId);
      if (mDist <= 3) {
        player.nextTurnDiceMod = Math.max(-1, (player.nextTurnDiceMod || 0) - 1);
        addLog(`Fear Me (Thanatos): ${player.name} started within 3 blocks of Thanatos (${mDist} steps) and loses 1 dice!`);
        triggerMonsterHorrorAlert(
          "FEAR ME",
          "THANATOS · PASSIVE",
          `${player.name} trembles inside Thanatos's 3-block shadow (-1 Dice).`,
          "passive"
        );
      }
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

    if (state.activeMonster && state.cycle % 2 !== 0) {
      addLog(`${state.activeMonster.name} receded back into the abyssal portal as Cycle ${state.cycle} (Day) began.`);
      state.activeMonster = null;
      state.isMonsterTurn = false;
    }

    // Return any stolen/foreign cards back to their original owners BEFORE reshuffling Cycle decks
    returnAllForeignCardsBeforeReshuffle();

    // Expire all active Unique / Passive effects on cycle transition & reshuffle decks
    state.players.forEach((p) => {
      if (Array.isArray(p.passives) && p.passives.length > 0) {
        p.passives.forEach((pas) => {
          addLog(`${p.name}'s Passive [${pas.name}] expired due to Cycle reset (${finishedCycle} -> ${state.cycle}).`);
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

    addLog(`CYCLE ${state.cycle} STARTED: All Cycle ${finishedCycle} Passives expired, decks reshuffled (6 cards), Merchant Shops refreshed.`);
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
    if (window.EFT_MINIGAMES && typeof window.EFT_MINIGAMES.clearAllTimers === "function") {
      window.EFT_MINIGAMES.clearAllTimers();
    }
  }

  function startRandomMinigame(mode = "ffa", opts = {}) {
    if (!state) return;
    if (window.EFT_MINIGAMES && typeof window.EFT_MINIGAMES.startRandomMinigame === "function") {
      clearDiceOfFateTimers();
      window.EFT_MINIGAMES.startRandomMinigame(mode, opts);
      return;
    }
    startDiceOfFateMinigame(opts.reasonTitle || "Minigame", opts.afterAction || "none");
  }

  function advanceRoundAfterMinigame() {
    if (!state) return;
    // Decrement 1-round [Cursed] status inflicted by Thanatos
    state.players.forEach((p) => {
      if (p.cursedRounds > 0) {
        p.cursedRounds--;
        if (p.cursedRounds === 0) {
          addLog(`[Cursed] lifted from ${p.name}.`);
        }
      }
    });

    if (state.activeGlobalEvent) {
      const curRem =
        typeof state.activeGlobalEvent.remainingRounds === "number"
          ? state.activeGlobalEvent.remainingRounds
          : Number(state.activeGlobalEvent.remainingTurns || 1);
      const nextRem = curRem - 1;
      state.activeGlobalEvent.remainingRounds = nextRem;
      if (nextRem <= 0) {
        addLog(`Global Event [${state.activeGlobalEvent.card.name}] expired after 2 rounds.`);
        state.activeGlobalEvent = null;
      }
    }

    state.activePlayerIndex = 0;
    if (state.roundInCycle < state.rules.turnsPerCycle) {
      state.roundInCycle++;
    } else {
      completeFullCycle();
    }

    // Monster spawns every 2 cycles starting at Cycle 2 (Cycle 2, 4, 6...) and ALWAYS takes the very first turn
    if (state.cycle >= 2 && state.cycle % 2 === 0 && !state.activeMonster) {
      spawnCycleMonster("thanatos", { startTurnAfterSpawn: true });
      return;
    }
    if (state.activeMonster) {
      state.isMonsterTurn = true;
      runMonsterTurn();
      return;
    }

    startPlayerTurn(getActivePlayer());
    if (camera.mode !== "wide") {
      camera.mode = "follow";
      focusCameraOnTile(getActivePlayer().tileId);
    }
  }

  function onMinigameClosed(afterAction, closedMg = null) {
    if (!state) return;
    if (afterAction === "advance_round") {
      advanceRoundAfterMinigame();
    } else if (afterAction === "forced_all_in" && closedMg && closedMg.data && closedMg.data.forcedAllInChoice) {
      const { challengerIndex, opponentIndex } = closedMg.data.forcedAllInChoice;
      const winnerP = state.players[challengerIndex];
      const oppP = state.players[opponentIndex];
      if (winnerP && oppP && oppP.shards > 0) {
        pendingInteraction = {
          type: "forced_all_in_reward",
          player: winnerP,
          targetPlayerIndex: oppP.index,
          myRoll: "WIN",
          oppRoll: closedMg.name || "Versus"
        };
        if (isLocalHumanTurnForPlayer(winnerP)) {
          openForcedAllInChoiceModal(winnerP, oppP, "WIN", closedMg.name || "Versus");
        }
      }
    }
    playSfx("click");
    renderAll();
    broadcastMultiplayerState();
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
    if (mg.gameId && window.EFT_MINIGAMES) {
      window.EFT_MINIGAMES.syncRuntime();
      return;
    }
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
    if (mg.gameId && window.EFT_MINIGAMES) {
      if (mg.gameId === "dice_of_fate" && mg.phase === "playing") {
        const curIdx = window.EFT_MINIGAMES.getCurrentDiceOfFateEntryIndex(mg);
        const curEntry = curIdx >= 0 ? mg.entries[curIdx] : null;
        window.EFT_MINIGAMES.dispatchAction("dof_roll", {}, curEntry ? curEntry.playerIndex : null);
      }
      return;
    }
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
      addLog(`Dice of Fate TIE (${maxTotal})! Tie-Breaker #${mg.tieRound}: ${mg.tiedNames.join(" vs ")}.`);
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
    if (state.activeMinigame.gameId && window.EFT_MINIGAMES) {
      window.EFT_MINIGAMES.finishActiveMinigame();
      return;
    }
    if (state.activeMinigame.status !== "finished") return;
    if (isRemoteClient()) {
      sendClientActionToHost("minigame_finish", {});
      return;
    }

    const afterAction = state.activeMinigame.afterAction;
    clearDiceOfFateTimers();
    state.activeMinigame = null;

    if (afterAction === "advance_round") {
      advanceRoundAfterMinigame();
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
      if (window.EFT_MINIGAMES) window.EFT_MINIGAMES.renderOverlay();
      return;
    }
    if (mg.gameId && window.EFT_MINIGAMES) {
      window.EFT_MINIGAMES.renderOverlay();
      return;
    }

    const curEntryIdx = mg.status === "rolling" ? getCurrentDiceOfFateEntryIndex(mg) : -1;
    const curEntry = curEntryIdx >= 0 ? mg.entries[curEntryIdx] : null;
    let statusText = "Dice of Fate";
    if (mg.status === "finished") {
      statusText = `Pemenang: ${mg.winnerName} (Roll ${mg.winnerTotal})!`;
    } else if (mg.status === "tie_pause") {
      statusText = `TIE! Tie-Breaker #${mg.tieRound}: ${(mg.tiedNames || []).join(" vs ")}`;
    } else if (curEntry) {
      const tieTag = mg.tieRound > 0 ? `Tie-Breaker #${mg.tieRound} · ` : "";
      statusText = `${tieTag}Rolling Now: ${curEntry.name}`;
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
            ? pt.cover
              ? `<img class="dof-portrait-img is-cover" src="${pt.src}" alt="${escapeHtml(entry.name)}" style="inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 22%;" />`
              : `<img class="dof-portrait-img" src="${pt.src}" alt="${escapeHtml(entry.name)}" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
            : `<div class="ph-portrait-fallback"><div class="ph-fallback-icon" style="fill:${escapeHtml(entry.color)};">${getCharacterSvgIcon(entry.charId)}</div></div>`;

        let numText = "-";
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
            ? `<span class="dof-tie-badge">Tie-Breaker</span>`
            : `<span class="dof-wait-tag">Gugur</span>`;
        } else if (entry.eliminated) {
          rightHtml = `<span class="dof-wait-tag">Gugur</span>`;
        } else if (isCurrent) {
          if (mg.isAnimatingRoll) {
            rightHtml = `<span class="dof-wait-tag">Rolling dice...</span>`;
          } else if (canLocalPlayerRollDiceOfFate(entry)) {
            rightHtml = `${mg.tieRound > 0 ? `<span class="dof-tie-badge">Tie-Breaker</span>` : ""}<button class="dof-roll-btn" onclick="window.EFT_APP.rollDiceOfFateCurrent()">Roll Dice</button>`;
          } else {
            rightHtml = `<span class="dof-wait-tag">Waiting for ${escapeHtml(entry.name)}...</span>`;
          }
        } else if (hasRolled) {
          rightHtml = `<span class="dof-wait-tag">Done</span>`;
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
              ? `<button class="dof-finish-btn" onclick="window.EFT_APP.finishDiceOfFateMinigame()">Done</button>`
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

  function runClashOfFateMinigame(reasonTitle = "Random Minigame") {
    startRandomMinigame("ffa", { reasonTitle, afterAction: "none" });
  }

  // ============================================================================
  // SKILL CARD EXECUTION ENGINE
  // ============================================================================
  function canPlaySkillCard(player, card) {
    if (state.winner) return { ok: false, reason: "Match has already ended." };
    if (isWalkingAnim || isTileEffectAnimating) return { ok: false, reason: "Wait for the current animation to finish." };
    if (isAdminUnlocked && adminFreeSkillUse) {
      return { ok: true, freeAdmin: true };
    }
    if (player.silencedThisPhase) {
      return { ok: false, reason: "Silenced by All-Out Attack for this Phase." };
    }
    const isReactiveOnlyHaste =
      card.haste &&
      (card.effectKey === "retreat_2_negate" ||
        card.effectKey === "reactive_negate_target" ||
        card.effectKey === "haste_negate_skill");
    if (isReactiveOnlyHaste) {
      return {
        ok: false,
        reason:
          "This [Haste] card triggers reactively out of turn! A reaction prompt will appear automatically when its trigger condition occurs."
      };
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
        const ch = card.choices && card.choices.length > 0 ? card.choices : [6];
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

  function getRarityVisualMeta(rarity) {
    const r = String(rarity || "Common").toLowerCase();
    if (r === "uncommon") return { key: "uncommon", color: "#22c55e", rgb: "34, 197, 94" };
    if (r === "rare") return { key: "rare", color: "#38bdf8", rgb: "56, 189, 248" };
    if (r === "epic") return { key: "epic", color: "#a855f7", rgb: "168, 85, 247" };
    if (r === "unique") return { key: "unique", color: "#ef4444", rgb: "239, 68, 68" };
    if (r === "ultimate") return { key: "ultimate", color: "#facc15", rgb: "250, 204, 21" };
    return { key: "common", color: "#9ca3af", rgb: "156, 163, 175" };
  }

  function formatDramaticCardDescription(rawDesc, fallbackName = "") {
    let text = String(rawDesc || fallbackName || "").trim();
    const badges = [];
    text = text.replace(/^\s*(?:\[([^\]]+)\]\s*)+/, (match) => {
      const inner = match.match(/\[([^\]]+)\]/g) || [];
      inner.forEach((b) => badges.push(b.slice(1, -1).trim()));
      return "";
    }).trim();

    let leadLabel = "";
    const passiveLead = text.match(/^(Passive|Transformation)\s*:\s*/i);
    if (passiveLead) {
      leadLabel = passiveLead[1] + ":";
      text = text.slice(passiveLead[0].length).trim();
    } else if (badges.length > 0) {
      leadLabel = badges.join(" · ");
    }

    let durationText = "";
    const durMatch = text.match(/\s*(?:\(?\s*Duration\s*:\s*([^)]+?)\s*\)?\.?\s*)$/i);
    if (durMatch) {
      durationText = durMatch[1].replace(/\.+$/, "").trim();
      text = text.slice(0, durMatch.index).trim();
    }

    let html = "";
    if (leadLabel) {
      html += `<div class="ca-dramatic-sublabel">${escapeHtml(leadLabel)}</div>`;
    }
    html += `<div class="ca-dramatic-body">${escapeHtml(text || rawDesc || "")}</div>`;
    if (durationText) {
      html += `
        <div class="ca-dramatic-duration-block">
          <div class="ca-dramatic-sublabel">Duration:</div>
          <div class="ca-dramatic-duration-val">${escapeHtml(durationText)}</div>
        </div>`;
    }
    return html;
  }

  function buildCasterPillHtml(payload, isLarge = false) {
    const ch = DATA.CHARACTERS[payload.charId] || {};
    const pillSrc =
      ch.menuPortrait ||
      (ch.compPortrait && ch.compPortrait.src) ||
      (ch.portrait && ch.portrait.src) ||
      "";
    const pillPos = (ch.compPortrait && ch.compPortrait.objectPosition) || "50% 22%";
    return `
      <div class="ca-player-pill ${isLarge ? "ca-player-pill-lg" : ""}">
        <div class="ca-player-pill-art">
          ${
            pillSrc
              ? `<img src="${pillSrc}" alt="${escapeHtml(payload.casterName || "")}" style="object-position:${pillPos};" />`
              : `<div class="ca-player-pill-fallback">${getCharacterSvgIcon(payload.charId)}</div>`
          }
        </div>
        <span class="ca-player-pill-name">${escapeHtml(payload.casterName || "Player")}</span>
      </div>`;
  }

  function dismissSideCardPopup() {
    clearTimeout(sideCardPopupTimerId);
    sideCardPopupTimerId = null;
    const feed = document.getElementById("card-activated-feed");
    if (feed) {
      feed.classList.remove("visible");
      feed.innerHTML = "";
    }
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
    if (force) {
      dismissSideCardPopup();
    }
    if (!skipQueueFlush && !isSkillActivationInFlight) {
      flushNextQueuedTileEffect();
      scheduleMultiplayerBotIfNeeded();
    }
  }

  function showDramaticSkillPopup(payload) {
    if (!payload) return;
    const prof = payload.profile || { theme: "sonic", tagline: "SKILL ACTIVATED", accent: "#34d399", accentRgb: "52, 211, 153" };
    const rarityStr = String(payload.rarity || "Common");
    const isUltimate = rarityStr === "Ultimate";
    const isUnique = rarityStr === "Unique";
    const isDramaticCenter = isUnique || isUltimate;

    // Keep exact same character skill SFX for every card activation
    playSfx("skill", `${payload.charId || ""}:${prof.theme}`);

    if (isDramaticCenter) {
      const overlay = document.getElementById("skill-dramatic-overlay");
      if (!overlay) return;
      dismissSkillPopup(true, true);

      const autoMs = isUltimate ? 6100 : 5400;
      const hasDistinctOutcome =
        payload.outcomeText &&
        String(payload.outcomeText).trim() !== String(payload.description || "").trim();

      overlay.innerHTML = `
        <div class="ca-dramatic-stage ${isUltimate ? "is-ultimate" : "is-unique"}">
          <div class="ca-dramatic-left">
            <div class="ca-dramatic-heading">
              <span class="ca-dramatic-head-top">${isUltimate ? "Ultimate" : "Unique"}</span>
              <span class="ca-dramatic-head-bot">Activated</span>
            </div>
            <div class="ca-dramatic-card-wrap">
              ${
                payload.cardImg
                  ? `<img class="ca-dramatic-card-img" src="${payload.cardImg}" alt="${escapeHtml(payload.cardName || "")}" />`
                  : `<div class="ca-dramatic-card-fallback">${escapeHtml(payload.cardName || "")}</div>`
              }
            </div>
            ${buildCasterPillHtml(payload, true)}
          </div>
          <div class="ca-dramatic-divider" aria-hidden="true"></div>
          <div class="ca-dramatic-right">
            ${formatDramaticCardDescription(payload.description || payload.outcomeText || "", payload.cardName)}
            ${
              hasDistinctOutcome
                ? `<div class="ca-dramatic-outcome">${escapeHtml(payload.outcomeText)}</div>`
                : ""
            }
          </div>
          <div class="ca-dramatic-hint">Click anywhere to continue</div>
        </div>`;

      skillPopupShownAt = Date.now();
      overlay.classList.add("visible");
      const caster = state && state.players ? state.players.find((p) => p.name === payload.casterName) : null;
      triggerGameFeedback(isUltimate ? "large" : "medium", {
        tileId: caster ? caster.tileId : null,
        vfxKind: "skill_cast",
        color: isUltimate ? "#e5a93c" : "#ef4444"
      });
      skillPopupTimerId = setTimeout(() => {
        dismissSkillPopup(true);
      }, autoMs);
      return;
    }

    // Normal cards (Common / Uncommon / Rare / Epic): sleek side notification below Last Card Used
    const feed = document.getElementById("card-activated-feed");
    if (!feed) return;
    clearTimeout(sideCardPopupTimerId);
    sideCardPopupTimerId = null;

    const rMeta = getRarityVisualMeta(rarityStr);
    const mainDesc = String(payload.description || payload.outcomeText || payload.cardName || "").trim();
    const hasDistinctOutcome =
      payload.outcomeText &&
      String(payload.outcomeText).trim() !== String(payload.description || "").trim();

    feed.innerHTML = `
      <div class="ca-side-panel rarity-${escapeHtml(rMeta.key)}"
           style="--ca-rarity-color:${escapeHtml(rMeta.color)};--ca-rarity-rgb:${escapeHtml(rMeta.rgb)};"
           title="Click to close">
        <div class="ca-side-desc-col">
          <div class="ca-side-desc-text">${escapeHtml(mainDesc)}</div>
          ${
            hasDistinctOutcome
              ? `<div class="ca-side-outcome-note">${escapeHtml(payload.outcomeText)}</div>`
              : ""
          }
        </div>
        <div class="ca-side-divider" aria-hidden="true"></div>
        <div class="ca-side-card-col">
          <div class="ca-side-heading">
            <span class="ca-side-head-top">Cards</span>
            <span class="ca-side-head-bot">Activated</span>
          </div>
          ${
            payload.cardImg
              ? `<img class="ca-side-card-img" src="${payload.cardImg}" alt="${escapeHtml(payload.cardName || "")}" />`
              : `<div class="ca-side-card-fallback">${escapeHtml(payload.cardName || "")}</div>`
          }
          ${buildCasterPillHtml(payload, false)}
        </div>
        <div class="ca-side-rarity-bar" title="${escapeHtml(rarityStr)}"></div>
      </div>`;

    feed.classList.remove("visible");
    void feed.offsetWidth;
    feed.classList.add("visible");

    sideCardPopupTimerId = setTimeout(() => {
      dismissSideCardPopup();
    }, 4800);
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
      `Forced All-In: ${escapeHtml(player.name)} Wins (${myRoll} vs ${oppRoll})!`,
      `<div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:rgba(234,179,8,0.12);border:1px solid rgba(250,204,21,0.45);border-radius:10px;padding:12px;font-size:0.86rem;color:#fef08a;">
          <strong>${escapeHtml(player.name)}</strong> won the 1v1 Duel against <strong>${escapeHtml(targetPlayer.name)}</strong>!
          Choose your reward:
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button class="btn btn-gold" onclick="window.EFT_APP.resolveForcedAllInChoice('tc')">
            Steal All Opponent TC (💰 ${targetPlayer.tc} TC)
          </button>
          <button class="btn btn-emerald" onclick="window.EFT_APP.resolveForcedAllInChoice('shard')">
            Steal 1 Tartarus Shard (💎 ${targetPlayer.shards} -> -1)
          </button>
        </div>
      </div>`,
      "forced_all_in"
    );
  }

  function syncForcedAllInModal() {
    const modal = document.getElementById("app-modal");
    const titleEl = document.getElementById("modal-title");
    const isAlreadyOpen = modal && modal.classList.contains("open") && titleEl && titleEl.dataset.modalKind === "forced_all_in";
    if (!pendingInteraction || pendingInteraction.type !== "forced_all_in_reward") {
      if (isAlreadyOpen) closeModal();
      return;
    }
    const winnerP = pendingInteraction.player || getActivePlayer();
    const targetP = state && state.players[pendingInteraction.targetPlayerIndex];
    if (!winnerP || !targetP || !isLocalHumanTurnForPlayer(winnerP)) return;
    if (!isAlreadyOpen) {
      openForcedAllInChoiceModal(winnerP, targetP, pendingInteraction.myRoll || "WIN", pendingInteraction.oppRoll || "Versus");
    }
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
        discardRandomCards(p, 1, { kind: "discard", sourceLabel: "-1 Card Tile" });
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

  function getEmperorTaxInfo(player, card) {
    if (!state || !player || !card) return { owners: [], perOwner: 5, totalTax: 0 };
    if (isAdminUnlocked && adminFreeSkillUse) return { owners: [], perOwner: 5, totalTax: 0 };
    if (card.rarity !== "Common" && card.rarity !== "Uncommon") {
      return { owners: [], perOwner: 5, totalTax: 0 };
    }
    const owners = state.players.filter(
      (other) => other.index !== player.index && hasPassive(other, "passive_emperor_tax")
    );
    return {
      owners,
      perOwner: 5,
      totalTax: owners.length * 5
    };
  }

  function openEmperorTaxConfirmModal(player, card, flowCard, options, taxInfo) {
    const canAfford = player.tc >= taxInfo.totalTax;
    const ownerNames = taxInfo.owners.map((o) => o.name).join(" & ");
    const emperorImg = "assets/cards/characters/maomao/e.webp";
    pendingEmperorTaxPlay = canAfford
      ? { cardUid: card.uid, flowCard: flowCard || card, options: options || {} }
      : null;

    if (canAfford) {
      openInfoModal(
        `The Emperor's Favor: Pay 💰 ${taxInfo.totalTax} TC Tax?`,
        `<div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:14px;align-items:center;">
            <img src="${emperorImg}" alt="The Emperor's Favor" style="width:82px;border-radius:8px;border:1px solid rgba(16,185,129,0.5);flex-shrink:0;" />
            <div style="font-size:0.84rem;line-height:1.5;color:#e2e8f0;">
              <div><strong>${escapeHtml(ownerNames)}</strong> has the active passive <strong style="color:#6ee7b7;">The Emperor's Favor</strong>.</div>
              <div style="margin-top:6px;">
                To activate this <strong>${escapeHtml(card.rarity)}</strong> card [<strong>${escapeHtml(card.name)}</strong>], you must pay a tax of <strong style="color:#fde047;">💰 ${taxInfo.totalTax} TC</strong> to ${escapeHtml(ownerNames)}.
              </div>
            </div>
          </div>
          <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.38);border-radius:10px;padding:10px 12px;font-size:0.8rem;color:#d1fae5;display:flex;justify-content:space-between;align-items:center;">
            <span>Your TC Balance</span>
            <strong>💰 ${player.tc} TC → 💰 ${player.tc - taxInfo.totalTax} TC</strong>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button class="btn btn-emerald" onclick="window.EFT_APP.resolveEmperorTaxPrompt(true)">
              Pay 💰 ${taxInfo.totalTax} TC &amp; Activate
            </button>
            <button class="btn btn-rose" onclick="window.EFT_APP.resolveEmperorTaxPrompt(false)">
              Decline (Cancel)
            </button>
          </div>
        </div>`
      );
    } else {
      openInfoModal(
        `The Emperor's Favor: Insufficient TC`,
        `<div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:14px;align-items:center;">
            <img src="${emperorImg}" alt="The Emperor's Favor" style="width:82px;border-radius:8px;border:1px solid rgba(244,63,94,0.5);flex-shrink:0;" />
            <div style="font-size:0.84rem;line-height:1.5;color:#e2e8f0;">
              <div><strong>${escapeHtml(ownerNames)}</strong> has the active passive <strong style="color:#6ee7b7;">The Emperor's Favor</strong>.</div>
              <div style="margin-top:6px;">
                Activating this <strong>${escapeHtml(card.rarity)}</strong> card [<strong>${escapeHtml(card.name)}</strong>] requires a tax of <strong style="color:#fde047;">💰 ${taxInfo.totalTax} TC</strong>.
              </div>
            </div>
          </div>
          <div style="background:rgba(225,29,72,0.16);border:1px solid rgba(244,63,94,0.45);border-radius:10px;padding:10px 12px;font-size:0.82rem;color:#fda4af;">
            Your current balance is only <strong>💰 ${player.tc} TC</strong> (less than ${taxInfo.totalTax} TC). Because you cannot pay the tax, this skill <strong>cannot be activated</strong>.
          </div>
          <button class="btn" onclick="window.EFT_APP.resolveEmperorTaxPrompt(false)">
            Close (Cancel)
          </button>
        </div>`
      );
    }
  }

  function resolveEmperorTaxPrompt(accepted) {
    const req = pendingEmperorTaxPlay;
    pendingEmperorTaxPlay = null;
    closeModal();
    if (!accepted || !req) {
      playSfx("click");
      return;
    }
    const player = getActivePlayer();
    const card = player ? player.hand.find((c) => c.uid === req.cardUid) : null;
    if (!player || !card) return;
    const taxInfo = getEmperorTaxInfo(player, card);
    if (taxInfo.owners.length > 0 && player.tc < taxInfo.totalTax) {
      openEmperorTaxConfirmModal(player, card, req.flowCard, req.options, taxInfo);
      return;
    }
    proceedCardActivationAfterTax(req.cardUid, req.flowCard || card, {
      ...(req.options || {}),
      emperorTaxConfirmed: true
    });
  }

  function proceedCardActivationAfterTax(cardUid, flowCard, options = {}) {
    if (flowCard.effectKey === "relocate_board_traps") {
      startTokenSourceSelection(cardUid, options, flowCard);
      return;
    }

    if (flowCard.effectKey === "sam_fire_tiles") {
      startSamFireTileSelection(cardUid, options, flowCard);
      return;
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

  function getCardTargetedPlayerIndices(caster, card, options = {}) {
    if (!state || !caster || !card) return [];
    let effectiveCard = card;
    if (card.effectKey === "copy_last_skill" && options.copiedSkillEntryId) {
      const entry = (state.recentOpponentSkills || []).find((e) => e.id === options.copiedSkillEntryId);
      if (entry && entry.card) effectiveCard = entry.card;
    }

    const res = new Set();
    const isSingleTarget =
      effectiveCard.targetType === "any_player" ||
      effectiveCard.targetType === "any_player_in_radius" ||
      effectiveCard.targetType === "other_player" ||
      effectiveCard.targetType === "opponent_in_radius";

    if (isSingleTarget) {
      let tp = null;
      const rad = effectiveCard.radius || 5;
      if (options.targetPlayerIndex !== undefined && state.players[options.targetPlayerIndex]) {
        tp = state.players[options.targetPlayerIndex];
      } else if (effectiveCard.targetType === "opponent_in_radius" || effectiveCard.targetType === "any_player_in_radius") {
        tp =
          state.players.find(
            (p) => p.index !== caster.index && !p.inSpawn && getTileDistance(caster.tileId, p.tileId) <= rad
          ) || null;
      } else if (effectiveCard.targetType === "other_player" || effectiveCard.targetType === "any_player") {
        tp = state.players.find((p) => p.index !== caster.index && !p.inSpawn) || null;
      }
      if (tp && tp.index !== caster.index && !tp.inSpawn) {
        res.add(tp.index);
      }
    }

    if (effectiveCard.targetType === "opponents_in_radius_aoe") {
      const rad = effectiveCard.radius || 8;
      state.players.forEach((p) => {
        if (p.index !== caster.index && !p.inSpawn && getTileDistance(caster.tileId, p.tileId) <= rad) {
          res.add(p.index);
        }
      });
    } else if (effectiveCard.effectKey === "tax_all_opponents_15" || effectiveCard.effectKey === "pull_all_players") {
      state.players.forEach((p) => {
        if (p.index !== caster.index && !p.inSpawn) res.add(p.index);
      });
    } else if (effectiveCard.effectKey === "sam_dash_aoe_5tc" && options.targetTileId) {
      state.players.forEach((p) => {
        if (p.index !== caster.index && !p.inSpawn && getTileDistance(options.targetTileId, p.tileId) <= 1) {
          res.add(p.index);
        }
      });
    }

    return Array.from(res);
  }

  function getEligibleHasteReactions(caster, card, options = {}) {
    if (!state || !state.rules || !state.rules.allowHaste) return [];
    const targetedIndices = getCardTargetedPlayerIndices(caster, card, options);
    const queue = [];

    const totalP = state.players.length;
    for (let offset = 1; offset < totalP; offset++) {
      const defender = state.players[(caster.index + offset) % totalP];
      if (!defender || defender.index === caster.index) continue;
      if (defender.silencedThisPhase) continue;

      const isTargeted = targetedIndices.includes(defender.index);
      const readyCards = (defender.hand || []).filter((hc) => {
        if (!hc || !hc.haste) return false;
        if (defender.cooldowns && defender.cooldowns[hc.id] > 0) return false;

        if (hc.effectKey === "retreat_2_negate") {
          return isTargeted;
        }
        if (hc.effectKey === "reactive_negate_target") {
          return isTargeted && card.rarity !== "Epic" && card.rarity !== "Ultimate";
        }
        if (hc.effectKey === "haste_negate_skill") {
          return card.rarity !== "Epic" && card.rarity !== "Unique" && card.rarity !== "Ultimate";
        }
        return false;
      });

      if (readyCards.length > 0) {
        queue.push({
          playerIndex: defender.index,
          cardUids: readyCards.map((c) => c.uid)
        });
      }
    }
    return queue;
  }

  function completeSkillCardExecution(player, card, options = {}) {
    isSkillActivationInFlight = true;
    let outcomeText = executeCardEffect(player, card, options) || card.description;
    if (pendingInteraction && pendingInteraction.type === "stage_is_mine") {
      outcomeText += " -> Passive [The Stage Is Mine] Active! Choose to move +1 / +2 / -1 on the map.";
    }

    const usedCardImg = getCardImage(card, card.ownerCharId || card.charId || player.charId);
    state.lastSkillCardUsed = {
      id: "lcu_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      charId: player.charId,
      cardId: card.id,
      casterName: player.name,
      cardName: card.name,
      rarity: card.rarity,
      cardImg: usedCardImg,
      description: card.description,
      outcomeText,
      cycle: state.cycle,
      round: state.roundInCycle
    };

    triggerDramaticSkillEvent({
      charId: player.charId,
      cardId: card.id,
      casterName: player.name,
      cardName: card.name,
      rarity: card.rarity,
      cardImg: usedCardImg,
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

  function playSkillCardFromHand(cardUid, options = {}) {
    if (!canLocalPlayerAct()) return;
    const actP = getActivePlayer();
    if (actP && !actP.isBot) {
      markRoomRealPlayerActivity();
    }
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

    const emperorTax = getEmperorTaxInfo(player, card);
    if (emperorTax.owners.length > 0) {
      if (player.tc < emperorTax.totalTax) {
        addLog(`The Emperor's Favor: ${player.name} failed to activate [${card.name}] (needs ${emperorTax.totalTax} TC, currently has ${player.tc} TC).`);
        if (!player.isBot && isLocalHumanTurnForPlayer(player)) {
          openEmperorTaxConfirmModal(player, card, card, options, emperorTax);
        }
        renderAll();
        broadcastMultiplayerState();
        return;
      }
    }

    saveSnapshot();
    selectedCardUid = null;

    if (emperorTax.owners.length > 0) {
      emperorTax.owners.forEach((other) => {
        player.tc = Math.max(0, player.tc - emperorTax.perOwner);
        other.tc += emperorTax.perOwner;
        addLog(`The Emperor's Favor: ${player.name} paid ${emperorTax.perOwner} TC tax to ${other.name}.`);
      });
      playSfx("coin_loss");
    }

    player.hand.splice(cardIdx, 1);
    if (card.rarity !== "Ultimate") {
      if (isCardForeignToPlayer(card, player)) {
        returnForeignCardToOwner(card, player);
      } else {
        player.discard.push(card);
      }
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

    // Check reactive out-of-turn [Haste] cards from opponents before executing effect!
    if (!options.skipHasteCheck) {
      const hasteQueue = getEligibleHasteReactions(player, card, options);
      if (hasteQueue.length > 0) {
        const firstEntry = hasteQueue[0];
        const firstDefender = state.players[firstEntry.playerIndex];
        pendingInteraction = {
          id: "haste_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          type: "haste_reaction",
          player: firstDefender,
          casterIndex: player.index,
          card: JSON.parse(JSON.stringify(card)),
          options: { ...(options || {}) },
          targetedIndices: getCardTargetedPlayerIndices(player, card, options),
          reactionQueue: hasteQueue,
          negatedTargetIndices: []
        };
        addLog(`[Haste Window]: ${player.name} played [${card.name}] -> ${firstDefender.name} can respond with a [Haste] card!`);
        playSfx("branch");
        renderAll();
        broadcastMultiplayerState();
        return;
      }
    }

    completeSkillCardExecution(player, card, options);
  }

  function openHasteReactionModal() {
    if (!pendingInteraction || pendingInteraction.type !== "haste_reaction") return;
    const { player: defender, casterIndex, card, reactionQueue } = pendingInteraction;
    if (!defender || !isLocalHumanTurnForPlayer(defender)) return;
    const caster = state.players[casterIndex] || getActivePlayer();
    const curEntry = Array.isArray(reactionQueue) && reactionQueue[0] ? reactionQueue[0] : null;
    const allowedUids = curEntry ? curEntry.cardUids || [] : [];
    const usableCards = (defender.hand || []).filter((c) => allowedUids.includes(c.uid));
    const incomingImg = getCardImage(card, card.ownerCharId || card.charId || caster.charId);

    const hasteCardsHtml = usableCards
      .map((hc) => {
        const hcImg = getCardImage(hc, hc.ownerCharId || hc.charId || defender.charId);
        return `
          <div class="haste-option-card">
            <img class="haste-option-img" src="${hcImg}" alt="${escapeHtml(hc.name)}" />
            <div class="haste-option-meta">
              <div class="haste-option-name">${escapeHtml(hc.name)} <span class="tag-badge">HASTE · ${escapeHtml(hc.rarity)}</span></div>
              <div class="haste-option-desc">${escapeHtml(hc.description)}</div>
              <button type="button" class="btn btn-emerald btn-sm" onclick="window.EFT_APP.resolveHasteReaction('${escapeHtml(hc.uid)}')">
                Activate ${escapeHtml(hc.name)}
              </button>
            </div>
          </div>`;
      })
      .join("");

    openInfoModal(
      `Reaksi [Haste]: ${escapeHtml(defender.name)}`,
      `<div style="display:flex;flex-direction:column;gap:12px;">
        <div class="haste-incoming-box">
          <img class="haste-incoming-img" src="${incomingImg}" alt="${escapeHtml(card.name)}" />
          <div style="font-size:0.82rem;line-height:1.45;color:#e2e8f0;">
            <div><strong style="color:#fde047;">${escapeHtml(caster.name)}</strong> activated <strong>[${escapeHtml(card.name)}]</strong> (${escapeHtml(card.rarity)}).</div>
            <div style="margin-top:4px;color:var(--text-muted);">${escapeHtml(card.description)}</div>
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--mint-light);font-weight:700;">Choose a [Haste] card from your hand to react out of turn:</div>
        <div style="display:flex;flex-direction:column;gap:8px;">${hasteCardsHtml}</div>
        <button type="button" class="btn" onclick="window.EFT_APP.resolveHasteReaction(null)">
          Pass (Let Effect Resolve)
        </button>
      </div>`,
      "haste_reaction"
    );
  }

  function syncHasteReactionModal() {
    if (!pendingInteraction || pendingInteraction.type !== "haste_reaction") {
      lastOpenedHasteId = null;
      return;
    }
    if (!isLocalHumanTurnForPlayer(pendingInteraction.player)) return;
    if (lastOpenedHasteId !== pendingInteraction.id) {
      lastOpenedHasteId = pendingInteraction.id;
      openHasteReactionModal();
    }
  }

  function resolveHasteReaction(hasteCardUid = null) {
    if (!canLocalPlayerAct()) return;
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
    if (isRemoteClient()) {
      sendClientActionToHost("haste_react", { hasteCardUid: hasteCardUid || null });
      closeModal();
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "haste_reaction") return;

    const pInt = pendingInteraction;
    const defender = pInt.player;
    const caster = state.players[pInt.casterIndex] || getActivePlayer();
    const incomingCard = pInt.card;
    const incomingOptions = pInt.options || {};
    const targetedIndices = pInt.targetedIndices || [];
    const negatedTargets = Array.isArray(pInt.negatedTargetIndices) ? [...pInt.negatedTargetIndices] : [];
    const remainingQueue = Array.isArray(pInt.reactionQueue) ? pInt.reactionQueue.slice(1) : [];

    lastOpenedHasteId = null;
    closeModal();

    let fullyNegated = false;

    if (hasteCardUid && defender) {
      const hIdx = (defender.hand || []).findIndex((c) => c.uid === hasteCardUid);
      if (hIdx !== -1) {
        const hCard = defender.hand.splice(hIdx, 1)[0];
        if (isCardForeignToPlayer(hCard, defender)) returnForeignCardToOwner(hCard, defender);
        else defender.discard.push(hCard);
        defender.cooldowns[hCard.id] = 1;

        let reactionOutcome = "";
        if (hCard.effectKey === "retreat_2_negate") {
          movePlayerInstantAlongPath(defender, 2, -1, true, {
            soundTheme: defender.isSamMode ? "sam" : defender.charId
          });
          negatedTargets.push(defender.index);
          if (targetedIndices.length <= 1) {
            fullyNegated = true;
            reactionOutcome = `${defender.name} stepped back 2 blocks with [Orderly Retreat] and negated ${caster.name}'s [${incomingCard.name}]!`;
          } else {
            reactionOutcome = `${defender.name} stepped back 2 blocks with [Orderly Retreat] and dodged [${incomingCard.name}]!`;
          }
          addLog(`[HASTE - ${hCard.name}]: ${reactionOutcome}`);
        } else if (hCard.effectKey === "reactive_negate_target") {
          negatedTargets.push(defender.index);
          if (targetedIndices.length <= 1) {
            fullyNegated = true;
            reactionOutcome = `${defender.name} activated [Poison Testing] and negated ${caster.name}'s [${incomingCard.name}]!`;
          } else {
            reactionOutcome = `${defender.name} activated [Poison Testing] and resisted [${incomingCard.name}]!`;
          }
          addLog(`[HASTE - ${hCard.name}]: ${reactionOutcome}`);
        } else if (hCard.effectKey === "haste_negate_skill") {
          fullyNegated = true;
          reactionOutcome = `${defender.name} activated [No Please] and canceled ${caster.name}'s [${incomingCard.name}]!`;
          addLog(`[HASTE - ${hCard.name}]: ${reactionOutcome}`);
        }

        const hImg = getCardImage(hCard, hCard.ownerCharId || hCard.charId || defender.charId);
        state.lastSkillCardUsed = {
          id: "lcu_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          charId: defender.charId,
          cardId: hCard.id,
          casterName: defender.name,
          cardName: hCard.name,
          rarity: hCard.rarity,
          cardImg: hImg,
          description: hCard.description,
          outcomeText: reactionOutcome,
          cycle: state.cycle,
          round: state.roundInCycle
        };

        triggerDramaticSkillEvent({
          charId: defender.charId,
          cardId: hCard.id,
          casterName: defender.name,
          cardName: hCard.name,
          rarity: hCard.rarity,
          cardImg: hImg,
          description: hCard.description,
          outcomeText: reactionOutcome,
          profile: getSkillDramaticProfile(hCard, defender.charId)
        });
      }
    }

    if (fullyNegated) {
      pendingInteraction = null;
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    if (remainingQueue.length > 0) {
      const nextEntry = remainingQueue[0];
      const nextDefender = state.players[nextEntry.playerIndex];
      pendingInteraction = {
        ...pInt,
        id: "haste_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        player: nextDefender,
        reactionQueue: remainingQueue,
        negatedTargetIndices: negatedTargets
      };
      renderAll();
      broadcastMultiplayerState();
      return;
    }

    pendingInteraction = null;
    completeSkillCardExecution(caster, incomingCard, {
      ...incomingOptions,
      negatedTargetIndices: negatedTargets
    });
  }

  function cardActivatesBlockEffect(card) {
    if (!card) return false;
    const desc = String(card.description || "");
    return /\[Activate (?:Block|Tile|Tiles) Effect\]|activate tiles effect/i.test(desc);
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
        const msg = `No valid targets within ${cardRadius} blocks.`;
        addLog(`[${card.name}]: ${msg}`);
        return msg;
      }
      if (card.targetType === "opponent_in_radius" && targetPlayer.index === player.index) {
        const msg = `[${card.name}] can only target another player within ${cardRadius} blocks.`;
        addLog(msg);
        return msg;
      }
      const distToTarget = getTileDistance(player.tileId, targetPlayer.tileId);
      if (distToTarget > cardRadius) {
        const msg = `${targetPlayer.name} is outside the ${cardRadius}-block radius (${distToTarget} blocks away).`;
        addLog(`[${card.name}]: ${msg}`);
        return msg;
      }
    }

    const isSinglePlayerTargetCard =
      card.targetType === "any_player" ||
      card.targetType === "any_player_in_radius" ||
      card.targetType === "other_player" ||
      card.targetType === "opponent_in_radius";

    const negatedTargetSet = new Set(Array.isArray(options.negatedTargetIndices) ? options.negatedTargetIndices : []);

    if (isSinglePlayerTargetCard && targetPlayer && targetPlayer.index !== player.index) {
      if (negatedTargetSet.has(targetPlayer.index)) {
        const msg = `[${card.name}]'s effect on ${targetPlayer.name} was negated by a [Haste] card!`;
        addLog(msg);
        return msg;
      }
      if (targetPlayer.inSpawn) {
        const msg = `${targetPlayer.name} terlindungi Spawn Protection.`;
        addLog(msg);
        return msg;
      }
      if (targetPlayer.safeZoneImmune) {
        const msg = `${targetPlayer.name} is protected by Safe Zone (Oak Cake Break) and cannot be targeted!`;
        addLog(msg);
        return msg;
      }
      if (card.rarity === "Common" && hasPassive(targetPlayer, "passive_sam_armor")) {
        const msg = `Firefly Type-IV Armor blocked the Common card [${card.name}].`;
        addLog(msg);
        return msg;
      }
      const onSafeZone = getTokensCoveringTile(targetPlayer.tileId).some((t) => t.type === "safe_zone");
      if (onSafeZone) {
        const msg = `${targetPlayer.name} terlindungi Safe Zone (Oak Cake Break).`;
        addLog(msg);
        return msg;
      }
    }

    const shouldActivateBlock = cardActivatesBlockEffect(card);
    const casterMoveTheme = player.isSamMode ? "sam" : player.charId;

    switch (card.effectKey) {
      case "move_steps": {
        const tgt = options.targetPlayerIndex !== undefined ? state.players[options.targetPlayerIndex] : player;
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = tgt.tileId;
          const isBack =
            String(options.stepDelta || "").startsWith("-") ||
            Boolean(card.choices && card.choices.length > 0 && card.choices.every((v) => v < 0));
          const animPath = buildSkillMovePath(prevTileId, options.targetTileId, 6);
          applySkillPathPassChecks(tgt, prevTileId, options.targetTileId);
          tgt.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            tgt.lastTileId,
            isBack
          );
          tgt.tileId = options.targetTileId;
          if (tgt.inSpawn && options.targetTileId !== "T0") tgt.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: tgt.index, path: animPath }],
            { soundTheme: casterMoveTheme, stepMs: 185 }
          );
          const destTile = TILE_MAP[options.targetTileId];
          const msg = `${tgt.name} moved to [${options.targetTileId}: ${destTile.name}]!`;
          addLog(`[${card.name}]: ${msg}`);
          if (shouldActivateBlock) {
            resolveExactLandingTile(tgt, destTile);
          }
          return msg;
        } else {
          const steps = Number(options.choiceValue || (card.choices && card.choices[0]) || 1);
          movePlayerInstantAlongPath(tgt, Math.abs(steps), steps >= 0 ? 1 : -1, shouldActivateBlock, {
            soundTheme: casterMoveTheme
          });
          const msg = `${tgt.name} moved ${steps > 0 ? "+" : ""}${steps} step(s)!`;
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
            const msg = `Target tile is outside the ${rad}-block radius or is not a Normal Tile.`;
            addLog(`[${card.name}]: ${msg}`);
            return msg;
          }
          const prevTileId = player.tileId;
          player.tileId = destTileId;
          player.lastTileId = (PREV_MAP[destTileId] && PREV_MAP[destTileId][0]) || null;
          if (player.inSpawn && destTileId !== "T0") player.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: player.index, path: [prevTileId, destTileId] }],
            { soundTheme: casterMoveTheme, stepMs: 170, landVfx: "warp_burst" }
          );
          const destTile = TILE_MAP[destTileId];
          const msg = `${player.name} jumped to Normal Tile [${destTileId}]!`;
          addLog(`[${card.name}]: ${msg}`);
          checkTokensOnStep(player, destTileId, true);
          if (shouldActivateBlock) {
            resolveExactLandingTile(player, destTile);
          }
          return msg;
        }
        return "No destination selected.";
      }
      case "move_self_range": {
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          const isBack = String(options.stepDelta || "").startsWith("-");
          const animPath = buildSkillMovePath(prevTileId, options.targetTileId, 10);
          applySkillPathPassChecks(player, prevTileId, options.targetTileId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            isBack
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: player.index, path: animPath }],
            { soundTheme: casterMoveTheme, stepMs: 165 }
          );
          const destTile = TILE_MAP[options.targetTileId];
          const msg = `${player.name} moved to [${options.targetTileId}: ${destTile.name}]!`;
          addLog(`[${card.name}]: ${msg}`);
          if (shouldActivateBlock) {
            resolveExactLandingTile(player, destTile);
          }
          return msg;
        } else {
          const steps = Number(options.choiceValue || 4);
          movePlayerInstantAlongPath(player, Math.abs(steps), steps >= 0 ? 1 : -1, shouldActivateBlock, {
            soundTheme: casterMoveTheme
          });
          const msg = `${player.name} moved ${steps > 0 ? "+" : ""}${steps} block(s)!`;
          addLog(`[${card.name}]: ${msg}`);
          return msg;
        }
      }
      case "swap_position": {
        if (targetPlayer && targetPlayer.index !== player.index) {
          const prevPlayerTile = player.tileId;
          const prevTargetTile = targetPlayer.tileId;
          const tempLast = player.lastTileId;
          player.tileId = prevTargetTile;
          player.lastTileId = targetPlayer.lastTileId;
          targetPlayer.tileId = prevPlayerTile;
          targetPlayer.lastTileId = tempLast;
          if (player.inSpawn && player.tileId !== "T0") player.inSpawn = false;
          if (targetPlayer.inSpawn && targetPlayer.tileId !== "T0") targetPlayer.inSpawn = false;
          triggerAnimatedSkillMovement(
            [
              { playerIndex: player.index, path: [prevPlayerTile, prevTargetTile] },
              { playerIndex: targetPlayer.index, path: [prevTargetTile, prevPlayerTile] }
            ],
            { soundTheme: casterMoveTheme, stepMs: 210, landVfx: "warp_burst" }
          );
          const msg = `${player.name} (${player.tileId}) swapped positions with ${targetPlayer.name} (${targetPlayer.tileId})!`;
          addLog(`[${card.name}]: ${msg}`);
          if (shouldActivateBlock) {
            resolveExactLandingTile(player, TILE_MAP[player.tileId]);
          }
          return msg;
        }
        return "No valid target to swap positions with.";
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
        const msg = `Passive The Stage Is Mine active (${durLabel}, expires on Cycle reset)! Landing on a Normal Tile lets you move +1/+2/-1.`;
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
          const msg = "Global Event Tiles cannot be selected for Bocchi The Rock!.";
          addLog(msg);
          return msg;
        }
        let pulledNames = [];
        const pullEntries = [];
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn && !negatedTargetSet.has(other.index)) {
            const fromTid = other.tileId;
            other.tileId = destTileId;
            other.lastTileId = (PREV_MAP[destTileId] && PREV_MAP[destTileId][0]) || null;
            pulledNames.push(other.name);
            pullEntries.push({ playerIndex: other.index, path: [fromTid, destTileId] });
            resolveDirectTileEffectForPull(other, destTile);
          }
        });
        if (pullEntries.length > 0) {
          triggerAnimatedSkillMovement(pullEntries, {
            soundTheme: casterMoveTheme,
            stepMs: 220,
            landVfx: "warp_burst"
          });
        }
        const msg =
          pulledNames.length > 0
            ? `Pulled ${pulledNames.join(", ")} to [${destTileId}: ${destTile.name}] & triggered the tile effect!`
            : `No opponents outside Spawn to pull to [${destTileId}].`;
        addLog(`ULTIMATE [${card.name}]: ${msg}`);
        return msg;
      }
      case "steal_5_or_10_tc": {
        const rollAmt = Math.random() < 0.5 ? 5 : 10;
        const taken = Math.min(rollAmt, targetPlayer.tc);
        targetPlayer.tc -= taken;
        const gained = modifyPlayerTC(player, taken, "own_skill");
        const msg = `${player.name} stole ${gained} TC from ${targetPlayer.name}!`;
        addLog(`[That's Mine]: ${msg}`);
        return msg;
      }
      case "turn_tc_multiplier": {
        const mults = card.multipliers || [1.25, 1.5, 2.0];
        const chosen = mults[Math.floor(Math.random() * mults.length)];
        player.turnTcMultiplier = chosen;
        const msg = `${player.name} gained a x${chosen} TC Multiplier for this turn!`;
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
        const msg = `${b} TC x ${m} = +${gained} TC for ${player.name}!`;
        addLog(`[Hand of Midas]: ${msg}`);
        return msg;
      }
      case "tax_all_opponents_15": {
        let totalCollected = 0;
        let cardLootedCount = 0;
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn && !negatedTargetSet.has(other.index)) {
            if (other.tc >= 15) {
              other.tc -= 15;
              totalCollected += 15;
            } else {
              const willReceive = player.hand.length < state.rules.maxHandSize;
              const surrendered = discardRandomCards(other, 1, {
                kind: "stolen",
                byIndex: player.index,
                byName: player.name,
                sourceLabel: "The House Always Wins",
                skipDiscardPile: willReceive
              });
              if (surrendered.length > 0 && willReceive) {
                player.hand.push(surrendered[0]);
              }
              cardLootedCount += surrendered.length;
              addLog(`${other.name} could not pay 15 TC -> surrendered 1 random card to ${player.name}.`);
            }
          }
        });
        const credited = totalCollected > 0 ? modifyPlayerTC(player, totalCollected, "own_skill") : 0;
        const msg = `Collected +${credited} TC${cardLootedCount > 0 ? ` & ${cardLootedCount} opponent card(s)` : ""}!`;
        addLog(`[The House Always Wins]: ${player.name} gained ${msg}`);
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
        const msg = `IPC Gems active (${durLabel}, expires on Cycle reset): all non-skill TC gains multiplied by x${mult}!`;
        addLog(`Passive Active: [IPC Gems] (${mult}x TC · ${durLabel}).`);
        return msg;
      }
      case "duel_forced_all_in": {
        const riskBet = applyRounding(targetPlayer.tc * 0.25, state.rules);
        const challengerIdx = player.index;
        const opponentIdx = targetPlayer.index;
        addLog(`ULTIMATE [Forced All-In]: ${player.name} challenged ${targetPlayer.name} to a 1v1 Versus Duel (Risk: ${riskBet} TC vs All TC / 1 Shard)!`);
        setTimeout(() => {
          if (!state || state.winner || state.activeMinigame) return;
          dismissSkillPopup(true, true);
          startRandomMinigame("versus", {
            reasonTitle: `ULTIMATE: Forced All-In · Risk 💰 ${riskBet} TC vs All TC / 1 Shard`,
            afterAction: "forced_all_in",
            challengerIndex: challengerIdx,
            opponentIndex: opponentIdx,
            wager: riskBet,
            challengerRisk: riskBet,
            opponentRisk: targetPlayer.tc
          });
        }, 950);
        return `${player.name} forced ${targetPlayer.name} into a Forced All-In Versus Duel!`;
      }
      case "discard_1_or_minus3_steps": {
        const hasDiscardable = targetPlayer.hand.some((c) => c && c.rarity !== "Ultimate");
        if (hasDiscardable) {
          const disc = discardRandomCards(targetPlayer, 1, { kind: "discard", sourceLabel: "Marionette String" });
          const msg = `${targetPlayer.name} discarded 1 card [${disc[0]?.name || "Card"}]!`;
          addLog(`[Marionette String]: ${msg}`);
          return msg;
        } else {
          targetPlayer.nextRollStepMod -= 3;
          const msg = `${targetPlayer.name} has no non-Ultimate cards -> -3 steps on their next roll!`;
          addLog(`[Marionette String]: ${msg}`);
          return msg;
        }
      }
      case "place_trap_virus": {
        const tileId = options.targetTileId || player.tileId;
        const rad = card.radius || 4;
        if (getTileDistance(player.tileId, tileId) > rad) {
          const msg = `Tile [${tileId}] is outside the ${rad}-block radius.`;
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
        const msg = `Punishing Virus Trap placed on [${tileId}] for 1 Full Cycle!`;
        addLog(`[Punishing Virus]: ${msg}`);
        return msg;
      }
      case "debuff_reverse_move": {
        targetPlayer.reverseNextRoll = true;
        const msg = `${targetPlayer.name} must move BACKWARD on their first roll next turn!`;
        addLog(`[Mind Deviation]: ${msg}`);
        return msg;
      }
      case "destroy_half_hand_radius": {
        const rad = card.radius || 8;
        let totalDestroyed = 0;
        const victims = [];
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn && !negatedTargetSet.has(other.index)) {
            const dist = getTileDistance(player.tileId, other.tileId);
            const nonUltCards = other.hand.filter((c) => c && c.rarity !== "Ultimate");
            if (dist <= rad && nonUltCards.length > 0) {
              const count = applyRounding(nonUltCards.length * 0.5, state.rules);
              const removed = discardRandomCards(other, count, { kind: "discard", sourceLabel: "Soul Extraction" });
              totalDestroyed += removed.length;
              if (removed.length > 0) victims.push(`${other.name} (-${removed.length})`);
            }
          }
        });
        const msg =
          totalDestroyed > 0
            ? `Destroyed ${totalDestroyed} card(s) (${victims.join(", ")})!`
            : "No opponents with non-Ultimate cards within 8 blocks.";
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
          return `Passive Daemonissa's Domain active (${durLabel}, expires on Cycle reset)!`;
        } else {
          addOrRefreshPassive(player, {
            key: "passive_unpredictable_tricks",
            name: "Unpredictable Tricks",
            remainingTurns: turns,
            expiresOnCycleEnd: !isCopied
          });
          const msg = `Unpredictable Tricks active (${durLabel}, expires on Cycle reset): passing or being passed -> opponent discards 1 card & pays 5 TC!`;
          addLog(`Passive Active: [Unpredictable Tricks] (${durLabel}).`);
          return msg;
        }
      }
      case "skip_target_turn_buff_self": {
        targetPlayer.skipNextTurn = true;
        player.extraPhasesThisTurn += 1;
        player.maxRollsThisTurn = (player.maxRollsThisTurn || 2) + 1;
        const bonusSkills =
          state.compendiumId === "comp_v0_1" ? 0 : state.compendiumId === "comp_alpha1_1" ? 1 : 2;
        player.maxSkillsThisTurn += bonusSkills;
        const msg = `${targetPlayer.name} skips their next turn! ${player.name} gains +1 Extra Dice Roll & +${bonusSkills} Skill Use!`;
        addLog(`ULTIMATE [${card.name}]: ${msg}`);
        return msg;
      }
      case "choice_10tc_or_draw1": {
        const gainVal = card.tcGain || (state.compendiumId === "comp_v0_1" ? 5 : 10);
        if (options.choiceValue === "draw") {
          const d = drawCards(player, 1);
          const msg = `${player.name} drew +${d.length} Card(s) from the deck!`;
          addLog(`[Showtime!]: ${msg}`);
          return msg;
        } else {
          const g = modifyPlayerTC(player, gainVal, "own_skill");
          const msg = `${player.name} gained +${g} TC!`;
          addLog(`[Showtime!]: ${msg}`);
          return msg;
        }
      }
      case "dash_1_6_steal_card": {
        let destId = player.tileId;
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          destId = options.targetTileId;
          const animPath = buildSkillMovePath(prevTileId, destId, 8);
          applySkillPathPassChecks(player, prevTileId, destId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(prevTileId, destId, player.lastTileId, false);
          player.tileId = destId;
          if (player.inSpawn && destId !== "T0") player.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: player.index, path: animPath }],
            { soundTheme: casterMoveTheme, stepMs: 160 }
          );
        } else {
          const steps = Number(options.choiceValue || 4);
          movePlayerInstantAlongPath(player, steps, 1, false, { soundTheme: casterMoveTheme });
          destId = player.tileId;
        }
        let stealMsg = "";
        const allowedStealRarities = new Set(["Common", "Uncommon", "Rare"]);
        const victim = state.players.find(
          (other) =>
            other.index !== player.index &&
            !other.inSpawn &&
            other.tileId === destId &&
            other.hand.some((c) => c && allowedStealRarities.has(c.rarity))
        );
        if (victim && !hasPassive(victim, "passive_immune_steal")) {
          const stealableIndices = [];
          victim.hand.forEach((c, idx) => {
            if (c && allowedStealRarities.has(c.rarity)) stealableIndices.push(idx);
          });
          if (stealableIndices.length > 0) {
            const pickIdx = stealableIndices[Math.floor(Math.random() * stealableIndices.length)];
            const stolenCard = victim.hand.splice(pickIdx, 1)[0];
            if (player.hand.length < state.rules.maxHandSize) player.hand.push(stolenCard);
            recordCardLossEvent(victim, stolenCard, "stolen", {
              byIndex: player.index,
              byName: player.name,
              sourceLabel: "Phantom Thief"
            });
            stealMsg = ` & stole [${stolenCard.name}] (${stolenCard.rarity}) from ${victim.name}!`;
            addLog(`[Phantom Thief]: ${player.name} stole [${stolenCard.name}] (${stolenCard.rarity}) from ${victim.name}.`);
          }
        }
        if (shouldActivateBlock && TILE_MAP[destId]) {
          resolveExactLandingTile(player, TILE_MAP[destId]);
        }
        return `${player.name} dashed to [${destId}]${stealMsg || "!"}`;
      }
      case "aoa_15tc_silence": {
        modifyPlayerTC(targetPlayer, -15, "own_skill");
        targetPlayer.silencedThisPhase = true;
        const msg = `${targetPlayer.name} lost 15 TC & is Silenced for 1 Phase!`;
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
          addLog(`[Will of Rebellion]: Copying effect of [${copiedCard.name}].`);
          const copyOpts = { ...options };
          if (copiedCard.rarity === "Unique") {
            copyOpts.copiedUniqueDurationTurns = Math.max(1, state.players.length);
          }
          const innerOutcome = executeCardEffect(player, copiedCard, copyOpts);
          return `Copied [${copiedCard.name}]: ${innerOutcome || copiedCard.description}`;
        } else {
          const g = modifyPlayerTC(player, 15, "own_skill");
          const msg = `No recent opponent skills -> ${player.name} gained +${g} TC.`;
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
        const msg = `Awaken, Arsene! active (${durLabel}, expires on Cycle reset): landing on Positive/Negative Effect tiles grants +1 extra die (max 1/turn)!`;
        addLog(`Passive Active: [Awaken, Arsene!] (${durLabel}).`);
        return msg;
      }
      case "grant_meta_shard": {
        player.metaShardBought = true;
        if (player.metaShard < 1) {
          player.metaShard = 1;
          const msg = `${player.name} gained 1 Permanent Meta-Shard that cannot be stolen!`;
          addLog(`ULTIMATE [Meta-Shard]: ${msg}`);
          checkVictory(player);
          return msg;
        }
        return "Meta-Shard already owned.";
      }
      case "choice_move1_2_or_10tc": {
        if (options.choiceValue === "move" && options.targetTileId && TILE_MAP[options.targetTileId]) {
          const prevTileId = player.tileId;
          const animPath = buildSkillMovePath(prevTileId, options.targetTileId, 4);
          applySkillPathPassChecks(player, prevTileId, options.targetTileId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            false
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: player.index, path: animPath }],
            { soundTheme: casterMoveTheme, stepMs: 185 }
          );
          addLog(`[${card.name}]: ${player.name} moved to [${options.targetTileId}].`);
          if (shouldActivateBlock) {
            resolveExactLandingTile(player, TILE_MAP[options.targetTileId]);
          }
        } else if (options.choiceValue === "move2") {
          movePlayerInstantAlongPath(player, 2, 1, shouldActivateBlock, { soundTheme: casterMoveTheme });
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
        return "Counter Shield active!";
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
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        addOrRefreshPassive(player, {
          key: "passive_miasma_cloud",
          name: "Miasma Cloud",
          remainingTurns: turns,
          expiresOnCycleEnd: !isCopied
        });
        addLog(`Passive Active: [Miasma Cloud] (${getActiveCycleDurationLabel(options.copiedUniqueDurationTurns)}).`);
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
          const animPath = buildSkillMovePath(prevTileId, options.targetTileId, 4);
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            false
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: player.index, path: animPath }],
            { soundTheme: casterMoveTheme, stepMs: 185 }
          );
          if (shouldActivateBlock) {
            resolveExactLandingTile(player, TILE_MAP[options.targetTileId]);
          }
        } else {
          movePlayerInstantAlongPath(player, 2, 1, shouldActivateBlock, { soundTheme: casterMoveTheme });
        }
        if (TILE_MAP[player.tileId]?.type === "normal") modifyPlayerTC(player, 10, "own_skill");
        return card.description;
      }
      case "scry_2_keep_1": {
        if (!Array.isArray(player.deck) || player.deck.length === 0) {
          const msg = "Deck is empty, no top cards to inspect.";
          addLog(`[${card.name}]: ${msg}`);
          return msg;
        }
        const topCards = [];
        while (topCards.length < 2 && player.deck.length > 0) {
          topCards.push(player.deck.pop());
        }
        if (topCards.length === 1) {
          const onlyCard = topCards[0];
          const lim = getEffectiveHandLimit(player);
          if (player.hand.length < lim) {
            player.hand.push(onlyCard);
            const msg = `Only 1 card left in deck: [${onlyCard.name}] added to hand!`;
            addLog(`[${card.name}]: ${msg}`);
            return msg;
          } else {
            if (isCardForeignToPlayer(onlyCard, player)) returnForeignCardToOwner(onlyCard, player);
            else player.discard.push(onlyCard);
            const msg = `Hand is full, [${onlyCard.name}] was sent to discard.`;
            addLog(`[${card.name}]: ${msg}`);
            return msg;
          }
        }
        pendingInteraction = {
          id: "scry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          type: "scry_2_keep_1",
          player,
          cards: topCards,
          cardName: card.name
        };
        const msg = `${player.name} inspected the top 2 cards of the deck: pick 1 to keep (the other is discarded)!`;
        addLog(`[${card.name}]: ${msg}`);
        return msg;
      }
      case "place_safe_zone": {
        const tid = options.targetTileId || player.tileId;
        const coveredTileIds = computeTokenCoveredTiles(tid, 3);
        state.boardTokens.push({
          id: "tok_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
          type: "safe_zone",
          name: "Safe Zone",
          ownerIndex: player.index,
          tileId: tid,
          radius: 3,
          coveredTileIds,
          remainingCycles: 1
        });
        const msg = `Safe Zone (3-block radius, ${coveredTileIds.length} tiles) placed centered at [${tid}]!`;
        addLog(`[Oak Cake Break]: ${msg}`);
        return msg;
      }
      case "retreat_2_negate": {
        movePlayerInstantAlongPath(player, 2, -1, shouldActivateBlock, { soundTheme: casterMoveTheme });
        return card.description;
      }
      case "relocate_board_traps": {
        if (!Array.isArray(state.boardTokens) || state.boardTokens.length === 0) {
          const msg = "No active Tokens/Traps on the board to relocate.";
          addLog(`[Entrusted Dream]: ${msg}`);
          return msg;
        }
        let tokIdx = options.tokenId ? state.boardTokens.findIndex((t) => t.id === options.tokenId) : 0;
        if (tokIdx === -1) tokIdx = 0;
        const tok = state.boardTokens[tokIdx];
        const prevTid = tok.tileId;
        const destTileId =
          options.targetTileId && TILE_MAP[options.targetTileId]
            ? options.targetTileId
            : (targetPlayer && targetPlayer.tileId) || player.tileId;

        tok.tileId = destTileId;
        if (tok.radius && tok.radius > 0) {
          tok.coveredTileIds = computeTokenCoveredTiles(destTileId, tok.radius);
        } else if (Array.isArray(tok.coveredTileIds)) {
          tok.coveredTileIds = [destTileId];
        }

        const affectedSet = new Set(
          Array.isArray(tok.coveredTileIds) && tok.coveredTileIds.length > 0 ? tok.coveredTileIds : [destTileId]
        );
        triggerBoardTileVfx([destTileId], tok.type === "fire_tile" ? "sam_fire_impact" : "warp_burst");

        const playersOnZone = state.players.filter((p) => !p.inSpawn && affectedSet.has(p.tileId));
        const res = triggerTokenEffectOnPlayers(tok, playersOnZone, player);
        if (res.consumed) {
          const rmIdx = state.boardTokens.findIndex((t) => t.id === tok.id);
          if (rmIdx !== -1) state.boardTokens.splice(rmIdx, 1);
        }

        const msg = `${player.name} relocated [${tok.name}] from [${prevTid}] to [${destTileId}]. ${res.summary}`;
        addLog(`[Entrusted Dream]: ${msg}`);
        return msg;
      }
      case "passive_immune_steal": {
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        addOrRefreshPassive(player, {
          key: "passive_immune_steal",
          name: "Stellaron Hunter's Resolve",
          remainingTurns: turns,
          expiresOnCycleEnd: !isCopied
        });
        return card.description;
      }
      case "transform_to_sam": {
        [...(player.hand || []), ...(player.discard || [])].forEach((c) => {
          if (isCardForeignToPlayer(c, player)) returnForeignCardToOwner(c, player);
        });
        player.isSamMode = true;
        player.charName = "SAM";
        player.name = player.username ? player.username : "SAM";
        player.discard = [];
        player.hand = [];
        player.deck = buildDeckForCharacter("firefly", state.compendiumId, true, player.id);
        drawCards(player, state.rules.startHandSize);
        addOrRefreshPassive(player, {
          key: "passive_sam_armor",
          name: "SAM Armor",
          remainingTurns: getFullCycleTurns(),
          expiresOnCycleEnd: true
        });
        addLog(`ULTIMATE [Complete Combustion]: ${player.name} transformed into SAM!`);
        return `${player.name} transformed into SAM! Hand & Deck swapped to SAM.`;
      }
      case "sam_dash_aoe_5tc": {
        const prevTileId = player.tileId;
        if (options.targetTileId && TILE_MAP[options.targetTileId]) {
          const animPath = buildSkillMovePath(prevTileId, options.targetTileId, 8);
          applySkillPathPassChecks(player, prevTileId, options.targetTileId);
          player.lastTileId = computeConsistentLastTileIdAfterJump(
            prevTileId,
            options.targetTileId,
            player.lastTileId,
            false
          );
          player.tileId = options.targetTileId;
          if (player.inSpawn && options.targetTileId !== "T0") player.inSpawn = false;
          triggerAnimatedSkillMovement(
            [{ playerIndex: player.index, path: animPath }],
            { soundTheme: "sam", stepMs: 160, landVfx: "sam_fire_impact", landSfx: "sam_impact" }
          );
          if (shouldActivateBlock) {
            resolveExactLandingTile(player, TILE_MAP[options.targetTileId]);
          }
        } else {
          const steps = Number(options.choiceValue || 4);
          movePlayerInstantAlongPath(player, steps, 1, shouldActivateBlock, {
            soundTheme: "sam",
            landVfx: "sam_fire_impact",
            landSfx: "sam_impact"
          });
        }
        const hitVictims = [];
        state.players.forEach((other) => {
          if (other.index !== player.index && !other.inSpawn && !other.safeZoneImmune && !negatedTargetSet.has(other.index)) {
            const dist = getTileDistance(player.tileId, other.tileId);
            if (dist <= 1) {
              const beforeTc = other.tc;
              modifyPlayerTC(other, -5, "own_skill");
              const actualLoss = Math.max(0, beforeTc - other.tc);
              hitVictims.push(`${other.name} (-${actualLoss} TC)`);
            }
          }
        });
        const dmgMsg =
          hitVictims.length > 0
            ? `${player.name} struck [${player.tileId}] with a fiery blast! AOE Hit: ${hitVictims.join(", ")}`
            : `${player.name} landed with a fiery blast at [${player.tileId}] (no opponents within 1 block).`;
        addLog(`[${card.name}]: ${dmgMsg}`);
        return dmgMsg;
      }
      case "sam_push_back_3": {
        if (!targetPlayer || targetPlayer.index === player.index) return "No opponents within 4 blocks.";
        const beforeTile = targetPlayer.tileId;
        const walked = movePlayerInstantAlongPath(targetPlayer, 3, -1, shouldActivateBlock, {
          soundTheme: "sam",
          stepMs: 195,
          landVfx: "push_impact"
        });
        const checkTiles = walked && walked.length > 1 ? walked.slice(1) : getDirectedPathToTile(beforeTile, targetPlayer.tileId, 5);
        const hitSomething = checkTiles.some((tid) => {
          const hasOther = state.players.some((p) => p.index !== targetPlayer.index && !p.inSpawn && p.tileId === tid);
          const hasTok = state.boardTokens.some((t) => t.tileId === tid);
          return hasOther || hasTok;
        });
        if (hitSomething) {
          modifyPlayerTC(targetPlayer, -10, "own_skill");
          addLog(`[Supernova Overload]: ${targetPlayer.name} was knocked back 3 blocks to [${targetPlayer.tileId}] & collided with a Player/Token (-10 TC)!`);
          return `${targetPlayer.name} was knocked back 3 blocks to [${targetPlayer.tileId}] & lost 10 TC!`;
        }
        addLog(`[Supernova Overload]: ${targetPlayer.name} was knocked back 3 blocks to [${targetPlayer.tileId}]!`);
        return `${targetPlayer.name} was knocked back 3 blocks to [${targetPlayer.tileId}]!`;
      }
      case "sam_discounted_versus": {
        if (!targetPlayer || targetPlayer.index === player.index) return "No opponents within 4 blocks.";
        const isTier2 = options.choiceValue === "tier2";
        const samBet = isTier2 ? 15 : 0;
        const oppBet = isTier2 ? 30 : 15;
        const challengerIdx = player.index;
        const opponentIdx = targetPlayer.index;
        const stakeLabel = isTier2 ? `SAM 15 TC vs Opponent 30 TC` : `SAM Free (0 TC) vs Opponent 15 TC`;
        addLog(`[Scorched Earth Execution]: ${player.name} forced ${targetPlayer.name} into a Versus Duel (${stakeLabel})!`);
        setTimeout(() => {
          if (!state || state.winner || state.activeMinigame) return;
          dismissSkillPopup(true, true);
          startRandomMinigame("versus", {
            reasonTitle: `Scorched Earth Execution · ${stakeLabel}`,
            afterAction: "versus_wager",
            challengerIndex: challengerIdx,
            opponentIndex: opponentIdx,
            wager: oppBet,
            challengerRisk: samBet,
            opponentRisk: oppBet
          });
        }, 950);
        return `${player.name} forced ${targetPlayer.name} into a Versus Duel (${stakeLabel})!`;
      }
      case "sam_fire_tiles": {
        let fireIds = [];
        if (Array.isArray(options.targetTileIds) && options.targetTileIds.length > 0) {
          const uniq = [];
          options.targetTileIds.forEach((fid) => {
            if (fid && TILE_MAP[fid] && TILE_MAP[fid].type !== "spawn" && TILE_MAP[fid].type !== "intersect" && !uniq.includes(fid)) {
              uniq.push(fid);
            }
          });
          fireIds = uniq.slice(0, 2);
        } else {
          const startId = options.targetTileId && TILE_MAP[options.targetTileId] ? options.targetTileId : player.tileId;
          if (startId && TILE_MAP[startId]) fireIds.push(startId);
          const candidates = DATA.BOARD_TILES.filter(
            (t) => t.type !== "spawn" && t.type !== "intersect" && !t.offTrack && !fireIds.includes(t.id)
          );
          if (candidates.length > 0 && fireIds.length < 2) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            fireIds.push(pick.id);
          }
        }
        fireIds.forEach((fid) => {
          state.boardTokens = state.boardTokens.filter((tk) => !(tk.tileId === fid && tk.type === "fire_tile"));
          state.boardTokens.push({
            id: "tok_" + Date.now() + "_" + fid + "_" + Math.random().toString(36).slice(2, 5),
            type: "fire_tile",
            name: "Deathstar Fire",
            ownerIndex: player.index,
            tileId: fid,
            remainingCycles: 2
          });
        });
        triggerBoardTileVfx(fireIds, "sam_fire_impact");
        playSfx("sam_impact");
        const msg = `${player.name} ignited 2 chosen tiles [${fireIds.join(" & ")}] with Deathstar Destruction!`;
        addLog(`[${card.name}]: ${msg}`);
        return msg;
      }
      case "passive_sam_armor": {
        const isCopied = Boolean(options.copiedUniqueDurationTurns);
        const turns = options.copiedUniqueDurationTurns || getFullCycleTurns();
        addOrRefreshPassive(player, {
          key: "passive_sam_armor",
          name: "SAM Armor",
          remainingTurns: turns,
          expiresOnCycleEnd: !isCopied
        });
        return card.description;
      }
      case "transform_to_firefly": {
        [...(player.hand || []), ...(player.discard || [])].forEach((c) => {
          if (isCardForeignToPlayer(c, player)) returnForeignCardToOwner(c, player);
        });
        player.isSamMode = false;
        player.charName = "Firefly / SAM";
        player.name = player.username ? player.username : "Firefly / SAM";
        player.passives = (player.passives || []).filter((p) => p.key !== "passive_sam_armor");
        player.discard = [];
        player.hand = [];
        player.deck = buildDeckForCharacter("firefly", state.compendiumId, false, player.id);
        drawCards(player, state.rules.startHandSize);
        addLog(`ULTIMATE [Cooldown Protocol]: ${player.name} returned to Firefly mode!`);
        return `${player.name} deactivated armor and returned to Firefly mode!`;
      }
      default:
        return card.description;
    }
  }

  function buildSkillMovePath(fromTileId, toTileId, maxDepth = 10) {
    if (!fromTileId || !toTileId || fromTileId === toTileId) return [toTileId || fromTileId].filter(Boolean);
    const tail = getDirectedPathToTile(fromTileId, toTileId, maxDepth);
    if (tail && tail.length > 0) {
      return [fromTileId, ...tail];
    }
    return [fromTileId, toTileId];
  }

  function spawnLocalBoardVfx(tileIds, kind = "sam_fire_impact") {
    const ids = Array.isArray(tileIds) ? tileIds : [tileIds];
    const now = Date.now();
    const isHeavy = kind === "sam_fire_impact";
    const isMedium = kind === "push_impact" || kind === "warp_burst";
    if (isHeavy) {
      triggerGameFeedback("large", { tileId: ids[0], vfxKind: kind });
    } else if (isMedium) {
      triggerGameFeedback("medium", { tileId: ids[0], vfxKind: kind });
    }
    ids.forEach((tid, idx) => {
      if (!tid || !TILE_MAP[tid]) return;
      if (idx > 0 && window.EFT_WEBGL_VFX) {
        window.EFT_WEBGL_VFX.burstAtTile(tid, kind);
      }
      const vfxId = `vfx_${now}_${tid}_${Math.random().toString(36).slice(2, 5)}`;
      activeBoardVfxList.push({ id: vfxId, tileId: tid, kind });
      setTimeout(() => {
        activeBoardVfxList = activeBoardVfxList.filter((v) => v.id !== vfxId);
        renderDigitalBoard();
      }, 1150);
    });
    renderDigitalBoard();
  }

  function triggerBoardTileVfx(tileIds, kind = "sam_fire_impact") {
    if (!state) return;
    const ids = (Array.isArray(tileIds) ? tileIds : [tileIds]).filter((tid) => tid && TILE_MAP[tid]);
    if (ids.length === 0) return;
    const ev = {
      id: "bvfx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      tileIds: ids,
      kind
    };
    state.lastBoardVfxEvent = ev;
    lastProcessedBoardVfxId = ev.id;
    spawnLocalBoardVfx(ids, kind);
  }

  function playLocalSkillMoveAnim(ev) {
    if (!ev || !Array.isArray(ev.entries) || ev.entries.length === 0) return;
    if (ev.soundTheme) {
      playSfx("move_skill", ev.soundTheme);
    }
    const stepMs = ev.stepMs || 185;
    ev.entries.forEach((entry) => {
      const pIdx = entry.playerIndex;
      const path = Array.isArray(entry.path) ? entry.path.filter((tid) => tid && TILE_MAP[tid]) : [];
      if (path.length < 2) return;
      if (skillMoveAnimTimers[pIdx]) {
        clearTimeout(skillMoveAnimTimers[pIdx]);
        delete skillMoveAnimTimers[pIdx];
      }
      let stepIdx = 0;
      const advance = () => {
        skillMoveAnimOverrides[pIdx] = path[stepIdx];
        if (stepIdx > 0) {
          playSfx("step");
          if (window.EFT_WEBGL_VFX) {
            const actor = state && state.players && state.players[pIdx];
            window.EFT_WEBGL_VFX.emitMoveTrail(path[stepIdx - 1], path[stepIdx], actor ? actor.color : "#9fd6be");
          }
        }
        if (camera.mode === "follow" && stepIdx === path.length - 1) {
          focusCameraOnTile(path[stepIdx]);
        }
        renderDigitalBoard();
        if (stepIdx < path.length - 1) {
          stepIdx++;
          skillMoveAnimTimers[pIdx] = setTimeout(advance, stepMs);
        } else {
          skillMoveAnimTimers[pIdx] = setTimeout(() => {
            delete skillMoveAnimOverrides[pIdx];
            delete skillMoveAnimTimers[pIdx];
            if (ev.landVfx) {
              spawnLocalBoardVfx([path[path.length - 1]], ev.landVfx);
            }
            if (ev.landSfx) {
              playSfx(ev.landSfx);
            }
            renderDigitalBoard();
          }, 120);
        }
      };
      advance();
    });
  }

  function triggerAnimatedSkillMovement(entries, opts = {}) {
    if (!state || !Array.isArray(entries) || entries.length === 0) return;
    const cleanEntries = entries
      .map((e) => ({
        playerIndex: e.playerIndex,
        path: Array.isArray(e.path) ? e.path.filter((tid) => tid && TILE_MAP[tid]) : []
      }))
      .filter((e) => e.path.length >= 2);
    if (cleanEntries.length === 0) return;
    const ev = {
      id: "smov_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      entries: cleanEntries,
      soundTheme: opts.soundTheme || "",
      stepMs: opts.stepMs || 185,
      landVfx: opts.landVfx || "",
      landSfx: opts.landSfx || ""
    };
    state.lastSkillMoveAnim = ev;
    lastProcessedSkillMoveAnimId = ev.id;
    playLocalSkillMoveAnim(ev);
  }

  function movePlayerInstantAlongPath(player, steps, direction = 1, resolveLanding = true, animOpts = {}) {
    let curr = player.tileId;
    let prev = player.lastTileId || null;
    const walkedPath = [curr];
    const hitPlayers = new Set();
    for (let i = 0; i < steps; i++) {
      const opts = getNextPlayableOptions(curr, prev, i === 0 ? direction : 1);
      if (opts.length === 0) break;
      const chosen = opts[0];
      prev = chosen.viaSplitId || curr;
      curr = chosen.tileId;
      player.lastTileId = prev;
      player.tileId = curr;
      walkedPath.push(curr);
      if (player.inSpawn && curr !== "T0") player.inSpawn = false;
      triggerUnpredictableTricksOnTile(player, curr, hitPlayers);
      checkTokensOnStep(player, curr, i === steps - 1);
    }
    if (direction < 0 && steps > 0) {
      player.lastTileId = getOppositeAdjacentNeighbor(player.tileId, player.lastTileId);
    }
    if (walkedPath.length >= 2) {
      triggerAnimatedSkillMovement(
        [{ playerIndex: player.index, path: walkedPath }],
        {
          soundTheme: animOpts.soundTheme || (player.isSamMode ? "sam" : player.charId),
          stepMs: animOpts.stepMs || 185,
          landVfx: animOpts.landVfx || "",
          landSfx: animOpts.landSfx || ""
        }
      );
    }
    if (resolveLanding && TILE_MAP[curr]) {
      resolveExactLandingTile(player, TILE_MAP[curr]);
    }
    return walkedPath;
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
    triggerGameFeedback("large", { tileId: shardObj.tileId, vfxKind: "shard_claim" });
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
      if (camera.mode !== "wide" && !camera.isDragging && state.players[state.activePlayerIndex]) {
        camera.mode = "follow";
        focusCameraOnTile(getActivePlayer().tileId, Math.max(camera.zoom, isMobilePortrait() ? 0.72 : 0.96));
      }
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
    if (
      state.lastWalkStepEvent &&
      state.lastWalkStepEvent.id &&
      state.lastWalkStepEvent.id !== lastProcessedWalkStepId
    ) {
      lastProcessedWalkStepId = state.lastWalkStepEvent.id;
      const ws = state.lastWalkStepEvent;
      activeStepsRemaining = Math.max(0, Number(ws.stepsLeft) || 0);
      isWalkingAnim = activeStepsRemaining > 0;
      playSfx("step");
      if (camera.mode === "follow" && !camera.isDragging && ws.tileId && TILE_MAP[ws.tileId]) {
        focusCameraOnTile(ws.tileId);
      }
    }
    if (state.lastSkillEvent && state.lastSkillEvent.id && state.lastSkillEvent.id !== lastShownSkillEventId) {
      lastShownSkillEventId = state.lastSkillEvent.id;
      showDramaticSkillPopup(state.lastSkillEvent);
    }
    if (state.lastTileEffectReveal && state.lastTileEffectReveal.id) {
      const rev = state.lastTileEffectReveal;
      if (rev.dismissed && tileShuffleState && tileShuffleState.id === rev.id) {
        dismissTileEffectOverlay(true);
      } else if (rev.id !== lastShownTileEffectRevealId && !rev.dismissed) {
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
    syncInGameChatFromState();
    if (
      state.lastMonsterSpawnEvent &&
      state.lastMonsterSpawnEvent.id &&
      state.lastMonsterSpawnEvent.id !== lastProcessedMonsterSpawnId
    ) {
      lastProcessedMonsterSpawnId = state.lastMonsterSpawnEvent.id;
      playMonsterPortalSpawnAnim(state.lastMonsterSpawnEvent);
    }
    if (
      state.lastMonsterAlertEvent &&
      state.lastMonsterAlertEvent.id &&
      state.lastMonsterAlertEvent.id !== lastProcessedMonsterAlertId
    ) {
      lastProcessedMonsterAlertId = state.lastMonsterAlertEvent.id;
      showMonsterHorrorAlert(state.lastMonsterAlertEvent);
    }
    if (state.lastBoardVfxEvent && state.lastBoardVfxEvent.id && state.lastBoardVfxEvent.id !== lastProcessedBoardVfxId) {
      lastProcessedBoardVfxId = state.lastBoardVfxEvent.id;
      spawnLocalBoardVfx(state.lastBoardVfxEvent.tileIds, state.lastBoardVfxEvent.kind);
    }
    if (state.lastSkillMoveAnim && state.lastSkillMoveAnim.id && state.lastSkillMoveAnim.id !== lastProcessedSkillMoveAnimId) {
      lastProcessedSkillMoveAnimId = state.lastSkillMoveAnim.id;
      playLocalSkillMoveAnim(state.lastSkillMoveAnim);
    }
    const turnTrackKey = state.turnTimerKey
      ? `${state.cycle}:${state.roundInCycle}:${state.activePlayerIndex}:${state.turnTimerKey}`
      : "";
    if (
      !state.activeMinigame &&
      !state.isMonsterTurn &&
      !state.winner &&
      !isInitializingMatch &&
      isMatchStarted &&
      !isTitleScreenVisible &&
      turnTrackKey &&
      turnTrackKey !== lastTrackedTurnTimerKey
    ) {
      lastTrackedTurnTimerKey = turnTrackKey;
      localTurnKeyStartedAt = Date.now();
      turnThinkingRemainingMs = TURN_TIME_LIMIT_SEC * 1000;
      lastTurnTimerTickAt = Date.now();
      lastTimerWarnSec = -1;
      triggerTurnStartReminder(getActivePlayer());
      if (camera.mode !== "wide" && !camera.isDragging && state.players[state.activePlayerIndex]) {
        camera.mode = "follow";
        focusCameraOnTile(getActivePlayer().tileId);
      }
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
    syncScryPickModal();
    syncHasteReactionModal();
    syncForcedAllInModal();
    detectAndTriggerPlayerFeedback();
    processPendingCardLossAnimations();
    applyCameraTransform();
    scheduleAutoEndTurnIfReady();
    scheduleMultiplayerBotIfNeeded();
      if (state.winner) {
        clearLocalMatchAutosave();
        clearActiveMpSession();
        stopMpInactivityMonitor();
        if (mp.mode === "firebase_host" && mp.fbRoomRef && !mpPendingRoomDeleteTimerId) {
          scheduleFirebaseRoomDelete(mp.fbRoomRef, 12000);
        }
      } else if (mp.mode === "local" && isMatchStarted && !isInitializingMatch) {
        scheduleLocalMatchAutosave();
      }
      syncLeaveRoomCornerBtn();
  }

  // Dirty-checked HUD & Board render cache (avoid redundant DOM rebuilds)
  const _hudCache = {
    topStatus: "",
    players: "",
    hand: "",
    log: "",
    boardSvg: "",
    boardTiles: "",
    boardDynamic: ""
  };
  let _staticBoardRoadsSvg = "";
  let _hadBranchPreviewClasses = false;
  let _prevPlayerVisualStats = null;

  function resetPlayerVisualStatsTracker() {
    _prevPlayerVisualStats = null;
  }

  function snapshotPlayerVisualStats(players) {
    if (!Array.isArray(players)) return null;
    return players.map((p) => ({
      tc: Number(p.tc) || 0,
      handLen: Array.isArray(p.hand) ? p.hand.length : 0,
      skillsUsed: Number(p.skillsUsedThisTurn) || 0,
      isSamMode: Boolean(p.isSamMode),
      safeZoneImmune: Boolean(p.safeZoneImmune),
      metaShard: Number(p.metaShard) || 0,
      turnTcMultiplier: Number(p.turnTcMultiplier) || 1,
      nextTurnDiceMod: Number(p.nextTurnDiceMod) || 0,
      nextPhaseDiceMod: Number(p.nextPhaseDiceMod) || 0,
      nextRollMaxCap: Number(p.nextRollMaxCap) || 0,
      reverseNextRoll: Boolean(p.reverseNextRoll),
      skipNextTurn: Boolean(p.skipNextTurn),
      silencedThisPhase: Boolean(p.silencedThisPhase),
      passiveKeys: Array.isArray(p.passives) ? p.passives.map((ps) => ps.key) : []
    }));
  }

  function buildFeedbackTagIconSvg(kind) {
    if (kind === "card-loss" || kind === "card-gain") {
      return kind === "card-loss"
        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`
        : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="12" y1="8.5" x2="12" y2="15.5"/><line x1="8.5" y1="12" x2="15.5" y2="12"/></svg>`;
    }
    if (kind === "tc-loss" || kind === "tc-gain") {
      return kind === "tc-loss"
        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
        : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    }
    if (kind === "debuff") {
      return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L21 20H3L12 4z"/><line x1="12" y1="10" x2="12" y2="14.5"/><circle cx="12" cy="17.2" r="0.8" fill="currentColor"/></svg>`;
    }
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`;
  }

  function spawnFeedbackFloatBadge(parentEl, text, kind, opts = {}) {
    if (!parentEl) return;
    const tag = document.createElement("div");
    tag.className = `eft-fb-float is-${kind}${opts.isPawn ? " is-pawn" : ""}`;
    if (opts.topPx !== undefined) tag.style.top = `${opts.topPx}px`;
    if (opts.rightPx !== undefined) tag.style.right = `${opts.rightPx}px`;
    tag.innerHTML = `${buildFeedbackTagIconSvg(kind)}<span>${escapeHtml(text)}</span>`;
    parentEl.appendChild(tag);
    setTimeout(() => {
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    }, 960);
  }

  function triggerPlayerVisualFeedback(playerIndex, events) {
    if (!Array.isArray(events) || events.length === 0) return;
    const hudCard = document.querySelector(`.player-hud-card[data-player-idx="${playerIndex}"]`);
    const pawnEl = document.querySelector(`.board-chibi-pawn[data-player-idx="${playerIndex}"]`);
    if (!hudCard && !pawnEl) return;

    const hasNegative = events.some((ev) => ev.tone === "neg");
    const primaryKind = hasNegative
      ? events.find((ev) => ev.tone === "neg").kind
      : events[0].kind;

    if (hudCard) {
      hudCard.classList.remove(
        "fb-hit-tc",
        "fb-hit-card",
        "fb-hit-debuff",
        "fb-gain-tc",
        "fb-gain-card",
        "fb-gain-buff",
        "fb-shake-neg",
        "fb-lift-pos"
      );
      void hudCard.offsetWidth;
      const flashCls =
        primaryKind === "tc-loss"
          ? "fb-hit-tc"
          : primaryKind === "card-loss"
          ? "fb-hit-card"
          : primaryKind === "debuff"
          ? "fb-hit-debuff"
          : primaryKind === "tc-gain"
          ? "fb-gain-tc"
          : primaryKind === "card-gain"
          ? "fb-gain-card"
          : "fb-gain-buff";
      hudCard.classList.add(flashCls, hasNegative ? "fb-shake-neg" : "fb-lift-pos");
      setTimeout(() => {
        hudCard.classList.remove(flashCls, "fb-shake-neg", "fb-lift-pos");
      }, 460);

      const tcSpan = hudCard.querySelector(".ph-curr-tc");
      const cardSpan = hudCard.querySelector(".ph-cards-line");
      events.forEach((ev) => {
        if (tcSpan && (ev.kind === "tc-loss" || ev.kind === "tc-gain")) {
          tcSpan.classList.remove("fb-stat-neg", "fb-stat-pos");
          void tcSpan.offsetWidth;
          tcSpan.classList.add(ev.kind === "tc-loss" ? "fb-stat-neg" : "fb-stat-pos");
          setTimeout(() => tcSpan.classList.remove("fb-stat-neg", "fb-stat-pos"), 480);
        }
        if (cardSpan && (ev.kind === "card-loss" || ev.kind === "card-gain")) {
          cardSpan.classList.remove("fb-stat-neg", "fb-stat-pos");
          void cardSpan.offsetWidth;
          cardSpan.classList.add(ev.kind === "card-loss" ? "fb-stat-neg" : "fb-stat-pos");
          setTimeout(() => cardSpan.classList.remove("fb-stat-neg", "fb-stat-pos"), 480);
        }
      });
    }

    if (pawnEl) {
      pawnEl.classList.remove("pawn-fb-neg", "pawn-fb-pos", "pawn-fb-buff");
      void pawnEl.offsetWidth;
      const pCls = hasNegative ? "pawn-fb-neg" : primaryKind === "buff" ? "pawn-fb-buff" : "pawn-fb-pos";
      pawnEl.classList.add(pCls);
      setTimeout(() => pawnEl.classList.remove(pCls), 420);
    }

    events.slice(0, 3).forEach((ev, idx) => {
      const delay = idx * 145;
      const topOffset = -8 - idx * 24;
      setTimeout(() => {
        const curHud = document.querySelector(`.player-hud-card[data-player-idx="${playerIndex}"]`);
        const curPawn = document.querySelector(`.board-chibi-pawn[data-player-idx="${playerIndex}"]`);
        if (curHud) {
          spawnFeedbackFloatBadge(curHud, ev.label, ev.kind, { topPx: topOffset, rightPx: 8 });
        }
        if (curPawn) {
          spawnFeedbackFloatBadge(curPawn, ev.label, ev.kind, { isPawn: true });
        }
      }, delay);
    });
  }

  function detectAndTriggerPlayerFeedback() {
    if (!state || !Array.isArray(state.players) || isInitializingMatch || !isMatchStarted || isTitleScreenVisible) {
      _prevPlayerVisualStats = state && Array.isArray(state.players) ? snapshotPlayerVisualStats(state.players) : null;
      return;
    }

    const nextSnap = snapshotPlayerVisualStats(state.players);
    if (!_prevPlayerVisualStats || _prevPlayerVisualStats.length !== nextSnap.length) {
      _prevPlayerVisualStats = nextSnap;
      return;
    }

    for (let i = 0; i < nextSnap.length; i++) {
      const prev = _prevPlayerVisualStats[i];
      const cur = nextSnap[i];
      const p = state.players[i];
      const events = [];

      // 1. TC Gain / Loss
      const tcDelta = cur.tc - prev.tc;
      if (tcDelta < 0) {
        events.push({ kind: "tc-loss", tone: "neg", label: `${tcDelta} TC` });
      } else if (tcDelta > 0) {
        events.push({ kind: "tc-gain", tone: "pos", label: `+${tcDelta} TC` });
      }

      // 2. Card Gain / Loss (skip normal playing 1 card from own hand & SAM form swap)
      const isFormSwap = cur.isSamMode !== prev.isSamMode;
      const cardDelta = cur.handLen - prev.handLen;
      const skillsUsedDelta = cur.skillsUsed - prev.skillsUsed;
      if (!isFormSwap) {
        if (cardDelta < 0) {
          const effectiveLoss = skillsUsedDelta > 0 ? Math.max(0, Math.abs(cardDelta) - skillsUsedDelta) : Math.abs(cardDelta);
          if (effectiveLoss > 0) {
            events.push({
              kind: "card-loss",
              tone: "neg",
              label: `-${effectiveLoss} ${effectiveLoss > 1 ? "Cards" : "Card"}`
            });
          }
        } else if (cardDelta > 0) {
          events.push({
            kind: "card-gain",
            tone: "pos",
            label: `+${cardDelta} ${cardDelta > 1 ? "Cards" : "Card"}`
          });
        }
      }

      // 3. Positive Buffs
      if (cur.isSamMode && !prev.isSamMode) {
        events.push({ kind: "buff", tone: "pos", label: "SAM Mode!" });
      }
      if (cur.safeZoneImmune && !prev.safeZoneImmune) {
        events.push({ kind: "buff", tone: "pos", label: "+Safe Zone" });
      }
      if (cur.metaShard > prev.metaShard) {
        events.push({ kind: "buff", tone: "pos", label: "+Meta-Shard" });
      }
      if (cur.turnTcMultiplier > prev.turnTcMultiplier && cur.turnTcMultiplier > 1) {
        events.push({ kind: "buff", tone: "pos", label: `x${cur.turnTcMultiplier} TC` });
      }
      if (cur.nextTurnDiceMod > prev.nextTurnDiceMod && cur.nextTurnDiceMod > 0) {
        events.push({ kind: "buff", tone: "pos", label: `+${cur.nextTurnDiceMod} Dice` });
      }
      if (cur.nextPhaseDiceMod > prev.nextPhaseDiceMod && cur.nextPhaseDiceMod > 0) {
        events.push({ kind: "buff", tone: "pos", label: `+${cur.nextPhaseDiceMod} Roll` });
      }
      const prevPasSet = new Set(prev.passiveKeys);
      (p.passives || []).forEach((ps) => {
        if (ps && ps.key && !prevPasSet.has(ps.key)) {
          events.push({ kind: "buff", tone: "pos", label: `+${ps.name || "Buff"}` });
        }
      });

      // 4. Negative Debuffs
      if (cur.nextTurnDiceMod < prev.nextTurnDiceMod && cur.nextTurnDiceMod < 0) {
        events.push({ kind: "debuff", tone: "neg", label: `${cur.nextTurnDiceMod} Dice` });
      }
      if (cur.nextPhaseDiceMod < prev.nextPhaseDiceMod && cur.nextPhaseDiceMod < 0) {
        events.push({ kind: "debuff", tone: "neg", label: `${cur.nextPhaseDiceMod} Roll` });
      }
      if (cur.nextRollMaxCap > 0 && !prev.nextRollMaxCap) {
        events.push({ kind: "debuff", tone: "neg", label: `Max ${cur.nextRollMaxCap} Roll` });
      }
      if (cur.reverseNextRoll && !prev.reverseNextRoll) {
        events.push({ kind: "debuff", tone: "neg", label: "Reverse!" });
      }
      if (cur.skipNextTurn && !prev.skipNextTurn) {
        events.push({ kind: "debuff", tone: "neg", label: "Skip Turn!" });
      }
      if (cur.silencedThisPhase && !prev.silencedThisPhase) {
        events.push({ kind: "debuff", tone: "neg", label: "Silenced!" });
      }

      if (events.length > 0) {
        triggerPlayerVisualFeedback(i, events);
      }
    }

    _prevPlayerVisualStats = nextSnap;
  }

  function invalidateHudCache() {
    _hudCache.topStatus = "";
    _hudCache.players = "";
    _hudCache.hand = "";
    _hudCache.log = "";
    _hudCache.boardSvg = "";
    _hudCache.boardTiles = "";
    _hudCache.boardDynamic = "";
  }

  function toRomanNumeral(num) {
    const n = Math.max(1, Math.floor(Number(num) || 1));
    const pairs = [
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
    ];
    let rem = n;
    let out = "";
    for (let i = 0; i < pairs.length; i++) {
      while (rem >= pairs[i][0]) {
        out += pairs[i][1];
        rem -= pairs[i][0];
      }
    }
    return out;
  }

  function buildRoundProgressRingSvg(round, total) {
    const rVal = Math.max(1, Number(round) || 1);
    const tVal = Math.max(1, Number(total) || 4);
    const frac = Math.max(0, Math.min(1, rVal / tVal));
    const cx = 22;
    const cy = 22;
    const radius = 20;

    let fillShape = "";
    if (frac >= 0.999) {
      fillShape = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#f8fafc" />`;
    } else if (frac > 0.001) {
      const ang = frac * Math.PI * 2 - Math.PI / 2;
      const x = cx + radius * Math.cos(ang);
      const y = cy + radius * Math.sin(ang);
      const largeArc = frac > 0.5 ? 1 : 0;
      fillShape = `<path d="M ${cx} ${cy} L ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="#f8fafc" />`;
    }

    const clipShape =
      frac >= 0.999
        ? `<circle cx="${cx}" cy="${cy}" r="${radius}" />`
        : frac > 0.001
        ? (() => {
            const ang = frac * Math.PI * 2 - Math.PI / 2;
            const x = cx + radius * Math.cos(ang);
            const y = cy + radius * Math.sin(ang);
            const largeArc = frac > 0.5 ? 1 : 0;
            return `<path d="M ${cx} ${cy} L ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" />`;
          })()
        : "";

    const fractionMarkup = (color) => `
      <text x="14.5" y="18.5" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-size="13.5" font-weight="700" fill="${color}">${rVal}</text>
      <line x1="25.5" y1="12.5" x2="17.5" y2="31.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
      <text x="28.5" y="33" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-size="13.5" font-weight="700" fill="${color}">${tVal}</text>
    `;

    return `
      <svg class="round-progress-svg" viewBox="0 0 44 44" aria-label="Round ${rVal} of ${tVal}">
        <defs>
          <clipPath id="eftRoundFillClip">${clipShape}</clipPath>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#0a181c" stroke="rgba(248, 250, 252, 0.55)" stroke-width="1.5" />
        ${fillShape}
        ${fractionMarkup("#f8fafc")}
        <g clip-path="url(#eftRoundFillClip)">
          ${fractionMarkup("#081113")}
        </g>
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(248, 250, 252, 0.65)" stroke-width="1.3" />
      </svg>`;
  }

  function renderTopStatusStrip() {
    const activeP = getActivePlayer();
    const targetSlots = state.rules.activeShardsOnBoard || 3;
    const shardSig = state.activeShards.map((s) => `${s.roman}:${s.tileId}`).join(",");
    const geSig = state.activeGlobalEvent
      ? `${state.activeGlobalEvent.card.id}:${state.activeGlobalEvent.remainingRounds ?? state.activeGlobalEvent.remainingTurns ?? 0}`
      : "";
    const lcuSig = state.lastSkillCardUsed ? `${state.lastSkillCardUsed.id}` : "";
    const topSig = [
      state.cycle,
      state.roundInCycle,
      state.rules.turnsPerCycle,
      state.activePlayerIndex,
      activeP.name,
      activeP.color,
      state.isMonsterTurn ? 1 : 0,
      state.activeMonster ? state.activeMonster.id : "",
      state.phaseIndex,
      activeP.skillsUsedThisTurn,
      activeP.maxSkillsThisTurn,
      isAdminUnlocked && adminFreeSkillUse ? 1 : 0,
      targetSlots,
      shardSig,
      geSig,
      lcuSig
    ].join("|");
    if (_hudCache.topStatus === topSig) return;
    _hudCache.topStatus = topSig;

    const turnEl = document.getElementById("turn-player-label");
    if (turnEl) {
      if (state.isMonsterTurn && state.activeMonster) {
        turnEl.textContent = state.activeMonster.name;
        turnEl.style.borderBottom = `2px solid ${state.activeMonster.color || "#22c55e"}`;
      } else {
        turnEl.textContent = activeP.name;
        turnEl.style.borderBottom = `2px solid ${activeP.color}`;
      }
    }
    const cycleEl = document.getElementById("metric-cycle");
    if (cycleEl) cycleEl.textContent = toRomanNumeral(state.cycle);

    const isNightCycle = state.cycle % 2 === 0;
    const arenaEl = document.querySelector(".arena-stage");
    if (arenaEl) {
      arenaEl.setAttribute("data-cycle-time", isNightCycle ? "night" : "day");
    }
    const timeBadgeEl = document.getElementById("cycle-time-badge");
    if (timeBadgeEl) {
      timeBadgeEl.classList.toggle("is-night", isNightCycle);
      timeBadgeEl.classList.toggle("is-day", !isNightCycle);
      timeBadgeEl.title = isNightCycle
        ? `Cycle ${toRomanNumeral(state.cycle)} · Night (Even Cycle)`
        : `Cycle ${toRomanNumeral(state.cycle)} · Day (Odd Cycle)`;
      timeBadgeEl.innerHTML = isNightCycle
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg><span>Night</span>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"></path></svg><span>Day</span>`;
    }

    const ringEl = document.getElementById("round-progress-ring");
    if (ringEl) {
      ringEl.innerHTML = buildRoundProgressRingSvg(state.roundInCycle, state.rules.turnsPerCycle);
      ringEl.title = `Round ${state.roundInCycle} / ${state.rules.turnsPerCycle}`;
    }

    const freeAdmin = isAdminUnlocked && adminFreeSkillUse;
    const cardUseEl = document.getElementById("metric-card-use");
    const cardUseWrap = document.getElementById("roll-card-used-label");
    if (cardUseEl) {
      cardUseEl.textContent = freeAdmin
        ? `${activeP.skillsUsedThisTurn} / FREE`
        : `${activeP.skillsUsedThisTurn} / ${activeP.maxSkillsThisTurn}`;
    }
    if (cardUseWrap) {
      const isMaxed = !freeAdmin && activeP.skillsUsedThisTurn >= activeP.maxSkillsThisTurn;
      cardUseWrap.classList.toggle("is-maxed", isMaxed);
    }

    const romans = state.activeShards.map((s) => s.roman);
    while (romans.length < targetSlots) romans.push("-");
    const shardsEl = document.getElementById("metric-shards");
    if (shardsEl) {
      shardsEl.textContent = romans.slice(0, targetSlots).join(" / ");
    }
    const shardPill = document.getElementById("shard-zones-pill");
    if (shardPill) {
      shardPill.title =
        state.activeShards.map((s) => `Zone ${s.roman} (${s.tileId})`).join(", ") || "No active Shards";
    }

    const weSlot = document.getElementById("world-event-pill-slot");
    if (weSlot) {
      if (state.activeGlobalEvent) {
        const ge = state.activeGlobalEvent.card;
        const geRem = state.activeGlobalEvent.remainingRounds ?? state.activeGlobalEvent.remainingTurns ?? 1;
        weSlot.innerHTML = `<div class="world-event-active-chip" onclick="window.EFT_APP.showEffectSpotlight('Active World Event', '${escapeHtml(
          ge.name
        )}', '${escapeHtml(ge.description)}', '${ge.image || ""}')">Event: ${escapeHtml(ge.name)} (${geRem}R)</div>`;
      } else {
        weSlot.innerHTML = "";
      }
    }

    const lcuSlot = document.getElementById("last-card-used-slot");
    if (lcuSlot) {
      const lcu = state.lastSkillCardUsed;
      if (lcu && lcu.cardName) {
        lcuSlot.innerHTML = `
          <button type="button" class="last-card-used-card" onclick="window.EFT_APP.openLastUsedCardModal()" title="Click to inspect the last card effect &amp; outcome">
            ${lcu.cardImg ? `<img class="last-card-used-thumb" src="${lcu.cardImg}" alt="${escapeHtml(lcu.cardName)}" loading="lazy" decoding="async" />` : ""}
            <div class="last-card-used-meta">
              <span class="last-card-used-label">Last Card Used</span>
              <span class="last-card-used-name">${escapeHtml(lcu.cardName)}</span>
              <span class="last-card-used-caster">${escapeHtml(lcu.casterName || "-")} · View details</span>
            </div>
          </button>`;
      } else {
        lcuSlot.innerHTML = `
          <div class="last-card-used-empty">
            <span class="last-card-used-label">Last Card Used</span>
            <span>None yet</span>
          </div>`;
      }
    }
  }

  function openLastUsedCardModal() {
    if (!state || !state.lastSkillCardUsed) return;
    playSfx("click");
    const lcu = state.lastSkillCardUsed;
    openInfoModal(
      `Last Card Used: ${escapeHtml(lcu.cardName)}`,
      `<div class="last-used-detail-layout">
        ${lcu.cardImg ? `<img class="last-used-detail-img" src="${lcu.cardImg}" alt="${escapeHtml(lcu.cardName)}" />` : ""}
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:1.05rem;color:#f8fafc;">${escapeHtml(lcu.cardName)}</strong>
            <span class="tag-badge">${escapeHtml(lcu.rarity || "Skill")}</span>
          </div>
          <div style="font-size:0.76rem;color:var(--text-muted);">
            Used by <strong style="color:#fff;">${escapeHtml(lcu.casterName || "-")}</strong> · Cycle ${lcu.cycle || 1} (Round ${lcu.round || 1})
          </div>
          <div class="last-used-detail-section">
            <div class="last-used-detail-heading">Skill Card Effect</div>
            <div style="font-size:0.84rem;color:#e2e8f0;line-height:1.48;">${escapeHtml(lcu.description || "-")}</div>
          </div>
          <div class="last-used-detail-section">
            <div class="last-used-detail-heading">What Happened</div>
            <div style="font-size:0.84rem;color:var(--mint-light);font-weight:700;line-height:1.48;">${escapeHtml(lcu.outcomeText || lcu.description || "-")}</div>
          </div>
        </div>
      </div>`
    );
  }

  function openScryPickModal() {
    if (!pendingInteraction || pendingInteraction.type !== "scry_2_keep_1") return;
    const { player, cards, cardName } = pendingInteraction;
    if (!isLocalHumanTurnForPlayer(player) || !Array.isArray(cards) || cards.length === 0) return;

    const cardsHtml = cards
      .map((c) => {
        const imgUrl = getCardImage(c, c.ownerCharId || c.charId || player.charId);
        return `
          <div class="scry-pick-card">
            <img class="scry-pick-img" src="${imgUrl}" alt="${escapeHtml(c.name)}" />
            <div class="scry-pick-title">${escapeHtml(c.name)}</div>
            <span class="tag-badge">${escapeHtml(c.rarity || "Skill")}</span>
            <div class="scry-pick-desc">${escapeHtml(c.description || "")}</div>
            <button type="button" class="btn btn-emerald" style="width:100%;" onclick="window.EFT_APP.resolveScryKeepChoice('${escapeHtml(c.uid)}')">
              Add to Hand
            </button>
          </div>`;
      })
      .join("");

    openInfoModal(
      `${escapeHtml(cardName || "Insect's Instinct")}: Pick 1 of Top 2 Cards`,
      `<div style="display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:0.8rem;color:#cbd5e1;">
          Choose <strong>1 card</strong> to add to <strong>${escapeHtml(player.name)}'s</strong> hand. The unchosen card will be discarded automatically.
        </div>
        <div class="scry-pick-grid">${cardsHtml}</div>
      </div>`,
      "scry_pick"
    );
  }

  function syncScryPickModal() {
    if (!pendingInteraction || pendingInteraction.type !== "scry_2_keep_1") {
      lastOpenedScryId = null;
      return;
    }
    if (!isLocalHumanTurnForPlayer(pendingInteraction.player)) return;
    if (lastOpenedScryId !== pendingInteraction.id) {
      lastOpenedScryId = pendingInteraction.id;
      openScryPickModal();
    }
  }

  function resolveScryKeepChoice(chosenUid) {
    if (!canLocalPlayerAct()) return;
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
    if (isRemoteClient()) {
      sendClientActionToHost("scry_keep_choice", { chosenUid });
      closeModal();
      return;
    }
    if (!pendingInteraction || pendingInteraction.type !== "scry_2_keep_1") return;
    const { player, cards, cardName } = pendingInteraction;
    pendingInteraction = null;
    lastOpenedScryId = null;
    closeModal();

    if (Array.isArray(cards) && cards.length > 0) {
      const chosen = cards.find((c) => c.uid === chosenUid) || cards[0];
      const discarded = cards.filter((c) => c.uid !== chosen.uid);
      const lim = getEffectiveHandLimit(player);
      let keepMsg = "";
      if (player.hand.length < lim) {
        player.hand.push(chosen);
        keepMsg = `added [${chosen.name}] to hand`;
      } else {
        if (isCardForeignToPlayer(chosen, player)) returnForeignCardToOwner(chosen, player);
        else player.discard.push(chosen);
        keepMsg = `hand was full so [${chosen.name}] was discarded`;
      }
      const discNames = [];
      discarded.forEach((dc) => {
        discNames.push(dc.name);
        if (isCardForeignToPlayer(dc, player)) returnForeignCardToOwner(dc, player);
        else player.discard.push(dc);
      });
      const fullMsg = `${player.name} ${keepMsg}${discNames.length > 0 ? ` & discarded [${discNames.join(", ")}]` : ""}!`;
      addLog(`[${cardName || "Insect's Instinct"}]: ${fullMsg}`);
      if (state.lastSkillCardUsed && state.lastSkillCardUsed.cardName === (cardName || "Insect's Instinct")) {
        state.lastSkillCardUsed.outcomeText = fullMsg;
      }
      playSfx("card");
    }

    renderAll();
    broadcastMultiplayerState();
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
        const extra = preview.hitNextBranch ? ` · Another branch (${preview.stepsLeftAtNextBranch} left)` : "";
        banner.innerHTML = `
          <span class="step-count-badge">${pendingInteraction.stepsRemaining} ${pendingInteraction.stepsRemaining === 1 ? "Step" : "Steps"} Left</span>
          <span>Preview: <strong>${escapeHtml(landTile.name)} (${preview.landingTileId})</strong>${extra}: ${
            touchOnly ? "Tap this tile again to move" : "Click tile to turn"
          }</span>`;
      } else {
        banner.innerHTML = `
          <span class="step-count-badge">${pendingInteraction.stepsRemaining} ${pendingInteraction.stepsRemaining === 1 ? "Step" : "Steps"} Left</span>
          <span>Choose a path directly on a glowing tile (${
            touchOnly ? "tap to preview" : "hover to preview, click to turn"
          })</span>`;
      }
      return;
    }

    if (pendingInteraction && pendingInteraction.type === "stage_is_mine") {
      banner.classList.add("visible", "branch-mode");
      banner.innerHTML = `
        <span class="step-count-badge">The Stage Is Mine</span>
        <span>Landed on Normal Tile: Click a glowing <strong>+1 / +2 / -1</strong> tile on the map to move &amp; trigger its effect, or Skip</span>`;
      return;
    }

    if (isWalkingAnim && activeStepsRemaining > 0) {
      banner.classList.add("visible");
      banner.classList.remove("branch-mode");
      banner.innerHTML = `
        <span class="step-count-badge">${activeStepsRemaining} ${activeStepsRemaining === 1 ? "Step" : "Steps"} Left</span>
        <span>${escapeHtml(getActivePlayer().name)} is moving...</span>`;
      return;
    }

    banner.classList.remove("visible", "branch-mode");
    banner.innerHTML = "";
  }

  function getCharacterPassiveStatusInfo(p) {
    const charDef = getCharacterForCompendium(p.charId, state.compendiumId) || DATA.CHARACTERS[p.charId] || {};
    const cardList = p.isSamMode && Array.isArray(charDef.samCards) ? charDef.samCards : charDef.cards || [];
    const passiveCardDefs = cardList.filter(
      (c) => c && (c.rarity === "Unique" || String(c.effectKey || "").startsWith("passive_"))
    );
    const activePassives = Array.isArray(p.passives) ? p.passives : [];
    const isActive = activePassives.length > 0;

    const formatDur = (pas) => {
      if (pas.expiresOnCycleEnd) {
        const totalR = (state.rules && state.rules.turnsPerCycle) || 4;
        const roundsLeft = Math.max(1, totalR - (state.roundInCycle || 1) + 1);
        return `${roundsLeft} ${roundsLeft === 1 ? "Round" : "Rounds"} Left`;
      }
      if (typeof pas.remainingTurns === "number") {
        const playersCnt = Math.max(1, state.players.length || 4);
        return pas.remainingTurns === 1
          ? "1 Turn Left"
          : `${Math.max(1, Math.ceil(pas.remainingTurns / playersCnt))} Rounds Left`;
      }
      return "Active";
    };

    if (isActive) {
      const primary = activePassives[0];
      const matchDef = passiveCardDefs.find((c) => c.effectKey === primary.key) || passiveCardDefs[0];
      const extraList = activePassives.map((ap) => `${ap.name} (${formatDur(ap)})`).join(" · ");
      return {
        isActive: true,
        title: primary.name || (matchDef ? matchDef.name : "Passive"),
        statusLabel: `ON · ${formatDur(primary)}`,
        extraLabel: activePassives.length > 1 ? extraList : "",
        description: matchDef ? matchDef.description : "Character passive effect is currently active."
      };
    }

    const baseDef = passiveCardDefs.find((c) => c.rarity === "Unique") || passiveCardDefs[0];
    return {
      isActive: false,
      title: baseDef ? baseDef.name : "Character Passive",
      statusLabel: "OFF",
      extraLabel: "",
      description: baseDef ? baseDef.description : "Activate this character's Unique / Passive card to turn this indicator on."
    };
  }

  function getWorldEventShortPillLabel(ge) {
    if (!ge || !ge.card) return "";
    const c = ge.card;
    const dur = ge.remainingTurns || 1;
    if (c.multiplierTC === 2) return `2x TC (${dur}T)`;
    if (c.multiplierSteps === 2) return `2x Steps (${dur}T)`;
    if (c.multiplierSteps === 0.5) return `0.5x Steps (${dur}T)`;
    if (c.bonusDice > 0) return `+${c.bonusDice} Dice (${dur}T)`;
    if (c.bonusDice < 0) return `${c.bonusDice} Dice (${dur}T)`;
    return `${c.name} (${dur}T)`;
  }

  function renderFloatingPlayerCards() {
    const listContainer = document.getElementById("hud-players-list");
    if (!listContainer) return;

    const geSig = state.activeGlobalEvent
      ? `${state.activeGlobalEvent.card.id}:${state.activeGlobalEvent.remainingRounds ?? state.activeGlobalEvent.remainingTurns ?? 0}`
      : "";

    const playersSig = [
      state.activePlayerIndex,
      state.roundInCycle,
      isAdminUnlocked ? 1 : 0,
      mp.mode,
      mp.mySeat,
      geSig,
      state.isMonsterTurn ? 1 : 0,
      state.activeMonster ? `${state.activeMonster.id}:${state.activeMonster.tileId}` : "",
      ...state.players.map((p) =>
        [
          p.name,
          p.charId,
          p.tc,
          p.shards,
          p.metaShard || 0,
          (p.hand || []).length,
          p.inSpawn ? 1 : 0,
          p.isSamMode ? 1 : 0,
          p.turnTcMultiplier || 1,
          p.nextTurnDiceMod || 0,
          p.nextPhaseDiceMod || 0,
          p.nextRollMaxCap || 0,
          p.reverseNextRoll ? 1 : 0,
          p.skipNextTurn ? 1 : 0,
          p.silencedThisPhase ? 1 : 0,
          p.cursedRounds || 0,
          p.safeZoneImmune ? 1 : 0,
          (p.passives || []).map((ps) => `${ps.key}:${ps.remainingTurns}:${ps.expiresOnCycleEnd ? 1 : 0}`).join(",")
        ].join("~")
      )
    ].join("|");
    if (_hudCache.players === playersSig) return;
    _hudCache.players = playersSig;

    const miniShardIcon = `<svg class="ph-shard-svg" viewBox="0 0 18 32" aria-hidden="true"><polygon points="9,1 16,8 16,24 9,31 2,24 2,8" fill="#c084fc" stroke="#f5d0fe" stroke-width="1.4"/><polygon points="9,1 9,31 2,24 2,8" fill="#a855f7" fill-opacity="0.7"/></svg>`;
    const worldEventLabel = state.activeGlobalEvent ? getWorldEventShortPillLabel(state.activeGlobalEvent) : "";

    const buildCard = (p, idx) => {
      const isTurn = idx === state.activePlayerIndex;
      const charBase = DATA.CHARACTERS[p.charId] || {};
      const pt = charBase.portrait || null;
      const pColor = p.color || charBase.color || "#9fd6be";
      const pRgb = charBase.colorRgb || "159, 214, 190";
      const pasInfo = getCharacterPassiveStatusInfo(p);

      const chips = [];
      // Green = Positive Buffs
      if (p.inSpawn) chips.push(`<span class="fp-effect-chip is-buff">Spawn Immune</span>`);
      if (p.isSamMode) chips.push(`<span class="fp-effect-chip is-buff">SAM Mode</span>`);
      if (p.safeZoneImmune) chips.push(`<span class="fp-effect-chip is-buff">Safe Zone</span>`);
      if (p.metaShard > 0) chips.push(`<span class="fp-effect-chip is-buff">Meta-Shard</span>`);
      if (p.turnTcMultiplier > 1) chips.push(`<span class="fp-effect-chip is-buff">x${p.turnTcMultiplier} TC</span>`);
      if (p.nextTurnDiceMod > 0) chips.push(`<span class="fp-effect-chip is-buff">+${p.nextTurnDiceMod} Dice</span>`);
      if (p.nextPhaseDiceMod > 0) chips.push(`<span class="fp-effect-chip is-buff">+${p.nextPhaseDiceMod} Roll</span>`);

      // Red = Debuffs
      if (p.nextTurnDiceMod < 0) chips.push(`<span class="fp-effect-chip is-debuff">${p.nextTurnDiceMod} Dice</span>`);
      if (p.nextPhaseDiceMod < 0) chips.push(`<span class="fp-effect-chip is-debuff">${p.nextPhaseDiceMod} Roll</span>`);
      if (p.nextRollMaxCap > 0) chips.push(`<span class="fp-effect-chip is-debuff">Max ${p.nextRollMaxCap} Roll</span>`);
      if (p.reverseNextRoll) chips.push(`<span class="fp-effect-chip is-debuff">Reverse</span>`);
      if (p.skipNextTurn) chips.push(`<span class="fp-effect-chip is-debuff">Skip Turn</span>`);
      if (p.silencedThisPhase) chips.push(`<span class="fp-effect-chip is-debuff">Silenced</span>`);
      if (p.cursedRounds > 0) chips.push(`<span class="fp-effect-chip is-debuff is-cursed">Cursed</span>`);

      // Purple = World Event with turn duration
      if (worldEventLabel) {
        chips.push(`<span class="fp-effect-chip is-world-event">${escapeHtml(worldEventLabel)}</span>`);
      }

      const portraitHtml =
        pt && pt.src
          ? pt.cover
            ? `<img class="ph-portrait-img is-cover" src="${pt.src}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" />`
            : `<img class="ph-portrait-img" src="${pt.src}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
          : `<div class="ph-portrait-fallback" style="background:radial-gradient(circle at 50% 42%, ${pColor}55 0%, #07191a 82%);"><div class="ph-fallback-icon" style="fill:${pColor};">${getCharacterSvgIcon(p.charId)}</div></div>`;

      const editBtn = isAdminUnlocked
        ? `<span class="ph-edit-link" onclick="event.stopPropagation();window.EFT_APP.openSandboxPlayerModal(${idx})">Edit</span>`
        : "";
      const rightClickAttr = isAdminUnlocked
        ? ` oncontextmenu="event.preventDefault();window.EFT_APP.openSandboxPlayerModal(${idx})"`
        : "";

      return `
      <div class="player-hud-card ${isTurn ? "is-active" : ""}" data-player-idx="${idx}" style="--p-color:${pColor};--p-rgb:${pRgb};" onclick="window.EFT_APP.focusCameraOnPlayer(${idx})" title="${escapeHtml(p.name)}${isAdminUnlocked ? " (Click to focus, right-click to edit)" : ""}"${rightClickAttr}>
        <div class="ph-card-clip">
          <div class="ph-hit-flash" aria-hidden="true"></div>
          <div class="ph-portrait-col">${portraitHtml}</div>
          <div class="ph-info-col">
            <div class="ph-title-row">
              <span class="ph-name ${p.name.length > 11 ? "long-name" : ""}">${escapeHtml(p.name)}</span>
              ${editBtn}
            </div>
            <div class="ph-stats-line">
              <span class="ph-curr-tc">TC: ${p.tc}</span>
              <span class="ph-curr-shard">${miniShardIcon}: ${p.shards + p.metaShard}/${state.rules.victoryShards}</span>
            </div>
            <div class="ph-cards-line">cards: ${p.hand.length}/${getEffectiveHandLimit(p)}</div>
            ${chips.length > 0 ? `<div class="ph-effects-row">${chips.join("")}</div>` : ""}
          </div>
          <div class="ph-passive-spacer" aria-hidden="true"></div>
        </div>
        <div class="ph-passive-wrap" onclick="event.stopPropagation()">
          <button type="button" class="ph-passive-orb ${pasInfo.isActive ? "is-on" : "is-off"}" aria-label="Passive ${escapeHtml(pasInfo.title)}: ${pasInfo.isActive ? "ON" : "OFF"}"></button>
          <div class="ph-passive-tooltip" role="tooltip">
            <div class="ph-pt-head">
              <span class="ph-pt-title">${escapeHtml(pasInfo.title)}</span>
              <span class="ph-pt-state ${pasInfo.isActive ? "is-on" : "is-off"}">${escapeHtml(pasInfo.statusLabel)}</span>
            </div>
            ${pasInfo.extraLabel ? `<div class="ph-pt-extra">${escapeHtml(pasInfo.extraLabel)}</div>` : ""}
            <div class="ph-pt-desc">${escapeHtml(pasInfo.description)}</div>
          </div>
        </div>
      </div>`;
    };

    const monsterCardHtml = buildMonsterHudCardHtml();
    listContainer.innerHTML = monsterCardHtml + state.players.map((p, i) => buildCard(p, i)).join("");
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
    if (t.type === "intersect") {
      return `<div class="lgr-split-hub" title="Split Junction (does not cost a step)">${buildSplitHubSvg(t)}</div>`;
    }
    if (activeToken && t.type === "normal") {
      const tm = getTrapTileMeta(activeToken);
      return `
        <div class="lgr-tile-shell">
          <div class="lgr-icon">${tm.icon}</div>
          <div class="lgr-pill-label">${escapeHtml(tm.label)}</div>
        </div>
        <div class="tile-token-sublabel ${tm.badgeCls}">${tm.icon}<span>${escapeHtml(tm.label)}</span></div>`;
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
    const tokenSubHtml = activeToken
      ? (() => {
          const tm = getTrapTileMeta(activeToken);
          return `<div class="tile-token-sublabel is-dual ${tm.badgeCls}">${tm.icon}<span>${escapeHtml(tm.label)}</span></div>`;
        })()
      : "";
    return `
      <div class="lgr-tile-shell">
        <div class="lgr-icon">${getTileSvgIcon(t.type)}</div>
        ${lbl ? `<div class="lgr-pill-label">${escapeHtml(lbl)}</div>` : ""}
      </div>
      ${tokenSubHtml}`;
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
    return `<div class="chibi-dir-indicator ${isRev ? "is-reverse" : ""}" title="${isRev ? "Moving BACKWARD (Mind Deviation)" : "Next dice movement direction"}">${arrowsHtml}${isRev ? `<span class="chibi-dir-rev-tag">REV</span>` : ""}</div>`;
  }

  function buildStaticBoardRoadsSvg() {
    if (_staticBoardRoadsSvg) return _staticBoardRoadsSvg;
    const W = BOARD_W;
    const H = BOARD_H;
    const pathLines = [];

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

    _staticBoardRoadsSvg = pathLines.join("");
    return _staticBoardRoadsSvg;
  }

  function renderBoardSvgOverlay() {
    const svg = document.getElementById("map-svg-overlay");
    if (!svg) return;

    const isBranching = Boolean(pendingInteraction && pendingInteraction.type === "choose_branch");
    const svgSig = isBranching
      ? [
          "branch",
          pendingInteraction.player ? pendingInteraction.player.tileId : "",
          (pendingInteraction.candidates || []).join(","),
          pendingInteraction.stepsRemaining || 0,
          pendingInteraction.direction || 1,
          hoveredBranchTileId || ""
        ].join("|")
      : "static";

    if (_hudCache.boardSvg === svgSig && svg.childElementCount > 0) return;
    _hudCache.boardSvg = svgSig;

    const W = BOARD_W;
    const H = BOARD_H;
    const dynamicLines = [];

    // Highlight glowing branch turn paths & live preview polyline ONLY during active branch choice
    if (isBranching) {
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
            dynamicLines.push(
              `<line x1="${x0}" y1="${y0}" x2="${xa}" y2="${ya}" stroke="${color}" stroke-width="${isHov ? 8 : 6.5}" stroke-linecap="round" />`
            );
          }
          dynamicLines.push(
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
            dynamicLines.push(
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
      ${buildStaticBoardRoadsSvg()}
      ${dynamicLines.join("")}
    `;
  }

  function applyBranchPreviewTileClasses() {
    const hasActivePreview = Boolean(
      pendingInteraction &&
      pendingInteraction.type === "choose_branch" &&
      hoveredBranchTileId &&
      pendingInteraction.candidates.includes(hoveredBranchTileId)
    );
    if (!hasActivePreview && !_hadBranchPreviewClasses) return;

    const tilesLayer = document.getElementById("map-tiles-layer") || document.getElementById("map-nodes-layer");
    if (!tilesLayer) return;

    tilesLayer.querySelectorAll(".branch-hovered, .branch-preview-step, .branch-preview-landing").forEach((el) => {
      el.classList.remove("branch-hovered", "branch-preview-step", "branch-preview-landing");
      el.removeAttribute("data-preview-step");
      el.removeAttribute("data-preview-tag");
      if (el.classList.contains("branch-option")) {
        el.setAttribute("data-branch-tag", "TURN");
      }
    });

    if (!hasActivePreview) {
      _hadBranchPreviewClasses = false;
      return;
    }

    _hadBranchPreviewClasses = true;
    const touchOnly = isTouchOnlyDevice();
    const hovEl = tilesLayer.querySelector(`[data-tile-id="${hoveredBranchTileId}"]`);
    if (hovEl) {
      hovEl.classList.add("branch-hovered");
      if (touchOnly) hovEl.setAttribute("data-branch-tag", "TAP AGAIN");
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
      hovEl.setAttribute("data-branch-tag", touchOnly ? "TAP AGAIN" : preview.hitNextBranch ? "BRANCH" : "LANDING");
      return;
    }

    for (let i = 1; i < preview.path.length; i++) {
      const tid = preview.path[i];
      const el = tilesLayer.querySelector(`[data-tile-id="${tid}"]`);
      if (!el) continue;
      if (i < preview.path.length - 1) {
        el.classList.add("branch-preview-step");
        el.setAttribute("data-preview-step", String(i + 1));
      } else {
        el.classList.add("branch-preview-landing");
        el.setAttribute("data-preview-tag", preview.hitNextBranch ? "BRANCH" : "LANDING");
      }
    }
  }

  const TILE_EFFECT_META = {
    tc_plus10: {
      title: "Tile +10 Tartarus Coin",
      badge: "+10 TC",
      accent: "#10b981",
      effect: "A player who lands directly on this tile gains +10 Tartarus Coins (💰 TC) from the bank."
    },
    tc_minus5: {
      title: "Tile -5 Tartarus Coin",
      badge: "-5 TC",
      accent: "#e11d48",
      effect: "A player who lands directly on this tile loses 5 Tartarus Coins (💰 TC) to the bank."
    },
    card_plus1: {
      title: "Tile +1 Skill Card",
      badge: "+1 Card",
      accent: "#0284c7",
      effect: "A player who lands directly on this tile draws +1 Skill Card from their personal deck (up to the Hand Limit)."
    },
    card_minus1: {
      title: "Tile -1 Skill Card",
      badge: "-1 Card",
      accent: "#eab308",
      effect: "A player who lands directly on this tile must discard 1 random card from their hand."
    },
    pos_effect: {
      title: "Positive Effect Tile",
      badge: "Positive Deck",
      accent: "#34d399",
      effect: "Draws 1 random Positive Effect Card (+10 TC, +15 TC, +1 Die Next Turn, Draw 1 Card, or Draw 2 Cards)."
    },
    neg_effect: {
      title: "Negative Effect Tile",
      badge: "Negative Deck",
      accent: "#fb7185",
      effect: "Draws 1 random Negative Effect Card (-5 TC, -10 TC, Discard 1 Card, Discard 2 Cards, or -1 Die Next Turn)."
    },
    event: {
      title: "Global Event Tile",
      badge: "Global Event",
      accent: "#d946ef",
      effect: "Draws 1 random Global Event Card whose effect immediately applies to all players in the arena."
    },
    versus: {
      title: "Versus Duel Tile",
      badge: "1v1 Versus",
      accent: "#f97316",
      effect: "Challenges an opponent to a 1v1 dice duel for a TC wager. The winner claims the pot."
    },
    trading: {
      title: "Trading Post",
      badge: "Trade",
      accent: "#84cc16",
      effect: "Opens a trade with another player: buy 1 random card (💰 15 TC), sell 1 card (💰 15 TC), or swap 1 random card."
    },
    merchant: {
      title: "Merchant Shop",
      badge: "Shop",
      accent: "#f59e0b",
      effect: "Located beside the path (does not consume movement steps). Passing the arrowed Shop lane with 💰 >= 15 TC lets you open the Merchant Shop."
    },
    warp: {
      title: "Warp Teleporter",
      badge: "Warp",
      accent: "#60a5fa",
      effect: "Landing directly on this tile instantly warps you to its paired Warp Tile on the other side of the map."
    },
    river_top: {
      title: "River Shortcut (Entry)",
      badge: "River",
      accent: "#38bdf8",
      effect: "Passing this tile with remaining steps (> 0) lets you pay 💰 15 TC to cross directly to the River Exit."
    },
    river_bottom: {
      title: "River Shortcut (Exit)",
      badge: "River Exit",
      accent: "#38bdf8",
      effect: "Exit landing point across the River Tartarus after taking the River Shortcut."
    }
  };

  const TOKEN_EFFECT_DESCRIPTIONS = {
    virus_trap: "Punishing Virus (Trap): Opponents passing or landing on this tile lose 1 die on their next dice roll.",
    herb_tile: "Medicinal Herbs: Players passing or landing here immediately gain +10 💰 TC.",
    restricted_zone: "Restricted Zone: Opponents landing on this tile must pay 20 💰 TC to the token owner.",
    fire_tile: "Deathstar Fire: Players landing here lose 15 💰 TC and their next roll is capped at 6 steps.",
    safe_zone: "Safe Zone (Oak Cake Break): Players on this tile cannot be targeted by opponent card effects."
  };

  function renderDigitalBoard() {
    renderBoardSvgOverlay();

    const nodesLayer = document.getElementById("map-nodes-layer");
    if (!nodesLayer) return;

    let tilesLayer = document.getElementById("map-tiles-layer");
    let dynamicLayer = document.getElementById("map-dynamic-layer");
    if (!tilesLayer || !dynamicLayer) {
      nodesLayer.innerHTML = `<div id="map-tiles-layer" class="map-sublayer"></div><div id="map-dynamic-layer" class="map-sublayer"></div>`;
      tilesLayer = document.getElementById("map-tiles-layer");
      dynamicLayer = document.getElementById("map-dynamic-layer");
      _hudCache.boardTiles = "";
      _hudCache.boardDynamic = "";
    }

    const localCanAct = canLocalPlayerAct();
    const branchCandidates =
      localCanAct && pendingInteraction && pendingInteraction.type === "choose_branch"
        ? pendingInteraction.candidates || []
        : [];
    const radiusIds =
      localCanAct &&
      pendingInteraction &&
      (pendingInteraction.type === "select_tile_target" ||
        pendingInteraction.type === "stage_is_mine" ||
        pendingInteraction.type === "select_token_source" ||
        pendingInteraction.type === "select_token_dest" ||
        pendingInteraction.type === "select_sam_fire_1" ||
        pendingInteraction.type === "select_sam_fire_2")
        ? pendingInteraction.validTileIds || []
        : [];

    const tilesSig = [
      localCanAct ? 1 : 0,
      state.activeShards.map((s) => `${s.roman}:${s.tileId}`).join(","),
      state.boardTokens
        .map((tok) => `${tok.id}:${tok.type}:${tok.tileId}:${tok.ownerIndex}:${(tok.coveredTileIds || []).join(".")}`)
        .join(","),
      branchCandidates.join(","),
      branchCandidates.length > 0
        ? `${pendingInteraction.stepsRemaining}:${pendingInteraction.direction}:${pendingInteraction.player ? pendingInteraction.player.tileId : ""}`
        : "",
      radiusIds.join(","),
      radiusIds.length > 0 && pendingInteraction.tileStepLabels
        ? Object.keys(pendingInteraction.tileStepLabels)
            .map((k) => `${k}=${pendingInteraction.tileStepLabels[k]}`)
            .join(",")
        : ""
    ].join("|");

    if (_hudCache.boardTiles !== tilesSig || tilesLayer.childElementCount === 0) {
      _hudCache.boardTiles = tilesSig;
      _hadBranchPreviewClasses = false;

      const candidateSet = new Set(branchCandidates);
      const radiusSet = new Set(radiusIds);
      const tokenTileMap = {};
      state.boardTokens.forEach((tok) => {
        const covered =
          Array.isArray(tok.coveredTileIds) && tok.coveredTileIds.length > 0 ? tok.coveredTileIds : [tok.tileId];
        covered.forEach((ctid) => {
          if (ctid) tokenTileMap[ctid] = tok;
        });
      });
      const shardTileSet = new Set(state.activeShards.map((s) => s.tileId));

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
          if (t.type !== "normal") {
            classes.push("tile-dual-effect");
          }
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
          const sTip = "Tartarus Shard is active here (pass with >= 100 TC to purchase).";
          tip = tip ? `${tip} | ${sTip}` : sTip;
        }

        if (candidateSet.has(t.id)) {
          classes.push("branch-option");
          branchTagAttr = ` data-branch-tag="TURN"`;
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
          tip = `Turn onto this path -> Estimated landing: ${landTile ? landTile.name : prev.landingTileId}`;
        }
        if (radiusSet.has(t.id)) classes.push("in-radius");
        if (localCanAct && pendingInteraction && pendingInteraction.type === "select_sam_fire_2" && pendingInteraction.firstTileId === t.id) {
          classes.push("tile-has-trap", "tile-trap-fire");
        }
        const stepLbl =
          radiusSet.size > 0 &&
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

      tilesLayer.innerHTML = tilesHtml.join("");
    }

    const dynamicSig = [
      state.activePlayerIndex,
      isWalkingAnim ? 1 : 0,
      isAdminUnlocked ? 1 : 0,
      state.isMonsterTurn ? 1 : 0,
      state.activeMonster
        ? `${state.activeMonster.id}:${state.activeMonster.tileId}:${state.activeMonster.portalEmerging ? 1 : 0}`
        : "",
      state.activeShards.map((s) => `${s.roman}:${s.tileId}`).join(","),
      fadingShards.map((s) => s.fadeId).join(","),
      activeBoardVfxList.map((v) => v.id).join(","),
      state.players
        .map((p, idx) => {
          const rTid = skillMoveAnimOverrides[idx] || p.tileId;
          return `${p.charId}:${rTid}:${p.isSamMode ? 1 : 0}:${p.reverseNextRoll ? 1 : 0}:${p.lastDirection || 1}:${p.prevTileId || ""}:${skillMoveAnimOverrides[idx] ? 1 : 0}`;
        })
        .join(";")
    ].join("|");

    if (_hudCache.boardDynamic !== dynamicSig || dynamicLayer.childElementCount === 0) {
      _hudCache.boardDynamic = dynamicSig;

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

      const tileOccupants = {};
      state.players.forEach((p, idx) => {
        const renderTid = skillMoveAnimOverrides[idx] || p.tileId;
        if (!tileOccupants[renderTid]) tileOccupants[renderTid] = [];
        tileOccupants[renderTid].push(p);
      });

      const pawnsHtml = state.players.map((p, idx) => {
        const renderTid = skillMoveAnimOverrides[idx] || p.tileId;
        const tile = TILE_MAP[renderTid] || TILE_MAP.T0;
        const group = tileOccupants[renderTid] || [p];
        const posInGroup = group.indexOf(p);
        const spreadX = (posInGroup - (group.length - 1) / 2) * 1.45;
        const px = tile.x + spreadX;
        const py = tile.y;
        const isAct = idx === state.activePlayerIndex;
        const isSkillAnim = Boolean(skillMoveAnimOverrides[idx]);
        const walkCls = (isAct && isWalkingAnim) || isSkillAnim ? "walking-step" : "";
        const chData = DATA.CHARACTERS[p.charId] || {};
        const chibiSrc = p.isSamMode && chData.samChibi ? chData.samChibi : chData.chibi || "";
        const pawnVisual = chibiSrc
          ? `<img class="board-chibi-img" src="${chibiSrc}" alt="${escapeHtml(p.name)}" decoding="async" />`
          : `<div class="board-pawn-fallback">${getCharacterSvgIcon(p.charId)}</div>`;
        const dirIndicator = buildChibiDirectionIndicatorHtml(p);
        return `
      <div class="board-chibi-pawn ${isAct ? "active-pawn" : ""} ${walkCls}"
           data-player-idx="${idx}"
           style="left:${px}%;top:${py}%;--pawn-color:${p.color};"
           title="${escapeHtml(p.name)} @ ${p.tileId}"
           onclick="event.stopPropagation();window.EFT_APP.${isAdminUnlocked ? "openSandboxPlayerModal" : "focusCameraOnPlayer"}(${idx})">
        ${dirIndicator}
        ${pawnVisual}
        <span class="pawn-hit-flash" aria-hidden="true"></span>
        <span class="chibi-base-ring"></span>
      </div>`;
      });

      const boardVfxHtml = activeBoardVfxList.map((v) => {
        const tile = TILE_MAP[v.tileId];
        if (!tile) return "";
        return `
      <div class="board-tile-vfx vfx-${escapeHtml(v.kind)}" style="left:${tile.x}%;top:${tile.y}%;">
        <div class="btv-ring"></div>
        <div class="btv-core"></div>
        <div class="btv-sparks"><span></span><span></span><span></span><span></span><span></span><span></span></div>
      </div>`;
      });

      const monsterPawnHtml = buildMonsterBoardPawnHtml();
      dynamicLayer.innerHTML =
        shardHtml.join("") +
        fadingShardHtml.join("") +
        boardVfxHtml.join("") +
        pawnsHtml.join("") +
        monsterPawnHtml;
    }

    applyBranchPreviewTileClasses();
    if (typeof syncChibiChatBubblePositions === "function") {
      syncChibiChatBubblePositions();
    }
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
    const activeP = getActivePlayer();
    let viewPlayerIdx = mp.mySeat !== -1 ? mp.mySeat : state.activePlayerIndex;
    if (mp.mode === "local" && activeP && activeP.isBot && state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
      viewPlayerIdx = state.seatMap[mp.clientId];
    }
    const player = state.players[viewPlayerIdx] || activeP;

    const drawCountEl = document.getElementById("draw-pile-count");
    if (drawCountEl && player) {
      const rem = (player.deck || []).length;
      drawCountEl.textContent = `${rem} ${rem === 1 ? "Card" : "Cards"}`;
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
        readoutEl.textContent = `Dice: [${state.lastDiceRoll.join(" + ")}] (${dirSign}${Math.abs(state.lastDiceTotal)} steps)`;
        readoutEl.classList.add("visible");
      } else {
        readoutEl.textContent = "";
        readoutEl.classList.remove("visible");
      }
    }

    const handContainer = document.getElementById("hand-cards-scroll");
    const tuckY = isMobileLandscape() ? 48 : isMobilePortrait() ? 68 : 104;
    const handSig = [
      player.index,
      player.charId,
      selectedCardUid || "",
      tuckY,
      player.hand.map((c) => `${c.uid}:${c.id}`).join(",")
    ].join("|");
    if (_hudCache.hand === handSig) return;
    captureRenderedHandCardRects();
    _hudCache.hand = handSig;

    if (player.hand.length === 0) {
      handContainer.innerHTML = "";
      return;
    }

    const total = player.hand.length;
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
             data-card-uid="${escapeHtml(card.uid)}"
             data-owner-idx="${player.index}"
             style="${inlineTransform}"
             onclick="event.stopPropagation();window.EFT_APP.onHandCardClicked('${card.uid}', ${player.index})">
          <img src="${imgUrl}" alt="${escapeHtml(card.name)}" draggable="false" loading="lazy" decoding="async" />
          <div class="tucked-card-actions">
            <button class="btn btn-emerald btn-sm" style="width:100%;" onclick="event.stopPropagation();window.EFT_APP.openPlayCardModal('${card.uid}', ${player.index})">
              Use / Details
            </button>
          </div>
        </div>`;
      })
      .join("");
  }

  let _suppressNextHandClick = false;
  let _pendingQuickDragPick = null;
  let _handDragBound = false;
  const _lastRenderedHandCardRects = new Map();

  function captureRenderedHandCardRects() {
    const container = document.getElementById("hand-cards-scroll");
    if (!container) return;
    const cards = container.querySelectorAll(".tucked-card[data-card-uid]");
    if (cards.length === 0) return;
    cards.forEach((el) => {
      const uid = el.getAttribute("data-card-uid");
      if (!uid) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        _lastRenderedHandCardRects.set(uid, {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height
        });
      }
    });
  }

  function showHandDragToast(message) {
    if (!message) return;
    document.querySelectorAll(".hand-drag-toast").forEach((el) => el.remove());
    const toast = document.createElement("div");
    toast.className = "hand-drag-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 1900);
  }

  function getValidTargetPlayersForSkill(targetCard, player) {
    if (!targetCard || !player || !state) return [];
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
    validPlayers.sort((a, b) => {
      const aSelf = a.index === player.index ? 1 : 0;
      const bSelf = b.index === player.index ? 1 : 0;
      return targetCard.effectKey === "move_steps" ? bSelf - aSelf : aSelf - bSelf;
    });
    return validPlayers;
  }

  function evaluateCardDragAction(player, card, ownerIdx) {
    if (!player || !card || !state) {
      return { ok: false, mode: "denied", pillText: "Unavailable", reason: "Card unavailable." };
    }
    const isMyTurn = ownerIdx === state.activePlayerIndex && canLocalPlayerAct();
    if (!isMyTurn) {
      return { ok: false, mode: "denied", pillText: "Not Your Turn", reason: "Wait for your turn to play this card." };
    }
    const check = canPlaySkillCard(player, card);
    if (!check.ok) {
      const shortPill = card.haste
        ? "[Haste] Reactive Only"
        : check.reason.length > 32
        ? check.reason.slice(0, 30) + "..."
        : check.reason;
      return { ok: false, mode: "denied", pillText: shortPill, reason: check.reason };
    }

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
        return { ok: true, mode: "instant", pillText: "Release to Gain +15 TC", options: {}, flowCard: card };
      }
      return { ok: true, mode: "quick_copy", pillText: "Release to Pick Skill", pool, flowCard: card };
    }

    return evaluateConcreteSkillDrag(player, card, {});
  }

  function evaluateConcreteSkillDrag(player, targetCard, baseOptions = {}) {
    const needsPlayerTarget =
      targetCard.targetType === "any_player" ||
      targetCard.targetType === "any_player_in_radius" ||
      targetCard.targetType === "other_player" ||
      targetCard.targetType === "opponent_in_radius";

    if (needsPlayerTarget) {
      const validPlayers = getValidTargetPlayersForSkill(targetCard, player);
      if (validPlayers.length === 0) {
        const rad = targetCard.radius || 5;
        const isRad = targetCard.targetType === "opponent_in_radius" || targetCard.targetType === "any_player_in_radius";
        const reason = isRad
          ? `No valid targets within ${rad} blocks.`
          : "All opponents are still at Spawn.";
        return { ok: false, mode: "denied", pillText: "No Valid Target", reason };
      }
      const alsoNeedsChoice = targetCard.effectKey === "sam_discounted_versus";
      if (validPlayers.length === 1 && !alsoNeedsChoice) {
        return {
          ok: true,
          mode: "instant",
          pillText: `Release -> ${validPlayers[0].name}`,
          options: { ...baseOptions, targetPlayerIndex: validPlayers[0].index },
          flowCard: targetCard
        };
      }
      return {
        ok: true,
        mode: "quick_target",
        pillText: "Release to Pick Target",
        validPlayers,
        alsoNeedsChoice,
        options: { ...baseOptions },
        flowCard: targetCard
      };
    }

    if (targetCard.targetType === "opponents_in_radius_aoe") {
      const rad = targetCard.radius || 8;
      const inRange = state.players.filter(
        (other) => other.index !== player.index && !other.inSpawn && getTileDistance(player.tileId, other.tileId) <= rad
      );
      if (inRange.length === 0) {
        return {
          ok: false,
          mode: "denied",
          pillText: "No Opponents in Range",
          reason: `No opponents within ${rad} blocks of your position (${player.tileId}).`
        };
      }
    }

    if (targetCard.effectKey === "relocate_board_traps") {
      if (!Array.isArray(state.boardTokens) || state.boardTokens.length === 0) {
        return {
          ok: false,
          mode: "denied",
          pillText: "No Tokens on Board",
          reason: "There are no active Tokens/Traps on the board to relocate right now."
        };
      }
      return { ok: true, mode: "instant", pillText: "Release to Pick Token", options: { ...baseOptions }, flowCard: targetCard };
    }

    if (
      targetCard.effectKey === "choice_10tc_or_draw1" ||
      targetCard.effectKey === "choice_move1_2_or_10tc" ||
      targetCard.effectKey === "sam_discounted_versus"
    ) {
      return {
        ok: true,
        mode: "quick_choice",
        pillText: "Release to Choose Effect",
        options: { ...baseOptions },
        flowCard: targetCard
      };
    }

    const picksTile =
      targetCard.effectKey === "sam_fire_tiles" ||
      targetCard.targetType === "normal_tile_in_radius" ||
      targetCard.targetType === "any_tile" ||
      targetCard.targetType === "non_event_tile" ||
      !!getSkillMoveSelectionSpec(targetCard, baseOptions);

    return {
      ok: true,
      mode: "instant",
      pillText: picksTile ? "Release to Pick Tile" : "Release to Activate",
      options: { ...baseOptions },
      flowCard: targetCard
    };
  }

  function finalizeDraggedSkillActivation(player, card, flowCard, options) {
    closeModal();
    const emperorTax = getEmperorTaxInfo(player, card);
    if (emperorTax.owners.length > 0) {
      openEmperorTaxConfirmModal(player, card, flowCard, options || {}, emperorTax);
      return;
    }
    proceedCardActivationAfterTax(card.uid, flowCard, options || {});
  }

  function openQuickDragPickModal(player, card, evalRes) {
    if (!player || !card || !evalRes) return;
    const flowCard = evalRes.flowCard || card;
    const choices = [];
    let heading = `${escapeHtml(card.name)}`;
    let subline = "";

    if (evalRes.mode === "quick_copy") {
      heading = `${escapeHtml(card.name)}: Copy Skill`;
      subline = `Choose an opponent skill played in Cycle ${state.cycle}:`;
      evalRes.pool.forEach((entry) => {
        choices.push({
          label: `${entry.card.name}`,
          meta: `by ${entry.casterName} · ${entry.card.rarity}`,
          kind: "copy_entry",
          entry
        });
      });
    } else if (evalRes.mode === "quick_target") {
      heading = `${escapeHtml(card.name)}: Select Target`;
      subline = flowCard.radius ? `Valid targets within ${flowCard.radius} blocks:` : "Select a target player:";
      evalRes.validPlayers.forEach((vp) => {
        const dist = getTileDistance(player.tileId, vp.tileId);
        const selfTag = vp.index === player.index ? " (Self)" : "";
        choices.push({
          label: `${vp.name}${selfTag}`,
          meta: `${vp.tileId} · ${dist} ${dist === 1 ? "block" : "blocks"}`,
          kind: evalRes.alsoNeedsChoice ? "target_then_choice" : "direct",
          options: { ...(evalRes.options || {}), targetPlayerIndex: vp.index },
          flowCard
        });
      });
    } else if (evalRes.mode === "quick_choice") {
      heading = `${escapeHtml(card.name)}: Choose Effect`;
      subline = "Select an option to activate immediately:";
      if (flowCard.effectKey === "choice_10tc_or_draw1") {
        const gainVal = flowCard.tcGain || (state.compendiumId === "comp_v0_1" ? 5 : 10);
        choices.push({ label: `Gain +${gainVal} T-Coins`, meta: "💰 TC", kind: "direct", options: { ...(evalRes.options || {}), choiceValue: "tc" }, flowCard });
        choices.push({ label: "Draw +1 Card", meta: "Deck", kind: "direct", options: { ...(evalRes.options || {}), choiceValue: "draw" }, flowCard });
      } else if (flowCard.effectKey === "choice_move1_2_or_10tc") {
        choices.push({ label: "Move +1 / +2 Tiles", meta: "Pick on Map", kind: "direct", options: { ...(evalRes.options || {}), choiceValue: "move" }, flowCard });
        choices.push({ label: "Gain +10 T-Coins", meta: "💰 TC", kind: "direct", options: { ...(evalRes.options || {}), choiceValue: "tc" }, flowCard });
      } else if (flowCard.effectKey === "sam_discounted_versus") {
        choices.push({ label: "Tier 1: SAM Free (0 TC) vs Opponent 15 TC", meta: "Versus", kind: "direct", options: { ...(evalRes.options || {}), choiceValue: "tier1" }, flowCard });
        choices.push({ label: "Tier 2: SAM 15 TC vs Opponent 30 TC", meta: "Versus", kind: "direct", options: { ...(evalRes.options || {}), choiceValue: "tier2" }, flowCard });
      }
    }

    _pendingQuickDragPick = {
      playerIndex: player.index,
      cardUid: card.uid,
      choices
    };

    const buttonsHtml = choices
      .map(
        (ch, idx) => `
        <button type="button" class="quick-pick-btn" onclick="window.EFT_APP.confirmQuickDragPick(${idx})">
          <span>${escapeHtml(ch.label)}</span>
          <span class="quick-pick-meta">${escapeHtml(ch.meta || "")}</span>
        </button>`
      )
      .join("");

    openInfoModal(
      heading,
      `<div class="quick-pick-stack">
        <div class="quick-pick-sub">${escapeHtml(subline)}</div>
        ${buttonsHtml}
      </div>`
    );
  }

  function confirmQuickDragPick(choiceIdx) {
    const req = _pendingQuickDragPick;
    _pendingQuickDragPick = null;
    if (!req || !canLocalPlayerAct()) return;
    const player = state.players[req.playerIndex] || getActivePlayer();
    const card = player ? player.hand.find((c) => c.uid === req.cardUid) : null;
    const picked = req.choices[choiceIdx];
    if (!player || !card || !picked) {
      closeModal();
      return;
    }

    if (picked.kind === "copy_entry") {
      const copiedCard = picked.entry.card;
      const baseOpts = { copiedSkillEntryId: picked.entry.id };
      const nextEval = evaluateConcreteSkillDrag(player, copiedCard, baseOpts);
      if (!nextEval.ok) {
        closeModal();
        playSfx("card_drag_deny");
        showHandDragToast(nextEval.reason);
        return;
      }
      if (nextEval.mode === "instant") {
        finalizeDraggedSkillActivation(player, card, copiedCard, nextEval.options);
      } else {
        openQuickDragPickModal(player, card, nextEval);
      }
      return;
    }

    if (picked.kind === "target_then_choice") {
      openQuickDragPickModal(player, card, {
        ok: true,
        mode: "quick_choice",
        options: picked.options,
        flowCard: picked.flowCard
      });
      return;
    }

    finalizeDraggedSkillActivation(player, card, picked.flowCard || card, picked.options || {});
  }

  function triggerDraggedCardActivation(cardUid, ownerIdx) {
    const player = state && state.players[ownerIdx] ? state.players[ownerIdx] : getActivePlayer();
    const card = player ? player.hand.find((c) => c.uid === cardUid) : null;
    if (!player || !card) return;
    if (selectedCardUid !== null) {
      selectedCardUid = null;
      renderTuckedHandAndDice();
    }
    const evalRes = evaluateCardDragAction(player, card, ownerIdx);
    if (!evalRes.ok) {
      playSfx("card_drag_deny");
      showHandDragToast(evalRes.reason);
      return;
    }
    if (evalRes.mode === "instant") {
      finalizeDraggedSkillActivation(player, card, evalRes.flowCard || card, evalRes.options || {});
      return;
    }
    openQuickDragPickModal(player, card, evalRes);
  }

  function setupHandCardDragGestures() {
    if (_handDragBound) return;
    const container = document.getElementById("hand-cards-scroll");
    if (!container) return;
    _handDragBound = true;

    let zoneLineEl = document.getElementById("hand-drag-zone-line");
    if (!zoneLineEl) {
      zoneLineEl = document.createElement("div");
      zoneLineEl.id = "hand-drag-zone-line";
      zoneLineEl.className = "hand-drag-zone-line";
      document.body.appendChild(zoneLineEl);
    }

    let dragState = null;

    function cleanupDrag() {
      if (zoneLineEl) {
        zoneLineEl.classList.remove("is-visible", "is-ready", "is-denied");
      }
      if (dragState) {
        if (dragState.sourceEl) {
          dragState.sourceEl.classList.remove("is-dragging-source");
        }
        if (dragState.ghostEl && dragState.ghostEl.parentNode) {
          dragState.ghostEl.remove();
        }
      }
      dragState = null;
    }

    container.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest(".tucked-card-actions")) return;
      const cardEl = e.target && e.target.closest ? e.target.closest(".tucked-card[data-card-uid]") : null;
      if (!cardEl || !state || isTitleScreenVisible) return;
      if (document.body.classList.contains("modal-open")) return;

      e.stopPropagation();

      const cardUid = cardEl.getAttribute("data-card-uid");
      const ownerIdx = Number(cardEl.getAttribute("data-owner-idx"));
      const player = state.players[ownerIdx];
      const card = player ? player.hand.find((c) => c.uid === cardUid) : null;
      if (!player || !card) return;

      const rect = cardEl.getBoundingClientRect();
      const cardW = cardEl.offsetWidth || rect.width || 112;
      const cardH = cardEl.offsetHeight || rect.height || 160;
      const dockEl = document.getElementById("hand-cards-scroll");
      const dockRect = dockEl ? dockEl.getBoundingClientRect() : rect;
      const isTouch = e.pointerType !== "mouse";

      dragState = {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        isTouch,
        cardUid,
        ownerIdx,
        player,
        card,
        sourceEl: cardEl,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        origRect: rect,
        cardW,
        cardH,
        dockTop: dockRect.top,
        offsetX: Math.max(14, Math.min(cardW - 14, e.clientX - rect.left)),
        offsetY: Math.min(cardH * 0.48, Math.max(18, e.clientY - rect.top)),
        touchLiftY: isTouch ? (isMobileLandscape() ? 38 : 54) : 0,
        started: false,
        inZone: false,
        evalRes: null,
        ghostEl: null,
        pillEl: null
      };
    });

    // Prevent mobile browsers from scrolling/pull-refreshing while actively dragging a card
    window.addEventListener(
      "touchmove",
      (te) => {
        if (dragState && dragState.started) {
          te.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener("pointermove", (e) => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      dragState.lastClientX = e.clientX;
      dragState.lastClientY = e.clientY;

      if (!dragState.started) {
        const dist = Math.hypot(dx, dy);
        const minStartDist = dragState.isTouch ? 8 : 11;
        if (dist < minStartDist) return;
        const isUpwardIntent = dragState.isTouch
          ? dy < -7 && Math.abs(dy) >= Math.abs(dx) * 0.58
          : dy < -9 && Math.abs(dy) >= Math.abs(dx) * 0.7;
        const isMousePull = !dragState.isTouch && dy < -8 && dist >= 12;
        if (!isUpwardIntent && !isMousePull) {
          if (dragState.isTouch && Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            dragState = null;
          }
          return;
        }

        dragState.started = true;
        _suppressNextHandClick = true;
        try {
          if (dragState.sourceEl && typeof dragState.sourceEl.setPointerCapture === "function") {
            dragState.sourceEl.setPointerCapture(e.pointerId);
          }
        } catch (err) {}
        dragState.evalRes = evaluateCardDragAction(dragState.player, dragState.card, dragState.ownerIdx);
        dragState.sourceEl.classList.add("is-dragging-source");

        const ghost = document.createElement("div");
        ghost.className = "hand-drag-ghost" + (dragState.card.rarity === "Ultimate" ? " is-ult" : "");
        ghost.style.width = dragState.cardW + "px";
        ghost.style.height = dragState.cardH + "px";

        const img = document.createElement("img");
        img.className = "hand-drag-ghost-art";
        img.src = getCardImage(dragState.card, dragState.player.charId);
        img.alt = dragState.card.name;
        img.draggable = false;
        ghost.appendChild(img);

        const pill = document.createElement("div");
        pill.className = "hand-drag-pill";
        pill.textContent = "Drag up to Activate";
        ghost.appendChild(pill);

        document.body.appendChild(ghost);
        dragState.ghostEl = ghost;
        dragState.pillEl = pill;
        zoneLineEl.classList.add("is-visible");
        playSfx("click");
      }

      if (dragState.started) {
        e.preventDefault();
        const vx = e.clientX - dragState.lastX;
        dragState.lastX = e.clientX;
        const tilt = Math.max(-13, Math.min(13, vx * 0.65));

        const gx = e.clientX - dragState.offsetX;
        const gy = e.clientY - dragState.offsetY - dragState.touchLiftY;
        const minPull = isMobileLandscape() ? -44 : isMobilePortrait() ? -64 : -104;
        const thresholdY = Math.min(
          dragState.dockTop - (dragState.isTouch ? 6 : 18),
          window.innerHeight - (isMobileLandscape() ? 102 : isMobilePortrait() ? 148 : 204)
        );
        const inZone = e.clientY < thresholdY || dy < minPull;
        dragState.inZone = inZone;

        const scale = inZone ? (dragState.isTouch ? 1.12 : 1.07) : 1.03;
        dragState.ghostEl.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg) scale(${scale})`;

        if (inZone) {
          const canGo = dragState.evalRes && dragState.evalRes.ok;
          dragState.ghostEl.classList.toggle("is-ready", !!canGo);
          dragState.ghostEl.classList.toggle("is-denied", !canGo);
          zoneLineEl.classList.toggle("is-ready", !!canGo);
          zoneLineEl.classList.toggle("is-denied", !canGo);
          dragState.pillEl.textContent = dragState.evalRes ? dragState.evalRes.pillText : "Release to Activate";
        } else {
          dragState.ghostEl.classList.remove("is-ready", "is-denied");
          zoneLineEl.classList.remove("is-ready", "is-denied");
          dragState.pillEl.textContent = "Drag up to Activate";
        }
      }
    }, { passive: false });

    const finishDrag = (e, cancelled) => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const st = dragState;
      dragState = null;

      try {
        if (st.sourceEl && typeof st.sourceEl.releasePointerCapture === "function") {
          st.sourceEl.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}

      if (!st.started) return;

      setTimeout(() => {
        _suppressNextHandClick = false;
      }, 160);

      zoneLineEl.classList.remove("is-visible", "is-ready", "is-denied");

      if (!cancelled && st.inZone && st.evalRes && st.evalRes.ok) {
        playSfx("card_drag_ok");
        const ghost = st.ghostEl;
        if (ghost) {
          ghost.classList.add("is-launching");
          const curX = (e.clientX || st.lastClientX) - st.offsetX;
          const curY = (e.clientY || st.lastClientY) - st.offsetY - st.touchLiftY - 44;
          ghost.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) scale(1.16)`;
          ghost.style.opacity = "0";
          setTimeout(() => {
            if (ghost.parentNode) ghost.remove();
          }, 250);
        }
        if (st.sourceEl) st.sourceEl.classList.remove("is-dragging-source");
        triggerDraggedCardActivation(st.cardUid, st.ownerIdx);
        return;
      }

      if (!cancelled && st.inZone && st.evalRes && !st.evalRes.ok) {
        playSfx("card_drag_deny");
        showHandDragToast(st.evalRes.reason);
      }

      const ghost = st.ghostEl;
      const srcEl = st.sourceEl;
      if (ghost) {
        ghost.classList.add("is-returning");
        ghost.style.transform = `translate3d(${st.origRect.left.toFixed(1)}px, ${st.origRect.top.toFixed(1)}px, 0) rotate(0deg) scale(1)`;
        ghost.style.opacity = "0";
        setTimeout(() => {
          if (ghost.parentNode) ghost.remove();
          if (srcEl) srcEl.classList.remove("is-dragging-source");
        }, 210);
      } else if (srcEl) {
        srcEl.classList.remove("is-dragging-source");
      }
    };

    window.addEventListener("pointerup", (e) => finishDrag(e, false));
    window.addEventListener("pointercancel", (e) => finishDrag(e, true));
  }

  function onHandCardClicked(cardUid, ownerIdx) {
    if (_suppressNextHandClick) return;
    playSfx("click");
    if (selectedCardUid === cardUid) {
      openPlayCardModal(cardUid, ownerIdx);
    } else {
      selectedCardUid = cardUid;
      renderTuckedHandAndDice();
    }
  }

  const HAND_RARITY_SORT_RANK = {
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    Epic: 4,
    Unique: 5,
    Ultimate: 6
  };

  function sortHandArrayInPlace(handArr) {
    if (!Array.isArray(handArr)) return;
    handArr.sort((a, b) => {
      const ra = HAND_RARITY_SORT_RANK[a && a.rarity] || 99;
      const rb = HAND_RARITY_SORT_RANK[b && b.rarity] || 99;
      if (ra !== rb) return ra - rb;
      return String((a && a.name) || "").localeCompare(String((b && b.name) || ""));
    });
  }

  function sortMyHand(explicitSeat = null) {
    if (!state || !Array.isArray(state.players)) return;
    const seatIdx = explicitSeat !== null && explicitSeat !== undefined ? explicitSeat : getViewedHandPlayerIndex();
    const p = state.players[seatIdx];
    if (!p || !Array.isArray(p.hand) || p.hand.length <= 1) return;
    sortHandArrayInPlace(p.hand);
    if (explicitSeat === null || explicitSeat === undefined) {
      playSfx("card_shuffle");
      if (isRemoteClient()) {
        sendClientActionToHost("sort_hand", { seat: seatIdx });
      } else if (isMultiplayerHost()) {
        broadcastMultiplayerState();
      }
      _hudCache.hand = "";
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
    const topLog = state.logs[0];
    const logSig = `${state.logs.length}|${topLog ? topLog.id : ""}`;
    if (_hudCache.log === logSig) return;
    _hudCache.log = logSig;
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
             Draw Pile is empty. All cards are currently in hand or discard until the next Cycle reshuffle.
           </div>`
        : `<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:10px;">
             <strong>${deck.length} card(s)</strong> remaining in <strong>${escapeHtml(player.name)}'s</strong> Draw Pile (sorted by rarity, not draw order):
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

    openInfoModal(`Draw Pile: ${escapeHtml(player.name)} (${deck.length} Cards)`, bodyHtml);
  }

  let _lastPromptBarAlertKey = "";

  function setPromptBarContent(bar, tone, eyebrow, headline, actionsHtml = "", alertKey = "") {
    bar.setAttribute("data-prompt-tone", tone || "default");
    bar.classList.add("visible");
    bar.innerHTML = `
      <div class="apb-copy">
        <div class="apb-eyebrow">${eyebrow}</div>
        <div class="apb-headline">${headline}</div>
      </div>
      ${actionsHtml ? `<div class="apb-actions">${actionsHtml}</div>` : ""}`;
    if (alertKey && alertKey !== _lastPromptBarAlertKey) {
      _lastPromptBarAlertKey = alertKey;
      bar.classList.remove("is-entering");
      void bar.offsetWidth;
      bar.classList.add("is-entering");
      if (tone === "shop" || tone === "haste" || tone === "shard" || tone === "river") {
        playSfx("branch");
      }
    }
  }

  function renderPromptBar() {
    const bar = document.getElementById("action-prompt-bar");
    if (!bar) return;

    if ((!pendingInteraction || pendingInteraction.type === "choose_branch") && state && state.activeTileModal && state.activeTileModal.status === "selecting") {
      const tm = state.activeTileModal;
      const actor = state.players[tm.actorIndex] || getActivePlayer();
      const isActor = isLocalHumanTurnForPlayer(actor);
      if (tm.type === "versus") {
        if (isActor) {
          setPromptBarContent(
            bar,
            "duel",
            "ACTION REQUIRED · VERSUS DUEL",
            `${escapeHtml(actor.name)}: Choose an opponent &amp; TC wager`,
            `<button class="btn btn-gold" onclick="window.EFT_APP.reopenSharedTileModal()">Open Versus Duel</button>`,
            `tm_versus_${tm.id}`
          );
        } else {
          setPromptBarContent(
            bar,
            "wait",
            "VERSUS DUEL",
            `Waiting for ${escapeHtml(actor.name)} to select an opponent...`
          );
        }
      } else {
        if (isActor) {
          setPromptBarContent(
            bar,
            "shop",
            "ACTION REQUIRED · TRADING POST",
            `${escapeHtml(actor.name)}: Choose a trade partner &amp; barter option`,
            `<button class="btn btn-emerald" onclick="window.EFT_APP.reopenSharedTileModal()">Open Trading Post</button>
             <button class="btn" onclick="window.EFT_APP.dismissSharedTileModal()">Skip Trade</button>`,
            `tm_trade_${tm.id}`
          );
        } else {
          setPromptBarContent(
            bar,
            "wait",
            "TRADING POST",
            `Waiting for ${escapeHtml(actor.name)} to finish trading...`
          );
        }
      }
      return;
    }

    if (!pendingInteraction || pendingInteraction.type === "choose_branch") {
      bar.classList.remove("visible", "is-entering");
      bar.removeAttribute("data-prompt-tone");
      bar.innerHTML = "";
      _lastPromptBarAlertKey = "";
      return;
    }
    if (pendingInteraction.type === "prompt_merchant_pass" && !isLocalHumanTurnForPlayer(pendingInteraction.player)) {
      bar.classList.remove("visible", "is-entering");
      bar.removeAttribute("data-prompt-tone");
      bar.innerHTML = "";
      return;
    }

    if (!canLocalPlayerAct()) {
      const actorName =
        pendingInteraction.player && pendingInteraction.player.name
          ? pendingInteraction.player.name
          : getActivePlayer().name;
      setPromptBarContent(
        bar,
        "wait",
        "IN PROGRESS",
        `Waiting for ${escapeHtml(actorName)} to decide...`
      );
      return;
    }

    if (pendingInteraction.type === "prompt_shard_buy") {
      const sh = pendingInteraction.shard;
      setPromptBarContent(
        bar,
        "shard",
        `ACTION REQUIRED · TARTARUS SHARD (ZONE ${escapeHtml(sh.roman)})`,
        `Claim this Tartarus Shard for 💰 ${state.rules.shardCost} TC?`,
        `<button class="btn btn-emerald" onclick="window.EFT_APP.confirmShardPurchase(true)">Buy Shard (💰 ${state.rules.shardCost} TC)</button>
         <button class="btn" onclick="window.EFT_APP.confirmShardPurchase(false)">Skip</button>`,
        `shard_${sh.tileId}_${pendingInteraction.stepsLeft}`
      );
    } else if (pendingInteraction.type === "prompt_river") {
      setPromptBarContent(
        bar,
        "river",
        "ACTION REQUIRED · RIVER SHORTCUT",
        `Pay 💰 ${state.rules.riverCost} TC to cross directly to [${escapeHtml(pendingInteraction.targetTileId)}]?`,
        `<button class="btn btn-primary" onclick="window.EFT_APP.confirmRiverShortcut(true)">Take Shortcut (💰 ${state.rules.riverCost} TC)</button>
         <button class="btn" onclick="window.EFT_APP.confirmRiverShortcut(false)">Stay on Road</button>`,
        `river_${pendingInteraction.targetTileId}_${pendingInteraction.stepsLeft}`
      );
    } else if (pendingInteraction.type === "prompt_merchant_pass") {
      setPromptBarContent(
        bar,
        "shop",
        `MERCHANT SHOP ${pendingInteraction.shopId} AVAILABLE`,
        `You are passing Merchant Shop ${pendingInteraction.shopId}. Open shop before continuing?`,
        `<button class="btn btn-gold" onclick="window.EFT_APP.openMerchantModal(${pendingInteraction.shopId})">Open Shop ${pendingInteraction.shopId}</button>
         <button class="btn" onclick="window.EFT_APP.resumeFromMerchantPrompt()">Continue (${pendingInteraction.stepsLeft} steps)</button>`,
        `shop_${pendingInteraction.shopId}_${pendingInteraction.stepsLeft}`
      );
    } else if (pendingInteraction.type === "select_tile_target") {
      const mover =
        pendingInteraction.movingPlayerIndex !== undefined && state.players[pendingInteraction.movingPlayerIndex]
          ? state.players[pendingInteraction.movingPlayerIndex]
          : getActivePlayer();
      const changeBtn = pendingInteraction.canChangeTarget
        ? `<button class="btn" onclick="window.EFT_APP.reopenPendingCardModal()">Change Target</button>`
        : "";
      const isBocchiPull =
        pendingInteraction.card &&
        pendingInteraction.card.effectKey === "pull_all_players" &&
        pendingInteraction.validTileIds.includes(pendingInteraction.player.tileId);
      const selfPullBtn = isBocchiPull
        ? `<button class="btn btn-emerald" onclick="window.EFT_APP.onTileClicked('${pendingInteraction.player.tileId}')">Pull to Bocchi's Tile</button>`
        : "";
      setPromptBarContent(
        bar,
        "tile",
        `SELECT TILE · ${escapeHtml(pendingInteraction.card.name).toUpperCase()}`,
        `Choose a glowing destination tile for ${escapeHtml(mover.name)}`,
        `${selfPullBtn}${changeBtn}<button class="btn btn-danger" onclick="window.EFT_APP.cancelPendingInteraction()">Cancel</button>`,
        `tile_${pendingInteraction.cardUid}`
      );
    } else if (pendingInteraction.type === "select_sam_fire_1") {
      setPromptBarContent(
        bar,
        "tile",
        "DEATHSTAR DESTRUCTION · TILE 1 / 2",
        "Pick the first tile anywhere on the map to ignite",
        `<button class="btn btn-danger" onclick="window.EFT_APP.cancelPendingInteraction()">Cancel</button>`,
        `sam_fire_1_${pendingInteraction.cardUid}`
      );
    } else if (pendingInteraction.type === "select_sam_fire_2") {
      setPromptBarContent(
        bar,
        "tile",
        `DEATHSTAR DESTRUCTION · TILE 2 / 2 (${escapeHtml(pendingInteraction.firstTileId || "")} SET)`,
        "Pick the second tile anywhere on the map to ignite",
        `<button class="btn btn-danger" onclick="window.EFT_APP.cancelPendingInteraction()">Cancel</button>`,
        `sam_fire_2_${pendingInteraction.firstTileId}`
      );
    } else if (pendingInteraction.type === "select_token_source") {
      setPromptBarContent(
        bar,
        "tile",
        "ENTRUSTED DREAM · STEP 1 / 2",
        "Select a tile containing an active Token or Trap to relocate",
        `<button class="btn btn-danger" onclick="window.EFT_APP.cancelPendingInteraction()">Cancel</button>`,
        `tok_src_${pendingInteraction.cardUid}`
      );
    } else if (pendingInteraction.type === "select_token_dest") {
      setPromptBarContent(
        bar,
        "tile",
        "ENTRUSTED DREAM · STEP 2 / 2",
        `Pick any tile to relocate ${escapeHtml(pendingInteraction.tokenName || "Token")} &amp; trigger its effect`,
        `<button class="btn btn-danger" onclick="window.EFT_APP.cancelPendingInteraction()">Cancel</button>`,
        `tok_dst_${pendingInteraction.tokenId}`
      );
    } else if (pendingInteraction.type === "haste_reaction") {
      const def = pendingInteraction.player || getActivePlayer();
      setPromptBarContent(
        bar,
        "haste",
        `OUT-OF-TURN REACTION · [HASTE] (${escapeHtml(def.name).toUpperCase()})`,
        `Respond to ${escapeHtml(pendingInteraction.card?.name || "Skill")} before it resolves!`,
        `<button class="btn btn-emerald" onclick="window.EFT_APP.openHasteReactionModal()">Activate [Haste] Card</button>
         <button class="btn" onclick="window.EFT_APP.resolveHasteReaction(null)">Pass</button>`,
        `haste_${pendingInteraction.card?.id || "s"}_${def.index}`
      );
    } else if (pendingInteraction.type === "stage_is_mine") {
      const btns = pendingInteraction.validTileIds
        .map((tid) => {
          const stepLbl = pendingInteraction.tileStepLabels[tid] || "";
          const tName = TILE_MAP[tid] ? TILE_MAP[tid].name : tid;
          return `<button class="btn btn-emerald" onclick="window.EFT_APP.resolveStageIsMineChoice('${tid}')">${escapeHtml(stepLbl)} (${escapeHtml(tName)})</button>`;
        })
        .join("");
      setPromptBarContent(
        bar,
        "tile",
        "PASSIVE TRIGGER · THE STAGE IS MINE",
        "Move +1 / +2 / -1 from this Normal Tile and trigger its block effect?",
        `${btns}<button class="btn" onclick="window.EFT_APP.resolveStageIsMineChoice(null)">Stay Here</button>`,
        `stage_${pendingInteraction.originTileId || "n"}`
      );
    } else if (pendingInteraction.type === "scry_2_keep_1") {
      setPromptBarContent(
        bar,
        "tile",
        `DECK INSPECTION · ${escapeHtml(pendingInteraction.cardName || "Insect's Instinct").toUpperCase()}`,
        "Choose 1 of the top 2 deck cards to keep in hand",
        `<button class="btn btn-emerald" onclick="window.EFT_APP.openScryPickModal()">Pick Card</button>`,
        `scry_${pendingInteraction.cardName}`
      );
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
                ? `Deck Copies: ${selectedCard.count}x`
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
    const allCards = [
      ...ch.cards,
      ...(ch.ultimate ? [ch.ultimate] : []),
      ...(Array.isArray(ch.samCards) ? ch.samCards : []),
      ...(ch.samUltimate ? [ch.samUltimate] : [])
    ];
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
          const devBadge = ch.underDevelopment
            ? `<span class="comp-dev-badge">Under Dev</span>`
            : "";
          return `
            <div class="comp-char-card"
                 style="--char-accent:${escapeHtml(ch.color || "#34d399")};--char-rgb:${escapeHtml(rgb)};"
                 onclick="window.EFT_APP.selectCompendiumCharacter('${cid}')">
              ${devBadge}
              ${
                cp && cp.src
                  ? `<img class="comp-char-portrait" src="${cp.src}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" style="object-position:${escapeHtml(cp.objectPosition || "50% 10%")};" />`
                  : ""
              }
              <div class="comp-char-bottom-scrim"></div>
              <div class="comp-char-card-footer">
                <span class="comp-char-role-hint">${escapeHtml(ch.underDevelopment ? `${ch.title} · Under Dev` : ch.title)}</span>
                <div class="comp-char-name-pill">${escapeHtml(label)}</div>
              </div>
            </div>`;
        }),
        ...unavailableIds.map((cid) => {
          const ch = DATA.CHARACTERS[cid];
          const label = ch.shortName || ch.name;
          const cp = ch.compPortrait || (ch.portrait ? { src: ch.portrait.src, objectPosition: "50% 30%" } : null);
          const rgb = ch.colorRgb || "148, 163, 184";
          const isTba = Boolean(ch.tba);
          const originLine = ch.origin ? `${ch.origin} · TBA` : isTba ? "TBA · Coming Soon" : "Unavailable";
          return `
            <div class="comp-char-card is-unavailable ${isTba ? "is-tba" : ""}"
                 style="--char-accent:${escapeHtml(ch.color || "#94a3b8")};--char-rgb:${escapeHtml(rgb)};"
                 title="${escapeHtml(ch.name)} (${escapeHtml(originLine)})">
              ${isTba ? `<span class="comp-tba-badge">TBA</span>` : ""}
              ${
                cp && cp.src
                  ? `<img class="comp-char-portrait comp-tba-portrait" src="${cp.src}" alt="${escapeHtml(ch.name)} Placeholder" loading="lazy" decoding="async" style="object-position:${escapeHtml(cp.objectPosition || "50% 30%")};" />`
                  : `<div class="comp-unavailable-center">
                       <div class="comp-unavailable-crest">${getCharacterSvgIcon(cid)}</div>
                       <span class="comp-unavailable-tag">${isTba ? "TBA" : "Unavailable"}</span>
                     </div>`
              }
              <div class="comp-char-bottom-scrim"></div>
              <div class="comp-char-card-footer">
                <span class="comp-char-role-hint comp-tba-role-hint">${escapeHtml(originLine)}</span>
                <div class="comp-char-name-pill">${escapeHtml(label)}</div>
              </div>
            </div>`;
        })
      ].join("");

      root.innerHTML = `
        <div class="comp-strip-shell">
          <div id="comp-fade-left" class="comp-edge-fade-left is-hidden"></div>
          <button id="comp-arrow-prev" class="comp-nav-arrow prev is-hidden" onclick="window.EFT_APP.scrollCompendiumStrip(-1)" aria-label="Previous Character">&lt;</button>
          <div id="comp-strip-track" class="comp-strip-track" onscroll="window.EFT_APP.updateCompendiumScrollControls()">
            ${stripCardsHtml}
          </div>
          <div id="comp-fade-right" class="comp-edge-fade-right"></div>
          <button id="comp-arrow-next" class="comp-nav-arrow next" onclick="window.EFT_APP.scrollCompendiumStrip(1)" aria-label="Next Character">&gt;</button>
        </div>`;

      requestAnimationFrame(() => updateCompendiumScrollControls());
      return;
    }

    // EXPANDED CHARACTER VIEW
    const ch = getCharacterForCompendium(selectedCompendiumCharId, compId);
    const baseCards = [...ch.cards, ...(ch.ultimate ? [ch.ultimate] : [])];
    const samModeCards = [
      ...(Array.isArray(ch.samCards) ? ch.samCards : []),
      ...(ch.samUltimate ? [ch.samUltimate] : [])
    ];
    const allCards = [...baseCards, ...samModeCards];
    const selectedCard = allCards.find((c) => c.id === selectedCompendiumCardId) || allCards[0];
    selectedCompendiumCardId = selectedCard ? selectedCard.id : null;

    const curIdx = activeIds.indexOf(selectedCompendiumCharId);
    const prevCid = activeIds[(curIdx - 1 + activeIds.length) % activeIds.length];
    const nextCid = activeIds[(curIdx + 1) % activeIds.length];
    const cp = ch.compPortrait || (ch.portrait ? { src: ch.portrait.src, objectPosition: "50% 10%" } : null);
    const rgb = ch.colorRgb || "72, 158, 130";

    const renderGalleryRow = (list) =>
      list
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

    const cardsGalleryHtml = renderGalleryRow(baseCards);
    const samGalleryHtml =
      samModeCards.length > 0
        ? `<div class="comp-exp-sam-section">
             <div class="comp-exp-cards-label" style="margin-bottom:8px;">SAM Mode: Skill Cards &amp; Transformation</div>
             <div class="comp-exp-cards-row">
               ${renderGalleryRow(samModeCards)}
             </div>
           </div>`
        : "";
    const devDisclaimerHtml = ch.underDevelopment
      ? `<div class="comp-dev-disclaimer"><strong>Disclaimer (Under Development):</strong> ${escapeHtml(
          ch.devDisclaimer || "This character is still under development; card effects and balance may change at any time."
        )}</div>`
      : "";

    const selectedDetailHtml = `<div id="comp-exp-card-detail-slot">${buildCompendiumCardDetailHtml(selectedCard, ch)}</div>`;

    root.innerHTML = `
      <div class="comp-expanded-panel" style="--char-accent:${escapeHtml(ch.color || "#34d399")};--char-rgb:${escapeHtml(rgb)};">
        <div class="comp-exp-portrait-col">
          <button class="comp-exp-back-btn" onclick="window.EFT_APP.selectCompendiumCharacter(null)">&lt; Back</button>
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
                ${ch.underDevelopment ? `<span class="comp-dev-inline-pill">Under Development</span>` : ""}
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn btn-sm" onclick="window.EFT_APP.selectCompendiumCharacter('${prevCid}')">&lt; Prev</button>
              <button class="btn btn-sm" onclick="window.EFT_APP.selectCompendiumCharacter('${nextCid}')">Next &gt;</button>
            </div>
          </div>

          ${devDisclaimerHtml}

          <div class="comp-exp-specialty-box">
            <div class="comp-exp-spec-label">Character Specialty</div>
            <div class="comp-exp-spec-val">${escapeHtml(ch.specialty)}</div>
          </div>

          <p class="comp-exp-lore">${escapeHtml(ch.lore)}</p>

          <div>
            <div class="comp-exp-cards-label" style="margin-bottom:8px;">${
              samModeCards.length > 0 ? "Firefly Mode: Skill Cards &amp; Ultimate" : "Skill Cards &amp; Ultimate"
            } (Click a card for details)</div>
            <div class="comp-exp-cards-row">
              ${cardsGalleryHtml}
            </div>
          </div>

          ${samGalleryHtml}

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
            <div><strong>Victory Condition:</strong> 💎 ${patch.victoryShards} Tartarus Shards (💰 ${patch.shardCost} TC each) · <strong>Starting TC:</strong> 💰 ${patch.startTC} TC</div>
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
    if (mp.mode !== "firebase_host" || !mp.fbRoomRef) return;
    mp.fbRoomRef
      .update({
        lobbyJson: JSON.stringify(mp.lobby),
        updatedAt: Date.now()
      })
      .catch(() => {});
  }

  function reassignLobbyBotChar(botMember, avoidCharIds) {
    if (!botMember || !mp.lobby) return;
    const allowed = getPlayableCharacterIds(mp.lobby.compendiumId);
    const free = allowed.find((cid) => !avoidCharIds.has(cid));
    if (free) {
      botMember.charId = free;
      const ch = getCharacterForCompendium(free, mp.lobby.compendiumId);
      botMember.username = `${ch ? ch.name : "Bot"} (Bot)`;
    }
  }

  function processLobbyJoinAction(d) {
    if (!d || !d.clientId) return;
    const allowed = getPlayableCharacterIds(mp.lobby.compendiumId);
    const takenByHumans = new Set(
      mp.lobby.members.filter((m) => !m.isBot && m.clientId !== d.clientId).map((m) => m.charId)
    );
    let chosenChar = allowed.includes(d.charId) ? d.charId : allowed[0];
    if (takenByHumans.has(chosenChar)) {
      chosenChar = allowed.find((cid) => !takenByHumans.has(cid)) || chosenChar;
    }

    const existing = mp.lobby.members.find((m) => m.clientId === d.clientId);
    const cleanName = String(d.username || "Player").trim().slice(0, 18) || "Player";
    if (!existing && mp.lobby.members.length >= 4) {
      const lastBotIdx = [...mp.lobby.members].reverse().findIndex((m) => m.isBot);
      if (lastBotIdx !== -1) {
        const realIdx = mp.lobby.members.length - 1 - lastBotIdx;
        mp.lobby.members.splice(realIdx, 1);
      }
    }

    const botUsingChar = mp.lobby.members.find((m) => m.isBot && m.charId === chosenChar);
    if (botUsingChar) {
      const usedSet = new Set(mp.lobby.members.map((m) => m.charId));
      usedSet.add(chosenChar);
      reassignLobbyBotChar(botUsingChar, usedSet);
    }

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
        isBot: false,
        ready: !!d.ready
      });
    }
    broadcastLobbyState();
    refreshLobbyModalIfOpen();
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
    if (mp.fbConnRef && mp.fbConnListener) {
      mp.fbConnRef.off("value", mp.fbConnListener);
    }
    if (mp.fbSeatsRef && mp.clientId) {
      mp.fbSeatsRef.child(mp.clientId).remove().catch(() => {});
    }
    mp.fbRoomRef = null;
    mp.fbActionsRef = null;
    mp.fbSeatsRef = null;
    mp.fbConnRef = null;
    mp.fbStateListener = null;
    mp.fbActionListener = null;
    mp.fbSeatsListener = null;
    mp.fbConnListener = null;
    mp.isConnected = false;
    mp.onlineSeats = {};
    updateMpConnectionPill("hidden", "");
  }

  function initHostLobbyPayload(code) {
    mp.lobby = {
      status: "waiting",
      hostClientId: mp.clientId,
      patchId: setupDraft.patchId || (state ? state.patchId : "alpha2"),
      compendiumId: setupDraft.compendiumId || (state ? state.compendiumId : "comp_beta1"),
      fillWithBots: true,
      kickedIds: [],
      lastNotify: null,
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

  let lastProcessedLobbyNotifyId = null;

  function kickLobbyPlayer(targetClientId) {
    if (!isMultiplayerHost() || !targetClientId || targetClientId === mp.clientId) return;
    playSfx("click");
    const target = (mp.lobby.members || []).find((m) => m.clientId === targetClientId);
    mp.lobby.members = (mp.lobby.members || []).filter((m) => m.clientId !== targetClientId);
    if (!target || !target.isBot) {
      if (!Array.isArray(mp.lobby.kickedIds)) mp.lobby.kickedIds = [];
      if (!mp.lobby.kickedIds.includes(targetClientId)) {
        mp.lobby.kickedIds.push(targetClientId);
      }
    }
    markRoomRealPlayerActivity(true);
    broadcastLobbyState();
    refreshLobbyModalIfOpen();
    if (target) {
      showHandDragToast(target.isBot ? `Removed ${target.username}.` : `Removed ${target.username} from the room.`);
    }
  }

  function notifyLobbyPlayer(targetClientId) {
    if (!isMultiplayerHost() || !targetClientId || targetClientId === mp.clientId) return;
    playSfx("click");
    const target = (mp.lobby.members || []).find((m) => m.clientId === targetClientId);
    if (!target) return;
    mp.lobby.lastNotify = {
      id: "ntf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      targetClientId,
      byName: (setupDraft.username || "").trim() || "Room Master",
      ts: Date.now()
    };
    markRoomRealPlayerActivity(true);
    broadcastLobbyState();
    showHandDragToast(`Notified ${target.username} to Ready up!`);
  }

  function copyRoomCodeQuick() {
    if (!mp.roomCode) return;
    playSfx("click");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mp.roomCode).then(() => {
        showHandDragToast(`Room code ${mp.roomCode} copied!`);
      }).catch(() => {
        showHandDragToast(`Room code: ${mp.roomCode}`);
      });
    } else {
      showHandDragToast(`Room code: ${mp.roomCode}`);
    }
  }

  function createLobbyRoom() {
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      alert("Please enter your Username before creating a Room.");
      return;
    }
    savePlayerProfile(uname, setupDraft.charId);
    startFirebaseHostRoom();
  }

  function joinLobbyRoom() {
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      alert("Please enter your Username before joining a Room.");
      return;
    }
    const codeInput = document.getElementById("setup-join-code");
    const code = ((codeInput && codeInput.value) || mp.roomCode || "").trim().toUpperCase();
    if (!code) {
      alert("Please enter a Room Code first.");
      return;
    }
    mp.roomCode = code;
    savePlayerProfile(uname, setupDraft.charId);
    joinFirebaseClientRoom(code);
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

  function addLobbyBot() {
    if (!isMultiplayerHost()) return;
    if (!Array.isArray(mp.lobby.members)) mp.lobby.members = [];
    if (mp.lobby.members.length >= 4) {
      playSfx("card_drag_deny");
      showHandDragToast("Room is already full (4/4 players).");
      return;
    }
    playSfx("click");
    const allowed = getPlayableCharacterIds(mp.lobby.compendiumId);
    const usedChars = new Set(mp.lobby.members.map((m) => m.charId));
    const freeChars = allowed.filter((cid) => !usedChars.has(cid));
    const cid =
      freeChars.length > 0
        ? freeChars[Math.floor(Math.random() * freeChars.length)]
        : allowed[mp.lobby.members.length % allowed.length];
    const ch = getCharacterForCompendium(cid, mp.lobby.compendiumId);
    mp.lobby.members.push({
      clientId: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      username: `${ch ? ch.name : "Bot"} (Bot)`,
      charId: cid,
      isHost: false,
      isBot: true,
      ready: true
    });
    markRoomRealPlayerActivity(true);
    broadcastLobbyState();
    refreshLobbyModalIfOpen();
  }

  function startMultiplayerMatchFromLobby() {
    if (!isMultiplayerHost()) return;
    const unreadyGuests = (mp.lobby.members || []).filter((m) => !m.isHost && !m.isBot && !m.ready);
    if (unreadyGuests.length > 0) {
      playSfx("card_drag_deny");
      showHandDragToast(`Waiting for ${unreadyGuests.map((u) => u.username).join(", ")} to press READY (use Notify!).`);
      return;
    }
    markRoomRealPlayerActivity(true);
    const allowed = getPlayableCharacterIds(mp.lobby.compendiumId);
    const roster = mp.lobby.members.map((m) => ({
      charId: allowed.includes(m.charId) ? m.charId : allowed[0],
      username: m.username,
      clientId: m.clientId,
      isBot: !!m.isBot
    }));

    if (roster.length < 2) {
      playSfx("card_drag_deny");
      showHandDragToast("Click '+1 Bot' or wait for at least 1 more player to start.");
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
      alert("Firebase is not configured.\n\nPlease fill in firebaseConfig in playtest/firebaseConfig.js first.");
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
          lastActivityAt: Date.now(),
          updatedAt: Date.now()
        })
        .then(() => {
          attachFirebaseConnectionMonitor(seatsRef, "Host Online");
          saveActiveMpSession("host", code);
          startMpInactivityMonitor(Date.now());
          syncLeaveRoomCornerBtn();

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
          stopMpInactivityMonitor();
          syncLeaveRoomCornerBtn();
          alert("Failed to write to Firebase Database: " + err.message);
        });
    } catch (e) {
      alert("Failed to start Firebase Host: " + e.message);
    }
  }

  function joinFirebaseClientRoom(forcedCode = null) {
    if (!window.EFT_IS_FIREBASE_READY()) {
      alert("Firebase is not configured in playtest/firebaseConfig.js.");
      return;
    }
    const codeEl = document.getElementById("setup-join-code");
    const code = (forcedCode || (codeEl && codeEl.value) || "").trim().toUpperCase();
    if (!code) {
      alert("Please enter the Host's Room Code first.");
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
            alert(`Room [${code}] was not found.`);
            return;
          }
          const lastActTs = Number(data.lastActivityAt || data.updatedAt || (data.meta && data.meta.createdAt) || 0);
          if (lastActTs > 0 && Date.now() - lastActTs >= ROOM_INACTIVITY_LIMIT_MS) {
            roomRef.remove().catch(() => {});
            clearActiveMpSession();
            alert(`Room [${code}] expired after 10 minutes of inactivity and has been removed.`);
            return;
          }

          mp.mode = "firebase_client";
          mp.roomCode = code;
          mp.mySeat = -1;
          mp.fbRoomRef = roomRef;
          mp.fbActionsRef = roomRef.child("actions");
          mp.fbSeatsRef = roomRef.child("seats");

          attachFirebaseConnectionMonitor(mp.fbSeatsRef, "Player Online");
          saveActiveMpSession("client", code);
          startMpInactivityMonitor(lastActTs || Date.now());
          invalidateHudCache();
          syncLeaveRoomCornerBtn();

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
            if (!val) {
              // Room has been deleted from Firebase
              stopMpInactivityMonitor();
              clearActiveMpSession();
              detachFirebaseListeners();
              mp.mode = "local";
              mp.roomCode = "";
              mp.mySeat = -1;
              syncLeaveRoomCornerBtn();
              if (state && state.winner) {
                renderVictoryScreenOverlay();
                return;
              }
              openRoomClosedNoticeModal(
                "Room Closed",
                "This multiplayer room has been closed and removed from the server."
              );
              return;
            }
            if (val.lastActivityAt) {
              const remoteAct = Number(val.lastActivityAt) || 0;
              if (remoteAct > mpLastRealActionAt) {
                mpLastRealActionAt = remoteAct;
                mpInactivityWarnShown = false;
              }
            }
            const prevStatus = mp.lobby.status;
            if (val.lobbyJson) {
              mp.lobby = JSON.parse(val.lobbyJson);
            }
            if (mp.lobby && Array.isArray(mp.lobby.kickedIds) && mp.lobby.kickedIds.includes(mp.clientId)) {
              stopMpInactivityMonitor();
              clearActiveMpSession();
              detachFirebaseListeners();
              mp.mode = "local";
              mp.roomCode = "";
              mp.mySeat = -1;
              syncLeaveRoomCornerBtn();
              openRoomClosedNoticeModal(
                "Removed from Room",
                "You were kicked from the room by the Room Master."
              );
              return;
            }
            if (
              mp.lobby &&
              mp.lobby.lastNotify &&
              mp.lobby.lastNotify.id &&
              mp.lobby.lastNotify.id !== lastProcessedLobbyNotifyId
            ) {
              lastProcessedLobbyNotifyId = mp.lobby.lastNotify.id;
              if (mp.lobby.lastNotify.targetClientId === mp.clientId) {
                playSfx("turn_reminder", "my_turn");
                showHandDragToast(`${mp.lobby.lastNotify.byName || "Room Master"} is asking you to press READY!`);
                setTimeout(() => {
                  const rBtn = document.getElementById("rl2-ready-btn");
                  if (rBtn) {
                    rBtn.classList.remove("is-notified");
                    void rBtn.offsetWidth;
                    rBtn.classList.add("is-notified");
                  }
                }, 80);
              }
            }
            if (val.stateJson) {
              state = JSON.parse(val.stateJson);
              pendingInteraction = val.pendingJson ? deserializePendingInteraction(JSON.parse(val.pendingJson)) : null;
              if (state.seatMap && typeof state.seatMap[mp.clientId] === "number") {
                mp.mySeat = state.seatMap[mp.clientId];
              }
            }
            mp.onlineSeats = val.seats || {};

            if (val.roomClosedReason === "last_player_victory" && state && state.winner) {
              hideMainTitleScreen();
              closeModal();
              renderAll();
              stopMpInactivityMonitor();
              clearActiveMpSession();
              const refToClean = mp.fbRoomRef;
              detachFirebaseListeners();
              mp.mode = "local";
              mp.roomCode = "";
              mp.mySeat = -1;
              syncLeaveRoomCornerBtn();
              if (refToClean) {
                setTimeout(() => deleteFirebaseRoomNow(refToClean), 450);
              }
              return;
            }
            if (val.roomClosedReason === "inactivity_timeout") {
              stopMpInactivityMonitor();
              clearActiveMpSession();
              detachFirebaseListeners();
              mp.mode = "local";
              mp.roomCode = "";
              mp.mySeat = -1;
              syncLeaveRoomCornerBtn();
              openRoomClosedNoticeModal(
                "Room Closed (Inactivity)",
                "No player actions were taken for 10 minutes. This room has been automatically removed to optimize database usage."
              );
              return;
            }
            if (val.roomClosedReason === "host_left") {
              stopMpInactivityMonitor();
              clearActiveMpSession();
              detachFirebaseListeners();
              mp.mode = "local";
              mp.roomCode = "";
              mp.mySeat = -1;
              syncLeaveRoomCornerBtn();
              openRoomClosedNoticeModal(
                "Room Closed",
                "The Host left the room. This session has ended and the room has been removed."
              );
              return;
            }

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
          alert("Failed to join Firebase Room: " + err.message);
        });
    } catch (e) {
      alert("Error joining Firebase Room: " + e.message);
    }
  }

  // ============================================================================
  // ROOM LIFECYCLE: LEAVE ROOM, WALKOVER VICTORY & 10-MINUTE INACTIVITY CLEANUP
  // ============================================================================
  const ROOM_INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
  const ROOM_INACTIVITY_WARN_MS = 9 * 60 * 1000;
  let mpLastRealActionAt = Date.now();
  let mpLastActivityFirebaseWriteAt = 0;
  let mpInactivityWarnShown = false;
  let mpInactivityCheckTimerId = null;
  let mpPendingRoomDeleteTimerId = null;

  function syncLeaveRoomCornerBtn() {
    const wrap = document.getElementById("hud-bottom-right-utils");
    if (!wrap) return;
    const show =
      mp.mode !== "local" &&
      isMatchStarted &&
      !isTitleScreenVisible &&
      !(state && state.winner);
    wrap.classList.toggle("is-hidden", !show);
  }

  function deleteFirebaseRoomNow(roomRefToDelete = null) {
    const targetRef = roomRefToDelete || mp.fbRoomRef;
    if (!targetRef) return;
    if (mpPendingRoomDeleteTimerId) {
      clearTimeout(mpPendingRoomDeleteTimerId);
      mpPendingRoomDeleteTimerId = null;
    }
    try {
      targetRef.remove().catch(() => {});
    } catch (e) {}
  }

  function scheduleFirebaseRoomDelete(roomRefToDelete, delayMs = 1200) {
    if (!roomRefToDelete) return;
    if (mpPendingRoomDeleteTimerId) {
      clearTimeout(mpPendingRoomDeleteTimerId);
      mpPendingRoomDeleteTimerId = null;
    }
    mpPendingRoomDeleteTimerId = setTimeout(() => {
      mpPendingRoomDeleteTimerId = null;
      deleteFirebaseRoomNow(roomRefToDelete);
    }, Math.max(0, delayMs));
  }

  function markRoomRealPlayerActivity(syncToFirebase = true) {
    if (mp.mode === "local") return;
    const now = Date.now();
    mpLastRealActionAt = now;
    mpInactivityWarnShown = false;
    if (syncToFirebase && mp.mode === "firebase_host" && mp.fbRoomRef && now - mpLastActivityFirebaseWriteAt >= 4500) {
      mpLastActivityFirebaseWriteAt = now;
      mp.fbRoomRef.update({ lastActivityAt: now }).catch(() => {});
    }
  }

  function openRoomClosedNoticeModal(title, message) {
    closeModal();
    openInfoModal(
      escapeHtml(title),
      `<div style="display:flex;flex-direction:column;gap:12px;">
        <p style="margin:0;font-size:0.86rem;color:#e2e8f0;line-height:1.5;">${escapeHtml(message)}</p>
        <button type="button" class="btn btn-emerald" onclick="window.EFT_APP.resetGameToMainMenu()">Back to Main Menu</button>
      </div>`
    );
  }

  function stopMpInactivityMonitor() {
    if (mpInactivityCheckTimerId) {
      clearInterval(mpInactivityCheckTimerId);
      mpInactivityCheckTimerId = null;
    }
    mpInactivityWarnShown = false;
  }

  function handleRoomInactivityExpired() {
    if (mp.mode === "local") {
      stopMpInactivityMonitor();
      return;
    }
    const roomRef = mp.fbRoomRef;
    const wasHost = mp.mode === "firebase_host";
    stopMpInactivityMonitor();
    clearActiveMpSession();

    if (roomRef) {
      if (wasHost) {
        roomRef
          .update({
            roomClosedReason: "inactivity_timeout",
            closedAt: Date.now()
          })
          .catch(() => {});
        scheduleFirebaseRoomDelete(roomRef, 550);
      } else {
        deleteFirebaseRoomNow(roomRef);
      }
    }

    detachFirebaseListeners();
    mp.mode = "local";
    mp.roomCode = "";
    mp.mySeat = -1;
    syncLeaveRoomCornerBtn();
    openRoomClosedNoticeModal(
      "Room Closed (Inactivity)",
      "No player actions were recorded for 10 minutes. This room has been automatically deleted to optimize database usage."
    );
  }

  function startMpInactivityMonitor(initialTimestamp = null) {
    stopMpInactivityMonitor();
    mpLastRealActionAt = Number(initialTimestamp) || Date.now();
    mpInactivityWarnShown = false;
    mpInactivityCheckTimerId = setInterval(() => {
      if (mp.mode === "local" || !mp.fbRoomRef) {
        stopMpInactivityMonitor();
        return;
      }
      if (state && state.winner) {
        stopMpInactivityMonitor();
        return;
      }
      const idleMs = Date.now() - mpLastRealActionAt;
      if (idleMs >= ROOM_INACTIVITY_WARN_MS && !mpInactivityWarnShown) {
        mpInactivityWarnShown = true;
        showHandDragToast("No player actions for 9 min. Room will auto-close in 1 min.");
      }
      const graceMs = mp.mode === "firebase_client" ? 5000 : 0;
      if (idleMs >= ROOM_INACTIVITY_LIMIT_MS + graceMs) {
        handleRoomInactivityExpired();
      }
    }, 10000);
  }

  function getActiveHumanPlayersInRoom() {
    if (!state || !Array.isArray(state.players)) return [];
    return state.players.filter((p) => p && !p.isBot && !p.hasLeftRoom);
  }

  function declareWalkoverVictoryAndDeleteRoom(winnerPlayer, reasonText, roomRef, deleteDelayMs = 1500) {
    if (!state || !winnerPlayer) return;
    clearTimeout(stepTimerId);
    clearTimeout(autoEndTurnTimerId);
    clearTimeout(tileModalAutoCloseTimerId);
    isWalkingAnim = false;
    activeStepsRemaining = 0;
    pendingInteraction = null;
    state.activeTileModal = null;
    state.activeMinigame = null;
    state.winner = {
      index: winnerPlayer.index,
      id: winnerPlayer.id,
      name: winnerPlayer.name,
      charId: winnerPlayer.charId,
      charName: winnerPlayer.charName || winnerPlayer.name,
      color: winnerPlayer.color,
      shards: winnerPlayer.shards,
      metaShard: winnerPlayer.metaShard,
      tc: winnerPlayer.tc,
      cycle: state.cycle,
      victoryReason: reasonText
    };
    addLog(`VICTORY! ${winnerPlayer.name} wins: ${reasonText}`);
    stopMpInactivityMonitor();
    clearActiveMpSession();

    if (roomRef) {
      roomRef
        .update({
          lobbyJson: JSON.stringify(mp.lobby),
          stateJson: JSON.stringify(state),
          pendingJson: JSON.stringify(null),
          roomClosedReason: "last_player_victory",
          closedAt: Date.now(),
          updatedAt: Date.now()
        })
        .catch(() => {});
      scheduleFirebaseRoomDelete(roomRef, deleteDelayMs);
    }
  }

  function handlePlayerLeftRoom(leaverClientId, leaverSeat = -1) {
    if (mp.mode !== "firebase_host") return;

    if (mp.lobby && Array.isArray(mp.lobby.members)) {
      mp.lobby.members = mp.lobby.members.filter((m) => m.clientId !== leaverClientId);
    }

    if (mp.lobby.status !== "playing") {
      const remainingHumansInLobby = (mp.lobby.members || []).filter((m) => !m.isBot);
      if (remainingHumansInLobby.length === 0) {
        const ref = mp.fbRoomRef;
        detachFirebaseListeners();
        deleteFirebaseRoomNow(ref);
        stopMpInactivityMonitor();
        clearActiveMpSession();
        mp.mode = "local";
        mp.roomCode = "";
        syncLeaveRoomCornerBtn();
      } else {
        broadcastLobbyState();
        refreshLobbyModalIfOpen();
      }
      return;
    }

    if (!state || state.winner) return;

    let seatIdx = -1;
    if (leaverClientId && state.seatMap && typeof state.seatMap[leaverClientId] === "number") {
      seatIdx = state.seatMap[leaverClientId];
      delete state.seatMap[leaverClientId];
    } else if (typeof leaverSeat === "number" && leaverSeat >= 0) {
      seatIdx = leaverSeat;
    }

    const leaver = seatIdx >= 0 && state.players[seatIdx] ? state.players[seatIdx] : null;
    if (leaver && !leaver.hasLeftRoom) {
      leaver.hasLeftRoom = true;
      leaver.isBot = true;
      addLog(`${leaver.name} left the room.`);
    }

    const remainingHumans = getActiveHumanPlayersInRoom();
    if (remainingHumans.length === 1) {
      const soleWinner = remainingHumans[0];
      const hostIsWinner = soleWinner.index === mp.mySeat;
      const ref = mp.fbRoomRef;
      declareWalkoverVictoryAndDeleteRoom(
        soleWinner,
        "All other players left the room. Victory by walkover!",
        ref,
        hostIsWinner ? 450 : 1600
      );
      if (hostIsWinner) {
        renderAll();
        detachFirebaseListeners();
        mp.mode = "local";
        mp.roomCode = "";
        mp.mySeat = -1;
        syncLeaveRoomCornerBtn();
      }
      return;
    }

    if (remainingHumans.length === 0) {
      const ref = mp.fbRoomRef;
      stopMpInactivityMonitor();
      clearActiveMpSession();
      detachFirebaseListeners();
      deleteFirebaseRoomNow(ref);
      mp.mode = "local";
      mp.roomCode = "";
      mp.mySeat = -1;
      syncLeaveRoomCornerBtn();
      return;
    }

    // 2+ human players still remain: keep match moving smoothly
    if (leaver && state.activePlayerIndex === leaver.index && !state.winner) {
      pendingInteraction = null;
      state.activeTileModal = null;
      endCurrentTurn({ forceTimeout: true });
      return;
    }
    broadcastMultiplayerState();
    renderAll();
  }

  function requestLeaveRoom() {
    if (mp.mode === "local") return;
    playSfx("click");
    const remainingCount = Math.max(0, getActiveHumanPlayersInRoom().length - 1);
    const extraNote =
      mp.lobby.status === "playing" && remainingCount === 1
        ? "Only 1 other player will remain in this room, so they will be declared the winner and the room will be automatically deleted."
        : "Leaving will end your participation in this room.";

    openInfoModal(
      `Leave Room [${escapeHtml(mp.roomCode || "")}]?`,
      `<div style="display:flex;flex-direction:column;gap:12px;">
        <p style="margin:0;font-size:0.84rem;color:#e2e8f0;line-height:1.5;">
          Are you sure you want to leave this multiplayer room?
        </p>
        <div style="background:rgba(225,29,72,0.14);border:1px solid rgba(248,113,113,0.38);border-radius:9px;padding:9px 11px;font-size:0.78rem;color:#fecaca;line-height:1.45;">
          ${escapeHtml(extraNote)}
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-danger" style="flex:1;" onclick="window.EFT_APP.confirmLeaveRoom()">Confirm Leave Room</button>
          <button type="button" class="btn" style="flex:1;" onclick="window.EFT_APP.closeModal()">Stay</button>
        </div>
      </div>`
    );
  }

  function confirmLeaveRoom() {
    if (mp.mode === "local") {
      closeModal();
      return;
    }
    playSfx("click");
    closeModal();

    if (mp.mode === "firebase_client") {
      sendClientActionToHost("leave_room", {
        clientId: mp.clientId,
        seatIndex: mp.mySeat
      });
      stopMpInactivityMonitor();
      clearActiveMpSession();
      setTimeout(() => {
        resetGameToMainMenu();
      }, 180);
      return;
    }

    if (mp.mode === "firebase_host") {
      const roomRef = mp.fbRoomRef;
      stopMpInactivityMonitor();
      clearActiveMpSession();

      if (mp.lobby.status !== "playing") {
        if (roomRef) {
          roomRef.update({ roomClosedReason: "host_left", closedAt: Date.now() }).catch(() => {});
          scheduleFirebaseRoomDelete(roomRef, 450);
        }
        resetGameToMainMenu({ preservePendingDelete: true });
        return;
      }

      const hostSeat =
        state && state.seatMap && typeof state.seatMap[mp.clientId] === "number"
          ? state.seatMap[mp.clientId]
          : mp.mySeat;
      if (state && state.players && state.players[hostSeat]) {
        state.players[hostSeat].hasLeftRoom = true;
        addLog(`${state.players[hostSeat].name} (Host) left the room.`);
      }
      if (state && state.seatMap) delete state.seatMap[mp.clientId];
      if (mp.lobby && Array.isArray(mp.lobby.members)) {
        mp.lobby.members = mp.lobby.members.filter((m) => m.clientId !== mp.clientId);
      }

      const remainingHumans = getActiveHumanPlayersInRoom();
      if (remainingHumans.length === 1) {
        declareWalkoverVictoryAndDeleteRoom(
          remainingHumans[0],
          "Opponent left the room. Victory by walkover!",
          roomRef,
          1600
        );
        resetGameToMainMenu({ preservePendingDelete: true });
        return;
      }

      if (remainingHumans.length === 0) {
        deleteFirebaseRoomNow(roomRef);
        resetGameToMainMenu({ preservePendingDelete: true });
        return;
      }

      if (roomRef) {
        roomRef.update({ roomClosedReason: "host_left", closedAt: Date.now() }).catch(() => {});
        scheduleFirebaseRoomDelete(roomRef, 900);
      }
      resetGameToMainMenu({ preservePendingDelete: true });
    }
  }

  function processRemoteClientAction(act) {
    if (!act) return;
    const aid = act.actionId || act.id;
    if (!aid) return;
    if (mp.processedActionIds.has(aid)) return;
    mp.processedActionIds.add(aid);

    const d = act.data || {};
    if (act.action === "leave_room") {
      handlePlayerLeftRoom(d.clientId || act.senderId, d.seatIndex !== undefined ? d.seatIndex : act.seat);
      return;
    }

    markRoomRealPlayerActivity(true);

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

    if (act.action === "sort_hand") {
      if (senderSeat >= 0 && state.players[senderSeat]) {
        sortMyHand(senderSeat);
        broadcastMultiplayerState();
      }
      return;
    }

    if (act.action === "chat_message") {
      if (senderSeat >= 0 && state.players[senderSeat] && d && typeof d.text === "string") {
        recordInGameChatMessage(senderSeat, d.text);
        broadcastMultiplayerState();
      }
      return;
    }

    const expectedSeat = getExpectedActingSeat();
    if (act.action === "minigame_finish" || act.action === "minigame_action") {
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
      else if (act.action === "scry_keep_choice") resolveScryKeepChoice(d.chosenUid);
      else if (act.action === "haste_react") resolveHasteReaction(d.hasteCardUid || null);
      else if (act.action === "forced_all_in_choice") resolveForcedAllInChoice(d.choice);
      else if (act.action === "minigame_roll") rollDiceOfFateCurrent();
      else if (act.action === "minigame_action") {
        if (window.EFT_MINIGAMES) {
          window.EFT_MINIGAMES.handleAuthoritativeAction(senderSeat, d.type, d.payload || {});
        }
      }
      else if (act.action === "minigame_finish") finishDiceOfFateMinigame();
    } finally {
      isProcessingRemoteAction = false;
    }
  }

  function disconnectMultiplayer() {
    const prevMode = mp.mode;
    const prevRoomRef = mp.fbRoomRef;
    if (prevMode === "firebase_client") {
      sendClientActionToHost("leave_room", { clientId: mp.clientId, seatIndex: mp.mySeat });
    } else if (prevMode === "firebase_host" && prevRoomRef) {
      prevRoomRef.update({ roomClosedReason: "host_left", closedAt: Date.now() }).catch(() => {});
      scheduleFirebaseRoomDelete(prevRoomRef, 450);
    }
    stopMpInactivityMonitor();
    detachFirebaseListeners();
    clearActiveMpSession();
    mp.mode = "local";
    mp.roomCode = "";
    mp.mySeat = -1;
    invalidateHudCache();
    syncLeaveRoomCornerBtn();
    mp.lobby = {
      status: "idle",
      hostClientId: "",
      patchId: state ? state.patchId : "alpha2",
      compendiumId: state ? state.compendiumId : "comp_beta1",
      fillWithBots: true,
      members: []
    };
    if (isTitleScreenVisible) {
      closeModal();
      showMainTitleScreen();
    } else {
      openWelcomeSetupModal("multiplayer");
    }
    renderAll();
  }

  function broadcastMultiplayerState() {
    if (!state || mp.mode !== "firebase_host" || !mp.fbRoomRef) return;
    mp.fbRoomRef
      .update({
        lobbyJson: JSON.stringify(mp.lobby),
        stateJson: JSON.stringify(state),
        pendingJson: JSON.stringify(serializePendingInteraction()),
        lastActivityAt: mpLastRealActionAt,
        updatedAt: Date.now()
      })
      .catch(() => {});
  }

  function sendClientActionToHost(actionName, data) {
    if (mp.mode !== "firebase_client" || !mp.fbActionsRef) return;
    if (actionName !== "leave_room") {
      markRoomRealPlayerActivity(false);
    }
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
    mp.fbActionsRef.push(msg).catch((err) => {
      alert("Failed to send action to Firebase: " + err.message);
    });
  }

  // ============================================================================
  // INTERACTIVE PROMPTS & MODALS
  // ============================================================================
  function confirmShardPurchase(buy) {
    if (!canLocalPlayerAct()) return;
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
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
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
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
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
    if (pendingInteraction && pendingInteraction.type === "prompt_merchant_pass" && pendingInteraction.shopId !== shopId && !isAdminUnlocked) {
      alert(`You are currently at Shop ${pendingInteraction.shopId} and cannot access Shop ${shopId}.`);
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
        alert("Meta-Shard can only be purchased once per match.");
        return;
      }
      if (shop.ultStock <= 0 || pBuys.ult >= 1) {
        alert("This Shop's Ultimate Card stock is sold out for this Cycle (1/Cycle).");
        return;
      }
      if (player.hand.some((c) => c.rarity === "Ultimate")) {
        alert("You may only hold a maximum of 1 Ultimate Card in hand at a time.");
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
    if (!closeAfter && isLocalHumanTurnForPlayer(player)) openMerchantModal(shopId);
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
      if (pendingInteraction.type === "select_sam_fire_1" && pendingInteraction.validTileIds.includes(tileId)) {
        const remainingIds = pendingInteraction.validTileIds.filter((id) => id !== tileId);
        pendingInteraction = {
          type: "select_sam_fire_2",
          cardUid: pendingInteraction.cardUid,
          card: pendingInteraction.card,
          player: pendingInteraction.player,
          options: { ...(pendingInteraction.options || {}), firstTileId: tileId },
          firstTileId: tileId,
          validTileIds: remainingIds,
          tileStepLabels: { [tileId]: "FIRE 1" }
        };
        playSfx("click");
        renderAll();
        return;
      }
      if (pendingInteraction.type === "select_sam_fire_2" && pendingInteraction.validTileIds.includes(tileId)) {
        const { cardUid, options, firstTileId } = pendingInteraction;
        pendingInteraction = null;
        playSkillCardFromHand(cardUid, {
          ...(options || {}),
          targetTileIds: [firstTileId, tileId],
          targetTileId: firstTileId
        });
        return;
      }
      if (pendingInteraction.type === "select_token_source" && pendingInteraction.validTileIds.includes(tileId)) {
        const covering = getTokensCoveringTile(tileId);
        const chosenTok = covering[0];
        if (!chosenTok) return;
        const allDestIds = DATA.BOARD_TILES.filter(
          (t) => t.type !== "spawn" && t.type !== "intersect" && !t.offTrack
        ).map((t) => t.id);
        pendingInteraction = {
          type: "select_token_dest",
          cardUid: pendingInteraction.cardUid,
          card: pendingInteraction.card,
          player: pendingInteraction.player,
          options: { ...(pendingInteraction.options || {}), tokenId: chosenTok.id },
          tokenId: chosenTok.id,
          tokenName: chosenTok.name,
          sourceTileId: chosenTok.tileId,
          validTileIds: allDestIds,
          tileStepLabels: {}
        };
        playSfx("click");
        renderAll();
        return;
      }
      if (pendingInteraction.type === "select_token_dest" && pendingInteraction.validTileIds.includes(tileId)) {
        const { cardUid, options, tokenId } = pendingInteraction;
        pendingInteraction = null;
        playSkillCardFromHand(cardUid, { ...(options || {}), tokenId, targetTileId: tileId });
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
    const tokensOnTile = getTokensCoveringTile(tileId);

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
          <strong>💎 Tartarus Shard (Zone ${escapeHtml(shardOnTile.roman)}):</strong> Pass this tile with at least 💰 ${state.rules.shardCost} TC to buy 1 💎 Tartarus Shard.
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
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
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
        controlsHtml += `<div style="color:#fda4af;font-size:0.8rem;">No valid targets (${isRadType ? `players are at Spawn or outside ${rad}-block radius` : "all opponents are still at Spawn"}).</div>`;
      } else {
        controlsHtml += `
          <div class="form-field">
            <label>Target Player${targetCard.radius ? ` (Radius ${targetCard.radius} Blocks)` : ""}:</label>
            <select id="card-modal-target-player">
              ${validPlayers
                .map((vp) => {
                  const charNote = vp.charName && vp.charName !== vp.name ? `${vp.charName} · ` : "";
                  const selfTag = vp.index === player.index ? " · Self" : "";
                  return `<option value="${vp.index}">${escapeHtml(vp.name)}${selfTag} (${charNote}${vp.tileId} · ${getTileDistance(
                    player.tileId,
                    vp.tileId
                  )} blocks)</option>`;
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
        controlsHtml += `<div style="color:#fda4af;font-size:0.8rem;">No opponents within ${rad} blocks of your position (${player.tileId}).</div>`;
      } else {
        controlsHtml += `<div style="color:#a7f3d0;font-size:0.78rem;">Targets within ${rad} blocks: <strong>${inRange
          .map((o) => `${escapeHtml(o.name)} (${getTileDistance(player.tileId, o.tileId)} blocks)`)
          .join(", ")}</strong></div>`;
      }
    }

    if (targetCard.effectKey === "choice_10tc_or_draw1") {
      const gainVal = targetCard.tcGain || (state.compendiumId === "comp_v0_1" ? 5 : 10);
      controlsHtml += `
        <div class="form-field">
          <label>Choose Effect:</label>
          <select id="card-modal-choice-val">
            <option value="tc">Gain +${gainVal} T-Coins</option>
            <option value="draw">Draw +1 Card</option>
          </select>
        </div>`;
    } else if (targetCard.effectKey === "choice_move1_2_or_10tc") {
      controlsHtml += `
        <div class="form-field">
          <label>Choose Effect:</label>
          <select id="card-modal-choice-val">
            <option value="move">Move +1 / +2 Tiles (Pick on Map)</option>
            <option value="tc">Gain +10 T-Coins</option>
          </select>
        </div>`;
    } else if (targetCard.effectKey === "relocate_board_traps") {
      if (!Array.isArray(state.boardTokens) || state.boardTokens.length === 0) {
        missingValidTarget = true;
        controlsHtml += `<div style="color:#fda4af;font-size:0.8rem;">There are no active Tokens/Traps on the board to relocate right now.</div>`;
      } else {
        controlsHtml += `<div style="color:#a7f3d0;font-size:0.78rem;"><strong>${state.boardTokens.length} active Token(s)/Trap(s)</strong> on the board. Click <strong>Use Card</strong> to select a token, relocate it anywhere, and trigger its effect!</div>`;
      }
    } else if (targetCard.effectKey === "sam_discounted_versus") {
      controlsHtml += `
        <div class="form-field">
          <label>Choose Versus Wager (SAM Discount):</label>
          <select id="card-modal-choice-val">
            <option value="tier1">Tier 1: SAM Free (0 TC) vs Opponent 15 TC</option>
            <option value="tier2">Tier 2: SAM 15 TC vs Opponent 30 TC</option>
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
        Copied effect: ${escapeHtml(entry.card.description)}${entry.card.rarity === "Unique" ? " (1 Turn Duration)" : ""}
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
    if (selectedCardUid !== null) {
      selectedCardUid = null;
      renderTuckedHandAndDice();
    }
    const imgUrl = getCardImage(card, player.charId);
    const isMyTurn = ownerIdx === state.activePlayerIndex && canLocalPlayerAct();
    const check = isMyTurn ? canPlaySkillCard(player, card) : { ok: false, reason: "Wait for your turn to play this card." };

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
        controlsHtml = `<div style="font-size:0.78rem;color:var(--mint-light);">No non-Ultimate opponent skills played in Cycle ${state.cycle} yet; using this card grants +15 TC instead.</div>`;
      } else {
        const firstBuilt = buildSkillControlsForModal(pool[0].card, player);
        missingValidTarget = firstBuilt.missingTarget;
        controlsHtml = `
          <div class="form-field">
            <label>Select Opponent Skill from Cycle ${state.cycle} (Non-Ultimate):</label>
            <select id="card-modal-copy-skill" onchange="window.EFT_APP.onCopySkillSelectChange(${player.index})">
              ${pool
                .map(
                  (e) =>
                    `<option value="${e.id}">${escapeHtml(e.card.name)} by ${escapeHtml(e.casterName)} (${escapeHtml(e.card.rarity)})</option>`
                )
                .join("")}
            </select>
          </div>
          <div id="card-modal-copy-extra">
            <div style="font-size:0.74rem;color:var(--mint-light);margin-bottom:6px;">
              Copied effect: ${escapeHtml(pool[0].card.description)}${pool[0].card.rarity === "Unique" ? " (1 Round Duration)" : ""}
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

    const emperorTax = isMyTurn ? getEmperorTaxInfo(player, card) : { owners: [], totalTax: 0 };
    const emperorNoticeHtml =
      emperorTax.owners.length > 0
        ? `<div style="background:rgba(245,158,11,0.14);border:1px solid rgba(251,191,36,0.42);padding:8px 10px;border-radius:8px;color:#fde68a;font-size:0.76rem;line-height:1.4;">
            <strong>The Emperor's Favor (${escapeHtml(emperorTax.owners.map((o) => o.name).join(" & "))}):</strong>
            Activating this ${escapeHtml(card.rarity)} card requires a tax of <strong>💰 ${emperorTax.totalTax} TC</strong>.
            ${player.tc < emperorTax.totalTax ? `<span style="color:#fda4af;">(Your TC is 💰 ${player.tc} TC, not enough!)</span>` : ""}
          </div>`
        : "";

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
          ${emperorNoticeHtml}
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

    const emperorTax = getEmperorTaxInfo(player, card);
    if (emperorTax.owners.length > 0) {
      openEmperorTaxConfirmModal(player, card, flowCard, options, emperorTax);
      return;
    }

    proceedCardActivationAfterTax(cardUid, flowCard, options);
  }

  function startSamFireTileSelection(cardUid, options = {}, specCard = null) {
    const player = getActivePlayer();
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return;
    const effectiveCard = specCard || card;
    const validTileIds = DATA.BOARD_TILES.filter(
      (t) => t.type !== "spawn" && t.type !== "intersect" && !t.offTrack
    ).map((t) => t.id);
    if (validTileIds.length < 2) {
      alert("Not enough valid tiles on the board.");
      return;
    }
    closeModal();
    pendingInteraction = {
      type: "select_sam_fire_1",
      cardUid,
      card: effectiveCard,
      player,
      options,
      validTileIds,
      tileStepLabels: {}
    };
    renderAll();
  }

  function startTokenSourceSelection(cardUid, options = {}, specCard = null) {
    const player = getActivePlayer();
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return;
    const effectiveCard = specCard || card;
    const validSet = new Set();
    (state.boardTokens || []).forEach((tok) => {
      if (tok.tileId && TILE_MAP[tok.tileId]) validSet.add(tok.tileId);
      if (Array.isArray(tok.coveredTileIds)) {
        tok.coveredTileIds.forEach((cid) => {
          if (cid && TILE_MAP[cid]) validSet.add(cid);
        });
      }
    });
    const validTileIds = Array.from(validSet);
    if (validTileIds.length === 0) {
      alert("No active Tokens/Traps on the board to relocate.");
      return;
    }
    closeModal();
    pendingInteraction = {
      type: "select_token_source",
      cardUid,
      card: effectiveCard,
      player,
      options,
      validTileIds,
      tileStepLabels: {}
    };
    focusCameraOnTileGroup(validTileIds, validTileIds[0]);
    renderAll();
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
    } else if (effectiveCard.targetType === "any_tile") {
      matches = DATA.BOARD_TILES.filter(
        (t) => t.type !== "spawn" && t.type !== "intersect" && !t.offTrack
      ).map((t) => ({
        tile: t,
        distance: getTileDistance(player.tileId, t.id)
      }));
    } else {
      const excludeSelfTile = effectiveCard.effectKey === "teleport_normal_radius";
      matches = getTilesWithinRadius(player.tileId, radius, onlyNormal, excludeSelfTile);
    }

    if (matches.length === 0) {
      alert("No matching tiles available.");
      return;
    }
    closeModal();
    const validTileIds = matches.map((m) => m.tile.id);
    pendingInteraction = {
      type: "select_tile_target",
      cardUid,
      card: effectiveCard,
      player,
      movingPlayerIndex: player.index,
      options,
      validTileIds,
      tileStepLabels: {},
      canChangeTarget: card.effectKey === "copy_last_skill"
    };
    focusCameraOnTileGroup(validTileIds, player.tileId);
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
      alert(`No valid destination tiles from ${movingPlayer.name}'s position (${movingPlayer.tileId}).`);
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

    focusCameraOnTileGroup(validTileIds, movingPlayer.tileId);
    renderAll();
  }

  function reopenPendingCardModal() {
    if (!pendingInteraction || pendingInteraction.type !== "select_tile_target") return;
    const { cardUid, player } = pendingInteraction;
    pendingInteraction = null;
    renderAll();
    openPlayCardModal(cardUid, player ? player.index : state.activePlayerIndex);
  }

  function openMerchantModal(shopId = 1, fromAdmin = false, targetPlayer = null) {
    if (!state) return;
    const player = targetPlayer || getActivePlayer();
    if (fromAdmin) {
      if (!isAdminUnlocked) return;
    } else if (!isLocalHumanTurnForPlayer(player)) {
      return;
    }
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
    if (metaShardUsed) ultBtnLabel = "Already Purchased (Max 1/Match)";
    else if (ultUsedThisCycle) ultBtnLabel = "Sold Out (0/1 This Cycle)";
    else if (hasUltInHand) ultBtnLabel = "Already Holding 1 Ultimate";

    openInfoModal(
      `Merchant Shop ${shopId} (${player.name}: 💰 ${player.tc} TC)`,
      `<div style="display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:0.76rem;color:var(--mint-light);background:rgba(245,158,11,0.12);border:1px solid rgba(251,191,36,0.36);border-radius:8px;padding:7px 11px;">
          ${
            state.rules.independentShops
              ? `Exclusive access to <strong>Merchant Shop ${shopId}</strong> (${shopId === 1 ? "Upper Path" : "Lower Path"}): Stock is separate from Shop ${shopId === 1 ? 2 : 1}.`
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
          ? `<span class="tag-badge" style="border-color:var(--mint-light);color:var(--mint-light);">Turn</span>`
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
              <span style="color:#cbd5e1;">${nonUltCnt} ${nonUltCnt === 1 ? "Card" : "Cards"}${ultCnt > 0 ? ` (+${ultCnt} Ult)` : ""}</span>
            </div>
          </div>`;
      })
      .join("");

    return `
      <div style="display:flex;flex-direction:column;gap:6px;background:rgba(6,16,20,0.55);border:1px solid var(--border-soft);border-radius:11px;padding:10px;">
        <div style="font-size:0.72rem;font-weight:800;color:var(--mint-light);text-transform:uppercase;letter-spacing:0.4px;">
          All Players Status (TC · Shards · Cards)
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

    const actor = state.players[tm.actorIndex] || getActivePlayer();
    const isActor = isLocalHumanTurnForPlayer(actor);

    // Pop-up efek tile hanya muncul untuk pemain yang terkena efek (bukan pemain lain)
    if (!isActor) {
      if (curKind === "shared_tile_modal") {
        lastRenderedTileModalKey = null;
        closeModal();
      }
      return;
    }

    if (tm.status === "selecting" && tileModalMinimizedForId === tm.id) {
      return;
    }

    const renderKey = `${tm.id}_${tm.status}_act_${actor.index}`;
    if (lastRenderedTileModalKey === renderKey && document.getElementById("app-modal")?.classList.contains("open")) {
      return;
    }
    lastRenderedTileModalKey = renderKey;

    const statsHtml = buildTileModalPlayersStatsHtml(actor.index);

    if (tm.status === "resolved") {
      tileModalMinimizedForId = null;
      openInfoModal(
        tm.type === "versus" ? `Versus Duel Result: ${escapeHtml(actor.name)}` : `Trading Post Result: ${escapeHtml(actor.name)}`,
        `<div style="display:flex;flex-direction:column;gap:12px;padding:6px 4px;">
          <div style="background:rgba(16,185,129,0.14);border:1px solid rgba(52,211,153,0.45);border-radius:12px;padding:14px;font-size:0.9rem;color:#ecfdf5;line-height:1.45;text-align:center;">
            ${escapeHtml(tm.summaryText || "Transaction completed.")}
          </div>
          ${statsHtml}
          <button class="btn btn-emerald" onclick="window.EFT_APP.dismissSharedTileModal()">Next</button>
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
      openInfoModal(
        `Versus Duel: 1v1 Wager (${escapeHtml(actor.name)})`,
        `<div style="display:flex;flex-direction:column;gap:12px;">
          ${statsHtml}
          <div class="form-grid">
            <div class="form-field">
              <label>Choose Duel Opponent:</label>
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
              <label>Wager Amount (1-30 TC):</label>
              <input
                type="number"
                id="versus-bet-input"
                min="1"
                max="30"
                step="1"
                value="15"
                placeholder="1 - 30 TC"
                oninput="if(this.value!==''){const v=Math.max(1,Math.min(30,Math.floor(Number(this.value)||1)));const lbl=document.getElementById('versus-pot-preview');if(lbl)lbl.textContent='Total Pot: 💰 '+(v*2)+' TC (Max 30 TC)';}"
              />
              <div id="versus-pot-preview" style="font-size:0.72rem;color:var(--mint-light);margin-top:3px;">
                Total Pot: 💰 30 TC (Max 30 TC)
              </div>
            </div>
          </div>
          <button class="btn btn-gold" onclick="window.EFT_APP.resolveVersusDuel()">Start 1v1 Duel</button>
        </div>`,
        "shared_tile_modal"
      );
    } else if (tm.type === "trading") {
      const others = state.players.filter((p) => p.index !== actor.index);
      openInfoModal(
        `Trading Post: Card Trade (${escapeHtml(actor.name)})`,
        `<div style="display:flex;flex-direction:column;gap:12px;">
          ${statsHtml}
          <div class="form-grid">
            <div class="form-field">
              <label>Choose Trade Partner:</label>
              <select id="trade-partner-select">
                ${others
                  .map((o) => {
                    const nonUltCnt = (o.hand || []).filter((c) => c && c.rarity !== "Ultimate").length;
                    const totShards = (o.shards || 0) + (o.metaShard || 0);
                    return `<option value="${o.index}">${escapeHtml(o.name)} (💰 ${o.tc} TC · 💎 ${totShards}/${
                      state.rules.victoryShards
                    } · ${nonUltCnt} Cards)</option>`;
                  })
                  .join("")}
              </select>
            </div>
            <div class="form-field">
              <label>Trade Action:</label>
              <select id="trade-type-select">
                <option value="buy_card_15">Buy 1 Random Card (Pay 💰 15 TC)</option>
                <option value="sell_card_15">Sell 1 Random Card (Receive 💰 15 TC)</option>
                <option value="swap_random_card">Swap 1 Random Card (1:1)</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" style="flex:1;" onclick="window.EFT_APP.executeTradeAction()">Confirm Trade</button>
            <button class="btn" onclick="window.EFT_APP.dismissSharedTileModal()">Skip</button>
          </div>
        </div>`,
        "shared_tile_modal"
      );
    }
  }

  function openVersusModal(challenger) {
    const rivals = state.players.filter((p) => p.index !== challenger.index && !p.inSpawn);
    if (rivals.length === 0) {
      addLog(`Versus Tile: No opponents outside Spawn for ${challenger.name} to challenge.`);
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
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
    const oppEl = document.getElementById("versus-opponent-select");
    const betEl = document.getElementById("versus-bet-input") || document.getElementById("versus-bet-select");
    const oppIdx = forcedOppIdx !== null ? Number(forcedOppIdx) : oppEl ? Number(oppEl.value) : -1;
    const rawBet = forcedBet !== null ? Number(forcedBet) : betEl ? Number(betEl.value) : 15;
    if (!Number.isFinite(rawBet) || rawBet < 1 || rawBet > 30) {
      alert("Please enter a wager between 1 and 30 TC.");
      return;
    }
    const bet = Math.max(1, Math.min(30, Math.floor(rawBet)));
    if (isRemoteClient() && forcedOppIdx === null) {
      sendClientActionToHost("resolve_versus", { oppIdx, bet });
      return;
    }
    const actorIdx =
      state.activeTileModal && typeof state.activeTileModal.actorIndex === "number"
        ? state.activeTileModal.actorIndex
        : state.activePlayerIndex;
    const challenger = state.players[actorIdx] || getActivePlayer();
    const opponent = state.players[oppIdx];
    if (!opponent || opponent.index === challenger.index) return;

    // Close the opponent/bet selection modal and launch the 1v1 Versus Minigame Randomizer
    clearTimeout(tileModalAutoCloseTimerId);
    tileModalAutoCloseTimerId = null;
    state.activeTileModal = null;
    lastRenderedTileModalKey = null;
    tileModalMinimizedForId = null;
    closeModal();

    startRandomMinigame("versus", {
      reasonTitle: `Versus Tile · Wager 💰 ${bet} TC`,
      afterAction: "versus_wager",
      challengerIndex: challenger.index,
      opponentIndex: opponent.index,
      wager: bet
    });
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
    if (!isProcessingRemoteAction) markRoomRealPlayerActivity();
    const partEl = document.getElementById("trade-partner-select");
    const typeEl = document.getElementById("trade-type-select");
    const partnerIdx = forcedPartnerIdx !== null ? Number(forcedPartnerIdx) : partEl ? Number(partEl.value) : -1;
    const tradeType = forcedTradeType !== null ? forcedTradeType : typeEl ? typeEl.value : "swap_random_card";
    if (isRemoteClient() && forcedPartnerIdx === null) {
      sendClientActionToHost("execute_trade", { partnerIdx, tradeType });
      return;
    }
    const actorIdx =
      state.activeTileModal && typeof state.activeTileModal.actorIndex === "number"
        ? state.activeTileModal.actorIndex
        : state.activePlayerIndex;
    const trader = state.players[actorIdx] || getActivePlayer();
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

    let summaryText = `${trader.name} skipped the Trading Post without trading.`;
    const pCardIdx = pickNonUltIdx(partner.hand);
    const tCardIdx = pickNonUltIdx(trader.hand);

    if (tradeType === "buy_card_15") {
      if (trader.tc >= 15 && pCardIdx !== -1) {
        trader.tc -= 15;
        partner.tc += 15;
        const bought = partner.hand.splice(pCardIdx, 1)[0];
        trader.hand.push(bought);
        recordCardLossEvent(partner, bought, "stolen", {
          byIndex: trader.index,
          byName: trader.name,
          sourceLabel: "Trading Post",
          badgeLabel: `BOUGHT BY ${trader.name}`
        });
        summaryText = `${trader.name} bought 1 random card from ${partner.name} for 💰 15 TC!`;
      } else {
        summaryText = `Trade failed: ${trader.name} has less than 15 TC or ${partner.name} has no non-Ultimate cards.`;
      }
    } else if (tradeType === "sell_card_15") {
      if (partner.tc >= 15 && tCardIdx !== -1) {
        partner.tc -= 15;
        trader.tc += 15;
        const sold = trader.hand.splice(tCardIdx, 1)[0];
        partner.hand.push(sold);
        summaryText = `${trader.name} sold 1 random card to ${partner.name} and received 💰 15 TC!`;
      } else {
        summaryText = `Trade failed: ${partner.name} has less than 15 TC or ${trader.name} has no non-Ultimate cards.`;
      }
    } else if (tradeType === "swap_random_card") {
      if (tCardIdx !== -1 && pCardIdx !== -1) {
        const c1 = trader.hand.splice(tCardIdx, 1)[0];
        const c2 = partner.hand.splice(pickNonUltIdx(partner.hand), 1)[0];
        trader.hand.push(c2);
        partner.hand.push(c1);
        recordCardLossEvent(partner, c2, "stolen", {
          byIndex: trader.index,
          byName: trader.name,
          sourceLabel: "Trading Post (Swap)",
          badgeLabel: `SWAPPED WITH ${trader.name}`
        });
        summaryText = `${trader.name} swapped 1 random card (1:1) with ${partner.name}!`;
      } else {
        summaryText = `Trade failed: one of the players has no non-Ultimate cards to swap.`;
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
      btn.textContent = isAdminUnlocked ? "Admin Mode: ON" : "Admin Mode";
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
            Enter the Admin password to unlock player editing, teleport, free skill use, and +/- card tools.
          </p>
          <div class="form-field">
            <label>Admin Password:</label>
            <input type="password" id="admin-pass-input" placeholder="Enter admin password" onkeydown="if(event.key==='Enter')window.EFT_APP.submitAdminPassword()" />
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
          Admin Mode active. All editing tools, Test Tools, +/- Card, and Free Skill Use are unlocked.
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
      errEl.textContent = "Incorrect admin password.";
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
      `Admin Edit Player: ${escapeHtml(p.name)}`,
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

  function isSkillCutinOrDiceAnimActive() {
    const skillOv = document.getElementById("skill-dramatic-overlay");
    if (skillOv && skillOv.classList.contains("visible")) return true;
    const diceOv = document.getElementById("dice-roll-overlay");
    if (diceOv && diceOv.classList.contains("visible")) return true;
    return false;
  }

  function scheduleMultiplayerBotIfNeeded() {
    clearTimeout(window._mpBotTimer);
    if (!state || state.winner || isWalkingAnim || isTileEffectAnimating || tileShuffleState) return;
    if (!isMatchStarted || isTitleScreenVisible) return;
    if (state.activeMinigame) {
      scheduleDiceOfFateBotIfNeeded();
      return;
    }
    const canDriveBots =
      (isMultiplayerHost() && mp.lobby.status === "playing") ||
      mp.mode === "local";
    if (!canDriveBots) return;

    // Handle any pendingInteraction (Haste, Stage Is Mine, etc.) based on its owning player!
    if (pendingInteraction) {
      const pActor = pendingInteraction.player || getActivePlayer();
      if (!pActor || !pActor.isBot) return; // Pause Bot turn while Human resolves interaction!
      window._mpBotTimer = setTimeout(() => {
        if (
          state &&
          !state.winner &&
          !isWalkingAnim &&
          !isTileEffectAnimating &&
          !tileShuffleState &&
          pendingInteraction
        ) {
          const curP = pendingInteraction.player || getActivePlayer();
          if (curP && curP.isBot) {
            _executeBotStepInternal();
          }
        }
      }, pendingInteraction.type === "haste_reaction" ? 950 : 1200);
      return;
    }

    // Handle activeTileModal (e.g. pushed onto Versus/Trading by SAM/Bocchi) based on the affected actor!
    if (state.activeTileModal) {
      const modalActor = state.players[state.activeTileModal.actorIndex] || getActivePlayer();
      if (!modalActor || !modalActor.isBot) return; // Pause Bot turn while Human affected by tile chooses!
      window._mpBotTimer = setTimeout(() => {
        if (
          state &&
          !state.winner &&
          !isWalkingAnim &&
          !isTileEffectAnimating &&
          !tileShuffleState &&
          state.activeTileModal
        ) {
          const curActor = state.players[state.activeTileModal.actorIndex] || getActivePlayer();
          if (curActor && curActor.isBot) {
            _executeBotStepInternal();
          }
        }
      }, 1350);
      return;
    }

    const activeP = getActivePlayer();
    if (!activeP || !activeP.isBot) return;

    // Wait naturally if dramatic skill cut-in or dice roll animation is still playing
    if (isSkillCutinOrDiceAnimActive()) {
      window._mpBotTimer = setTimeout(() => {
        scheduleMultiplayerBotIfNeeded();
      }, 650);
      return;
    }

    // Natural human-like thinking tempo
    let delayMs = 1750 + Math.floor(Math.random() * 650); // 1.75s - 2.4s before skill/roll
    if (pendingInteraction) {
      delayMs = 1250 + Math.floor(Math.random() * 450); // 1.25s - 1.7s for branch/shard/scry
    } else if (state.activeTileModal) {
      delayMs = 1650 + Math.floor(Math.random() * 550); // 1.65s - 2.2s for versus/trade
    } else if (state.phaseIndex === 5) {
      delayMs = 1200 + Math.floor(Math.random() * 450); // 1.2s - 1.65s before End Turn
    }

    window._mpBotTimer = setTimeout(() => {
      if (
        state &&
        !state.winner &&
        !isWalkingAnim &&
        !isTileEffectAnimating &&
        !tileShuffleState &&
        !isSkillCutinOrDiceAnimActive() &&
        getActivePlayer()?.isBot
      ) {
        _executeBotStepInternal();
      } else if (state && !state.winner && getActivePlayer()?.isBot) {
        scheduleMultiplayerBotIfNeeded();
      }
    }, delayMs);
  }

  function _executeBotStepInternal() {
    if (!state || state.winner || isWalkingAnim || isTileEffectAnimating || tileShuffleState) return;
    isProcessingRemoteAction = true;
    try {
      if (state.activeMinigame) {
        if (state.activeMinigame.gameId && window.EFT_MINIGAMES) {
          window.EFT_MINIGAMES.nudgeBotStep();
        } else if (state.activeMinigame.status === "rolling") {
          rollDiceOfFateCurrent();
        } else {
          finishDiceOfFateMinigame();
        }
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
        if (p.type === "haste_reaction") {
          const curEntry = Array.isArray(p.reactionQueue) && p.reactionQueue[0] ? p.reactionQueue[0] : null;
          const uids = curEntry && Array.isArray(curEntry.cardUids) ? curEntry.cardUids : [];
          // Bot activates Haste card when targeted or when opponent plays Rare/Uncommon card
          const shouldReact = uids.length > 0 && Math.random() < 0.78;
          resolveHasteReaction(shouldReact ? uids[0] : null);
          return;
        }
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
        } else if (p.type === "scry_2_keep_1") {
          const rank = { Ultimate: 6, Unique: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };
          const sorted = [...(p.cards || [])].sort((a, b) => (rank[b.rarity] || 0) - (rank[a.rarity] || 0));
          resolveScryKeepChoice(sorted[0] ? sorted[0].uid : null);
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
            const taxCheck = getEmperorTaxInfo(player, c);
            if (taxCheck.owners.length > 0 && player.tc < taxCheck.totalTax) {
              return false;
            }
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
      modalCard.classList.toggle(
        "wide-popup-modal",
        modalKind === "compendium_popup" || modalKind === "rules_popup"
      );
    }
    const titleEl = document.getElementById("modal-title");
    titleEl.innerHTML = title;
    titleEl.dataset.modalKind = modalKind;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("app-modal").classList.add("open");
    document.body.classList.add("modal-open");
  }

  function openCardDetailModal(bodyHtml) {
    const modalCard = document.getElementById("app-modal-card");
    if (modalCard) {
      modalCard.classList.remove("welcome-lobby-modal", "wide-popup-modal");
      modalCard.classList.add("card-detail-modal");
    }
    const titleEl = document.getElementById("modal-title");
    titleEl.innerHTML = "";
    titleEl.dataset.modalKind = "card_detail";
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("app-modal").classList.add("open");
    document.body.classList.add("modal-open");
    if (selectedCardUid !== null) {
      selectedCardUid = null;
      renderTuckedHandAndDice();
    }
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
    document.body.classList.remove("modal-open");
    if (curKind === "card_detail" && selectedCardUid !== null) {
      selectedCardUid = null;
      renderTuckedHandAndDice();
    }
    renderPromptBar();
    scheduleAutoEndTurnIfReady();
  }

  function toggleFloatingMenu(forceState) {
    const pop = document.getElementById("floating-menu-popover");
    const btn = document.getElementById("btn-floating-menu");
    if (!pop || !btn) return;
    const willOpen = typeof forceState === "boolean" ? forceState : !pop.classList.contains("open");
    pop.classList.toggle("open", willOpen);
    btn.classList.toggle("is-open", willOpen);
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    playSfx("click");
  }

  function closeFloatingMenu(returnFocus = false) {
    const pop = document.getElementById("floating-menu-popover");
    const btn = document.getElementById("btn-floating-menu");
    if (!pop || !btn) return;
    const wasOpen = pop.classList.contains("open");
    pop.classList.remove("open");
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    if (wasOpen && returnFocus) btn.focus();
  }

  function openCompendiumModal() {
    openInfoModal(
      "Character Compendium",
      `<div class="compendium-modal-stage">
        <div id="compendium-showcase-root" class="compendium-showcase-root is-modal-mode"></div>
      </div>`,
      "compendium_popup"
    );
    renderCompendiumView();
  }

  function openRulesModal() {
    const curPatch = (state && state.patchId) || "alpha2";
    openInfoModal(
      "Official Rulebook &amp; Board Cards",
      `<div class="rules-modal-stage">
        <div class="panel-box">
          <div class="panel-header" style="flex-wrap:wrap;gap:8px;">
            <span>Official Rulebook &amp; Patch Selector</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:0.74rem;color:var(--text-muted);text-transform:none;">Active Patch:</span>
              <select id="rules-patch-select" class="btn" onchange="window.EFT_APP.changeRulesPatch(this.value)">
                <option value="alpha2"${curPatch === "alpha2" ? " selected" : ""}>Patch Alpha 2 (3 Shards / 2 Cycles, [Haste])</option>
                <option value="alpha1_2"${curPatch === "alpha1_2" ? " selected" : ""}>Patch Alpha 1.2 (Fractional Rounding Law, 9 Events)</option>
                <option value="alpha1_1"${curPatch === "alpha1_1" ? " selected" : ""}>Patch Alpha 1.1 (2x d6 System, Independent Shops)</option>
                <option value="v0_1"${curPatch === "v0_1" ? " selected" : ""}>Version 0.1 (1x d12 per Phase, Shared Global Shop)</option>
              </select>
            </div>
          </div>
          <div id="rules-patch-details"></div>
        </div>
        <div class="panel-box">
          <div class="panel-header">
            <span>Board Effect &amp; Global Event Registry (19 Cards)</span>
          </div>
          <div id="rules-board-cards-grid" class="compendium-grid"></div>
        </div>
      </div>`,
      "rules_popup"
    );
    renderRulesView();
  }

  function openSoundSettingsModal() {
    const pct = Math.round((soundPrefs.volume || 0) * 100);
    const skillPct = Math.round((soundPrefs.skillSfxVolume !== undefined ? soundPrefs.skillSfxVolume : 0.75) * 100);
    const bgmPct = Math.round((soundPrefs.bgmVolume !== undefined ? soundPrefs.bgmVolume : 0.42) * 100);

    openInfoModal(
      "Sound Settings &amp; Game Feel",
      `<div class="sound-modal-wrap">
        <div class="sound-modal-master-row" id="sound-control-pill">
          <button id="btn-sound-mute" class="sound-mute-btn" type="button" onclick="window.EFT_APP.toggleSoundMute()" aria-label="Mute or unmute sound"></button>
          <div class="sound-modal-slider-col">
            <span class="sound-modal-label">Master Sound Volume</span>
            <input id="sound-volume-slider" class="sound-volume-slider sound-modal-range" type="range" min="0" max="100" value="${pct}" aria-label="Master Sound Volume" oninput="window.EFT_APP.setSoundVolume(this.value)" />
          </div>
          <span id="sound-volume-label" class="sound-volume-label">${pct}%</span>
        </div>

        <div class="sound-modal-section">
          <label class="am-toggle-row">
            <span>Background Music (Day / Night Cycle)</span>
            <input id="bgm-toggle" type="checkbox" checked onchange="window.EFT_APP.toggleBgm(this.checked)" />
          </label>
          <div class="am-slider-row">
            <span>Music Volume</span>
            <input id="bgm-volume-slider" class="sound-volume-slider" type="range" min="0" max="100" value="${bgmPct}" oninput="window.EFT_APP.setBgmVolume(this.value)" />
            <span id="bgm-volume-label" class="sound-volume-label">${bgmPct}%</span>
          </div>
          <label class="am-toggle-row">
            <span>Camera Shake (Screen Shake)</span>
            <input id="screen-shake-toggle" type="checkbox" checked onchange="window.EFT_APP.toggleScreenShake(this.checked)" />
          </label>
          <label class="am-toggle-row">
            <span>Turn Change Alert</span>
            <span class="am-inline-ctrl">
              <button type="button" class="am-mini-test-btn" onclick="event.preventDefault();event.stopPropagation();window.EFT_APP.previewTurnChangeSfx()">Test</button>
              <input id="turn-sfx-toggle" type="checkbox" checked onchange="window.EFT_APP.toggleTurnSfx(this.checked)" />
            </span>
          </label>
          <label class="am-toggle-row">
            <span>Character Skill Card SFX</span>
            <input id="skill-sfx-toggle" type="checkbox" checked onchange="window.EFT_APP.toggleSkillSfx(this.checked)" />
          </label>
          <div class="am-slider-row">
            <span>Skill SFX Volume</span>
            <input id="skill-sfx-volume-slider" class="sound-volume-slider" type="range" min="0" max="100" value="${skillPct}" oninput="window.EFT_APP.setSkillSfxVolume(this.value)" />
            <span id="skill-sfx-volume-label" class="sound-volume-label">${skillPct}%</span>
          </div>
        </div>
      </div>`,
      "sound_settings"
    );
    syncSoundControlUi();
  }

  function openMenuPopup(section) {
    closeFloatingMenu(false);
    playSfx("click");
    if (section === "room") {
      openWelcomeSetupModal("multiplayer");
    } else if (section === "compendium") {
      openCompendiumModal();
    } else if (section === "rules") {
      openRulesModal();
    } else if (section === "guide") {
      openQuickGuideModal(0);
    } else if (section === "sound") {
      openSoundSettingsModal();
    } else if (section === "admin") {
      openAdminModal();
    }
  }

  function switchTab(tabId) {
    playSfx("click");
    closeFloatingMenu(false);
    if (tabId === "compendium") {
      openCompendiumModal();
    } else if (tabId === "rules") {
      openRulesModal();
    } else {
      closeModal();
    }
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
        ? pt.cover
          ? `<img class="ph-portrait-img is-cover" src="${pt.src}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" />`
          : `<img class="ph-portrait-img" src="${pt.src}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`
        : `<div class="ph-portrait-fallback" style="background:radial-gradient(circle at 50% 42%, ${ch.color}55 0%, #07191a 82%);"><div class="ph-fallback-icon" style="fill:${ch.color};">${getCharacterSvgIcon(cid)}</div></div>`;
      const clickAttr = isTaken ? "" : `onclick="window.EFT_APP.selectSetupChar('${cid}')"`;
      const devBadge = charBase.underDevelopment
        ? `<span class="char-pick-dev-tag">Under Dev</span>`
        : "";
      const roleText = isTaken
        ? "Picked by: " + escapeHtml(takenBy)
        : charBase.underDevelopment
        ? "Under Development"
        : escapeHtml(ch.title);

      return `
      <div class="char-pick-card ${isSel ? "selected" : ""} ${isTaken ? "taken" : ""}" ${clickAttr} title="${escapeHtml(charBase.devDisclaimer || ch.name)}">
        <div class="char-pick-thumb" style="--char-glow:${escapeHtml(ch.color || "#34d399")};">${thumbHtml}${devBadge}</div>
        <div class="char-pick-info">
          <div class="char-pick-name">${escapeHtml(ch.name)}</div>
          <div class="char-pick-role">${roleText}</div>
        </div>
      </div>`;
    });

    const lockedCards = unavailableIds.map((cid) => {
      const ch = DATA.CHARACTERS[cid];
      const isTba = Boolean(ch.tba);
      const badgeLabel = isTba ? "TBA" : "Coming Soon";
      const roleLabel = ch.origin ? `${ch.origin} · TBA` : isTba ? "TBA" : "Unavailable";
      const teaseImg = ch.menuPortrait
        ? `<img class="char-pick-menu-img is-tease" src="${ch.menuPortrait}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" />
           <span class="char-pick-tease-tag">${badgeLabel}</span>`
        : `<div class="ph-portrait-fallback" style="background:radial-gradient(circle at 50% 42%, rgba(148,163,184,0.22) 0%, #071214 82%);">
             <div class="ph-fallback-icon" style="fill:#64748b;">${getCharacterSvgIcon(cid)}</div>
           </div>`;
      return `
      <div class="char-pick-card unavailable ${isTba ? "is-tba" : ""}" title="${escapeHtml(ch.name)} (${escapeHtml(roleLabel)})">
        <div class="char-pick-thumb" style="--char-glow:${escapeHtml(ch.color || "#64748b")};">
          ${teaseImg}
        </div>
        <div class="char-pick-info">
          <div class="char-pick-name">${escapeHtml(ch.name)}</div>
          <div class="char-pick-role">${escapeHtml(roleLabel)}</div>
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
    if (field === "controlType") {
      openWelcomeSetupModal(setupDraft.tab);
    }
  }

  function selectSetupChar(charId) {
    if (DATA.CHARACTERS[charId] && DATA.CHARACTERS[charId].unavailable) return;
    setupDraft.charId = charId;
    savePlayerProfile(setupDraft.username, setupDraft.charId);
    if (mp.mode !== "local" && mp.lobby.status === "waiting") {
      if (isMultiplayerHost()) {
        const me = mp.lobby.members.find((m) => m.clientId === mp.clientId);
        const takenByHuman = mp.lobby.members.some((m) => !m.isBot && m.clientId !== mp.clientId && m.charId === charId);
        if (!takenByHuman && me) {
          const botHoldingChar = mp.lobby.members.find((m) => m.isBot && m.charId === charId);
          me.charId = charId;
          if (botHoldingChar) {
            const usedSet = new Set(mp.lobby.members.map((m) => m.charId));
            usedSet.add(charId);
            reassignLobbyBotChar(botHoldingChar, usedSet);
          }
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

  function hexColorToRgbTuple(hex) {
    const clean = String(hex || "#34d399").replace("#", "").trim();
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return "52, 211, 153";
    const num = parseInt(full, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function renderRoomLobbyV2CharGrid(compId, selectedCharId, takenMap = {}) {
    const compDef = DATA.COMPENDIUM_VERSIONS[compId] || DATA.COMPENDIUM_VERSIONS.comp_beta1;
    const playableIds = getPlayableCharacterIds(compId);
    const unavailableIds = (compDef.unavailableCharacters || []).filter((cid) => DATA.CHARACTERS[cid]);

    const activeTiles = playableIds.map((cid) => {
      const ch = getCharacterForCompendium(cid, compId);
      const base = DATA.CHARACTERS[cid] || {};
      const imgSrc = base.menuPortrait || (base.portrait && base.portrait.src) || "";
      const takenBy = takenMap[cid] || "";
      const isTaken = !!takenBy;
      const isSel = !isTaken && selectedCharId === cid;
      const color = ch.color || "#34d399";
      const rgb = hexColorToRgbTuple(color);
      const clickAttr = isTaken ? "" : `onclick="window.EFT_APP.selectSetupChar('${cid}')"`;
      const tagHtml = isTaken
        ? `<span class="rl2-char-tile-tag is-taken">${escapeHtml(takenBy)}</span>`
        : base.underDevelopment
        ? `<span class="rl2-char-tile-tag">Dev</span>`
        : "";
      const mediaHtml = imgSrc
        ? `<img class="rl2-char-tile-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" />`
        : `<div class="ph-portrait-fallback" style="width:100%;height:100%;background:radial-gradient(circle at 50% 42%, ${color}55 0%, #07191a 82%);"><div class="ph-fallback-icon" style="fill:${color};">${getCharacterSvgIcon(cid)}</div></div>`;

      return `
        <div class="rl2-char-tile ${isSel ? "is-selected" : ""} ${isTaken ? "is-locked" : ""}"
             style="--char-color:${escapeHtml(color)};--char-rgb:${rgb};"
             ${clickAttr}
             title="${escapeHtml(base.devDisclaimer || ch.name)}">
          ${mediaHtml}
          ${tagHtml}
          <div class="rl2-char-tile-bar">${escapeHtml(ch.shortName || ch.name)}</div>
        </div>`;
    });

    const lockedTiles = unavailableIds.map((cid) => {
      const ch = DATA.CHARACTERS[cid];
      const imgSrc = ch.menuPortrait || (ch.portrait && ch.portrait.src) || "";
      const badge = ch.tba ? "TBA" : "Soon";
      const mediaHtml = imgSrc
        ? `<img class="rl2-char-tile-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(ch.name)}" loading="lazy" decoding="async" />`
        : `<div class="ph-portrait-fallback" style="width:100%;height:100%;"><div class="ph-fallback-icon" style="fill:#64748b;">${getCharacterSvgIcon(cid)}</div></div>`;

      return `
        <div class="rl2-char-tile is-tba" title="${escapeHtml(ch.name)} (${escapeHtml(ch.origin ? ch.origin + " · " : "")}${badge})">
          ${mediaHtml}
          <span class="rl2-char-tile-tag">${badge}</span>
          <div class="rl2-char-tile-bar">${escapeHtml(ch.shortName || ch.name)}</div>
        </div>`;
    });

    return [...activeTiles, ...lockedTiles].join("");
  }

  function openWelcomeSetupModal(activeTab = "multiplayer", prefillRoomCode = "") {
    setupDraft.tab = "multiplayer";
    if (prefillRoomCode) mp.roomCode = prefillRoomCode.trim().toUpperCase();

    const inLobbyWaiting = mp.mode !== "local" && mp.lobby && mp.lobby.status === "waiting";
    const compId = inLobbyWaiting ? mp.lobby.compendiumId : setupDraft.compendiumId;
    const playableIds = getPlayableCharacterIds(compId);
    if (!playableIds.includes(setupDraft.charId)) {
      setupDraft.charId = playableIds[0];
    }

    if (inLobbyWaiting) {
      const takenMap = {};
      mp.lobby.members.forEach((m) => {
        if (!m.isBot && m.clientId !== mp.clientId) takenMap[m.charId] = m.username;
      });
      const me = mp.lobby.members.find((m) => m.clientId === mp.clientId);
      const isHost = isMultiplayerHost();
      const myName = (me && me.username) || (setupDraft.username || "").trim() || "Player";
      const isRoomFull = (mp.lobby.members || []).length >= 4;

      const rosterHtml = mp.lobby.members
        .map((m) => {
          const ch = getCharacterForCompendium(m.charId, compId);
          const base = DATA.CHARACTERS[m.charId] || {};
          const pColor = (ch && ch.color) || "#34d399";
          const pRgb = hexColorToRgbTuple(pColor);
          const imgSrc = base.menuPortrait || (base.portrait && base.portrait.src) || "";
          const orbClass = m.isHost ? "is-host" : m.ready ? "is-ready" : "is-not-ready";
          const orbTitle = m.isHost ? "Room Master" : m.isBot ? "Bot Ready" : m.ready ? "Ready" : "Not Ready";

          let rmControls = "";
          if (isHost && !m.isHost) {
            const notifyBtn =
              !m.isBot && !m.ready
                ? `<button type="button" class="rl2-rm-btn rl2-rm-notify" onclick="window.EFT_APP.notifyLobbyPlayer('${escapeHtml(m.clientId)}')" title="Notify player to Ready up">Notify</button>`
                : "";
            const kickLabel = m.isBot ? "Remove" : "Kick";
            const kickTitle = m.isBot ? "Remove bot from room" : "Kick player from room";
            const kickBtn = `<button type="button" class="rl2-rm-btn rl2-rm-kick" onclick="window.EFT_APP.kickLobbyPlayer('${escapeHtml(m.clientId)}')" title="${kickTitle}">${kickLabel}</button>`;
            rmControls = `<span class="rl2-rm-actions">${notifyBtn}${kickBtn}</span>`;
          }

          return `
            <div class="rl2-player-capsule" style="--p-color:${escapeHtml(pColor)};--p-rgb:${pRgb};">
              <div class="rl2-capsule-portrait">
                ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(ch ? ch.name : m.charId)}" />` : ""}
              </div>
              <div class="rl2-capsule-right">
                ${rmControls}
                <span class="rl2-capsule-name" title="${escapeHtml(m.username)} · ${escapeHtml(ch ? ch.name : m.charId)}">${escapeHtml(m.username)}</span>
                <span class="rl2-status-orb ${orbClass}" title="${orbTitle}" aria-label="${orbTitle}"></span>
              </div>
            </div>`;
        })
        .join("");

      const footerRightHtml = isHost
        ? `<div class="rl2-footer-actions">
             <button type="button" class="rl2-add-bot-btn" ${isRoomFull ? "disabled" : ""} onclick="window.EFT_APP.addLobbyBot()" title="${isRoomFull ? "Room is full (4/4)" : "Add 1 AI Bot to this room"}">+1 Bot</button>
             <button type="button" class="rl2-start-btn" onclick="window.EFT_APP.startMultiplayerMatchFromLobby()">START</button>
           </div>`
        : `<div class="rl2-wait-hint">${me && me.ready ? "Ready! Waiting for Room Master..." : "Press READY when you are set"}</div>
           <button type="button" id="rl2-ready-btn" class="rl2-start-btn ${me && me.ready ? "is-ready-active" : ""}" onclick="window.EFT_APP.toggleLobbyReady()">${
             me && me.ready ? "CANCEL READY" : "READY"
           }</button>`;

      openInfoModal(
        `Room ${escapeHtml(mp.roomCode)}`,
        `<div class="rl2-wrap">
          <div class="rl2-header">
            <div class="rl2-greeting">Hi, ${escapeHtml(myName)}</div>
            <button type="button" class="rl2-room-code-btn" onclick="window.EFT_APP.copyRoomCodeQuick()" title="Click to copy Room Code">
              Room: ${escapeHtml(mp.roomCode)}
            </button>
          </div>

          <div>
            <div class="rl2-section-label">Choose Character :</div>
            <div class="rl2-char-grid">
              ${renderRoomLobbyV2CharGrid(compId, me ? me.charId : setupDraft.charId, takenMap)}
            </div>
          </div>

          <div class="rl2-dev-note">
            <strong>Note:</strong> Mao-Mao and Firefly / SAM are playable but still under development.
          </div>

          <div>
            <div class="rl2-section-label">Players :</div>
            <div class="rl2-players-list">
              ${rosterHtml}
            </div>
          </div>

          <div class="rl2-footer">
            <div class="rl2-footer-left">
              <button type="button" class="btn btn-emerald btn-sm" onclick="window.EFT_APP.copyInviteLink()">Copy Invite Link</button>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.EFT_APP.disconnectMultiplayer()">Leave Room</button>
            </div>
            <div class="rl2-footer-right">
              ${footerRightHtml}
            </div>
          </div>
        </div>`,
        "welcome_lobby"
      );
      return;
    }

    // In-match Room Info popup (Multiplayer-only)
    const activeRoomInfoHtml =
      mp.mode !== "local" && mp.roomCode
        ? `<div class="rl2-header">
             <div class="rl2-greeting">Hi, ${escapeHtml((setupDraft.username || "Player").trim() || "Player")}</div>
             <button type="button" class="rl2-room-code-btn" onclick="window.EFT_APP.copyRoomCodeQuick()" title="Click to copy Room Code">
               Room: ${escapeHtml(mp.roomCode)}
             </button>
           </div>
           <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;">
             <div style="display:flex;gap:8px;flex-wrap:wrap;">
               <button type="button" class="btn btn-emerald btn-sm" onclick="window.EFT_APP.copyInviteLink()">Copy Invite Link</button>
               <button type="button" class="btn btn-danger btn-sm" onclick="window.EFT_APP.requestLeaveRoom()">Leave Room</button>
             </div>
             <button type="button" class="btn btn-sm" onclick="window.EFT_APP.closeModal()">Close</button>
           </div>`
        : `<div class="rl2-header">
             <div class="rl2-greeting">Multiplayer Room</div>
             <button type="button" class="btn btn-sm" onclick="window.EFT_APP.closeModal()">Close</button>
           </div>
           <div class="grid-2col setup-mp-cards">
             <div class="panel-box setup-bottom-panel">
               <div class="panel-header" style="margin-bottom:2px;">Host Game</div>
               <p style="font-size:0.76rem;color:var(--text-muted);line-height:1.45;margin:0 0 8px;">
                 Create an online room and share the room code or invite link with friends.
               </p>
               <button class="btn btn-emerald setup-action-btn" onclick="window.EFT_APP.createLobbyRoom()">Host Game</button>
             </div>
             <div class="panel-box setup-bottom-panel">
               <div class="panel-header" style="margin-bottom:2px;">Join Game</div>
               <div class="form-field">
                 <label>Room Code:</label>
                 <input type="text" id="setup-join-code" placeholder="EFT456" maxlength="6" value="${escapeHtml(mp.roomCode)}" style="text-transform:uppercase;font-weight:800;" />
               </div>
               <button class="btn btn-gold setup-action-btn" onclick="window.EFT_APP.joinLobbyRoom()">Join Room</button>
             </div>
           </div>`;

    openInfoModal(
      "Multiplayer Room",
      `<div class="rl2-wrap">${activeRoomInfoHtml}</div>`,
      "welcome_lobby"
    );
  }

  function startLocalRandomizedMatch() {
    const uname = (setupDraft.username || "").trim();
    if (!uname) {
      alert("Please enter your Username before starting the match.");
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
      const isBotSlot = (ext.controlType || "bot") === "bot";
      const cid = playableIds.includes(ext.charId)
        ? ext.charId
        : freeDefaults[i % freeDefaults.length] || playableIds[0];
      const ch = getCharacterForCompendium(cid, setupDraft.compendiumId);
      const extName =
        (ext.username || "").trim() ||
        `${ch ? ch.name : "Player"} (${isBotSlot ? "Bot" : `P${i + 2}`})`;
      roster.push({
        charId: cid,
        username: extName,
        clientId: null,
        isBot: isBotSlot
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

  const processedChatMsgIds = new Set();
  const activeChibiBubbles = {};
  let lastChatLogSig = "";

  function getLocalChatPlayerIndex() {
    if (!state || !Array.isArray(state.players) || state.players.length === 0) return 0;
    if (mp.mySeat !== -1 && state.players[mp.mySeat]) return mp.mySeat;
    if (state.seatMap && typeof state.seatMap[mp.clientId] === "number" && state.players[state.seatMap[mp.clientId]]) {
      return state.seatMap[mp.clientId];
    }
    return state.activePlayerIndex || 0;
  }

  function getPawnBoardCoords(playerIndex) {
    if (!state || !Array.isArray(state.players) || !state.players[playerIndex]) return null;
    const p = state.players[playerIndex];
    const renderTid = skillMoveAnimOverrides[playerIndex] || p.tileId;
    const tile = TILE_MAP[renderTid] || TILE_MAP.T0;
    if (!tile) return null;
    const group = [];
    state.players.forEach((pl, idx) => {
      const tid = skillMoveAnimOverrides[idx] || pl.tileId;
      if (tid === renderTid) group.push(idx);
    });
    const posInGroup = Math.max(0, group.indexOf(playerIndex));
    const spreadX = (posInGroup - (group.length - 1) / 2) * 1.45;
    return { x: tile.x + spreadX, y: tile.y };
  }

  function openInGameChatInput() {
    if (!state || isTitleScreenVisible || !isMatchStarted) return;
    const bar = document.getElementById("hud-chat-input-bar");
    const input = document.getElementById("hud-chat-input");
    if (!bar || !input) return;
    bar.classList.remove("is-hidden");
    input.focus();
  }

  function closeInGameChatInput() {
    const bar = document.getElementById("hud-chat-input-bar");
    const input = document.getElementById("hud-chat-input");
    if (input) {
      input.value = "";
      input.blur();
    }
    if (bar) bar.classList.add("is-hidden");
  }

  function submitInGameChat() {
    const input = document.getElementById("hud-chat-input");
    if (!input) return;
    const text = input.value.trim().slice(0, 120);
    closeInGameChatInput();
    if (!text || !state) return;

    if (mp.mode === "client") {
      sendClientActionToHost("chat_message", { text });
      return;
    }

    const pIdx = getLocalChatPlayerIndex();
    recordInGameChatMessage(pIdx, text);
    if (mp.mode === "host") {
      broadcastMultiplayerState();
    }
  }

  function recordInGameChatMessage(playerIndex, rawText) {
    if (!state || !Array.isArray(state.players) || !state.players[playerIndex]) return;
    const text = String(rawText || "").trim().slice(0, 120);
    if (!text) return;
    const p = state.players[playerIndex];
    if (!Array.isArray(state.chatMessages)) state.chatMessages = [];
    const msg = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerIndex,
      senderName: p.name,
      color: p.color || "#34d399",
      text,
      ts: Date.now()
    };
    state.chatMessages.push(msg);
    if (state.chatMessages.length > 24) {
      state.chatMessages = state.chatMessages.slice(-24);
    }
    syncInGameChatFromState();
  }

  function spawnChibiChatBubble(playerIndex, text, color, senderName) {
    const layer = document.getElementById("board-chat-bubbles-layer");
    if (!layer) return;
    const coords = getPawnBoardCoords(playerIndex);
    if (!coords) return;

    const prev = activeChibiBubbles[playerIndex];
    if (prev && prev.timeoutId) clearTimeout(prev.timeoutId);
    if (prev && prev.removeId) clearTimeout(prev.removeId);

    let el = layer.querySelector(`.chibi-chat-bubble[data-player-idx="${playerIndex}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "chibi-chat-bubble";
      el.setAttribute("data-player-idx", String(playerIndex));
      layer.appendChild(el);
    }

    el.classList.remove("is-fading");
    el.style.left = `${coords.x}%`;
    el.style.top = `${coords.y}%`;
    el.style.setProperty("--bubble-accent", color || "#34d399");
    el.innerHTML = `<span class="ccb-name">${escapeHtml(senderName || "")}</span><span class="ccb-text">${escapeHtml(text)}</span>`;

    const timeoutId = setTimeout(() => {
      if (el) el.classList.add("is-fading");
      const removeId = setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
        if (activeChibiBubbles[playerIndex] && activeChibiBubbles[playerIndex].timeoutId === timeoutId) {
          delete activeChibiBubbles[playerIndex];
        }
      }, 360);
      if (activeChibiBubbles[playerIndex]) activeChibiBubbles[playerIndex].removeId = removeId;
    }, 5400);

    activeChibiBubbles[playerIndex] = { text, color, senderName, timeoutId, removeId: null };
  }

  function syncChibiChatBubblePositions() {
    const layer = document.getElementById("board-chat-bubbles-layer");
    if (!layer || !state) return;
    layer.querySelectorAll(".chibi-chat-bubble[data-player-idx]").forEach((el) => {
      const idx = Number(el.getAttribute("data-player-idx"));
      const coords = getPawnBoardCoords(idx);
      if (coords) {
        el.style.left = `${coords.x}%`;
        el.style.top = `${coords.y}%`;
      }
    });
  }

  function syncInGameChatFromState() {
    if (!state) return;
    const msgs = Array.isArray(state.chatMessages) ? state.chatMessages : [];
    const logEl = document.getElementById("hud-chat-log");
    const recent = msgs.slice(-6);
    const sig = recent.map((m) => m.id).join(",");

    if (logEl && sig !== lastChatLogSig) {
      lastChatLogSig = sig;
      logEl.innerHTML = recent
        .map(
          (m) => `
        <div class="hud-chat-line">
          <span class="hud-chat-name" style="color:${escapeHtml(m.color || "#6ee7b7")};">${escapeHtml(m.senderName || "Player")}:</span>
          <span class="hud-chat-text">${escapeHtml(m.text || "")}</span>
        </div>`
        )
        .join("");
      logEl.scrollTop = logEl.scrollHeight;
    }

    const now = Date.now();
    msgs.forEach((m) => {
      if (!m || !m.id || processedChatMsgIds.has(m.id)) return;
      processedChatMsgIds.add(m.id);
      if (now - (m.ts || 0) < 12000) {
        spawnChibiChatBubble(m.playerIndex, m.text, m.color, m.senderName);
        playSfx("click");
      }
    });
  }

  // ============================================================================
  // PVE MONSTER ENGINE (THANATOS - GOD OF DEATH 1/3)
  // ============================================================================
  let lastProcessedMonsterSpawnId = null;
  let lastProcessedMonsterAlertId = null;
  let monsterTurnTimers = [];
  let monsterAlertFadeTimer = null;
  let monsterAlertHideTimer = null;

  function clearMonsterTurnTimers() {
    monsterTurnTimers.forEach((tid) => clearTimeout(tid));
    monsterTurnTimers = [];
  }

  function scheduleMonsterTimer(fn, ms) {
    const tid = setTimeout(() => {
      monsterTurnTimers = monsterTurnTimers.filter((id) => id !== tid);
      fn();
    }, ms);
    monsterTurnTimers.push(tid);
    return tid;
  }

  function clearMonsterRuntimeUi() {
    clearMonsterTurnTimers();
    clearTimeout(monsterAlertFadeTimer);
    clearTimeout(monsterAlertHideTimer);
    lastProcessedMonsterSpawnId = null;
    lastProcessedMonsterAlertId = null;
    const portalLayer = document.getElementById("board-monster-portal-layer");
    if (portalLayer) portalLayer.innerHTML = "";
    const alertEl = document.getElementById("monster-horror-alert");
    if (alertEl) {
      alertEl.classList.remove("is-visible", "is-fading", "tone-spawn", "tone-skill", "tone-death", "tone-passive");
      alertEl.innerHTML = "";
    }
  }

  function buildThanatosPortraitSvg() {
    return `
      <svg class="thanatos-placeholder-svg" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="thAura" cx="46%" cy="52%" r="54%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0.34"/>
            <stop offset="68%" stop-color="#052e16" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="140" height="120" fill="url(#thAura)"/>
        <!-- Fan of Persona 3 Thanatos Floating Coffins -->
        <g stroke="#4ade80" stroke-width="1.35" fill="#07131a">
          <polygon points="10,48 22,22 36,28 28,60 15,62" transform="rotate(-18 22 42)"/>
          <polygon points="28,12 48,4 58,20 44,44 30,36" transform="rotate(-8 42 22)"/>
          <polygon points="74,6 96,14 98,38 78,46 68,26" transform="rotate(14 84 26)"/>
          <polygon points="94,40 124,28 134,50 112,72 90,62" transform="rotate(8 112 52)"/>
          <polygon points="4,72 26,64 34,88 18,104 4,94"/>
        </g>
        <!-- Chains linking coffins -->
        <path d="M26 42 Q46 30 62 46 Q82 32 104 46" stroke="#64748b" stroke-width="2.2" stroke-dasharray="3 3" fill="none"/>
        <!-- Cloaked torso & gauntlets -->
        <path d="M36 116 C38 82, 48 68, 64 68 C80 68, 88 84, 92 116 Z" fill="#091318" stroke="#1e293b" stroke-width="1.5"/>
        <path d="M52 74 L64 90 L76 74" stroke="#22c55e" stroke-opacity="0.55" stroke-width="1.4" fill="none"/>
        <!-- Iconic Pale Bone Skull Mask -->
        <path d="M48 44 C48 30, 76 30, 76 44 L73 60 L66 68 L58 68 L51 60 Z" fill="#d6e2dd" stroke="#0f172a" stroke-width="1.6"/>
        <path d="M53 46 L60 49 L55 53 Z" fill="#020617"/>
        <path d="M71 46 L64 49 L69 53 Z" fill="#020617"/>
        <circle cx="56.5" cy="49.5" r="1.4" fill="#4ade80"/>
        <circle cx="67.5" cy="49.5" r="1.4" fill="#4ade80"/>
        <path d="M57 59 L67 59 M59 57 L59 63 M62 57 L62 64 M65 57 L65 63" stroke="#0f172a" stroke-width="1.3"/>
      </svg>`;
  }

  function buildThanatosChibiSvg() {
    return `
      <svg class="monster-chibi-svg" viewBox="0 0 110 116" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="thPawnGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="55" cy="58" r="46" fill="url(#thPawnGlow)"/>
        <!-- Orbiting Mini Coffins -->
        <g fill="#08131a" stroke="#4ade80" stroke-width="1.6">
          <polygon points="10,44 20,24 30,30 24,52 14,54"/>
          <polygon points="80,30 90,24 100,44 96,54 86,52"/>
          <polygon points="34,12 48,8 52,26 40,32 32,22"/>
          <polygon points="62,8 76,12 78,22 70,32 58,26"/>
        </g>
        <!-- Dark cloak body -->
        <path d="M35 98 C37 70, 44 62, 55 62 C66 62, 73 70, 75 98 L65 92 L55 100 L45 92 Z" fill="#060c10" stroke="#22c55e" stroke-width="1.4"/>
        <!-- Pale Skull Helmet -->
        <path d="M38 44 C38 26, 72 26, 72 44 L68 62 L60 69 L50 69 L42 62 Z" fill="#dce7e2" stroke="#020617" stroke-width="2"/>
        <path d="M44 46 L52 50 L46 55 Z" fill="#020617"/>
        <path d="M66 46 L58 50 L64 55 Z" fill="#020617"/>
        <circle cx="48" cy="50.5" r="2" fill="#4ade80"/>
        <circle cx="62" cy="50.5" r="2" fill="#4ade80"/>
        <path d="M49 60 L61 60 M52 58 L52 65 M55 58 L55 66 M58 58 L58 65" stroke="#020617" stroke-width="1.5"/>
      </svg>`;
  }

  function buildMonsterHudCardHtml() {
    if (!state || !state.activeMonster) return "";
    const m = state.activeMonster;
    const def = (DATA.MONSTERS && DATA.MONSTERS[m.id]) || {};
    const passivesHtml = (def.passives || [])
      .map((ps) => `<div class="ph-m-tip-row"><strong>${escapeHtml(ps.name)}:</strong> ${escapeHtml(ps.description)}</div>`)
      .join("");
    const skillsHtml = (def.skills || [])
      .map((sk) => `<div class="ph-m-tip-row"><strong>${escapeHtml(sk.name)}:</strong> ${escapeHtml(sk.description)}</div>`)
      .join("");
    const activeCls = state.isMonsterTurn ? "is-active" : "";
    return `
      <div class="monster-hud-card ${activeCls}" onclick="window.EFT_APP.focusCameraOnMonster()" title="Click to focus on ${escapeHtml(m.name)}">
        <div class="mh-card-clip">
          <div class="mh-portrait-col">${buildThanatosPortraitSvg()}</div>
          <div class="mh-name-col">
            <span class="mh-name">${escapeHtml(m.name)}</span>
          </div>
        </div>
        <div class="mh-hover-tooltip" role="tooltip">
          <div class="mh-tip-head">${escapeHtml(m.name)} · ${escapeHtml(m.title || "Boss Monster")} (${def.orderIndex || 1}/${def.totalRoster || 3})</div>
          <div class="mh-tip-sub">Moves with 1d${def.diceSides || 8} · Acts First Every Round</div>
          ${passivesHtml}
          ${skillsHtml}
        </div>
      </div>`;
  }

  function buildMonsterBoardPawnHtml() {
    if (!state || !state.activeMonster || !state.activeMonster.tileId) return "";
    const m = state.activeMonster;
    const tile = TILE_MAP[m.tileId];
    if (!tile) return "";
    const emergeCls = m.portalEmerging ? "is-emerging" : "";
    const activeCls = state.isMonsterTurn ? "is-monster-turn" : "";
    return `
      <div class="board-monster-pawn ${activeCls} ${emergeCls}"
           data-monster-id="${escapeHtml(m.id)}"
           style="left:${tile.x}%;top:${tile.y}%;"
           title="${escapeHtml(m.name)} (${escapeHtml(m.title || "God of Death")}) @ ${m.tileId}"
           onclick="event.stopPropagation();window.EFT_APP.focusCameraOnMonster()">
        <div class="monster-pawn-aura" aria-hidden="true"></div>
        ${buildThanatosChibiSvg()}
        <span class="monster-pawn-tag">${escapeHtml(m.name)}</span>
      </div>`;
  }

  function focusCameraOnMonster() {
    if (!state || !state.activeMonster || !state.activeMonster.tileId) return;
    camera.mode = "follow";
    focusCameraOnTile(state.activeMonster.tileId, isMobilePortrait() ? 0.78 : 1.04);
  }

  function showMonsterHorrorAlert(ev) {
    const el = document.getElementById("monster-horror-alert");
    if (!el || !ev) return;
    clearTimeout(monsterAlertFadeTimer);
    clearTimeout(monsterAlertHideTimer);

    const tone = ev.tone || "skill";
    const title = ev.title || "THANATOS";
    const subtitle = ev.subtitle || "GOD OF DEATH";
    const detail = ev.detail || "";

    el.classList.remove("is-visible", "is-fading", "tone-spawn", "tone-skill", "tone-death", "tone-passive");
    el.innerHTML = `
      <div class="mha-whisper">${escapeHtml(subtitle)}</div>
      <div class="mha-headline" data-text="${escapeHtml(title)}">${escapeHtml(title)}</div>
      ${detail ? `<div class="mha-detail">${escapeHtml(detail)}</div>` : ""}
    `;
    void el.offsetWidth;
    el.classList.add("is-visible", `tone-${tone}`);
    playSfx(tone === "spawn" ? "monster_portal" : "monster_skill");

    const holdMs = tone === "spawn" || tone === "death" ? 3200 : 2650;
    monsterAlertFadeTimer = setTimeout(() => {
      el.classList.add("is-fading");
    }, holdMs);
    monsterAlertHideTimer = setTimeout(() => {
      el.classList.remove("is-visible", "is-fading", `tone-${tone}`);
      el.innerHTML = "";
    }, holdMs + 650);
  }

  function triggerMonsterHorrorAlert(title, subtitle, detail, tone = "skill") {
    if (!state) return;
    const ev = {
      id: `ma_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      subtitle,
      detail,
      tone,
      ts: Date.now()
    };
    state.lastMonsterAlertEvent = ev;
    lastProcessedMonsterAlertId = ev.id;
    showMonsterHorrorAlert(ev);
    broadcastMultiplayerState();
  }

  function playMonsterPortalSpawnAnim(spawnEv) {
    if (!spawnEv || !spawnEv.tileId) return;
    const tile = TILE_MAP[spawnEv.tileId];
    const layer = document.getElementById("board-monster-portal-layer");
    if (!tile || !layer) return;

    camera.mode = "follow";
    focusCameraOnTile(spawnEv.tileId, isMobilePortrait() ? 0.84 : 1.12);
    addCameraTrauma(0.55);
    playSfx("monster_portal");

    const portalId = `mp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const node = document.createElement("div");
    node.className = "monster-spawn-portal";
    node.id = portalId;
    node.style.left = `${tile.x}%`;
    node.style.top = `${tile.y}%`;
    node.innerHTML = `
      <div class="msp-void-rift"></div>
      <div class="msp-outer-clock"></div>
      <div class="msp-inner-sigil"></div>
      <div class="msp-coffin-ring"><span></span><span></span><span></span><span></span><span></span><span></span></div>
      <div class="msp-mist-pillar"></div>
      <div class="msp-shockwave"></div>
    `;
    layer.appendChild(node);

    setTimeout(() => {
      node.classList.add("is-closing");
    }, 2050);
    setTimeout(() => {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 2650);
  }

  function pickMonsterSpawnTile() {
    const candidates = DATA.BOARD_TILES.filter(
      (t) => t.id !== "T0" && t.type !== "intersect" && !t.offTrack
    );
    if (candidates.length === 0) return "T1";
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.id;
  }

  function getMonsterNextTile(monster) {
    if (!monster || !monster.tileId) return "T1";
    const curTile = TILE_MAP[monster.tileId];
    if (!curTile) return "T1";
    let nextIds = Array.isArray(curTile.next) ? [...curTile.next] : [];
    const resolved = [];
    const pushResolved = (tid) => {
      const t = TILE_MAP[tid];
      if (!t) return;
      if (t.type === "intersect" && Array.isArray(t.next)) {
        t.next.forEach((nt) => {
          if (nt !== monster.tileId && nt !== "T0") resolved.push(nt);
        });
      } else if (tid !== "T0") {
        resolved.push(tid);
      }
    };
    nextIds.forEach(pushResolved);
    if (resolved.length === 0) {
      const adj = (ADJ_MAP[monster.tileId] || []).filter((id) => id !== monster.prevTileId && id !== "T0");
      adj.forEach(pushResolved);
    }
    if (resolved.length === 0) return "T1";
    return resolved[Math.floor(Math.random() * resolved.length)];
  }

  function spawnCycleMonster(monsterId = "thanatos", opts = {}) {
    if (!state) return;
    const def = (DATA.MONSTERS && DATA.MONSTERS[monsterId]) || null;
    if (!def) return;
    clearMonsterTurnTimers();

    const spawnTileId = opts.tileId || pickMonsterSpawnTile();
    state.activeMonster = {
      id: def.id,
      name: def.name,
      title: def.title,
      color: def.color,
      colorRgb: def.colorRgb,
      textColor: def.textColor || def.color,
      tileId: spawnTileId,
      prevTileId: null,
      lastDirection: 1,
      spawnedCycle: state.cycle,
      portalEmerging: true
    };
    state.isMonsterTurn = true;

    const spawnEv = {
      id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      monsterId: def.id,
      name: def.name,
      title: def.title,
      tileId: spawnTileId,
      ts: Date.now()
    };
    state.lastMonsterSpawnEvent = spawnEv;
    lastProcessedMonsterSpawnId = spawnEv.id;

    const spawnTile = TILE_MAP[spawnTileId];
    addLog(`DARK HOUR: ${def.name} (${def.title}) tore open a portal at ${spawnTile ? spawnTile.name : spawnTileId} (${spawnTileId}) and claims the first turn!`);
    playMonsterPortalSpawnAnim(spawnEv);
    triggerMonsterHorrorAlert(
      "THANATOS",
      "GOD OF DEATH HAS ARRIVED",
      `A portal tore open at ${spawnTile ? spawnTile.name : spawnTileId}. Death walks first.`,
      "spawn"
    );
    renderAll();
    broadcastMultiplayerState();

    scheduleMonsterTimer(() => {
      if (!state || !state.activeMonster) return;
      state.activeMonster.portalEmerging = false;
      renderAll();
      broadcastMultiplayerState();
      if (opts.startTurnAfterSpawn !== false && !isRemoteClient()) {
        runMonsterTurn();
      }
    }, 2350);
  }

  function runMonsterTurn() {
    if (!state || !state.activeMonster || state.winner) {
      finishMonsterTurn();
      return;
    }
    if (isRemoteClient()) return;

    clearMonsterTurnTimers();
    state.isMonsterTurn = true;
    const monster = state.activeMonster;
    const curRound = state.roundInCycle || 1;
    camera.mode = "follow";
    focusCameraOnTile(monster.tileId, isMobilePortrait() ? 0.78 : 1.0);
    renderAll();
    broadcastMultiplayerState();

    const activePool = state.players.filter((p) => !p.hasLeftRoom);
    const targets = activePool.length > 0 ? activePool : state.players;

    // Skill 1 - Death Whisper (Round 2 & Round 4): random player [Cursed] for 1 round
    if (monster.id === "thanatos" && (curRound === 2 || curRound === 4) && targets.length > 0) {
      const victim = targets[Math.floor(Math.random() * targets.length)];
      victim.cursedRounds = Math.max(victim.cursedRounds || 0, 1);
      addLog(`Thanatos cast [Death Whisper] on ${victim.name} -> Inflicted [Cursed] for 1 round (cannot obtain TC)!`);
      if (victim.tileId && window.EFT_WEBGL_VFX) {
        window.EFT_WEBGL_VFX.burstAtTile(victim.tileId, "debuff", "#22c55e");
      }
      focusCameraOnTile(victim.tileId, isMobilePortrait() ? 0.78 : 1.0);
      triggerMonsterHorrorAlert(
        "DEATH WHISPER",
        "THANATOS · GOD OF DEATH",
        `${victim.name} is Cursed for 1 round. No TC can be obtained.`,
        "skill"
      );
      renderAll();
      broadcastMultiplayerState();
      scheduleMonsterTimer(() => rollMonster1d8AndWalk(), 2050);
      return;
    }

    // Skill 2 - I Am Death (Round 3): highest TC player [Cursed] + teleported to Thanatos
    if (monster.id === "thanatos" && curRound === 3 && targets.length > 0) {
      const maxTc = Math.max(...targets.map((p) => p.tc || 0));
      const topTargets = targets.filter((p) => (p.tc || 0) === maxTc);
      const victim = topTargets[Math.floor(Math.random() * topTargets.length)];
      victim.cursedRounds = Math.max(victim.cursedRounds || 0, 1);
      victim.inSpawn = false;
      victim.lastTileId = victim.tileId;
      victim.tileId = monster.tileId;
      addLog(`Thanatos cast [I Am Death] on ${victim.name} (Highest TC: ${victim.tc}) -> Inflicted [Cursed] and dragged them to ${monster.tileId}!`);
      addCameraTrauma(0.5);
      if (monster.tileId && window.EFT_WEBGL_VFX) {
        window.EFT_WEBGL_VFX.burstAtTile(monster.tileId, "debuff", "#22c55e");
      }
      focusCameraOnTile(monster.tileId, isMobilePortrait() ? 0.8 : 1.06);
      triggerMonsterHorrorAlert(
        "I AM DEATH",
        "THANATOS · GOD OF DEATH",
        `${victim.name} (Highest TC) is Cursed and dragged to Thanatos.`,
        "death"
      );
      renderAll();
      broadcastMultiplayerState();
      scheduleMonsterTimer(() => rollMonster1d8AndWalk(), 2250);
      return;
    }

    scheduleMonsterTimer(() => rollMonster1d8AndWalk(), 700);
  }

  function rollMonster1d8AndWalk() {
    if (!state || !state.activeMonster || state.winner) {
      finishMonsterTurn();
      return;
    }
    const monster = state.activeMonster;
    const def = (DATA.MONSTERS && DATA.MONSTERS[monster.id]) || {};
    const sides = def.diceSides || 8;
    const roll = Math.floor(Math.random() * sides) + 1;
    addLog(`${monster.name} rolled 1d${sides}: [${roll}] (${roll} steps).`);

    const diceEvId = `dr_m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    state.lastDiceRollEvent = {
      id: diceEvId,
      playerName: monster.name,
      rolls: [roll],
      rawTotal: roll,
      totalSteps: roll,
      direction: 1,
      sides,
      isForced: false,
      ts: Date.now()
    };
    lastShownDiceRollEventId = diceEvId;
    focusCameraOnTile(monster.tileId, isMobilePortrait() ? 0.78 : 1.0);
    renderAll();
    broadcastMultiplayerState();

    playDiceRollAnimation(
      {
        player: { name: monster.name },
        rolls: [roll],
        rawTotal: roll,
        totalSteps: roll,
        direction: 1,
        sides,
        isForced: false
      },
      () => {
        stepMonsterForward(roll, new Set());
      }
    );
  }

  function stepMonsterForward(stepsRemaining, coffinHitSet) {
    if (!state || !state.activeMonster || state.winner || stepsRemaining <= 0) {
      scheduleMonsterTimer(() => finishMonsterTurn(), 520);
      return;
    }
    const monster = state.activeMonster;
    const nextTileId = getMonsterNextTile(monster);
    monster.prevTileId = monster.tileId;
    monster.tileId = nextTileId;
    const stepsLeft = stepsRemaining - 1;
    activeStepsRemaining = stepsLeft;
    isWalkingAnim = stepsLeft > 0;
    playSfx("step");

    const stepEvId = `ws_m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    state.lastWalkStepEvent = {
      id: stepEvId,
      isMonster: true,
      tileId: nextTileId,
      stepsLeft,
      ts: Date.now()
    };
    lastProcessedWalkStepId = stepEvId;

    if (camera.mode === "follow") {
      focusCameraOnTile(nextTileId);
    }

    // Passive 1 - Coffin's Door: Every time Thanatos passes a player, they lose 1 card
    if (monster.id === "thanatos") {
      state.players.forEach((p) => {
        if (p.inSpawn || p.tileId !== nextTileId || coffinHitSet.has(p.index)) return;
        coffinHitSet.add(p.index);
        const disc = discardRandomCards(p, 1, { kind: "discard", sourceLabel: "Coffin's Door (Thanatos)" });
        addLog(`Coffin's Door (Thanatos): Passed ${p.name} -> ${p.name} lost ${disc.length} card(s)!`);
        triggerMonsterHorrorAlert(
          "COFFIN'S DOOR",
          "THANATOS · PASSIVE",
          `${p.name} crossed Thanatos's path and lost ${disc.length} card.`,
          "passive"
        );
      });
    }

    renderAll();
    broadcastMultiplayerState();

    if (stepsLeft > 0) {
      scheduleMonsterTimer(() => stepMonsterForward(stepsLeft, coffinHitSet), 340);
    } else {
      scheduleMonsterTimer(() => finishMonsterTurn(), 560);
    }
  }

  function finishMonsterTurn() {
    if (!state) return;
    state.isMonsterTurn = false;
    isWalkingAnim = false;
    activeStepsRemaining = 0;
    state.activePlayerIndex = 0;
    startPlayerTurn(getActivePlayer());
    if (camera.mode !== "wide") {
      camera.mode = "follow";
      focusCameraOnTile(getActivePlayer().tileId);
    }
    renderAll();
    broadcastMultiplayerState();
  }

  function triggerManualMonsterSpawn() {
    if (!isAdminUnlocked) {
      openAdminModal();
      return;
    }
    spawnCycleMonster("thanatos", { startTurnAfterSpawn: true });
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
    toggleFloatingMenu,
    closeFloatingMenu,
    openMenuPopup,
    openCompendiumModal,
    openRulesModal,
    openSoundSettingsModal,
    toggleBgm,
    setBgmVolume,
    sortMyHand,
    openInGameChatInput,
    closeInGameChatInput,
    submitInGameChat,
    focusCameraOnMonster,
    triggerManualMonsterSpawn,
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
    confirmQuickDragPick,
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
    openLastUsedCardModal,
    openScryPickModal,
    resolveScryKeepChoice,
    openHasteReactionModal,
    resolveHasteReaction,
    resolveForcedAllInChoice,
    rollDiceOfFateCurrent,
    finishDiceOfFateMinigame,
    dismissSkillPopup,
    dismissSideCardPopup,
    resolveEmperorTaxPrompt,
    onTileEffectOverlayClick,
    dismissTileEffectOverlay,
    toggleSoundMute,
    setSoundVolume,
    toggleAudioMixerPopover,
    toggleScreenShake,
    toggleTurnSfx,
    openQuickGuideModal,
    resumeSavedLocalMatch,
    reconnectSavedMultiplayerSession,
    dismissSavedSessions,
    toggleSkillSfx,
    setSkillSfxVolume,
    toggleCharacterSkillSfx,
    previewCharacterSkillSfx,
    previewTurnChangeSfx,
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
    addLobbyBot,
    startMultiplayerMatchFromLobby,
    startFirebaseHostRoom,
    joinFirebaseClientRoom,
    disconnectMultiplayer,
    copyInviteLink: () => {
      if (!mp.roomCode) return;
      const baseUrl = window.location.origin + window.location.pathname;
      const inviteUrl = `${baseUrl}?room=${encodeURIComponent(mp.roomCode)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
          alert(`Invite link copied:\n${inviteUrl}\n\nShare this link with your friends!`);
        });
      } else {
        prompt("Copy this Invite Link for your friends:", inviteUrl);
      }
    },
    openNewMatchSetupModal,
    setCameraMode,
    focusCameraOnPlayer,
    requestMobileLandscapeFullscreen,
    toggleMobileFullscreen,
    cancelPendingInteraction: () => {
      if (!canLocalPlayerAct()) return;
      pendingInteraction = null;
      hoveredBranchTileId = null;
      renderAll();
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
      runClashOfFateMinigame("Manual Minigame (FFA)");
    },
    triggerManualVersusMinigame: () => {
      if (!isAdminUnlocked) {
        openAdminModal();
        return;
      }
      if (!state || !state.players || state.players.length < 2) return;
      saveSnapshot();
      const challenger = getActivePlayer();
      const opponent = state.players.find((p) => p.index !== challenger.index);
      if (!opponent) return;
      startRandomMinigame("versus", {
        reasonTitle: "Manual Versus Duel · Wager 💰 15 TC",
        afterAction: "versus_wager",
        challengerIndex: challenger.index,
        opponentIndex: opponent.index,
        wager: 15
      });
    },
    startRandomMinigame,
    requestLeaveRoom,
    confirmLeaveRoom,
    submitTitleUsername,
    editTitleUsername,
    toggleTitlePlayMenu,
    toggleTitleJoinCode,
    onTitleJoinCodeInput,
    hostGameFromTitle,
    submitTitleJoinCode,
    kickLobbyPlayer,
    notifyLobbyPlayer,
    copyRoomCodeQuick
  };

  window.addEventListener("DOMContentLoaded", () => {
    // Graceful fallback: if a .webp asset has not been generated locally yet, fall back to .png
    document.addEventListener(
      "error",
      (ev) => {
        const el = ev.target;
        if (el && el.tagName === "IMG" && !el.dataset.webpFallbackTried) {
          const curSrc = el.getAttribute("src") || "";
          if (/\.webp(\?.*)?$/i.test(curSrc)) {
            el.dataset.webpFallbackTried = "1";
            el.src = curSrc.replace(/\.webp(\?.*)?$/i, ".png$1");
          }
        }
      },
      true
    );

    if (window.EFT_MINIGAMES && typeof window.EFT_MINIGAMES.init === "function") {
      window.EFT_MINIGAMES.init({
        getState: () => state,
        getData: () => DATA,
        isRemoteClient,
        isMultiplayerHost,
        getMpInfo: () => ({ mode: mp.mode, mySeat: mp.mySeat }),
        escapeHtml,
        getCharacterSvgIcon,
        playSfx,
        modifyPlayerTC,
        addLog,
        renderAll,
        broadcastMultiplayerState,
        sendClientActionToHost,
        onMinigameClosed,
        onRealPlayerAction: () => markRoomRealPlayerActivity(true)
      });
    }
    const verCorner = document.getElementById("mts-version-corner");
    if (verCorner && window.EFT_VERSION && window.EFT_VERSION.version) {
      verCorner.textContent = window.EFT_VERSION.version;
      verCorner.title = `Upload #${window.EFT_VERSION.uploadCount || 1}`;
    }
    syncAdminUiState();
    syncSoundControlUi();
    setupBoardDragAndZoom();
    setupHandCardDragGestures();
    if (window.EFT_WEBGL_VFX && typeof window.EFT_WEBGL_VFX.init === "function") {
      window.EFT_WEBGL_VFX.init(
        document.getElementById("board-viewport"),
        BOARD_W,
        BOARD_H,
        () => camera,
        () => TILE_MAP
      );
    }
    initGame("alpha2", "comp_beta1", ["bocchi", "aventurine", "lilith", "joker"]);
    renderTitleResumeSlot();

    document.addEventListener(
      "pointerdown",
      (ev) => {
        ensureAudioCtx(true);
        const menuAnchor = document.getElementById("hud-floating-menu-anchor");
        const menuPop = document.getElementById("floating-menu-popover");
        if (menuPop && menuPop.classList.contains("open") && menuAnchor && !menuAnchor.contains(ev.target)) {
          closeFloatingMenu(false);
        }
        const audioPill = document.getElementById("sound-control-pill");
        const audioPop = document.getElementById("audio-mixer-popover");
        if (audioPop && audioPop.classList.contains("open") && audioPill && !audioPill.contains(ev.target)) {
          audioPop.classList.remove("open");
        }
        if (selectedCardUid !== null && ev.target && typeof ev.target.closest === "function" && !ev.target.closest(".tucked-card")) {
          selectedCardUid = null;
          renderTuckedHandAndDice();
        }
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
      if (state && state.activeMinigame && window.EFT_MINIGAMES && window.EFT_MINIGAMES.handleKeyDown(e)) {
        return;
      }
      if (e.key === "Enter") {
        const activeEl = document.activeElement;
        const isTyping =
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable);
        const modal = document.getElementById("app-modal");
        const modalOpen = modal && modal.classList.contains("open");
        const chatBar = document.getElementById("hud-chat-input-bar");
        const chatOpen = chatBar && !chatBar.classList.contains("is-hidden");
        if (!isTyping && !modalOpen && !chatOpen && !isTitleScreenVisible && isMatchStarted && state && !state.activeMinigame) {
          e.preventDefault();
          openInGameChatInput();
          return;
        }
      }
      if (e.key === "Escape") {
        const chatBar = document.getElementById("hud-chat-input-bar");
        if (chatBar && !chatBar.classList.contains("is-hidden")) {
          closeInGameChatInput();
          return;
        }
        const menuPop = document.getElementById("floating-menu-popover");
        if (menuPop && menuPop.classList.contains("open")) {
          closeFloatingMenu(true);
        }
        const audioPop = document.getElementById("audio-mixer-popover");
        if (audioPop && audioPop.classList.contains("open")) {
          audioPop.classList.remove("open");
        }
        document.querySelectorAll(".floating-drawer.open").forEach((dr) => dr.classList.remove("open"));
        const sideFeed = document.getElementById("card-activated-feed");
        if (sideFeed && sideFeed.classList.contains("visible")) {
          dismissSideCardPopup();
        }
        const modal = document.getElementById("app-modal");
        const titleEl = document.getElementById("modal-title");
        const isLockedWelcome = titleEl && titleEl.dataset && titleEl.dataset.modalKind === "welcome_lobby" && !isMatchStarted;
        if (modal && modal.classList.contains("open") && !isLockedWelcome) {
          closeModal();
        }
        const ov = document.getElementById("skill-dramatic-overlay");
        if (ov && ov.classList.contains("visible")) {
          dismissSkillPopup(true);
        }
        if (tileShuffleState && tileShuffleState.phase === "revealed") {
          dismissTileEffectOverlay(true);
        }
      }
    });

    const handleViewportReflow = () => {
      if (!state) return;
      invalidateHudCache();
      renderTuckedHandAndDice();
      if (document.getElementById("comp-strip-track")) updateCompendiumScrollControls();
      if (camera.mode === "follow") focusCameraOnTile(getActivePlayer().tileId);
      if (window.EFT_WEBGL_VFX) window.EFT_WEBGL_VFX.resize();
    };

    window.addEventListener("resize", handleViewportReflow);
    window.addEventListener("orientationchange", () => {
      setTimeout(handleViewportReflow, 160);
    });

    runInitialAssetPreload(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get("room");
        if (roomParam) {
          const cleanRoom = roomParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
          if (cleanRoom) {
            pendingInviteRoomCode = cleanRoom;
          }
        }
      } catch (e) {}
    });
  });
})();
