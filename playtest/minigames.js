(function () {
  "use strict";

  // ============================================================================
  // ESCAPE FROM TARTARUS — MODULAR MINIGAME RANDOMIZER & FAST MINIGAMES ENGINE
  // ============================================================================
  // Supports:
  //   - Versus Tile (1v1): Gunting Batu Kertas, Dice Of Fate, Quick Draw, Heads or Tail
  //   - End-of-Round (FFA): Rebutan Peti (Split or Bust), Dice Of Fate, Blackjack
  //   - Spin Wheel Randomizer with anti-repeat memory
  //   - Intro screen (2.5s), Gameplay with timer + auto-action + Bot AI, Result screen
  //   - Local (Solo vs Bots / Hotseat) & Multiplayer (Host-Authoritative) sync
  // ============================================================================

  const WHEEL_DURATION_MS = 2550;
  const WHEEL_SETTLE_MS = 550;
  const INTRO_DURATION_MS = 2600;
  const RESULT_AUTO_CLOSE_MS = 5200;
  const FFA_MAX_TC_REWARD = 45;

  let hostApi = null;
  const registry = Object.create(null);
  const pools = {
    versus: [],
    ffa: []
  };

  // Runtime timers (kept strictly outside state so state remains 100% JSON-serializable)
  let runtimeTickId = null;
  let localUiTimerId = null;
  let wheelAudioTimers = [];
  let dofRollAnimInterval = null;
  let lastShownDofRollEventId = null;
  let lastAnimatedWheelId = null;
  let lastAnimatedCoinKey = null;
  let localTimerAnchor = {
    token: "",
    remainingMs: 0,
    durationMs: 1,
    receivedAt: 0
  };
  let localFireSeenKey = "";
  let localFireSeenAt = 0;

  // ----------------------------------------------------------------------------
  // PUBLIC REGISTRY API (Easy to add new minigames!)
  // ----------------------------------------------------------------------------
  function registerMinigame(def) {
    if (!def || !def.id) return;
    registry[def.id] = def;
    const modes = Array.isArray(def.modes) ? def.modes : [];
    modes.forEach((m) => {
      if (!pools[m]) pools[m] = [];
      if (!pools[m].includes(def.id)) pools[m].push(def.id);
    });
  }

  function getPool(mode) {
    const ids = pools[mode] || [];
    return ids.map((id) => registry[id]).filter(Boolean);
  }

  function getMinigameDef(id) {
    return registry[id] || null;
  }

  function init(api) {
    hostApi = api;
  }

  // ----------------------------------------------------------------------------
  // UTILITY HELPERS
  // ----------------------------------------------------------------------------
  function esc(str) {
    return hostApi && hostApi.escapeHtml ? hostApi.escapeHtml(str) : String(str ?? "");
  }

  function playSfx(type, variant) {
    if (hostApi && hostApi.playSfx) hostApi.playSfx(type, variant);
  }

  function getState() {
    return hostApi && hostApi.getState ? hostApi.getState() : null;
  }

  function getData() {
    return hostApi && hostApi.getData ? hostApi.getData() : window.EFT_DATA || {};
  }

  function isRemoteClient() {
    return !!(hostApi && hostApi.isRemoteClient && hostApi.isRemoteClient());
  }

  function getMpInfo() {
    return hostApi && hostApi.getMpInfo ? hostApi.getMpInfo() : { mode: "local", mySeat: -1 };
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function canLocalControlSeat(mg, seatIndex) {
    if (!mg) return false;
    const entry = mg.entries.find((e) => e.playerIndex === seatIndex);
    if (!entry) return false;
    const mp = getMpInfo();
    if (mp.mode !== "local" && mp.mySeat !== -1) {
      return mp.mySeat === seatIndex;
    }
    return !entry.isBot;
  }

  function getLocalControllableEntries(mg) {
    if (!mg) return [];
    const mp = getMpInfo();
    if (mp.mode !== "local" && mp.mySeat !== -1) {
      const mine = mg.entries.find((e) => e.playerIndex === mp.mySeat);
      return mine ? [mine] : [];
    }
    return mg.entries.filter((e) => !e.isBot);
  }

  function buildPortraitHtml(entry, imgClass = "dof-portrait-img") {
    const DATA = getData();
    const ch = (DATA.CHARACTERS && DATA.CHARACTERS[entry.charId]) || {};
    const pt = ch.portrait || null;
    if (pt && pt.src) {
      return `<img class="${imgClass}" src="${pt.src}" alt="${esc(entry.name)}" style="width:${pt.widthPct}%;left:${pt.leftPct}%;top:${pt.topPct}%;" />`;
    }
    const svg = hostApi && hostApi.getCharacterSvgIcon ? hostApi.getCharacterSvgIcon(entry.charId) : "";
    return `<div class="ph-portrait-fallback"><div class="ph-fallback-icon" style="fill:${esc(entry.color)};">${svg}</div></div>`;
  }

  // ----------------------------------------------------------------------------
  // TIMER MANAGEMENT (CLOCK-SKEW SAFE)
  // ----------------------------------------------------------------------------
  function setPhaseTimer(mg, durationMs) {
    const dur = Math.max(200, Math.round(durationMs));
    const now = Date.now();
    mg.timerToken = "tm_" + now + "_" + Math.random().toString(36).slice(2, 6);
    mg.timerDurationMs = dur;
    mg.timerRemainingMs = dur;
    mg._hostDeadlineAt = now + dur;
    localTimerAnchor = {
      token: mg.timerToken,
      remainingMs: dur,
      durationMs: dur,
      receivedAt: now
    };
  }

  function clearPhaseTimer(mg) {
    mg.timerToken = "";
    mg.timerDurationMs = 0;
    mg.timerRemainingMs = 0;
    mg._hostDeadlineAt = 0;
  }

  function getHostRemainingMs(mg, now = Date.now()) {
    if (!mg || !mg._hostDeadlineAt) return 0;
    return Math.max(0, mg._hostDeadlineAt - now);
  }

  function getDisplayRemainingMs(mg) {
    if (!mg || !mg.timerToken || !mg.timerDurationMs) return 0;
    if (!isRemoteClient() && mg._hostDeadlineAt) {
      return Math.max(0, mg._hostDeadlineAt - Date.now());
    }
    if (localTimerAnchor.token !== mg.timerToken) {
      localTimerAnchor = {
        token: mg.timerToken,
        remainingMs: Math.max(0, mg.timerRemainingMs || 0),
        durationMs: Math.max(1, mg.timerDurationMs || 1),
        receivedAt: Date.now()
      };
    }
    const elapsed = Math.max(0, Date.now() - localTimerAnchor.receivedAt);
    return Math.max(0, localTimerAnchor.remainingMs - elapsed);
  }

  function syncAndBroadcast(mg, renderNow = true) {
    if (mg && mg._hostDeadlineAt && !isRemoteClient()) {
      mg.timerRemainingMs = Math.max(0, mg._hostDeadlineAt - Date.now());
    }
    if (renderNow && hostApi && hostApi.renderAll) {
      hostApi.renderAll();
    }
    if (hostApi && hostApi.broadcastMultiplayerState) {
      hostApi.broadcastMultiplayerState();
    }
  }

  function clearAllTimers() {
    if (runtimeTickId) {
      clearInterval(runtimeTickId);
      runtimeTickId = null;
    }
    if (localUiTimerId) {
      clearInterval(localUiTimerId);
      localUiTimerId = null;
    }
    if (dofRollAnimInterval) {
      clearInterval(dofRollAnimInterval);
      dofRollAnimInterval = null;
    }
    wheelAudioTimers.forEach((t) => clearTimeout(t));
    wheelAudioTimers = [];
    lastAnimatedWheelId = null;
    lastAnimatedCoinKey = null;
    localFireSeenKey = "";
    localFireSeenAt = 0;
  }

  function ensureRuntimeLoops() {
    if (!localUiTimerId) {
      localUiTimerId = setInterval(updateLiveTimerDom, 100);
    }
    if (!isRemoteClient() && !runtimeTickId) {
      runtimeTickId = setInterval(hostRuntimeTick, 100);
    }
  }

  function updateLiveTimerDom() {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg) {
      if (localUiTimerId) {
        clearInterval(localUiTimerId);
        localUiTimerId = null;
      }
      return;
    }
    const remMs = getDisplayRemainingMs(mg);
    const durMs = Math.max(1, mg.timerDurationMs || 1);
    const pct = Math.max(0, Math.min(100, (remMs / durMs) * 100));
    const sec = Math.ceil(remMs / 1000);

    const chip = document.getElementById("mg-timer-chip");
    if (chip) {
      const txt = chip.querySelector("#mg-timer-text");
      if (txt) {
        if (mg.timerToken) {
          txt.textContent = `${sec}d`;
        } else if (mg.gameId === "quick_draw" && mg.phase === "playing" && mg.data && (mg.data.subPhase === "wait" || mg.data.subPhase === "fake")) {
          txt.textContent = "SIAGA";
        } else {
          txt.textContent = "--";
        }
      }
      chip.classList.toggle("is-warning", !!mg.timerToken && sec <= 5 && sec > 2);
      chip.classList.toggle("is-critical", !!mg.timerToken && sec <= 2);
    }
    const bar = document.getElementById("mg-timer-bar-fill");
    if (bar) {
      bar.style.width = mg.timerToken ? `${pct}%` : "0%";
      bar.classList.toggle("is-critical", !!mg.timerToken && sec <= 2);
    }
    const introCd = document.getElementById("mg-intro-cd");
    if (introCd && mg.phase === "intro") {
      introCd.textContent = `Dimulai dalam ${Math.max(1, sec)}...`;
    }
    const resCd = document.getElementById("mg-result-cd");
    if (resCd && mg.phase === "result") {
      resCd.textContent = `Kembali ke papan dalam ${Math.max(1, sec)} detik...`;
    }
  }

  // ----------------------------------------------------------------------------
  // RANDOMIZER LAUNCH & PHASE TRANSITIONS
  // ----------------------------------------------------------------------------
  function pickMinigameFromPool(mode, forcedGameId = null) {
    const state = getState();
    const pool = getPool(mode);
    if (pool.length === 0) return null;
    if (forcedGameId) {
      const exact = pool.find((g) => g.id === forcedGameId);
      if (exact) return exact;
    }
    const history = (state && state.minigameHistory) || {};
    const lastId = history[mode] || null;
    const candidates = pool.length > 1 && lastId ? pool.filter((g) => g.id !== lastId) : pool;
    const chosen = pickRandom(candidates);
    if (state) {
      if (!state.minigameHistory) state.minigameHistory = { versus: null, ffa: null };
      state.minigameHistory[mode] = chosen.id;
    }
    return chosen;
  }

  function startRandomMinigame(mode = "ffa", opts = {}) {
    const state = getState();
    if (!state) return;
    clearAllTimers();

    const pool = getPool(mode);
    const chosen = pickMinigameFromPool(mode, opts.forcedGameId || null);
    if (!chosen) return;

    const DATA = getData();
    let participantIndices = [];
    if (mode === "versus") {
      const cIdx = typeof opts.challengerIndex === "number" ? opts.challengerIndex : state.activePlayerIndex;
      const oIdx = typeof opts.opponentIndex === "number" ? opts.opponentIndex : (cIdx + 1) % state.players.length;
      participantIndices = [cIdx, oIdx];
    } else {
      participantIndices = state.players.map((p) => p.index);
    }

    const entries = participantIndices
      .map((idx) => state.players[idx])
      .filter(Boolean)
      .map((p) => {
        const ch = (DATA.CHARACTERS && DATA.CHARACTERS[p.charId]) || {};
        return {
          playerIndex: p.index,
          name: p.name,
          charName: p.charName || ch.name || p.name,
          charId: p.charId,
          color: p.color || ch.color || "#34d399",
          colorRgb: ch.colorRgb || "52, 211, 153",
          isBot: !!p.isBot,
          // Shared result metadata
          rank: null,
          isWinner: false,
          rewardDelta: 0,
          rewardNote: "",
          scoreText: "",
          // Dice of Fate compatibility fields
          d1: null,
          d2: null,
          total: null,
          finalScore: 0,
          roundReached: 1,
          eliminated: false,
          isTied: false,
          tieBreak: 0,
          reward: 0,
          justLanded: false
        };
      });

    // Compute exact Spin Wheel target angle so the pointer at 12 o'clock lands inside chosen slice
    const sliceCount = pool.length;
    const chosenIdx = Math.max(0, pool.findIndex((g) => g.id === chosen.id));
    const sliceDeg = 360 / sliceCount;
    const sliceCenterDeg = chosenIdx * sliceDeg + sliceDeg / 2;
    const jitter = (Math.random() - 0.5) * Math.min(22, sliceDeg * 0.45);
    const spins = randInt(4, 5) * 360;
    const wheelTargetDeg = Math.round(spins + (360 - sliceCenterDeg) + jitter);

    const mg = {
      id: "mg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      mode, // "versus" | "ffa"
      gameId: chosen.id,
      name: chosen.title,
      reasonTitle: opts.reasonTitle || (mode === "versus" ? "Versus Duel 1v1" : "Minigame Akhir Ronde"),
      afterAction: opts.afterAction || "none", // "advance_round" | "versus_wager" | "none"
      wager: mode === "versus" ? Math.max(0, Number(opts.wager) || 15) : 0,
      challengerRisk: mode === "versus" && opts.challengerRisk !== undefined ? Math.max(0, Number(opts.challengerRisk)) : null,
      opponentRisk: mode === "versus" && opts.opponentRisk !== undefined ? Math.max(0, Number(opts.opponentRisk)) : null,
      payouts: state.rules && state.rules.minigamePayouts ? state.rules.minigamePayouts : [30, 15, 15, 10],
      phase: "selecting", // "selecting" | "intro" | "playing" | "result"
      wheelPoolIds: pool.map((g) => g.id),
      wheelChosenIdx: chosenIdx,
      wheelTargetDeg,
      wheelDurationMs: WHEEL_DURATION_MS,
      wheelLanded: false,
      timerToken: "",
      timerDurationMs: 0,
      timerRemainingMs: 0,
      _hostDeadlineAt: 0,
      rewardsSettled: false,
      winnerIndices: [],
      resultHeadline: "",
      resultSub: "",
      entries,
      data: {}
    };

    if (typeof chosen.initData === "function") {
      chosen.initData(mg);
    }

    state.activeMinigame = mg;
    setPhaseTimer(mg, WHEEL_DURATION_MS + WHEEL_SETTLE_MS);

    playSfx("turn");
    ensureRuntimeLoops();
    syncAndBroadcast(mg, true);
  }

  function transitionToIntro(mg) {
    if (!mg || mg.phase !== "selecting") return;
    mg.phase = "intro";
    mg.wheelLanded = true;
    setPhaseTimer(mg, INTRO_DURATION_MS);
    playSfx("card_reveal", mg.mode === "versus" ? "negative" : "event");
    syncAndBroadcast(mg, true);
  }

  function transitionToGameplay(mg) {
    if (!mg || mg.phase === "playing") return;
    const def = getMinigameDef(mg.gameId);
    mg.phase = "playing";
    clearPhaseTimer(mg);
    if (def && typeof def.onEnterGameplay === "function") {
      def.onEnterGameplay(mg);
    }
    playSfx("turn");
    syncAndBroadcast(mg, true);
  }

  function transitionToResult(mg, resultSpec = {}) {
    const state = getState();
    if (!state || !mg || mg.phase === "result") return;

    mg.phase = "result";
    mg.winnerIndices = Array.isArray(resultSpec.winnerIndices) ? resultSpec.winnerIndices : [];
    mg.resultHeadline = resultSpec.headline || "Minigame Selesai!";
    mg.resultSub = resultSpec.sub || "";

    if (!mg.rewardsSettled) {
      mg.rewardsSettled = true;
      settleMinigameRewards(mg, resultSpec);
    }

    setPhaseTimer(mg, RESULT_AUTO_CLOSE_MS);
    playSfx("shard");
    syncAndBroadcast(mg, true);
  }

  function settleMinigameRewards(mg, resultSpec) {
    const state = getState();
    if (!state || !hostApi) return;

    if (mg.mode === "versus") {
      const challengerEntry = mg.entries[0];
      const opponentEntry = mg.entries[1];
      const winSeat = mg.winnerIndices[0] !== undefined ? mg.winnerIndices[0] : challengerEntry.playerIndex;
      const winnerEntry = mg.entries.find((e) => e.playerIndex === winSeat) || challengerEntry;
      const loserEntry = mg.entries.find((e) => e.playerIndex !== winnerEntry.playerIndex) || opponentEntry;

      const winnerP = state.players[winnerEntry.playerIndex];
      const loserP = state.players[loserEntry.playerIndex];
      const challengerWon = winnerEntry.playerIndex === challengerEntry.playerIndex;
      const baseBet = Math.max(0, mg.wager || 15);
      const effectiveBet =
        challengerWon && mg.opponentRisk !== null && mg.opponentRisk !== undefined
          ? Math.max(0, Number(mg.opponentRisk))
          : !challengerWon && mg.challengerRisk !== null && mg.challengerRisk !== undefined
          ? Math.max(0, Number(mg.challengerRisk))
          : baseBet;

      if (winnerP && loserP) {
        const taken = Math.min(effectiveBet, loserP.tc);
        loserP.tc = Math.max(0, loserP.tc - taken);
        const gained = taken > 0 ? hostApi.modifyPlayerTC(winnerP, taken, "versus") : 0;

        winnerEntry.isWinner = true;
        winnerEntry.rank = 1;
        winnerEntry.rewardDelta = gained;
        winnerEntry.rewardNote = gained > 0 ? `Menang Duel (+${gained} TC)` : "Menang Duel (Entry Gratis · 0 TC)";

        loserEntry.isWinner = false;
        loserEntry.rank = 2;
        loserEntry.rewardDelta = -taken;
        loserEntry.rewardNote = taken > 0 ? `Kalah Taruhan (-${taken} TC)` : "Kalah Duel (0 TC)";

        mg.resultHeadline = `${winnerP.name} Memenangkan Duel!`;
        mg.resultSub =
          gained > 0
            ? `${winnerP.name} mengalahkan ${loserP.name} di ${mg.name} & merebut 💰 ${gained} TC!`
            : `${winnerP.name} mengalahkan ${loserP.name} di ${mg.name} (Entry Fee 0 TC)!`;
        hostApi.addLog(
          `Versus (${mg.name}): ${winnerP.name} mengalahkan ${loserP.name}${gained > 0 ? ` & merebut 💰 ${gained} TC` : " (0 TC)"}!`
        );
      }
      return;
    }

    // FFA Modes: each minigame provides per-seat net TC deltas in resultSpec.deltas OR custom handler
    if (typeof resultSpec.customSettle === "function") {
      resultSpec.customSettle(mg, state, hostApi);
      return;
    }

    const deltas = resultSpec.deltas || {};
    const applyMaxCap = mg.mode === "ffa" && mg.gameId !== "dice_of_fate";
    const logParts = [];
    mg.entries.forEach((entry) => {
      const p = state.players[entry.playerIndex];
      const raw = Number(deltas[entry.playerIndex] || 0);
      if (p) {
        if (raw > 0) {
          const cappedRaw = applyMaxCap ? Math.min(FFA_MAX_TC_REWARD, raw) : raw;
          const gained = hostApi.modifyPlayerTC(p, cappedRaw, "minigame");
          entry.rewardDelta = gained;
        } else if (raw < 0) {
          const loss = Math.min(p.tc, Math.abs(raw));
          p.tc = Math.max(0, p.tc - loss);
          entry.rewardDelta = -loss;
          if (loss > 0) playSfx("coin_loss");
        } else {
          entry.rewardDelta = 0;
        }
      }
      const sign = entry.rewardDelta > 0 ? "+" : "";
      logParts.push(`${entry.name} (${sign}${entry.rewardDelta} TC)`);
    });

    hostApi.addLog(`Minigame ${mg.name} (${mg.reasonTitle}): ${logParts.join(" | ")}`);
  }

  function finishActiveMinigame() {
    const state = getState();
    if (!state || !state.activeMinigame) return;
    const mg = state.activeMinigame;
    if (mg.phase !== "result") return;

    if (isRemoteClient()) {
      hostApi.sendClientActionToHost("minigame_finish", {});
      return;
    }

    const afterAction = mg.afterAction;
    clearAllTimers();
    state.activeMinigame = null;

    if (hostApi && hostApi.onMinigameClosed) {
      hostApi.onMinigameClosed(afterAction);
    }
  }

  // ----------------------------------------------------------------------------
  // HOST RUNTIME TICK (TIMERS + BOT AI)
  // ----------------------------------------------------------------------------
  function hostRuntimeTick() {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg || isRemoteClient()) {
      if (!mg && runtimeTickId) {
        clearInterval(runtimeTickId);
        runtimeTickId = null;
      }
      return;
    }

    const now = Date.now();
    const remMs = getHostRemainingMs(mg, now);

    if (mg.phase === "selecting") {
      if (!mg.wheelLanded && remMs <= WHEEL_SETTLE_MS) {
        mg.wheelLanded = true;
        updateWheelLandedVisual(mg);
      }
      if (remMs <= 0) {
        transitionToIntro(mg);
      }
      return;
    }

    if (mg.phase === "intro") {
      if (remMs <= 0) {
        transitionToGameplay(mg);
      }
      return;
    }

    if (mg.phase === "result") {
      if (remMs <= 0) {
        finishActiveMinigame();
      }
      return;
    }

    if (mg.phase === "playing") {
      const def = getMinigameDef(mg.gameId);
      if (def) {
        if (typeof def.onBotThink === "function") {
          def.onBotThink(mg, now);
        }
        if (typeof def.onTick === "function") {
          def.onTick(mg, now);
        }
      }
    }
  }

  function syncRuntime() {
    const state = getState();
    if (state && state.activeMinigame) {
      ensureRuntimeLoops();
    } else {
      clearAllTimers();
    }
  }

  // ----------------------------------------------------------------------------
  // CLIENT & LOCAL ACTION DISPATCH
  // ----------------------------------------------------------------------------
  function dispatchAction(actionType, payload = {}, explicitSeat = null) {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg) return;

    const mp = getMpInfo();
    let seatIdx = explicitSeat;
    if (seatIdx === null || seatIdx === undefined) {
      if (mp.mode !== "local" && mp.mySeat !== -1) {
        seatIdx = mp.mySeat;
      } else {
        const humans = getLocalControllableEntries(mg);
        seatIdx = humans.length > 0 ? humans[0].playerIndex : mg.entries[0].playerIndex;
      }
    }

    if (isRemoteClient()) {
      hostApi.sendClientActionToHost("minigame_action", {
        type: actionType,
        payload
      });
      return;
    }

    handleAuthoritativeAction(seatIdx, actionType, payload);
  }

  function handleAuthoritativeAction(seatIdx, actionType, payload = {}) {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg) return;

    if (actionType === "skip_intro" && mg.phase === "intro") {
      transitionToGameplay(mg);
      return;
    }
    if (actionType === "finish" && mg.phase === "result") {
      finishActiveMinigame();
      return;
    }

    if (mg.phase !== "playing") return;
    const isParticipant = mg.entries.some((e) => e.playerIndex === seatIdx);
    if (!isParticipant) return;

    const def = getMinigameDef(mg.gameId);
    if (def && typeof def.onAction === "function") {
      def.onAction(mg, seatIdx, actionType, payload);
    }
  }

  function nudgeBotStep() {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg || isRemoteClient()) return;

    if (mg.phase === "selecting") {
      transitionToIntro(mg);
    } else if (mg.phase === "intro") {
      transitionToGameplay(mg);
    } else if (mg.phase === "result") {
      finishActiveMinigame();
    } else if (mg.phase === "playing") {
      const def = getMinigameDef(mg.gameId);
      if (def && typeof def.onBotStepForce === "function") {
        def.onBotStepForce(mg);
      }
    }
  }

  function handleKeyDown(e) {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg) return false;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) {
      return false;
    }

    const key = (e.key || "").toLowerCase();
    if (mg.phase === "result" && (key === "enter" || key === " ")) {
      e.preventDefault();
      finishActiveMinigame();
      return true;
    }
    if (mg.phase !== "playing") return false;

    const def = getMinigameDef(mg.gameId);
    if (def && typeof def.onKeyDown === "function") {
      return !!def.onKeyDown(mg, e, key);
    }
    return false;
  }

  // ============================================================================
  // MINIGAME 1 (VERSUS + FFA): DICE OF FATE (EXISTING MECHANIC PRESERVED!)
  // ============================================================================
  const DOF_TURN_TIMEOUT_MS = 10000;

  function dofGetCurrentEntryIdx(mg) {
    const d = mg.data;
    if (!d || !Array.isArray(d.activeOrder)) return -1;
    const idx = d.activeOrder[d.currentOrderPos];
    return typeof idx === "number" ? idx : -1;
  }

  function dofCanLocalRoll(mg, entry) {
    if (!entry) return false;
    const mp = getMpInfo();
    if (mp.mode === "local" || mp.mySeat === -1) return true;
    if (hostApi && hostApi.isMultiplayerHost && hostApi.isMultiplayerHost() && entry.isBot) return true;
    return mp.mySeat === entry.playerIndex;
  }

  function dofExecuteRoll(mg, isAuto = false) {
    const d = mg.data;
    if (!d || d.status !== "rolling" || d.isAnimatingRoll) return;
    const idx = dofGetCurrentEntryIdx(mg);
    const entry = mg.entries[idx];
    if (!entry) return;

    d.isAnimatingRoll = true;
    d.animatingEntryIndex = idx;
    clearPhaseTimer(mg);
    mg.entries.forEach((e) => {
      e.justLanded = false;
    });

    const rollVal = randInt(1, 20);
    const tieBreak = randInt(1, 20);
    const rollId = "dofr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    d.lastRollEvent = {
      id: rollId,
      entryIndex: idx,
      targetVal: rollVal
    };
    lastShownDofRollEventId = rollId;

    syncAndBroadcast(mg, true);

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
      const curState = getState();
      if (!curState || !curState.activeMinigame || curState.activeMinigame.id !== mg.id) {
        clearInterval(dofRollAnimInterval);
        dofRollAnimInterval = null;
        return;
      }
      if (ticks < maxTicks) {
        if (ticks % 2 === 1) playSfx("dice_tick");
        const el = document.getElementById(`dof-num-${idx}`);
        if (el) el.textContent = String(randInt(1, 20));
        return;
      }

      clearInterval(dofRollAnimInterval);
      dofRollAnimInterval = null;

      entry.d1 = rollVal;
      entry.d2 = null;
      entry.total = rollVal;
      entry.finalScore = rollVal;
      entry.roundReached = (d.tieRound || 0) + 1;
      entry.tieBreak = tieBreak;
      entry.justLanded = true;
      d.isAnimatingRoll = false;
      d.animatingEntryIndex = -1;
      d.currentOrderPos++;

      playSfx("dice_land");

      if (d.currentOrderPos >= d.activeOrder.length) {
        dofEvaluateRound(mg);
      } else {
        d.botNextAt = Date.now() + 680;
        setPhaseTimer(mg, DOF_TURN_TIMEOUT_MS);
        syncAndBroadcast(mg, true);
      }
    }, 65);
  }

  function dofPlayRemoteRollAnim(rollEv) {
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
        if (el) el.textContent = String(randInt(1, 20));
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

  function dofEvaluateRound(mg) {
    const d = mg.data;
    const maxTotal = Math.max(...d.activeOrder.map((i) => mg.entries[i].total || 0));
    const tiedIndices = d.activeOrder.filter((i) => mg.entries[i].total === maxTotal);

    d.activeOrder.forEach((i) => {
      const e = mg.entries[i];
      if (!tiedIndices.includes(i)) {
        e.eliminated = true;
        e.isTied = false;
      }
    });

    if (tiedIndices.length > 1) {
      d.tieRound = (d.tieRound || 0) + 1;
      d.status = "tie_pause";
      d.tiedIndices = tiedIndices;
      d.tiedNames = tiedIndices.map((i) => mg.entries[i].name);
      tiedIndices.forEach((i) => {
        mg.entries[i].isTied = true;
      });
      if (hostApi && hostApi.addLog) {
        hostApi.addLog(`Dice of Fate SERI (${maxTotal})! Adu ulang Tie-Breaker #${d.tieRound}: ${d.tiedNames.join(" vs ")}.`);
      }
      playSfx("branch");
      setPhaseTimer(mg, 1500);
      syncAndBroadcast(mg, true);
      return;
    }

    dofFinalize(mg);
  }

  function dofFinalize(mg) {
    const ranked = [...mg.entries].sort(
      (a, b) =>
        (b.roundReached || 1) - (a.roundReached || 1) ||
        (b.finalScore || 0) - (a.finalScore || 0) ||
        (b.tieBreak || 0) - (a.tieBreak || 0)
    );
    const winner = ranked[0];

    ranked.forEach((entry, rankIdx) => {
      entry.rank = rankIdx + 1;
      entry.isWinner = rankIdx === 0;
      entry.isTied = false;
      entry.scoreText = `Roll ${entry.finalScore}${entry.roundReached > 1 ? ` (TB #${entry.roundReached - 1})` : ""}`;
    });

    if (mg.mode === "versus") {
      transitionToResult(mg, {
        winnerIndices: [winner.playerIndex],
        headline: `${winner.name} Menang Dice of Fate!`,
        sub: `Roll tertinggi ${winner.finalScore} mengamankan kemenangan duel!`
      });
      return;
    }

    transitionToResult(mg, {
      winnerIndices: [winner.playerIndex],
      headline: `Pemenang: ${winner.name} (Roll ${winner.finalScore})!`,
      sub: `Hadiah Tartarus Coin dibagikan sesuai peringkat roll 1d20.`,
      customSettle: (m, state, api) => {
        const lines = ranked.map((entry, rankIdx) => {
          const baseReward = m.payouts[rankIdx] !== undefined ? m.payouts[rankIdx] : 10;
          const p = state.players[entry.playerIndex];
          const earned = p ? api.modifyPlayerTC(p, baseReward, "minigame") : baseReward;
          entry.reward = earned;
          entry.rewardDelta = earned;
          entry.rewardNote = `Peringkat #${rankIdx + 1}`;
          return `#${rankIdx + 1} ${entry.name} (${entry.finalScore}) +${earned} TC`;
        });
        api.addLog(`Dice of Fate (${m.reasonTitle}): ${lines.join(" | ")}`);
      }
    });
  }

  registerMinigame({
    id: "dice_of_fate",
    title: "Dice Of Fate",
    shortTitle: "Dice Of Fate",
    icon: "🎲",
    accent: "#34d399",
    accentRgb: "52, 211, 153",
    modes: ["versus", "ffa"],
    ruleText: {
      versus: "Lempar dadu 1d20 secara bergantian; angka tertinggi menang duel (seri langsung tie-breaker)!",
      ffa: "Semua pemain melempar dadu 1d20; angka tertinggi meraih hadiah koin terbesar (seri langsung tie-breaker)!"
    },
    initData(mg) {
      mg.data = {
        status: "rolling",
        tieRound: 0,
        tiedIndices: [],
        tiedNames: [],
        activeOrder: mg.entries.map((_, i) => i),
        currentOrderPos: 0,
        isAnimatingRoll: false,
        animatingEntryIndex: -1,
        lastRollEvent: null,
        botNextAt: 0
      };
    },
    onEnterGameplay(mg) {
      mg.data.botNextAt = Date.now() + 720;
      setPhaseTimer(mg, DOF_TURN_TIMEOUT_MS);
    },
    onAction(mg, seatIdx, actionType) {
      if (actionType !== "dof_roll") return;
      const d = mg.data;
      if (d.status !== "rolling" || d.isAnimatingRoll) return;
      const idx = dofGetCurrentEntryIdx(mg);
      const entry = mg.entries[idx];
      if (!entry) return;
      const mp = getMpInfo();
      if (mp.mode !== "local" && mp.mySeat !== -1 && entry.playerIndex !== seatIdx && !entry.isBot) return;
      dofExecuteRoll(mg, false);
    },
    onBotThink(mg, now) {
      const d = mg.data;
      if (d.status !== "rolling" || d.isAnimatingRoll) return;
      const idx = dofGetCurrentEntryIdx(mg);
      const entry = mg.entries[idx];
      if (entry && entry.isBot && now >= (d.botNextAt || 0)) {
        dofExecuteRoll(mg, true);
      }
    },
    onBotStepForce(mg) {
      if (mg.data.status === "rolling" && !mg.data.isAnimatingRoll) {
        dofExecuteRoll(mg, true);
      }
    },
    onTick(mg, now) {
      const d = mg.data;
      if (d.isAnimatingRoll) return;
      const rem = getHostRemainingMs(mg, now);
      if (d.status === "tie_pause" && rem <= 0) {
        (d.tiedIndices || []).forEach((i) => {
          const e = mg.entries[i];
          e.d1 = null;
          e.d2 = null;
          e.total = null;
          e.justLanded = false;
          e.isTied = true;
        });
        d.activeOrder = [...(d.tiedIndices || [])];
        d.currentOrderPos = 0;
        d.status = "rolling";
        d.botNextAt = now + 700;
        setPhaseTimer(mg, DOF_TURN_TIMEOUT_MS);
        syncAndBroadcast(mg, true);
      } else if (d.status === "rolling" && rem <= 0) {
        dofExecuteRoll(mg, true);
      }
    },
    onKeyDown(mg, e, key) {
      if (key === " " || key === "enter") {
        const idx = dofGetCurrentEntryIdx(mg);
        const entry = mg.entries[idx];
        if (entry && mg.data.status === "rolling" && !mg.data.isAnimatingRoll && dofCanLocalRoll(mg, entry)) {
          e.preventDefault();
          dispatchAction("dof_roll", {}, entry.playerIndex);
          return true;
        }
      }
      return false;
    },
    renderGameplay(mg) {
      const d = mg.data;
      const curEntryIdx = d.status === "rolling" ? dofGetCurrentEntryIdx(mg) : -1;
      const curEntry = curEntryIdx >= 0 ? mg.entries[curEntryIdx] : null;
      let statusText = "Dice of Fate";
      if (d.status === "tie_pause") {
        statusText = `SERI! Adu Ulang Tie-Breaker #${d.tieRound}: ${(d.tiedNames || []).join(" vs ")}`;
      } else if (curEntry) {
        const tieTag = d.tieRound > 0 ? `Tie-Breaker #${d.tieRound} · ` : "";
        statusText = `${tieTag}Giliran Roll: ${curEntry.name}`;
      }

      const rowsHtml = mg.entries
        .map((entry, idx) => {
          const isCurrent = d.status === "rolling" && idx === curEntryIdx;
          const isInActivePool = Array.isArray(d.activeOrder) && d.activeOrder.includes(idx);
          const isTiedActive = (d.status === "tie_pause" || d.tieRound > 0) && entry.isTied && !entry.eliminated;
          const isDimmed = entry.eliminated;
          const hasRolled = entry.total !== null;
          const showCharSub = entry.charName && entry.charName.toLowerCase() !== entry.name.toLowerCase();

          let numText = "-";
          let numCls = "is-pending";
          if (hasRolled) {
            numText = String(entry.total);
            numCls = entry.justLanded ? "is-landed" : "";
          } else if (entry.eliminated && entry.finalScore) {
            numText = String(entry.finalScore);
            numCls = "";
          } else if (isCurrent && d.isAnimatingRoll) {
            numText = "...";
            numCls = "is-rolling";
          }

          let rightHtml = "";
          if (d.status === "tie_pause") {
            rightHtml = entry.isTied ? `<span class="dof-tie-badge">Adu Ulang</span>` : `<span class="dof-wait-tag">Gugur</span>`;
          } else if (entry.eliminated) {
            rightHtml = `<span class="dof-wait-tag">Gugur</span>`;
          } else if (isCurrent) {
            if (d.isAnimatingRoll) {
              rightHtml = `<span class="dof-wait-tag">Mengocok dadu...</span>`;
            } else if (dofCanLocalRoll(mg, entry)) {
              rightHtml = `${d.tieRound > 0 ? `<span class="dof-tie-badge">Tie-Breaker</span>` : ""}<button class="dof-roll-btn" onclick="window.EFT_MINIGAMES.dispatchAction('dof_roll', {}, ${entry.playerIndex})">Roll Dice</button>`;
            } else {
              rightHtml = `<span class="dof-wait-tag">Menunggu ${esc(entry.name)}...</span>`;
            }
          } else if (hasRolled) {
            rightHtml = `<span class="dof-wait-tag">Selesai</span>`;
          } else if (isInActivePool) {
            const posInOrder = d.activeOrder.indexOf(idx);
            rightHtml = `${d.tieRound > 0 ? `<span class="dof-tie-badge">Tie-Breaker</span>` : ""}<span class="dof-wait-tag">Antrean #${posInOrder + 1}</span>`;
          }

          const rowClasses = ["dof-row"];
          if (isCurrent) rowClasses.push("is-current");
          if (isTiedActive && !isCurrent) rowClasses.push("is-tied");
          if (isDimmed) rowClasses.push("is-dimmed");

          return `
            <div class="${rowClasses.join(" ")}" style="--dof-color:${esc(entry.color)};--dof-rgb:${esc(entry.colorRgb)};">
              <div class="dof-portrait-col">${buildPortraitHtml(entry, "dof-portrait-img")}</div>
              <div class="dof-name-col">
                <div class="dof-name-pill">${esc(entry.name)}</div>
                ${showCharSub ? `<div class="dof-char-sub">${esc(entry.charName)}</div>` : ""}
              </div>
              <div class="dof-roll-display">
                <span class="dof-roll-label">Roll :</span>
                <span id="dof-num-${idx}" class="dof-roll-num ${numCls}">${numText}</span>
                ${hasRolled ? `<span class="dof-dice-breakdown">[1d20]</span>` : ""}
              </div>
              <div class="dof-action-col">${rightHtml}</div>
            </div>`;
        })
        .join("");

      const hintText =
        mg.mode === "versus"
          ? `Duel 1v1 · Taruhan 💰 ${mg.wager} TC`
          : `1st: 💰 +${mg.payouts[0] || 30} TC · 2nd/3rd: +${mg.payouts[1] || 15} TC · 4th: +${mg.payouts[3] || 10} TC`;

      return {
        subtitle: statusText,
        rightExtraHtml: `<span class="dof-payout-hint">${hintText}</span>`,
        bodyHtml: `<div class="dof-rows-stack">${rowsHtml}</div>`,
        afterRender() {
          if (d.lastRollEvent && d.lastRollEvent.id && d.lastRollEvent.id !== lastShownDofRollEventId) {
            lastShownDofRollEventId = d.lastRollEvent.id;
            dofPlayRemoteRollAnim(d.lastRollEvent);
          }
        }
      };
    }
  });

  // ============================================================================
  // MINIGAME 2 (VERSUS 1v1): GUNTING BATU KERTAS (BEST OF 3)
  // ============================================================================
  const RPS_CHOICES = [
    { id: "batu", label: "Batu", emoji: "✊" },
    { id: "gunting", label: "Gunting", emoji: "✌️" },
    { id: "kertas", label: "Kertas", emoji: "✋" }
  ];
  const RPS_CHOICE_MAP = {
    batu: RPS_CHOICES[0],
    gunting: RPS_CHOICES[1],
    kertas: RPS_CHOICES[2]
  };
  const RPS_ROUND_TIME_MS = 6000;

  function rpsJudge(a, b) {
    if (a === b) return 0;
    if ((a === "batu" && b === "gunting") || (a === "gunting" && b === "kertas") || (a === "kertas" && b === "batu")) {
      return 1;
    }
    return -1;
  }

  function rpsStartRound(mg) {
    const d = mg.data;
    d.subPhase = "choosing";
    d.choices = {};
    d.roundWinnerIdx = -1;
    d.roundMsg = "";
    const now = Date.now();
    d.botPickAt = {};
    mg.entries.forEach((e) => {
      if (e.isBot) d.botPickAt[e.playerIndex] = now + randInt(900, 2100);
    });
    setPhaseTimer(mg, RPS_ROUND_TIME_MS);
  }

  function rpsRevealRound(mg) {
    const d = mg.data;
    const p0 = mg.entries[0];
    const p1 = mg.entries[1];
    if (!d.choices[p0.playerIndex]) d.choices[p0.playerIndex] = pickRandom(RPS_CHOICES).id;
    if (!d.choices[p1.playerIndex]) d.choices[p1.playerIndex] = pickRandom(RPS_CHOICES).id;

    const c0 = d.choices[p0.playerIndex];
    const c1 = d.choices[p1.playerIndex];
    const res = rpsJudge(c0, c1);

    d.subPhase = "reveal";
    if (res === 0) {
      d.tieStreak = (d.tieStreak || 0) + 1;
      d.roundWinnerIdx = -1;
      d.roundMsg = `SERI (${RPS_CHOICE_MAP[c0].label} vs ${RPS_CHOICE_MAP[c1].label})! Ronde diulang...`;
      playSfx("branch");
    } else {
      d.tieStreak = 0;
      const winPos = res === 1 ? 0 : 1;
      d.scores[winPos]++;
      d.roundWinnerIdx = winPos;
      const winEntry = mg.entries[winPos];
      d.roundMsg = `${winEntry.name} menang ronde ini! (${RPS_CHOICE_MAP[winPos === 0 ? c0 : c1].label} mengalahkan ${RPS_CHOICE_MAP[winPos === 0 ? c1 : c0].label})`;
      playSfx("dice_land");
    }

    setPhaseTimer(mg, 2100);
    syncAndBroadcast(mg, true);
  }

  registerMinigame({
    id: "rps",
    title: "Gunting Batu Kertas",
    shortTitle: "Gunting Batu Kertas",
    icon: "✂️",
    accent: "#fb923c",
    accentRgb: "251, 146, 60",
    modes: ["versus"],
    ruleText: "Format Best of 3: pilih Gunting, Batu, atau Kertas secara rahasia dalam 6 detik; seri diulang, 2 kemenangan menang!",
    initData(mg) {
      mg.data = {
        round: 1,
        scores: [0, 0],
        subPhase: "choosing",
        choices: {},
        roundWinnerIdx: -1,
        roundMsg: "",
        tieStreak: 0,
        botPickAt: {}
      };
    },
    onEnterGameplay(mg) {
      rpsStartRound(mg);
    },
    onAction(mg, seatIdx, actionType, payload) {
      if (actionType !== "rps_pick") return;
      const d = mg.data;
      if (d.subPhase !== "choosing") return;
      const choice = payload && payload.choice;
      if (!RPS_CHOICE_MAP[choice]) return;
      if (d.choices[seatIdx]) return;

      d.choices[seatIdx] = choice;
      playSfx("click");

      const allPicked = mg.entries.every((e) => !!d.choices[e.playerIndex]);
      if (allPicked) {
        rpsRevealRound(mg);
      } else {
        syncAndBroadcast(mg, true);
      }
    },
    onBotThink(mg, now) {
      const d = mg.data;
      if (d.subPhase !== "choosing") return;
      let changed = false;
      mg.entries.forEach((e) => {
        if (e.isBot && !d.choices[e.playerIndex] && now >= (d.botPickAt[e.playerIndex] || 0)) {
          d.choices[e.playerIndex] = pickRandom(RPS_CHOICES).id;
          changed = true;
        }
      });
      if (changed) {
        const allPicked = mg.entries.every((e) => !!d.choices[e.playerIndex]);
        if (allPicked) rpsRevealRound(mg);
        else syncAndBroadcast(mg, true);
      }
    },
    onBotStepForce(mg) {
      const d = mg.data;
      if (d.subPhase === "choosing") {
        mg.entries.forEach((e) => {
          if (!d.choices[e.playerIndex]) d.choices[e.playerIndex] = pickRandom(RPS_CHOICES).id;
        });
        rpsRevealRound(mg);
      }
    },
    onTick(mg, now) {
      const d = mg.data;
      const rem = getHostRemainingMs(mg, now);
      if (d.subPhase === "choosing" && rem <= 0) {
        rpsRevealRound(mg);
      } else if (d.subPhase === "reveal" && rem <= 0) {
        if (d.scores[0] >= 2 || d.scores[1] >= 2) {
          const winPos = d.scores[0] >= 2 ? 0 : 1;
          mg.entries[0].scoreText = `Skor ${d.scores[0]} - ${d.scores[1]}`;
          mg.entries[1].scoreText = `Skor ${d.scores[1]} - ${d.scores[0]}`;
          transitionToResult(mg, {
            winnerIndices: [mg.entries[winPos].playerIndex]
          });
        } else {
          if (d.roundWinnerIdx !== -1) d.round++;
          rpsStartRound(mg);
          syncAndBroadcast(mg, true);
        }
      }
    },
    onKeyDown(mg, e, key) {
      if (mg.data.subPhase !== "choosing") return false;
      const humans = getLocalControllableEntries(mg);
      if (humans.length === 0) return false;
      const mapP1 = { "1": "batu", a: "batu", "2": "gunting", s: "gunting", "3": "kertas", d: "kertas" };
      const mapP2 = { j: "batu", k: "gunting", l: "kertas" };
      if (mapP1[key]) {
        e.preventDefault();
        dispatchAction("rps_pick", { choice: mapP1[key] }, humans[0].playerIndex);
        return true;
      }
      if (humans.length > 1 && mapP2[key]) {
        e.preventDefault();
        dispatchAction("rps_pick", { choice: mapP2[key] }, humans[1].playerIndex);
        return true;
      }
      return false;
    },
    renderGameplay(mg) {
      const d = mg.data;
      const p0 = mg.entries[0];
      const p1 = mg.entries[1];
      const humans = getLocalControllableEntries(mg);
      const isTwoLocalHumans = humans.length === 2;

      const renderSlot = (entry, pos) => {
        const picked = d.choices[entry.playerIndex];
        const isReveal = d.subPhase === "reveal";
        const cls = ["rps-hand-slot"];
        if (!isReveal && picked) cls.push("is-locked");
        if (isReveal && d.roundWinnerIdx === pos) cls.push("is-round-win");
        if (isReveal && d.roundWinnerIdx !== -1 && d.roundWinnerIdx !== pos) cls.push("is-round-lose");

        let icon = "❔";
        let label = "Memilih...";
        if (isReveal && picked) {
          icon = RPS_CHOICE_MAP[picked].emoji;
          label = RPS_CHOICE_MAP[picked].label;
        } else if (picked) {
          icon = "🔒";
          label = "Pilihan Terkunci!";
        }
        return `
          <div class="${cls.join(" ")}">
            <div style="font-weight:800;font-size:0.86rem;color:${esc(entry.color)};">${esc(entry.name)}</div>
            <div class="rps-big-emoji ${isReveal ? "is-pop" : ""}">${icon}</div>
            <div style="font-size:0.8rem;font-weight:700;color:#cbd5e1;">${label}</div>
          </div>`;
      };

      let controlsHtml = "";
      if (d.subPhase === "choosing") {
        if (isTwoLocalHumans) {
          const keys = [
            ["A", "S", "D"],
            ["J", "K", "L"]
          ];
          controlsHtml = `
            <div class="rps-hotseat-split">
              ${humans
                .map((h, hIdx) => {
                  const locked = !!d.choices[h.playerIndex];
                  return `
                    <div class="rps-hotseat-box">
                      <div style="font-size:0.8rem;font-weight:800;color:${esc(h.color)};">${esc(h.name)} ${locked ? "(✓ Terkunci)" : "(Pilih Rahasia)"}</div>
                      <div class="rps-choice-row">
                        ${RPS_CHOICES.map(
                          (c, ci) => `
                          <button class="rps-choice-btn" ${locked ? "disabled" : ""} onclick="window.EFT_MINIGAMES.dispatchAction('rps_pick', {choice:'${c.id}'}, ${h.playerIndex})">
                            <span class="rps-choice-icon">${c.emoji}</span>
                            <span class="rps-choice-label">${c.label}</span>
                            <span class="rps-choice-key">${keys[hIdx][ci]}</span>
                          </button>`
                        ).join("")}
                      </div>
                    </div>`;
                })
                .join("")}
            </div>`;
        } else if (humans.length === 1) {
          const me = humans[0];
          const myPick = d.choices[me.playerIndex];
          const keys = ["1 / A", "2 / S", "3 / D"];
          controlsHtml = `
            <div class="rps-choice-row">
              ${RPS_CHOICES.map(
                (c, ci) => `
                <button class="rps-choice-btn ${myPick === c.id ? "is-selected" : ""}" ${myPick ? "disabled" : ""} onclick="window.EFT_MINIGAMES.dispatchAction('rps_pick', {choice:'${c.id}'}, ${me.playerIndex})">
                  <span class="rps-choice-icon">${c.emoji}</span>
                  <span class="rps-choice-label">${c.label}</span>
                  <span class="rps-choice-key">Tombol ${keys[ci]}</span>
                </button>`
              ).join("")}
            </div>
            <div class="mg-hint-note">${myPick ? "Pilihan terkunci! Menunggu lawan..." : "Pilih sebelum waktu habis (otomatis acak jika kehabisan waktu)."}</div>`;
        } else {
          controlsHtml = `<div class="mg-hint-note">Menonton duel 1v1 secara langsung...</div>`;
        }
      } else {
        controlsHtml = `<div class="mg-round-msg">${esc(d.roundMsg)}</div>`;
      }

      return {
        subtitle: `Best of 3 · Ronde ${d.round} · Taruhan 💰 ${mg.wager} TC`,
        bodyHtml: `
          <div class="mg-duel-board">
            ${renderDuelScoreboard(mg, d.scores, `Ronde ${d.round} · Bo3`, 2)}
            <div class="mg-stage-panel">
              <div class="rps-duel-reveal">
                ${renderSlot(p0, 0)}
                <div style="font-family:Georgia,serif;font-size:1.5rem;font-weight:800;color:#fde047;">VS</div>
                ${renderSlot(p1, 1)}
              </div>
              ${controlsHtml}
            </div>
          </div>`
      };
    }
  });

  // ============================================================================
  // MINIGAME 3 (VERSUS 1v1): QUICK DRAW (BEST OF 3 + FAKE-OUTS)
  // ============================================================================
  const QD_FAKE_SIGNALS = ["SIAP...", "JANGAN!", "TUNGGU...", "TAHAN!"];

  function qdStartRound(mg) {
    const d = mg.data;
    d.subPhase = "wait";
    d.signalText = "BERSIAP...";
    d.roundMsg = "";
    d.roundWinnerIdx = -1;
    d.fireAt = 0;
    d.fireKey = "qdf_" + mg.id + "_" + d.round + "_" + Date.now();
    d.fakeCount = 0;
    d.maxFakes = Math.random() < 0.55 ? 1 : 0;
    d.nextEventAt = Date.now() + (d.maxFakes === 0 ? randInt(2000, 4200) : randInt(1300, 2200));
    d.botActionAt = {};
    d.pendingPress = null;
    clearPhaseTimer(mg);
  }

  function qdResolveRound(mg, winnerPos, msg) {
    const d = mg.data;
    if (d.subPhase === "reveal") return;
    d.subPhase = "reveal";
    d.scores[winnerPos]++;
    d.roundWinnerIdx = winnerPos;
    d.roundMsg = msg;
    setPhaseTimer(mg, 2000);
    syncAndBroadcast(mg, true);
  }

  registerMinigame({
    id: "quick_draw",
    title: "Quick Draw",
    shortTitle: "Quick Draw",
    icon: "⚡",
    accent: "#f43f5e",
    accentRgb: "244, 63, 94",
    modes: ["versus"],
    ruleText: "Format Best of 3: tunggu sinyal 'TEMBAK!' lalu tekan secepat mungkin! Waspada sinyal pengecoh (false start = langsung kalah ronde).",
    initData(mg) {
      mg.data = {
        round: 1,
        scores: [0, 0],
        subPhase: "wait", // "wait" | "fake" | "fire" | "reveal"
        signalText: "BERSIAP...",
        roundMsg: "",
        roundWinnerIdx: -1,
        fireAt: 0,
        fireKey: "",
        fakeCount: 0,
        maxFakes: 1,
        nextEventAt: 0,
        botActionAt: {},
        pendingPress: null
      };
    },
    onEnterGameplay(mg) {
      qdStartRound(mg);
    },
    onAction(mg, seatIdx, actionType, payload) {
      if (actionType !== "qd_fire") return;
      const d = mg.data;
      if (d.subPhase === "reveal") return;

      const actorPos = mg.entries.findIndex((e) => e.playerIndex === seatIdx);
      if (actorPos < 0) return;
      const oppPos = actorPos === 0 ? 1 : 0;
      const actor = mg.entries[actorPos];
      const opp = mg.entries[oppPos];

      if (d.subPhase === "wait" || d.subPhase === "fake" || (payload && payload.falseStart)) {
        playSfx("coin_loss");
        qdResolveRound(mg, oppPos, `FALSE START! ${actor.name} menekan terlalu cepat, ${opp.name} menang ronde!`);
        return;
      }

      if (d.subPhase === "fire") {
        const hostElapsed = Math.max(40, Date.now() - (d.fireAt || Date.now()));
        const clientMs = payload && typeof payload.reactionMs === "number" && payload.reactionMs >= 30 && payload.reactionMs <= 4500 ? Math.round(payload.reactionMs) : hostElapsed;
        const reactionMs = Math.min(hostElapsed, clientMs);
        playSfx("dice_land");
        qdResolveRound(mg, actorPos, `TEMBAK! ${actor.name} tercepat (${reactionMs} ms)!`);
      }
    },
    onBotThink(mg, now) {
      const d = mg.data;
      if (d.subPhase === "reveal") return;
      mg.entries.forEach((e, pos) => {
        if (!e.isBot) return;
        const targetAt = d.botActionAt[e.playerIndex];
        if (targetAt && now >= targetAt) {
          d.botActionAt[e.playerIndex] = 0;
          if (d.subPhase === "fake") {
            const oppPos = pos === 0 ? 1 : 0;
            playSfx("coin_loss");
            qdResolveRound(mg, oppPos, `FALSE START! ${e.name} tertipu sinyal pengecoh, ${mg.entries[oppPos].name} menang ronde!`);
          } else if (d.subPhase === "fire") {
            const ms = Math.max(120, now - (d.fireAt || now));
            playSfx("dice_land");
            qdResolveRound(mg, pos, `TEMBAK! ${e.name} tercepat (${ms} ms)!`);
          }
        }
      });
    },
    onBotStepForce(mg) {
      const d = mg.data;
      if (d.subPhase !== "reveal") {
        const winPos = randInt(0, 1);
        qdResolveRound(mg, winPos, `${mg.entries[winPos].name} memenangkan adu refleks!`);
      }
    },
    onTick(mg, now) {
      const d = mg.data;
      if (d.subPhase === "wait" && now >= d.nextEventAt) {
        if (d.fakeCount < d.maxFakes) {
          d.subPhase = "fake";
          d.fakeCount++;
          d.signalText = pickRandom(QD_FAKE_SIGNALS);
          d.nextEventAt = now + randInt(850, 1300);
          d.botActionAt = {};
          mg.entries.forEach((e) => {
            if (e.isBot && Math.random() < 0.14) {
              d.botActionAt[e.playerIndex] = now + randInt(280, 480);
            }
          });
          playSfx("timer_warn");
          syncAndBroadcast(mg, true);
        } else {
          d.subPhase = "fire";
          d.signalText = "TEMBAK!";
          d.fireAt = now;
          d.botActionAt = {};
          mg.entries.forEach((e) => {
            if (e.isBot) {
              d.botActionAt[e.playerIndex] = now + randInt(310, 640);
            }
          });
          setPhaseTimer(mg, 3800);
          playSfx("turn_reminder", "my_turn");
          syncAndBroadcast(mg, true);
        }
      } else if (d.subPhase === "fake" && now >= d.nextEventAt) {
        d.subPhase = "wait";
        d.signalText = "BERSIAP...";
        d.nextEventAt = now + randInt(900, 1600);
        d.botActionAt = {};
        syncAndBroadcast(mg, true);
      } else if (d.subPhase === "fire" && getHostRemainingMs(mg, now) <= 0) {
        const randWin = randInt(0, 1);
        qdResolveRound(mg, randWin, `Waktu reaksi habis! ${mg.entries[randWin].name} mengambil ronde.`);
      } else if (d.subPhase === "reveal" && getHostRemainingMs(mg, now) <= 0) {
        if (d.scores[0] >= 2 || d.scores[1] >= 2) {
          const winPos = d.scores[0] >= 2 ? 0 : 1;
          mg.entries[0].scoreText = `Skor ${d.scores[0]} - ${d.scores[1]}`;
          mg.entries[1].scoreText = `Skor ${d.scores[1]} - ${d.scores[0]}`;
          transitionToResult(mg, {
            winnerIndices: [mg.entries[winPos].playerIndex]
          });
        } else {
          d.round++;
          qdStartRound(mg);
          syncAndBroadcast(mg, true);
        }
      }
    },
    onKeyDown(mg, e, key) {
      if (mg.data.subPhase === "reveal") return false;
      const humans = getLocalControllableEntries(mg);
      if (humans.length === 0) return false;
      const isTwoLocal = humans.length === 2;
      const isFire = mg.data.subPhase === "fire";
      const reactionMs = isFire && localFireSeenAt ? Math.max(40, Date.now() - localFireSeenAt) : 0;

      if (isTwoLocal) {
        if (key === "a") {
          e.preventDefault();
          dispatchAction("qd_fire", { falseStart: !isFire, reactionMs }, humans[0].playerIndex);
          return true;
        }
        if (key === "l") {
          e.preventDefault();
          dispatchAction("qd_fire", { falseStart: !isFire, reactionMs }, humans[1].playerIndex);
          return true;
        }
      } else if (key === " " || key === "enter") {
        e.preventDefault();
        dispatchAction("qd_fire", { falseStart: !isFire, reactionMs }, humans[0].playerIndex);
        return true;
      }
      return false;
    },
    renderGameplay(mg) {
      const d = mg.data;
      if (d.subPhase === "fire" && localFireSeenKey !== d.fireKey) {
        localFireSeenKey = d.fireKey;
        localFireSeenAt = Date.now();
      }

      const humans = getLocalControllableEntries(mg);
      const isTwoLocal = humans.length === 2;
      const isFire = d.subPhase === "fire";
      const isReveal = d.subPhase === "reveal";

      const bannerCls = isFire ? "is-fire" : d.subPhase === "fake" ? "is-fake" : "is-wait";
      const arenaCls = isFire ? "state-fire" : d.subPhase === "fake" ? "state-fake" : "state-wait";

      let btnHtml = "";
      if (isReveal) {
        btnHtml = `<div class="mg-round-msg">${esc(d.roundMsg)}</div>`;
      } else if (isTwoLocal) {
        btnHtml = `
          <div class="qd-trigger-wrap">
            <button class="qd-trigger-btn ${isFire ? "is-fire-ready" : ""}" onpointerdown="window.EFT_MINIGAMES.quickDrawTrigger(${humans[0].playerIndex})">
              ${esc(humans[0].name)}<br/><span style="font-size:0.78rem;opacity:0.88;">Klik / Tombol [A]</span>
            </button>
            <button class="qd-trigger-btn ${isFire ? "is-fire-ready" : ""}" onpointerdown="window.EFT_MINIGAMES.quickDrawTrigger(${humans[1].playerIndex})">
              ${esc(humans[1].name)}<br/><span style="font-size:0.78rem;opacity:0.88;">Klik / Tombol [L]</span>
            </button>
          </div>`;
      } else if (humans.length === 1) {
        btnHtml = `
          <div class="qd-trigger-wrap">
            <button class="qd-trigger-btn ${isFire ? "is-fire-ready" : ""}" onpointerdown="window.EFT_MINIGAMES.quickDrawTrigger(${humans[0].playerIndex})">
              ${isFire ? "🔫 TEMBAK SEKARANG!" : "⚡ SIAGA (Tunggu TEMBAK!)"}
              <div style="font-size:0.76rem;margin-top:4px;opacity:0.88;">Klik / Tap / Spasi</div>
            </button>
          </div>`;
      } else {
        btnHtml = `<div class="mg-hint-note">Menonton adu refleks 1v1...</div>`;
      }

      return {
        subtitle: `Best of 3 · Ronde ${d.round} · Taruhan 💰 ${mg.wager} TC`,
        bodyHtml: `
          <div class="mg-duel-board">
            ${renderDuelScoreboard(mg, d.scores, `Ronde ${d.round} · Bo3`, 2)}
            <div class="mg-stage-panel" style="padding:0;">
              <div class="qd-arena ${arenaCls}">
                <div class="qd-signal-banner ${bannerCls}">${isReveal ? "HASIL RONDE" : esc(d.signalText)}</div>
                ${btnHtml}
                <div class="mg-hint-note">Jangan terkecoh sinyal palsu seperti "SIAP..." atau "JANGAN!"</div>
              </div>
            </div>
          </div>`
      };
    }
  });

  function quickDrawTrigger(seatIdx) {
    const state = getState();
    const mg = state ? state.activeMinigame : null;
    if (!mg || mg.gameId !== "quick_draw" || mg.phase !== "playing") return;
    if (mg.data.subPhase === "reveal") return;
    const isFire = mg.data.subPhase === "fire";
    const reactionMs = isFire && localFireSeenAt ? Math.max(40, Date.now() - localFireSeenAt) : 0;
    dispatchAction("qd_fire", { falseStart: !isFire, reactionMs }, seatIdx);
  }

  // ============================================================================
  // MINIGAME 4 (VERSUS 1v1): HEADS OR TAIL (BEST OF 3)
  // ============================================================================
  const COIN_CHOOSE_MS = 5000;

  function coinStartRound(mg) {
    const d = mg.data;
    d.subPhase = "choosing";
    d.challengerPick = null;
    d.coinResult = null;
    d.roundMsg = "";
    d.targetDeg = 0;
    d.flipKey = "";
    d.botPickAt = mg.entries[0].isBot ? Date.now() + randInt(950, 1750) : 0;
    setPhaseTimer(mg, COIN_CHOOSE_MS);
  }

  function coinLaunchFlip(mg, pick) {
    const d = mg.data;
    if (d.subPhase !== "choosing") return;
    d.challengerPick = pick === "tails" ? "tails" : "heads";
    d.coinResult = Math.random() < 0.5 ? "heads" : "tails";
    d.subPhase = "flipping";
    const fullSpins = randInt(5, 7) * 360;
    d.targetDeg = fullSpins + (d.coinResult === "tails" ? 180 : 0);
    d.flipKey = "cf_" + mg.id + "_" + d.round + "_" + Date.now();
    playSfx("card_shuffle");
    setPhaseTimer(mg, 1850);
    syncAndBroadcast(mg, true);
  }

  registerMinigame({
    id: "heads_or_tail",
    title: "Heads or Tail",
    shortTitle: "Heads or Tail",
    icon: "🪙",
    accent: "#fbbf24",
    accentRgb: "251, 191, 36",
    modes: ["versus"],
    ruleText: "Format Best of 3: penantang memilih Heads atau Tail dalam 5 detik, lawan otomatis sisi sebaliknya, lalu koin dilempar!",
    initData(mg) {
      mg.data = {
        round: 1,
        scores: [0, 0],
        subPhase: "choosing", // "choosing" | "flipping" | "reveal"
        challengerPick: null,
        coinResult: null,
        targetDeg: 0,
        flipKey: "",
        roundMsg: "",
        botPickAt: 0
      };
    },
    onEnterGameplay(mg) {
      coinStartRound(mg);
    },
    onAction(mg, seatIdx, actionType, payload) {
      if (actionType !== "coin_pick") return;
      if (mg.data.subPhase !== "choosing") return;
      if (seatIdx !== mg.entries[0].playerIndex) return;
      const side = payload && payload.side;
      if (side !== "heads" && side !== "tails") return;
      coinLaunchFlip(mg, side);
    },
    onBotThink(mg, now) {
      const d = mg.data;
      if (d.subPhase === "choosing" && mg.entries[0].isBot && now >= (d.botPickAt || 0)) {
        coinLaunchFlip(mg, Math.random() < 0.5 ? "heads" : "tails");
      }
    },
    onBotStepForce(mg) {
      if (mg.data.subPhase === "choosing") {
        coinLaunchFlip(mg, Math.random() < 0.5 ? "heads" : "tails");
      }
    },
    onTick(mg, now) {
      const d = mg.data;
      const rem = getHostRemainingMs(mg, now);
      if (d.subPhase === "choosing" && rem <= 0) {
        coinLaunchFlip(mg, Math.random() < 0.5 ? "heads" : "tails");
      } else if (d.subPhase === "flipping" && rem <= 0) {
        d.subPhase = "reveal";
        const challengerWon = d.challengerPick === d.coinResult;
        const winPos = challengerWon ? 0 : 1;
        d.scores[winPos]++;
        const sideLabel = d.coinResult === "heads" ? "HEADS (Mahkota)" : "TAIL (Tartarus)";
        d.roundMsg = `Koin mendarat di ${sideLabel}! ${mg.entries[winPos].name} menang ronde ${d.round}!`;
        playSfx("dice_land");
        setPhaseTimer(mg, 1750);
        syncAndBroadcast(mg, true);
      } else if (d.subPhase === "reveal" && rem <= 0) {
        if (d.scores[0] >= 2 || d.scores[1] >= 2) {
          const winPos = d.scores[0] >= 2 ? 0 : 1;
          mg.entries[0].scoreText = `Skor ${d.scores[0]} - ${d.scores[1]}`;
          mg.entries[1].scoreText = `Skor ${d.scores[1]} - ${d.scores[0]}`;
          transitionToResult(mg, {
            winnerIndices: [mg.entries[winPos].playerIndex]
          });
        } else {
          d.round++;
          coinStartRound(mg);
          syncAndBroadcast(mg, true);
        }
      }
    },
    onKeyDown(mg, e, key) {
      if (mg.data.subPhase !== "choosing") return false;
      const ch = mg.entries[0];
      if (!canLocalControlSeat(mg, ch.playerIndex)) return false;
      if (key === "h" || key === "1") {
        e.preventDefault();
        dispatchAction("coin_pick", { side: "heads" }, ch.playerIndex);
        return true;
      }
      if (key === "t" || key === "2") {
        e.preventDefault();
        dispatchAction("coin_pick", { side: "tails" }, ch.playerIndex);
        return true;
      }
      return false;
    },
    renderGameplay(mg) {
      const d = mg.data;
      const p0 = mg.entries[0];
      const p1 = mg.entries[1];
      const canPick = d.subPhase === "choosing" && canLocalControlSeat(mg, p0.playerIndex);
      const p0Side = d.challengerPick ? (d.challengerPick === "heads" ? "HEADS 👑" : "TAIL ⚜️") : "Memilih...";
      const p1Side = d.challengerPick ? (d.challengerPick === "heads" ? "TAIL ⚜️" : "HEADS 👑") : "Otomatis sisi lawan";

      let coinStyle = "";
      let coinCls = "coin-body";
      if (d.subPhase === "choosing") {
        coinCls += " is-idle";
      } else if (d.subPhase === "reveal") {
        coinStyle = `transform: rotateY(${d.targetDeg}deg); transition: none;`;
      } else if (d.subPhase === "flipping") {
        coinStyle =
          d.flipKey && lastAnimatedCoinKey === d.flipKey
            ? `transform: rotateY(${d.targetDeg}deg);`
            : `transform: rotateY(0deg);`;
      }

      let bottomHtml = "";
      if (d.subPhase === "choosing") {
        if (canPick) {
          bottomHtml = `
            <div style="font-size:0.88rem;font-weight:800;color:#fef08a;">${esc(p0.name)}, pilih sisi koin kamu!</div>
            <div class="coin-choice-btns">
              <button class="coin-pick-btn btn-heads" onclick="window.EFT_MINIGAMES.dispatchAction('coin_pick', {side:'heads'}, ${p0.playerIndex})">👑 HEADS <span style="font-size:0.72rem;opacity:0.8;">[H]</span></button>
              <button class="coin-pick-btn btn-tails" onclick="window.EFT_MINIGAMES.dispatchAction('coin_pick', {side:'tails'}, ${p0.playerIndex})">⚜️ TAIL <span style="font-size:0.72rem;opacity:0.8;">[T]</span></button>
            </div>`;
        } else {
          bottomHtml = `<div class="mg-hint-note">Menunggu <strong>${esc(p0.name)}</strong> memilih Heads atau Tail...</div>`;
        }
      } else if (d.subPhase === "flipping") {
        bottomHtml = `<div class="mg-round-msg">Melempar koin takdir...</div>`;
      } else {
        bottomHtml = `<div class="mg-round-msg">${esc(d.roundMsg)}</div>`;
      }

      const coinDomId = `mg-coin-body-${mg.id}-r${d.round}`;

      return {
        subtitle: `Best of 3 · Ronde ${d.round} · Taruhan 💰 ${mg.wager} TC`,
        bodyHtml: `
          <div class="mg-duel-board">
            ${renderDuelScoreboard(mg, d.scores, `Ronde ${d.round} · Bo3`, 2, [p0Side, p1Side])}
            <div class="mg-stage-panel">
              <div class="coin-stage">
                <div class="coin-scene">
                  <div id="${coinDomId}" class="${coinCls}" style="${coinStyle}">
                    <div class="coin-face coin-face-heads">
                      <span class="coin-face-glyph">👑</span>
                      <span class="coin-face-text">HEADS</span>
                    </div>
                    <div class="coin-face coin-face-tails">
                      <span class="coin-face-glyph">⚜️</span>
                      <span class="coin-face-text">TAIL</span>
                    </div>
                  </div>
                </div>
                ${bottomHtml}
              </div>
            </div>
          </div>`,
        afterRender() {
          if (d.subPhase === "flipping" && d.flipKey && lastAnimatedCoinKey !== d.flipKey) {
            lastAnimatedCoinKey = d.flipKey;
            const el = document.getElementById(coinDomId);
            if (el) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  el.style.transform = `rotateY(${d.targetDeg}deg)`;
                });
              });
            }
          }
        }
      };
    }
  });

  // ============================================================================
  // MINIGAME 5 (FFA): REBUTAN PETI (SPLIT OR BUST — 3 RONDE CEPAT)
  // ============================================================================
  const SOB_TOTAL_ROUNDS = 3;
  const SOB_CHOOSE_MS = 10000;

  function sobGenerateChests(roundNum, playerCount) {
    if (roundNum === 1) {
      return [
        { id: 0, tier: "Rendah", value: randInt(4, 6), icon: "🧳" },
        { id: 1, tier: "Sedang", value: randInt(7, 9), icon: "💼" },
        { id: 2, tier: "Tinggi", value: randInt(11, 13), icon: "👑" }
      ];
    }
    if (roundNum === 2) {
      return [
        { id: 0, tier: "Rendah", value: randInt(4, 5), icon: "🧳" },
        { id: 1, tier: "Sedang", value: randInt(6, 8), icon: "💼" },
        { id: 2, tier: "Tinggi", value: randInt(10, 12), icon: "💰" },
        { id: 3, tier: "Jackpot", value: randInt(13, 15), icon: "👑" }
      ];
    }
    // Round 3: high stakes (3 chests for maximum mind-game collision! Max 3-round total = 13 + 15 + 17 = 45 TC)
    const base = [
      { id: 0, tier: "Sedang", value: randInt(7, 9), icon: "💼" },
      { id: 1, tier: "Tinggi", value: randInt(11, 13), icon: "💰" },
      { id: 2, tier: "Jackpot", value: randInt(15, 17), icon: "👑" }
    ];
    if (playerCount <= 2) {
      base.push({ id: 3, tier: "Rendah", value: randInt(4, 6), icon: "🧳" });
    }
    return base;
  }

  function sobStartRound(mg) {
    const d = mg.data;
    d.subPhase = "choosing";
    d.chests = sobGenerateChests(d.round, mg.entries.length);
    d.picks = {};
    d.outcomes = {};
    d.roundGains = {};
    const now = Date.now();
    d.botPickAt = {};
    mg.entries.forEach((e) => {
      if (e.isBot) d.botPickAt[e.playerIndex] = now + randInt(1000, 3600);
    });
    setPhaseTimer(mg, SOB_CHOOSE_MS);
  }

  function sobBotChooseChest(chests) {
    // Weighted by value^1.25 so bots temptingly fight over high chests while still diversifying
    const weights = chests.map((c) => Math.pow(c.value, 1.25));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < chests.length; i++) {
      r -= weights[i];
      if (r <= 0) return chests[i].id;
    }
    return chests[chests.length - 1].id;
  }

  function sobRevealRound(mg) {
    const d = mg.data;
    if (d.subPhase === "reveal") return;

    mg.entries.forEach((e) => {
      if (d.picks[e.playerIndex] === undefined) {
        d.picks[e.playerIndex] = pickRandom(d.chests).id;
      }
    });

    d.subPhase = "reveal";
    d.outcomes = {};
    d.roundGains = {};

    d.chests.forEach((chest) => {
      const pickers = mg.entries.filter((e) => d.picks[e.playerIndex] === chest.id).map((e) => e.playerIndex);
      let kind = "empty";
      let perPlayer = 0;
      if (pickers.length === 1) {
        kind = "full";
        perPlayer = chest.value;
      } else if (pickers.length === 2) {
        kind = "split";
        perPlayer = Math.floor(chest.value / 2);
      } else if (pickers.length >= 3) {
        kind = "bust";
        perPlayer = 0;
      }
      d.outcomes[chest.id] = { kind, pickers, perPlayer };
      pickers.forEach((seatIdx) => {
        const prevTotal = d.totals[seatIdx] || 0;
        const nextTotal = Math.min(FFA_MAX_TC_REWARD, prevTotal + perPlayer);
        d.roundGains[seatIdx] = Math.max(0, nextTotal - prevTotal);
        d.totals[seatIdx] = nextTotal;
      });
    });

    const anyBust = Object.values(d.outcomes).some((o) => o.kind === "bust");
    playSfx(anyBust ? "branch" : "coin_gain");
    setPhaseTimer(mg, 3000);
    syncAndBroadcast(mg, true);
  }

  registerMinigame({
    id: "split_or_bust",
    title: "Rebutan Peti (Split or Bust)",
    shortTitle: "Rebutan Peti",
    icon: "🧰",
    accent: "#38bdf8",
    accentRgb: "56, 189, 248",
    modes: ["ffa"],
    ruleText: "3 ronde cepat (Maks. 45 TC): pilih 1 peti diam-diam! 1 pemain = penuh, 2 pemain = bagi dua, 3+ pemain = HANGUS (0 TC)!",
    initData(mg) {
      const totals = {};
      mg.entries.forEach((e) => {
        totals[e.playerIndex] = 0;
      });
      mg.data = {
        round: 1,
        subPhase: "choosing", // "choosing" | "reveal"
        chests: [],
        picks: {},
        outcomes: {},
        roundGains: {},
        totals,
        botPickAt: {}
      };
    },
    onEnterGameplay(mg) {
      sobStartRound(mg);
    },
    onAction(mg, seatIdx, actionType, payload) {
      if (actionType !== "sob_pick") return;
      const d = mg.data;
      if (d.subPhase !== "choosing") return;
      const chestId = Number(payload && payload.chestId);
      if (!d.chests.some((c) => c.id === chestId)) return;
      if (d.picks[seatIdx] !== undefined) return;

      d.picks[seatIdx] = chestId;
      playSfx("click");

      const allPicked = mg.entries.every((e) => d.picks[e.playerIndex] !== undefined);
      if (allPicked) sobRevealRound(mg);
      else syncAndBroadcast(mg, true);
    },
    onBotThink(mg, now) {
      const d = mg.data;
      if (d.subPhase !== "choosing") return;
      let changed = false;
      mg.entries.forEach((e) => {
        if (e.isBot && d.picks[e.playerIndex] === undefined && now >= (d.botPickAt[e.playerIndex] || 0)) {
          d.picks[e.playerIndex] = sobBotChooseChest(d.chests);
          changed = true;
        }
      });
      if (changed) {
        const allPicked = mg.entries.every((e) => d.picks[e.playerIndex] !== undefined);
        if (allPicked) sobRevealRound(mg);
        else syncAndBroadcast(mg, true);
      }
    },
    onBotStepForce(mg) {
      if (mg.data.subPhase === "choosing") sobRevealRound(mg);
    },
    onTick(mg, now) {
      const d = mg.data;
      const rem = getHostRemainingMs(mg, now);
      if (d.subPhase === "choosing" && rem <= 0) {
        sobRevealRound(mg);
      } else if (d.subPhase === "reveal" && rem <= 0) {
        if (d.round < SOB_TOTAL_ROUNDS) {
          d.round++;
          sobStartRound(mg);
          syncAndBroadcast(mg, true);
        } else {
          const cappedTotals = {};
          mg.entries.forEach((e) => {
            cappedTotals[e.playerIndex] = Math.min(FFA_MAX_TC_REWARD, d.totals[e.playerIndex] || 0);
          });
          const maxEarn = Math.max(...mg.entries.map((e) => cappedTotals[e.playerIndex] || 0));
          const winners = mg.entries.filter((e) => (cappedTotals[e.playerIndex] || 0) === maxEarn && maxEarn > 0);
          mg.entries.forEach((e) => {
            const earned = cappedTotals[e.playerIndex] || 0;
            e.isWinner = winners.some((w) => w.playerIndex === e.playerIndex);
            e.scoreText = `Total Peti: ${earned} TC`;
            e.rewardNote = earned > 0 ? "Rampasan Peti" : "Nihil";
          });
          transitionToResult(mg, {
            winnerIndices: winners.map((w) => w.playerIndex),
            headline: winners.length > 0 ? `Perampas Terbesar: ${winners.map((w) => w.name).join(" & ")}!` : "Semua Peti Hangus!",
            sub: `Total hadiah dari 3 ronde Rebutan Peti (maks. ${FFA_MAX_TC_REWARD} TC) langsung ditambahkan ke saldo TC.`,
            deltas: cappedTotals
          });
        }
      }
    },
    onKeyDown(mg, e, key) {
      if (mg.data.subPhase !== "choosing") return false;
      const idx = Number(key) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= mg.data.chests.length) return false;
      const humans = getLocalControllableEntries(mg);
      const nextHuman = humans.find((h) => mg.data.picks[h.playerIndex] === undefined);
      if (!nextHuman) return false;
      e.preventDefault();
      dispatchAction("sob_pick", { chestId: mg.data.chests[idx].id }, nextHuman.playerIndex);
      return true;
    },
    renderGameplay(mg) {
      const d = mg.data;
      const isReveal = d.subPhase === "reveal";
      const humans = getLocalControllableEntries(mg);
      const activeHuman = humans.find((h) => d.picks[h.playerIndex] === undefined) || null;
      const mySingleHuman = humans.length === 1 ? humans[0] : null;
      const myPick = mySingleHuman ? d.picks[mySingleHuman.playerIndex] : undefined;

      const playersStripHtml = mg.entries
        .map((e) => {
          const picked = d.picks[e.playerIndex] !== undefined;
          const isActing = !isReveal && activeHuman && activeHuman.playerIndex === e.playerIndex;
          const rGain = d.roundGains[e.playerIndex];
          const statusChip = isReveal
            ? rGain > 0
              ? `<span style="color:#6ee7b7;font-weight:900;">+${rGain} TC</span>`
              : `<span style="color:#fda4af;font-weight:900;">0 TC</span>`
            : picked
            ? `<span style="color:#6ee7b7;font-weight:800;">✓ Terkunci</span>`
            : `<span style="color:#94a3b8;">Memilih...</span>`;
          return `
            <div class="sob-player-card ${picked ? "is-picked" : ""} ${isActing ? "is-acting" : ""}">
              <div style="display:flex;align-items:center;gap:7px;min-width:0;">
                <span style="width:10px;height:10px;border-radius:50%;background:${esc(e.color)};flex-shrink:0;"></span>
                <span style="font-weight:800;font-size:0.82rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(e.name)}</span>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.74rem;">
                <span style="color:#fde047;font-weight:800;">💰 ${d.totals[e.playerIndex] || 0}</span>
                ${statusChip}
              </div>
            </div>`;
        })
        .join("");

      const chestsHtml = d.chests
        .map((chest, ci) => {
          const out = isReveal ? d.outcomes[chest.id] : null;
          const cls = ["sob-chest-card"];
          if (!isReveal && !activeHuman) cls.push("is-disabled");
          if (!isReveal && myPick === chest.id) cls.push("is-my-pick");
          if (isReveal && out) {
            cls.push("is-disabled");
            if (out.kind === "full") cls.push("outcome-full");
            else if (out.kind === "split") cls.push("outcome-split");
            else if (out.kind === "bust") cls.push("outcome-bust");
          }

          let footerHtml = "";
          if (isReveal && out) {
            const pickerPills = out.pickers
              .map((sIdx) => {
                const pe = mg.entries.find((e) => e.playerIndex === sIdx);
                return pe ? `<span class="sob-picker-pill" style="--p-color:${esc(pe.color)};">${esc(pe.name)}</span>` : "";
              })
              .join("");
            let badgeHtml = `<span class="sob-outcome-badge is-empty">Tidak Dipilih</span>`;
            if (out.kind === "full") badgeHtml = `<span class="sob-outcome-badge is-full">Penuh +${out.perPlayer} TC</span>`;
            else if (out.kind === "split") badgeHtml = `<span class="sob-outcome-badge is-split">Bagi Dua +${out.perPlayer} TC</span>`;
            else if (out.kind === "bust") badgeHtml = `<span class="sob-outcome-badge is-bust">HANGUS! 0 TC</span>`;
            footerHtml = `<div class="sob-chest-pickers">${pickerPills}</div>${badgeHtml}`;
          } else {
            footerHtml = `
              <div class="sob-chest-pickers">
                ${myPick === chest.id ? `<span class="sob-picker-pill" style="--p-color:#34d399;">Pilihan Kamu</span>` : `<span style="font-size:0.72rem;color:#94a3b8;">Tombol [${ci + 1}]</span>`}
              </div>`;
          }

          const clickAttr = !isReveal && activeHuman ? `onclick="window.EFT_MINIGAMES.dispatchAction('sob_pick', {chestId:${chest.id}}, ${activeHuman.playerIndex})"` : "";

          return `
            <div class="${cls.join(" ")}" ${clickAttr}>
              <span class="sob-chest-tier">Peti #${ci + 1} · ${esc(chest.tier)}</span>
              <div class="sob-chest-icon">${isReveal && out && out.kind === "bust" ? "💥" : isReveal && out && out.pickers.length > 0 ? "✨" : chest.icon}</div>
              <div class="sob-chest-value">💰 ${chest.value} TC</div>
              ${footerHtml}
            </div>`;
        })
        .join("");

      const promptNote = isReveal
        ? `<div class="mg-round-msg">Peti dibuka! 1 pemain = Penuh · 2 pemain = Bagi Dua · 3+ pemain = Hangus!</div>`
        : activeHuman
        ? `<div class="mg-round-msg">${humans.length > 1 ? `Giliran Pilih Rahasia (${esc(activeHuman.name)}): ` : ""}Klik 1 peti sebelum waktu habis!</div>`
        : `<div class="mg-hint-note">Pilihan terkunci! Menunggu pemain lain memilih peti...</div>`;

      return {
        subtitle: `Ronde ${d.round} / ${SOB_TOTAL_ROUNDS} · Pilih 1 Peti Secara Rahasia`,
        bodyHtml: `
          <div class="sob-layout">
            <div class="sob-players-strip">${playersStripHtml}</div>
            ${promptNote}
            <div class="sob-chests-grid">${chestsHtml}</div>
          </div>`
      };
    }
  });

  // ============================================================================
  // MINIGAME 6 (FFA): BLACKJACK (TARUHAN 10s + PARALEL VS DEALER)
  // ============================================================================
  const BJ_MIN_BET = 5;
  const BJ_MAX_BET = FFA_MAX_TC_REWARD;
  const BJ_BET_TIME_MS = 10000;
  const BJ_PLAY_TIME_MS = 32000;
  const BJ_SUITS = ["♠", "♥", "♦", "♣"];
  const BJ_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function bjCreateDeck() {
    const deck = [];
    BJ_SUITS.forEach((suit) => {
      BJ_RANKS.forEach((rank) => {
        deck.push({ rank, suit, isRed: suit === "♥" || suit === "♦" });
      });
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function bjDrawCard(d) {
    if (!d.deck || d.deck.length < 8) {
      d.deck = bjCreateDeck();
    }
    return d.deck.pop();
  }

  function bjEvalHand(cards) {
    let total = 0;
    let aces = 0;
    (cards || []).forEach((c) => {
      if (c.rank === "A") {
        total += 11;
        aces++;
      } else if (c.rank === "K" || c.rank === "Q" || c.rank === "J") {
        total += 10;
      } else {
        total += Number(c.rank) || 0;
      }
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return {
      total,
      isSoft: aces > 0,
      isBust: total > 21,
      isNatural: cards && cards.length === 2 && total === 21
    };
  }

  function bjRenderCardHtml(card, hidden = false) {
    if (hidden) {
      return `<div class="bj-card is-back">✦</div>`;
    }
    return `
      <div class="bj-card ${card.isRed ? "is-red" : ""}">
        <div class="bj-card-rank">${esc(card.rank)}</div>
        <div class="bj-card-suit">${esc(card.suit)}</div>
      </div>`;
  }

  function bjStartDealPhase(mg) {
    const d = mg.data;
    if (d.subPhase !== "betting") return;

    mg.entries.forEach((e) => {
      const seat = d.seats[e.playerIndex];
      if (!seat.betLocked) {
        seat.betLocked = true;
      }
    });

    d.subPhase = "playing";
    d.dealerHand = [bjDrawCard(d), bjDrawCard(d)];
    d.dealerRevealed = false;
    const now = Date.now();

    mg.entries.forEach((e) => {
      const seat = d.seats[e.playerIndex];
      seat.hand = [bjDrawCard(d), bjDrawCard(d)];
      const ev = bjEvalHand(seat.hand);
      if (ev.isNatural) {
        seat.status = "blackjack";
      } else {
        seat.status = "playing";
      }
      seat.botNextAt = e.isBot ? now + randInt(950, 1800) : 0;
    });

    playSfx("card_shuffle");
    if (bjAllPlayersDone(mg)) {
      bjStartDealerTurn(mg);
    } else {
      setPhaseTimer(mg, BJ_PLAY_TIME_MS);
      syncAndBroadcast(mg, true);
    }
  }

  function bjAllPlayersDone(mg) {
    const d = mg.data;
    return mg.entries.every((e) => {
      const s = d.seats[e.playerIndex];
      return s && s.status !== "playing";
    });
  }

  function bjStartDealerTurn(mg) {
    const d = mg.data;
    if (d.subPhase === "dealer" || d.subPhase === "settled") return;

    mg.entries.forEach((e) => {
      const s = d.seats[e.playerIndex];
      if (s && s.status === "playing") s.status = "stand";
    });

    d.subPhase = "dealer";
    d.dealerRevealed = true;
    d.dealerNextDrawAt = Date.now() + 720;
    clearPhaseTimer(mg);
    playSfx("card");
    syncAndBroadcast(mg, true);
  }

  function bjEvaluateOutcomes(mg) {
    const d = mg.data;
    const dealerEv = bjEvalHand(d.dealerHand);
    const deltas = {};
    const winners = [];

    mg.entries.forEach((e) => {
      const s = d.seats[e.playerIndex];
      const pEv = bjEvalHand(s.hand);
      let outcome = "lose";
      let delta = 0;

      if (pEv.isBust) {
        outcome = "bust";
        delta = s.isFreeStake ? 0 : -s.bet;
      } else if (pEv.isNatural && !dealerEv.isNatural) {
        outcome = "blackjack";
        delta = Math.round(s.bet * 1.5);
        winners.push(e.playerIndex);
      } else if (pEv.isNatural && dealerEv.isNatural) {
        outcome = "push";
        delta = 0;
      } else if (dealerEv.isNatural && !pEv.isNatural) {
        outcome = "lose";
        delta = s.isFreeStake ? 0 : -s.bet;
      } else if (dealerEv.isBust || pEv.total > dealerEv.total) {
        outcome = "win";
        delta = s.bet;
        winners.push(e.playerIndex);
      } else if (pEv.total === dealerEv.total) {
        outcome = "push";
        delta = 0;
      } else {
        outcome = "lose";
        delta = s.isFreeStake ? 0 : -s.bet;
      }

      if (delta > 0) {
        delta = Math.min(FFA_MAX_TC_REWARD, delta);
      }

      s.outcome = outcome;
      s.netDelta = delta;
      deltas[e.playerIndex] = delta;

      const labelMap = {
        blackjack: "BLACKJACK! (1.5x)",
        win: "Menang (1x)",
        push: "Seri (Push)",
        lose: s.isFreeStake ? "Kalah (Modal Gratis)" : "Kalah",
        bust: s.isFreeStake ? "Bust (Modal Gratis)" : "Bust"
      };
      e.isWinner = outcome === "blackjack" || outcome === "win";
      e.scoreText = `Kartu ${pEv.total} vs Dealer ${dealerEv.total}`;
      e.rewardNote = `${labelMap[outcome]} · Bet ${s.bet} TC`;
    });

    d.subPhase = "settled";
    d.pendingDeltas = deltas;
    d.pendingWinners = winners;
    setPhaseTimer(mg, 2000);
    playSfx(winners.length > 0 ? "coin_gain" : "branch");
    syncAndBroadcast(mg, true);
  }

  function bjApplyPlayerAction(mg, seatIdx, act) {
    const d = mg.data;
    if (d.subPhase !== "playing") return;
    const s = d.seats[seatIdx];
    if (!s || s.status !== "playing") return;

    if (act === "hit") {
      s.hand.push(bjDrawCard(d));
      const ev = bjEvalHand(s.hand);
      playSfx("card");
      if (ev.isBust) {
        s.status = "bust";
        playSfx("coin_loss");
      } else if (ev.total === 21) {
        s.status = "stand";
      }
    } else if (act === "stand") {
      s.status = "stand";
      playSfx("click");
    } else if (act === "double") {
      const canDouble = s.hand.length === 2 && !s.isFreeStake && s.wallet >= s.bet * 2 && s.bet * 2 <= BJ_MAX_BET;
      if (!canDouble) return;
      s.bet = Math.min(BJ_MAX_BET, s.bet * 2);
      s.doubled = true;
      s.hand.push(bjDrawCard(d));
      const ev = bjEvalHand(s.hand);
      playSfx("card");
      s.status = ev.isBust ? "bust" : "stand";
      if (ev.isBust) playSfx("coin_loss");
    }

    if (bjAllPlayersDone(mg)) {
      bjStartDealerTurn(mg);
    } else {
      syncAndBroadcast(mg, true);
    }
  }

  registerMinigame({
    id: "blackjack",
    title: "Blackjack",
    shortTitle: "Blackjack",
    icon: "🃏",
    accent: "#a855f7",
    accentRgb: "168, 85, 247",
    modes: ["ffa"],
    ruleText: `Pasang taruhan dalam 10 detik (maks. pendapatan +${FFA_MAX_TC_REWARD} TC), lalu main paralel melawan Dealer (mendekati 21 tanpa Bust; Blackjack bayar 1.5x)!`,
    initData(mg) {
      const state = getState();
      const seats = {};
      mg.entries.forEach((e) => {
        const p = state && state.players[e.playerIndex];
        const wallet = p ? Math.max(0, p.tc) : 0;
        const isFreeStake = wallet < BJ_MIN_BET;
        const maxBet = Math.min(wallet, BJ_MAX_BET);
        const defaultBet = isFreeStake ? BJ_MIN_BET : Math.min(maxBet, Math.max(BJ_MIN_BET, Math.floor(maxBet * 0.25)));
        seats[e.playerIndex] = {
          wallet,
          isFreeStake,
          bet: defaultBet,
          betLocked: isFreeStake,
          doubled: false,
          hand: [],
          status: "betting", // "betting" | "playing" | "stand" | "bust" | "blackjack"
          outcome: "",
          netDelta: 0,
          botNextAt: 0
        };
      });
      mg.data = {
        subPhase: "betting", // "betting" | "playing" | "dealer" | "settled"
        deck: bjCreateDeck(),
        dealerHand: [],
        dealerRevealed: false,
        dealerNextDrawAt: 0,
        seats,
        pendingDeltas: {},
        pendingWinners: []
      };
    },
    onEnterGameplay(mg) {
      const now = Date.now();
      mg.entries.forEach((e) => {
        const s = mg.data.seats[e.playerIndex];
        if (e.isBot && !s.betLocked) {
          s.botNextAt = now + randInt(700, 2000);
        }
      });
      if (mg.entries.every((e) => mg.data.seats[e.playerIndex].betLocked)) {
        bjStartDealPhase(mg);
      } else {
        setPhaseTimer(mg, BJ_BET_TIME_MS);
      }
    },
    onAction(mg, seatIdx, actionType, payload) {
      const d = mg.data;
      const s = d.seats[seatIdx];
      if (!s) return;

      if (d.subPhase === "betting") {
        if (s.betLocked) return;
        if (actionType === "bj_set_bet") {
          const maxBet = Math.min(s.wallet, BJ_MAX_BET);
          const val = Math.max(BJ_MIN_BET, Math.min(maxBet, Math.floor(Number(payload && payload.amount) || BJ_MIN_BET)));
          s.bet = val;
          playSfx("click");
          syncAndBroadcast(mg, true);
        } else if (actionType === "bj_lock_bet") {
          s.betLocked = true;
          playSfx("dice_land");
          if (mg.entries.every((e) => d.seats[e.playerIndex].betLocked)) {
            bjStartDealPhase(mg);
          } else {
            syncAndBroadcast(mg, true);
          }
        }
        return;
      }

      if (d.subPhase === "playing") {
        if (actionType === "bj_hit") bjApplyPlayerAction(mg, seatIdx, "hit");
        else if (actionType === "bj_stand") bjApplyPlayerAction(mg, seatIdx, "stand");
        else if (actionType === "bj_double") bjApplyPlayerAction(mg, seatIdx, "double");
      }
    },
    onBotThink(mg, now) {
      const d = mg.data;
      if (d.subPhase === "betting") {
        let changed = false;
        mg.entries.forEach((e) => {
          const s = d.seats[e.playerIndex];
          if (e.isBot && !s.betLocked && now >= (s.botNextAt || 0)) {
            const pcts = [0.2, 0.3, 0.45];
            const pick = pickRandom(pcts);
            const maxBet = Math.min(s.wallet, BJ_MAX_BET);
            s.bet = Math.max(BJ_MIN_BET, Math.min(maxBet, Math.floor(maxBet * pick)));
            s.betLocked = true;
            changed = true;
          }
        });
        if (changed) {
          if (mg.entries.every((e) => d.seats[e.playerIndex].betLocked)) bjStartDealPhase(mg);
          else syncAndBroadcast(mg, true);
        }
      } else if (d.subPhase === "playing") {
        for (let i = 0; i < mg.entries.length; i++) {
          const e = mg.entries[i];
          const s = d.seats[e.playerIndex];
          if (e.isBot && s.status === "playing" && now >= (s.botNextAt || 0)) {
            const ev = bjEvalHand(s.hand);
            const dealerUp = d.dealerHand[0] ? (d.dealerHand[0].rank === "A" ? 11 : ["K", "Q", "J"].includes(d.dealerHand[0].rank) ? 10 : Number(d.dealerHand[0].rank)) : 7;
            const canDouble = s.hand.length === 2 && !s.isFreeStake && s.wallet >= s.bet * 2 && s.bet * 2 <= BJ_MAX_BET;
            s.botNextAt = now + randInt(750, 1200);
            if (canDouble && (ev.total === 10 || ev.total === 11) && dealerUp <= 9 && Math.random() < 0.65) {
              bjApplyPlayerAction(mg, e.playerIndex, "double");
            } else if (ev.total < 17 || (ev.total === 17 && ev.isSoft)) {
              bjApplyPlayerAction(mg, e.playerIndex, "hit");
            } else {
              bjApplyPlayerAction(mg, e.playerIndex, "stand");
            }
            break;
          }
        }
      }
    },
    onBotStepForce(mg) {
      const d = mg.data;
      if (d.subPhase === "betting") bjStartDealPhase(mg);
      else if (d.subPhase === "playing") bjStartDealerTurn(mg);
    },
    onTick(mg, now) {
      const d = mg.data;
      const rem = getHostRemainingMs(mg, now);
      if (d.subPhase === "betting" && rem <= 0) {
        bjStartDealPhase(mg);
      } else if (d.subPhase === "playing" && rem <= 0) {
        bjStartDealerTurn(mg);
      } else if (d.subPhase === "dealer" && now >= (d.dealerNextDrawAt || 0)) {
        const anyNonBust = mg.entries.some((e) => {
          const st = d.seats[e.playerIndex].status;
          return st === "stand" || st === "blackjack";
        });
        const dealerEv = bjEvalHand(d.dealerHand);
        if (anyNonBust && dealerEv.total < 17) {
          d.dealerHand.push(bjDrawCard(d));
          d.dealerNextDrawAt = now + 680;
          playSfx("card");
          syncAndBroadcast(mg, true);
        } else {
          bjEvaluateOutcomes(mg);
        }
      } else if (d.subPhase === "settled" && rem <= 0) {
        const dealerEv = bjEvalHand(d.dealerHand);
        const winCount = (d.pendingWinners || []).length;
        transitionToResult(mg, {
          winnerIndices: d.pendingWinners || [],
          headline: dealerEv.isBust
            ? `Dealer BUST (${dealerEv.total})!`
            : winCount > 0
            ? `Dealer ${dealerEv.total}: ${winCount} Pemain Menang!`
            : `Dealer Menang (${dealerEv.total})!`,
          sub: "Ringkasan hasil taruhan & perubahan saldo TC seluruh pemain.",
          deltas: d.pendingDeltas || {}
        });
      }
    },
    onKeyDown(mg, e, key) {
      const d = mg.data;
      const humans = getLocalControllableEntries(mg);
      if (humans.length === 0) return false;
      if (d.subPhase === "playing") {
        const active = humans.find((h) => d.seats[h.playerIndex].status === "playing");
        if (!active) return false;
        if (key === "h") {
          e.preventDefault();
          dispatchAction("bj_hit", {}, active.playerIndex);
          return true;
        }
        if (key === "s") {
          e.preventDefault();
          dispatchAction("bj_stand", {}, active.playerIndex);
          return true;
        }
        if (key === "d") {
          e.preventDefault();
          dispatchAction("bj_double", {}, active.playerIndex);
          return true;
        }
      }
      return false;
    },
    renderGameplay(mg) {
      const d = mg.data;
      const dealerEv = bjEvalHand(d.dealerHand);
      const dealerScoreText =
        d.subPhase === "betting"
          ? "Menunggu Taruhan"
          : d.dealerRevealed
          ? `${dealerEv.total}${dealerEv.isBust ? " (BUST)" : dealerEv.isNatural ? " (BLACKJACK!)" : ""}`
          : d.dealerHand[0]
          ? `${bjEvalHand([d.dealerHand[0]]).total} + ?`
          : "?";

      const dealerCardsHtml =
        d.subPhase === "betting"
          ? `<div style="font-size:0.82rem;color:#94a3b8;padding:12px 0;">Dealer siap membagikan kartu setelah semua taruhan terkunci...</div>`
          : d.dealerHand.map((card, i) => bjRenderCardHtml(card, !d.dealerRevealed && i === 1)).join("");

      const seatsHtml = mg.entries
        .map((e) => {
          const s = d.seats[e.playerIndex];
          const canControl = canLocalControlSeat(mg, e.playerIndex);
          const ev = bjEvalHand(s.hand);
          const seatCls = ["bj-seat-card"];
          if (canControl) seatCls.push("is-local");
          if (s.outcome) seatCls.push(`outcome-${s.outcome}`);

          let bodyHtml = "";
          if (d.subPhase === "betting") {
            const maxBet = Math.max(BJ_MIN_BET, Math.min(s.wallet, BJ_MAX_BET));
            const q25 = Math.max(BJ_MIN_BET, Math.floor(maxBet * 0.25));
            const q50 = Math.max(BJ_MIN_BET, Math.floor(maxBet * 0.5));
            const qMax = maxBet;
            if (s.isFreeStake) {
              bodyHtml = `
                <div style="font-size:0.78rem;color:#fde68a;background:rgba(245,158,11,0.14);border:1px solid rgba(251,191,36,0.4);border-radius:9px;padding:8px;text-align:center;">
                  Saldo kurang dari ${BJ_MIN_BET} TC, mendapat <strong>Modal Gratis 💰 ${BJ_MIN_BET} TC</strong>!
                </div>`;
            } else if (canControl && !s.betLocked) {
              bodyHtml = `
                <div style="font-size:0.78rem;color:#cbd5e1;display:flex;justify-content:space-between;">
                  <span>Saldo: <strong>💰 ${s.wallet} TC</strong></span>
                  <span style="color:#fde047;font-weight:900;">Taruhan: 💰 ${s.bet} TC</span>
                </div>
                <div class="bj-bet-btns">
                  <button class="bj-quick-btn ${s.bet === BJ_MIN_BET ? "is-active" : ""}" onclick="window.EFT_MINIGAMES.dispatchAction('bj_set_bet', {amount:${BJ_MIN_BET}}, ${e.playerIndex})">Min (${BJ_MIN_BET})</button>
                  <button class="bj-quick-btn ${s.bet === q25 ? "is-active" : ""}" onclick="window.EFT_MINIGAMES.dispatchAction('bj_set_bet', {amount:${q25}}, ${e.playerIndex})">25%</button>
                  <button class="bj-quick-btn ${s.bet === q50 ? "is-active" : ""}" onclick="window.EFT_MINIGAMES.dispatchAction('bj_set_bet', {amount:${q50}}, ${e.playerIndex})">50%</button>
                  <button class="bj-quick-btn ${s.bet === qMax ? "is-active" : ""}" onclick="window.EFT_MINIGAMES.dispatchAction('bj_set_bet', {amount:${qMax}}, ${e.playerIndex})">Max</button>
                </div>
                <button class="bj-act-btn bj-btn-hit" onclick="window.EFT_MINIGAMES.dispatchAction('bj_lock_bet', {}, ${e.playerIndex})">Kunci Taruhan (💰 ${s.bet} TC)</button>`;
            } else {
              bodyHtml = `
                <div style="font-size:0.8rem;color:${s.betLocked ? "#6ee7b7" : "#94a3b8"};text-align:center;padding:10px 0;font-weight:700;">
                  ${s.betLocked ? `✓ Taruhan Terkunci: 💰 ${s.bet} TC` : `Sedang memasang taruhan...`}
                </div>`;
            }
          } else {
            const canDouble = s.hand.length === 2 && !s.isFreeStake && s.wallet >= s.bet * 2 && s.bet * 2 <= BJ_MAX_BET;
            const statusLabels = {
              playing: "Sedang Bermain",
              stand: "Stand",
              bust: "BUST!",
              blackjack: "BLACKJACK!"
            };
            let controls = "";
            if (d.subPhase === "playing" && s.status === "playing" && canControl) {
              controls = `
                <div class="bj-action-row">
                  <button class="bj-act-btn bj-btn-hit" onclick="window.EFT_MINIGAMES.dispatchAction('bj_hit', {}, ${e.playerIndex})">Hit [H]</button>
                  <button class="bj-act-btn bj-btn-stand" onclick="window.EFT_MINIGAMES.dispatchAction('bj_stand', {}, ${e.playerIndex})">Stand [S]</button>
                  <button class="bj-act-btn bj-btn-double" ${canDouble ? "" : "disabled"} title="${canDouble ? "Gandakan taruhan & ambil 1 kartu terakhir" : "Saldo tidak cukup / bukan 2 kartu awal"}" onclick="window.EFT_MINIGAMES.dispatchAction('bj_double', {}, ${e.playerIndex})">2x [D]</button>
                </div>`;
            } else if (d.subPhase === "settled") {
              const sign = s.netDelta > 0 ? "+" : "";
              const dCls = s.netDelta > 0 ? "is-pos" : s.netDelta < 0 ? "is-neg" : "is-zero";
              controls = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.78rem;font-weight:800;color:#fde68a;">${esc((s.outcome || "").toUpperCase())}</span>
                  <span class="mg-delta-pill ${dCls}">${sign}${s.netDelta} TC</span>
                </div>`;
            } else {
              controls = `<div style="font-size:0.76rem;color:#94a3b8;text-align:center;font-weight:700;">${statusLabels[s.status] || ""}</div>`;
            }

            bodyHtml = `
              <div class="bj-cards-row">${s.hand.map((c) => bjRenderCardHtml(c, false)).join("")}</div>
              ${controls}`;
          }

          return `
            <div class="${seatCls.join(" ")}">
              <div class="bj-seat-top">
                <div style="display:flex;align-items:center;gap:7px;min-width:0;">
                  <span style="width:10px;height:10px;border-radius:50%;background:${esc(e.color)};flex-shrink:0;"></span>
                  <span style="font-weight:800;font-size:0.86rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(e.name)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:0.74rem;color:#fde047;font-weight:800;">💰 ${s.bet}${s.doubled ? " (2x)" : ""}${s.isFreeStake ? " Gratis" : ""}</span>
                  ${d.subPhase !== "betting" ? `<span class="bj-score-badge">${ev.total}</span>` : ""}
                </div>
              </div>
              ${bodyHtml}
            </div>`;
        })
        .join("");

      const phaseSub =
        d.subPhase === "betting"
          ? "Fase 1: Pasang Taruhan (10 Detik)"
          : d.subPhase === "playing"
          ? "Fase 2: Bermain Melawan Dealer (Hit / Stand / Double)"
          : d.subPhase === "dealer"
          ? "Giliran Dealer (Wajib Hit hingga ≥ 17)..."
          : "Hasil Ronde Blackjack";

      return {
        subtitle: phaseSub,
        bodyHtml: `
          <div class="bj-layout">
            <div class="bj-dealer-zone">
              <div class="bj-dealer-label">
                <span>🎩 Tartarus Dealer</span>
                <span class="bj-score-badge">${dealerScoreText}</span>
              </div>
              <div class="bj-cards-row">${dealerCardsHtml}</div>
            </div>
            <div class="bj-players-grid">${seatsHtml}</div>
          </div>`
      };
    }
  });

  // ============================================================================
  // SHARED UI RENDERERS (SPIN WHEEL, INTRO, DUEL SCOREBOARD, RESULT)
  // ============================================================================
  function renderDuelScoreboard(mg, scores, roundLabel, targetWins = 2, sideTags = null) {
    const p0 = mg.entries[0];
    const p1 = mg.entries[1];
    const pips = (won) =>
      Array.from({ length: targetWins }, (_, i) => `<span class="mg-pip ${i < won ? "is-won" : ""}"></span>`).join("");

    return `
      <div class="mg-duel-scoreboard">
        <div class="mg-duel-fighter">
          <div class="mg-fighter-portrait" style="--p-color:${esc(p0.color)};--p-rgb:${esc(p0.colorRgb)};">
            ${buildPortraitHtml(p0)}
          </div>
          <div class="mg-fighter-meta">
            <div class="mg-fighter-name">${esc(p0.name)}</div>
            <div class="mg-fighter-tag">${sideTags ? esc(sideTags[0]) : "Penantang"}</div>
            <div class="mg-score-pips">${pips(scores[0] || 0)}</div>
          </div>
        </div>
        <div class="mg-vs-center">
          <div class="mg-vs-score">${scores[0] || 0} - ${scores[1] || 0}</div>
          <div class="mg-vs-round">${esc(roundLabel)}</div>
        </div>
        <div class="mg-duel-fighter is-right">
          <div class="mg-fighter-portrait" style="--p-color:${esc(p1.color)};--p-rgb:${esc(p1.colorRgb)};">
            ${buildPortraitHtml(p1)}
          </div>
          <div class="mg-fighter-meta">
            <div class="mg-fighter-name">${esc(p1.name)}</div>
            <div class="mg-fighter-tag">${sideTags ? esc(sideTags[1]) : "Lawan"}</div>
            <div class="mg-score-pips">${pips(scores[1] || 0)}</div>
          </div>
        </div>
      </div>`;
  }

  function buildSpinWheelSvg(poolDefs) {
    const n = poolDefs.length;
    const cx = 160;
    const cy = 160;
    const r = 154;
    const sliceDeg = 360 / n;
    const sliceColors = ["#113a36", "#1c2c44", "#3b1f38", "#3d2914", "#15364a"];

    const slices = poolDefs
      .map((def, i) => {
        const startDeg = i * sliceDeg - 90;
        const endDeg = (i + 1) * sliceDeg - 90;
        const startRad = (startDeg * Math.PI) / 180;
        const endRad = (endDeg * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        const largeArc = sliceDeg > 180 ? 1 : 0;

        const midDeg = i * sliceDeg + sliceDeg / 2;
        const midRad = ((midDeg - 90) * Math.PI) / 180;
        const iconR = r * 0.72;
        const textR = r * 0.48;
        const ix = cx + iconR * Math.cos(midRad);
        const iy = cy + iconR * Math.sin(midRad);
        const tx = cx + textR * Math.cos(midRad);
        const ty = cy + textR * Math.sin(midRad);

        const bg = sliceColors[i % sliceColors.length];
        return `
          <g>
            <path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z"
                  fill="${bg}" stroke="rgba(253,224,71,0.55)" stroke-width="2" />
            <text x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="26" transform="rotate(${midDeg.toFixed(1)} ${ix.toFixed(1)} ${iy.toFixed(1)})">${def.icon || "★"}</text>
            <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="#f8fafc" font-family="Georgia, serif" font-size="${n >= 4 ? 11.5 : 13}" font-weight="700" transform="rotate(${midDeg.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})">${esc(def.shortTitle || def.title)}</text>
          </g>`;
      })
      .join("");

    return `<svg viewBox="0 0 320 320" aria-hidden="true">${slices}</svg>`;
  }

  function updateWheelLandedVisual(mg) {
    const pill = document.getElementById("mg-wheel-status-pill");
    if (pill) {
      pill.classList.add("is-landed");
      pill.textContent = `Terpilih: ${mg.name}!`;
    }
    const chip = document.getElementById(`mg-pool-chip-${mg.gameId}`);
    if (chip) chip.classList.add("is-winner");
    playSfx("dice_land");
  }

  function renderSelectingPhase(overlay, mg) {
    const existingRotor = document.getElementById(`mg-wheel-rotor-${mg.id}`);
    if (existingRotor && lastAnimatedWheelId === mg.id) {
      if (mg.wheelLanded) updateWheelLandedVisual(mg);
      return;
    }

    const poolDefs = (mg.wheelPoolIds || []).map((id) => getMinigameDef(id)).filter(Boolean);
    const modeLabel = mg.mode === "versus" ? "DUEL VERSUS TILE 1v1" : "MINIGAME AKHIR RONDE";
    const subLabel = mg.mode === "versus" ? `${mg.entries[0]?.name || ""} vs ${mg.entries[1]?.name || ""} · Taruhan 💰 ${mg.wager} TC` : mg.reasonTitle;

    overlay.innerHTML = `
      <div class="mg-shell">
        <div class="mg-wheel-stage">
          <div class="mg-wheel-eyebrow">${esc(modeLabel)}</div>
          <div class="mg-wheel-heading">Memutar Roda Minigame...</div>
          <div style="font-size:0.84rem;color:#cbd5e1;margin-top:-10px;">${esc(subLabel)}</div>

          <div class="mg-wheel-arena">
            <div class="mg-wheel-glow"></div>
            <svg id="mg-wheel-pointer-${mg.id}" class="mg-wheel-pointer" viewBox="0 0 36 42" aria-hidden="true">
              <path d="M18 40 L4 10 Q18 0 32 10 Z" fill="#fde047" stroke="#78350f" stroke-width="2.5" />
            </svg>
            <div class="mg-wheel-rim">
              <div id="mg-wheel-rotor-${mg.id}" class="mg-wheel-rotor">
                ${buildSpinWheelSvg(poolDefs)}
              </div>
              <div class="mg-wheel-hub">SPIN</div>
            </div>
          </div>

          <div id="mg-wheel-status-pill" class="mg-wheel-status-pill ${mg.wheelLanded ? "is-landed" : ""}">
            ${mg.wheelLanded ? `Terpilih: ${esc(mg.name)}!` : "Mengacak minigame dari pool..."}
          </div>

          <div class="mg-wheel-pool-chips">
            ${poolDefs
              .map(
                (def) => `
              <span id="mg-pool-chip-${def.id}" class="mg-pool-chip ${mg.wheelLanded && def.id === mg.gameId ? "is-winner" : ""}">
                ${def.icon || ""} ${esc(def.title)}
              </span>`
              )
              .join("")}
          </div>
        </div>
      </div>`;

    lastAnimatedWheelId = mg.id;
    const rotor = document.getElementById(`mg-wheel-rotor-${mg.id}`);
    const pointer = document.getElementById(`mg-wheel-pointer-${mg.id}`);
    if (rotor) {
      if (mg.wheelLanded) {
        rotor.style.transform = `rotate(${mg.wheelTargetDeg}deg)`;
      } else {
        rotor.style.transform = "rotate(0deg)";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            rotor.style.transition = `transform ${mg.wheelDurationMs}ms cubic-bezier(0.11, 0.86, 0.16, 1)`;
            rotor.style.transform = `rotate(${mg.wheelTargetDeg}deg)`;
          });
        });

        // Decelerating tick SFX synced to wheel slowdown
        wheelAudioTimers.forEach((t) => clearTimeout(t));
        wheelAudioTimers = [];
        const tickTimes = [120, 230, 350, 480, 620, 780, 960, 1170, 1410, 1700, 2050, 2380];
        tickTimes.forEach((ms) => {
          wheelAudioTimers.push(
            setTimeout(() => {
              const cur = getState()?.activeMinigame;
              if (!cur || cur.id !== mg.id || cur.phase !== "selecting") return;
              playSfx("dice_tick");
              if (pointer) {
                pointer.classList.remove("is-ticking");
                void pointer.offsetWidth;
                pointer.classList.add("is-ticking");
              }
            }, ms)
          );
        });
      }
    }
  }

  function renderIntroPhase(overlay, mg) {
    const def = getMinigameDef(mg.gameId) || {};
    const ruleStr = typeof def.ruleText === "object" ? def.ruleText[mg.mode] || "" : def.ruleText || "";
    const modeTag = mg.mode === "versus" ? `Versus 1v1 · Taruhan 💰 ${mg.wager} TC` : `End-of-Round · Semua Pemain`;

    const avatarsHtml = mg.entries
      .map(
        (e) => `
      <div class="mg-avatar-chip" style="--p-color:${esc(e.color)};">
        <span class="mg-avatar-dot">${buildPortraitHtml(e)}</span>
        <span>${esc(e.name)}</span>
      </div>`
      )
      .join("");

    overlay.innerHTML = `
      <div class="mg-shell">
        <div class="mg-intro-stage">
          <div class="mg-intro-card" style="--mg-accent:${esc(def.accent || "#34d399")};--mg-accent-rgb:${esc(def.accentRgb || "52, 211, 153")};">
            <span class="mg-mode-pill ${mg.mode === "versus" ? "mode-versus" : "mode-ffa"}">${esc(modeTag)}</span>
            <div class="mg-intro-icon">${def.icon || "🎮"}</div>
            <h2 class="mg-intro-title">${esc(def.title || mg.name)}</h2>
            <div class="mg-intro-rule">${esc(ruleStr)}</div>
            <div class="mg-intro-players">${avatarsHtml}</div>
            <div class="mg-timer-bar-track" style="max-width:340px;"><div id="mg-timer-bar-fill" class="mg-timer-bar-fill"></div></div>
            <div id="mg-intro-cd" class="mg-intro-countdown">Dimulai dalam 3...</div>
          </div>
        </div>
      </div>`;
    updateLiveTimerDom();
  }

  function renderResultPhase(overlay, mg) {
    const state = getState();
    const sorted = [...mg.entries].sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      return (b.rewardDelta || 0) - (a.rewardDelta || 0);
    });

    const rowsHtml = sorted
      .map((entry) => {
        const p = state && state.players[entry.playerIndex];
        const curTc = p ? p.tc : 0;
        const delta = Number(entry.rewardDelta || 0);
        const sign = delta > 0 ? "+" : "";
        const dCls = delta > 0 ? "is-pos" : delta < 0 ? "is-neg" : "is-zero";
        return `
          <div class="mg-result-row ${entry.isWinner ? "is-winner" : ""}">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <div class="mg-avatar-dot" style="width:36px;height:36px;border-color:${esc(entry.color)};">${buildPortraitHtml(entry)}</div>
              <div style="min-width:0;">
                <div style="font-weight:800;font-size:0.94rem;color:#fff;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span>${esc(entry.name)}</span>
                  ${entry.isWinner ? `<span class="dof-winner-badge" style="font-size:0.64rem;padding:2px 8px;">Winner</span>` : ""}
                </div>
                <div style="font-size:0.74rem;color:#94a3b8;">
                  ${esc(entry.scoreText || entry.rewardNote || "")}${entry.scoreText && entry.rewardNote ? ` · ${esc(entry.rewardNote)}` : ""}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
              <span class="mg-delta-pill ${dCls}">${sign}${delta} TC</span>
              <span style="font-size:0.78rem;color:#fde047;font-weight:800;">💰 ${curTc} TC</span>
            </div>
          </div>`;
      })
      .join("");

    overlay.innerHTML = `
      <div class="mg-shell">
        <div class="mg-result-stage">
          <div class="mg-result-card">
            <div class="mg-result-banner">
              <div class="mg-result-eyebrow">HASIL ${esc(mg.name.toUpperCase())}</div>
              <div class="mg-result-headline">${esc(mg.resultHeadline)}</div>
              <div class="mg-result-sub">${esc(mg.resultSub)}</div>
            </div>
            <div class="mg-result-rows">${rowsHtml}</div>
            <div class="mg-timer-bar-track"><div id="mg-timer-bar-fill" class="mg-timer-bar-fill"></div></div>
            <div class="mg-result-footer">
              <span id="mg-result-cd" class="mg-hint-note">Kembali ke papan dalam 5 detik...</span>
              <button class="dof-finish-btn" onclick="window.EFT_MINIGAMES.finishActiveMinigame()">Kembali ke Papan</button>
            </div>
          </div>
        </div>
      </div>`;
    updateLiveTimerDom();
  }

  function renderOverlay() {
    const overlay = document.getElementById("dice-of-fate-overlay");
    if (!overlay) return;
    const state = getState();
    const mg = state ? state.activeMinigame : null;

    if (!mg) {
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
      lastAnimatedWheelId = null;
      lastAnimatedCoinKey = null;
      return;
    }

    ensureRuntimeLoops();

    // Sync client timer anchor when a new timerToken arrives
    if (isRemoteClient() && mg.timerToken && localTimerAnchor.token !== mg.timerToken) {
      localTimerAnchor = {
        token: mg.timerToken,
        remainingMs: Math.max(0, mg.timerRemainingMs || 0),
        durationMs: Math.max(1, mg.timerDurationMs || 1),
        receivedAt: Date.now()
      };
    }

    overlay.classList.add("visible");

    if (mg.phase === "selecting") {
      renderSelectingPhase(overlay, mg);
      return;
    }
    if (mg.phase === "intro") {
      renderIntroPhase(overlay, mg);
      return;
    }
    if (mg.phase === "result") {
      renderResultPhase(overlay, mg);
      return;
    }

    // Gameplay phase
    const def = getMinigameDef(mg.gameId);
    if (!def || typeof def.renderGameplay !== "function") return;
    const view = def.renderGameplay(mg) || {};
    const modeCls = mg.mode === "versus" ? "mode-versus" : "mode-ffa";
    const modeLabel = mg.mode === "versus" ? "VERSUS 1v1" : "END-OF-ROUND";

    overlay.innerHTML = `
      <div class="mg-shell">
        <div class="mg-header-bar">
          <div class="mg-header-left">
            <span class="mg-mode-pill ${modeCls}">${modeLabel}</span>
            <span class="mg-title">${def.icon || ""} ${esc(def.title || mg.name)}</span>
            <span class="mg-subtitle">${esc(view.subtitle || mg.reasonTitle)}</span>
          </div>
          <div class="mg-header-right">
            ${view.rightExtraHtml || ""}
            <div id="mg-timer-chip" class="mg-timer-chip">
              <span>⏱</span>
              <span id="mg-timer-text">--</span>
            </div>
          </div>
        </div>
        <div class="mg-timer-bar-track"><div id="mg-timer-bar-fill" class="mg-timer-bar-fill"></div></div>
        ${view.bodyHtml || ""}
      </div>`;

    updateLiveTimerDom();
    if (typeof view.afterRender === "function") {
      view.afterRender();
    }
  }

  window.EFT_MINIGAMES = {
    init,
    registerMinigame,
    getPool,
    getMinigameDef,
    startRandomMinigame,
    finishActiveMinigame,
    dispatchAction,
    handleAuthoritativeAction,
    quickDrawTrigger,
    nudgeBotStep,
    handleKeyDown,
    renderOverlay,
    syncRuntime,
    clearAllTimers,
    getCurrentDiceOfFateEntryIndex: (mg) => (mg && mg.gameId === "dice_of_fate" ? dofGetCurrentEntryIdx(mg) : -1)
  };
})();
