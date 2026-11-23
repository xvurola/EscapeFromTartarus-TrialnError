// ============================================================================
// ESCAPE FROM TARTARUS — OFFICIAL RULEBOOK PATCHES & COMPENDIUM VERSIONS
// ============================================================================

window.EFT_DATA = {
  // 1. RULEBOOK PATCH VERSIONS (Directly from Official .docx files)
  RULE_PATCHES: {
    v0_1: {
      id: "v0_1",
      name: "Rulebook Version 0.1",
      subtitle: "Initial Concept: 2 Phases of 1x d12, Shared Global Shop",
      diceCount: 1,
      diceSides: 12,
      victoryShards: 3,
      shardCost: 100,
      activeShardsOnBoard: 2,
      shardSpawnUnit: "turn",
      shardSpawnInterval: 2,
      turnsPerCycle: 4,
      startTC: 20,
      startHandSize: 6,
      maxHandSize: 8,
      maxSkillsPerTurn: 2,
      riverCost: 15,
      defaultUltCost: 70,
      drawShopCost: 15,
      drawShopStock: 4,
      drawShopPlayerLimit: 2,
      actAgainCost: 15,
      actAgainStock: 2,
      actAgainPlayerLimit: 1,
      minigamePayouts: [30, 15, 15, 10],
      versusBets: [15, 20, 30],
      roundingMode: "round",
      independentShops: false,
      allowHaste: false,
      summary: [
        "Objective: Collect 3 Tartarus Shards (100 TC each). All players start at Spawn with 20 TC.",
        "Time System: 1 Cycle = 4 Turns. Each Turn has 2 movement Phases.",
        "Movement: Roll 1x d12 per Phase (2 to 24 steps per Turn).",
        "Spawn Protection: Players in Spawn who haven't moved cannot be targeted by any Skill Card.",
        "River Shortcut: Pass by entry and pay 15 TC. Warp Teleporter: Exact landing teleports to other Warp.",
        "Merchant Shop: Shared global stock per Cycle (1x Ultimate 70 TC, 4x Card Draw 15 TC, 2x Act Again 15 TC).",
        "End-of-Round Minigame: 1st gets +30 TC, others get +15 / +15 / +10 TC."
      ]
    },
    alpha1_1: {
      id: "alpha1_1",
      name: "Rulebook Patch Alpha 1.1",
      subtitle: "2x d6 Probability Curve, Dynamic d6 Shard Spawning, Independent Shops",
      diceCount: 2,
      diceSides: 6,
      victoryShards: 3,
      shardCost: 100,
      activeShardsOnBoard: 2,
      shardSpawnUnit: "turn",
      shardSpawnInterval: 2,
      turnsPerCycle: 4,
      startTC: 20,
      startHandSize: 6,
      maxHandSize: 8,
      maxSkillsPerTurn: 2,
      riverCost: 15,
      defaultUltCost: 70,
      drawShopCost: 15,
      drawShopStock: 4,
      drawShopPlayerLimit: 2,
      actAgainCost: 15,
      actAgainStock: 2,
      actAgainPlayerLimit: 1,
      minigamePayouts: [30, 15, 15, 10],
      versusBets: [15, 30],
      roundingMode: "round",
      independentShops: true,
      allowHaste: false,
      summary: [
        "Movement Dice System: Switched from 1x d12 to 2x d6 per Phase to stabilize movement probability.",
        "Skill Windows: Strict deployment only during Pre-Phase 1 and Mid-Turn Pause (before rolling dice). Max 2 Skill Cards per Turn.",
        "Dynamic Shard Spawning: 2 Tartarus Shards maintained on board. Every 2 Turns, roll 1x d6 (Zones I–VI) to spawn a Shard. Claim by passing by and paying 100 TC.",
        "Independent Merchant Shops: Shop 1 and Shop 2 have independent stocks. Ultimate Cards (70 TC, [Retain]) have individual stock (max 1 held at a time).",
        "Clash of Fate Minigame: Dice Duel at the end of every full round (1st: +30 TC, 2nd: +15 TC, 3rd: +15 TC, 4th: +10 TC)."
      ]
    },
    alpha1_2: {
      id: "alpha1_2",
      name: "Rulebook Patch Alpha 1.2",
      subtitle: "Adds Law of Fractional Rounding (Always Round Up) & 9 Global Events",
      diceCount: 2,
      diceSides: 6,
      victoryShards: 3,
      shardCost: 100,
      activeShardsOnBoard: 2,
      shardSpawnUnit: "turn",
      shardSpawnInterval: 2,
      turnsPerCycle: 4,
      startTC: 20,
      startHandSize: 6,
      maxHandSize: 8,
      maxSkillsPerTurn: 2,
      riverCost: 15,
      defaultUltCost: 70,
      drawShopCost: 15,
      drawShopStock: 4,
      drawShopPlayerLimit: 2,
      actAgainCost: 15,
      actAgainStock: 2,
      actAgainPlayerLimit: 1,
      minigamePayouts: [30, 15, 15, 10],
      versusBets: [15, 30],
      roundingMode: "ceil",
      independentShops: true,
      allowHaste: false,
      summary: [
        "The Law of Fractional Rounding: Whenever any multiplier, percentage buff, or movement halve (x0.5) results in a decimal, it is ALWAYS rounded UP to the nearest integer (e.g. 7 * 0.5 = 4 steps; 22.1 TC = 23 TC).",
        "Expanded Global Event Registry (9 Events): x2 TC, x2 Steps, x0.5 Steps, +1 Dice, -1 Dice, Sudden Minigame, +25 TC all players, -25 TC all players, and Reset & Shuffle all decks.",
        "Retains 2x d6 movement per Phase, 2 active Shards (spawn every 2 turns), and Independent Merchant Shops 1 & 2."
      ]
    },
    alpha2: {
      id: "alpha2",
      name: "Rulebook Patch Alpha 2",
      subtitle: "3 Active Shards on Board, Respawn Every 2 Cycles, [Haste] Keyword",
      diceCount: 2,
      diceSides: 6,
      victoryShards: 3,
      shardCost: 100,
      activeShardsOnBoard: 3,
      shardSpawnUnit: "cycle",
      shardSpawnInterval: 2,
      turnsPerCycle: 4,
      startTC: 20,
      startHandSize: 6,
      maxHandSize: 8,
      maxSkillsPerTurn: 2,
      riverCost: 15,
      defaultUltCost: 70,
      drawShopCost: 15,
      drawShopStock: 4,
      drawShopPlayerLimit: 2,
      actAgainCost: 15,
      actAgainStock: 2,
      actAgainPlayerLimit: 1,
      minigamePayouts: [30, 15, 15, 10],
      versusBets: [15, 30],
      roundingMode: "ceil",
      independentShops: true,
      allowHaste: true,
      summary: [
        "Turn Anatomy: Standby Phase -> Main Phase 1 -> Roll Dice -> Main Phase 2 -> Roll Dice -> End Turn. All players start at Spawn with 20 TC.",
        "Keyword [Haste]: Cards with [Haste] can be activated outside the player's normal action window (reactive counterplay).",
        "Dynamic Shard Spawning: 3 Tartarus Shards are maintained on the board. New shard spawn sequence triggers every 2 Cycles.",
        "Variable Ultimate Cost: Ultimate Card cost in Merchant Shops now scales per character (e.g. 70 TC standard, 50 TC for Firefly/SAM transformation)."
      ]
    }
  },

  // 2. CHARACTER COMPENDIUM VERSIONS (v0.1, Alpha 1.1, Beta 1)
  COMPENDIUM_VERSIONS: {
    comp_v0_1: {
      id: "comp_v0_1",
      name: "Compendium v0.1 (Initial 4 Characters)",
      availableCharacters: ["bocchi", "aventurine", "joker", "lilith"],
      unavailableCharacters: ["maomao", "firefly"],
      overrides: {
        bocchi: {
          bocchi_r: {
            description: "Move 1–12 blocks forward or backward. (Phase End)",
            choices: [-12, -8, -4, -2, 2, 4, 8, 12]
          },
          bocchi_uq: {
            description: "Passive (1 Cycle): Normal Tiles grant random effect (+1/+2/-1/Act Again)."
          }
        },
        aventurine: {
          avt_c: {
            description: "Steal 5 or 10 TC from one other player.",
            radius: 99
          },
          avt_uc: {
            description: "Gain +25% (x1.25), +50% (x1.5), or x2 TC multiplier on this turn.",
            multipliers: [1.25, 1.5, 2.0]
          },
          avt_uq: {
            description: "Passive (1 Cycle): Increase TC earnings by 1.5x (excluding own skill cards).",
            passiveMultiplier: 1.5
          }
        },
        lilith: {
          lilith_uc: {
            description: "Trap: Place virus token on Normal Tile (3-block radius). Opponent loses 1 dice roll next turn.",
            radius: 3
          },
          lilith_e: {
            description: "Destroy 50% of cards in opponent hands within a 10-block radius.",
            radius: 10
          },
          lilith_uq: {
            name: "Daemonissa's Domain",
            description: "Passive (1 Cycle): Opponents ending within 3 blocks lose 1 die and have Hand-Limit reduced to 5."
          },
          lilith_ult: {
            name: "The Last Lullaby",
            description: "[Retain] Target anywhere skips their next full turn. Lilith gains +1 extra die."
          }
        },
        joker: {
          joker_c: {
            description: "Choose one: Gain 5 TC or draw 1 card from deck.",
            tcGain: 5
          },
          joker_r: {
            description: "Target within 4-block radius loses 15 TC and cannot use Skill Cards for 1 Phase.",
            radius: 4
          }
        }
      }
    },
    comp_alpha1_1: {
      id: "comp_alpha1_1",
      name: "Compendium Alpha 1.1 (Rebalanced 4 Core Characters)",
      availableCharacters: ["bocchi", "aventurine", "joker", "lilith"],
      unavailableCharacters: ["maomao", "firefly"],
      overrides: {
        bocchi: {
          bocchi_r: {
            description: "Move 1-8 blocks forward or backward.",
            choices: [-8, -6, -4, -2, 2, 4, 6, 8]
          }
        },
        aventurine: {
          avt_c: {
            description: "Randomly steal 5 or 10 TC from one other player on a 5 blocks radius.",
            radius: 5
          },
          avt_uc: {
            description: "Gain a x1.25 / x1.5 / x2 multiplier on TC earnings for this turn.",
            multipliers: [1.25, 1.5, 2.0]
          },
          avt_uq: {
            description: "Passive: Increase all TC earnings by 1.3x (does not apply to the results of your own skill cards). Duration: 1 Cycle (expires on Cycle transition).",
            passiveMultiplier: 1.3
          }
        },
        lilith: {
          lilith_uc: {
            description: "Place a trap on a Normal Tile (4-block radius). Opponents who land or pass it lose 1 dice on their next dice roll. (Trap lasted for 1 cycle)",
            radius: 4
          },
          lilith_e: {
            description: "Destroy 50% of the cards in the hands of all opponents within a 8-block radius instantly.",
            radius: 8
          },
          lilith_uq: {
            name: "Unpredictable Tricks",
            description: "Passive: When you pass an opponent or they passed you, they lose 1 random card and must give you 5 TC. Duration: 1 Cycle (expires on Cycle transition)."
          },
          lilith_ult: {
            name: "Dreamfall Showdown",
            description: "[Retain] Target 1 player, skips their next full turn. Lilith gains +1 extra phase and +1 skill use."
          }
        },
        joker: {
          joker_c: {
            description: "Choose one: Gain 10 TC or draw 1 card from the deck.",
            tcGain: 10
          },
          joker_r: {
            description: "Target in a 6-block radius loses 15 TC and is forbidden from using Skill Cards for 1 Phase.",
            radius: 6
          }
        }
      }
    },
    comp_beta1: {
      id: "comp_beta1",
      name: "Compendium Beta 1 (6 Playable · 2 TBA)",
      availableCharacters: ["bocchi", "aventurine", "joker", "lilith", "maomao", "firefly"],
      unavailableCharacters: ["mostima", "arlecchino"],
      overrides: {}
    }
  },

  // 3. BOARD EFFECT DECKS (Positive, Negative, Global Event)
  BOARD_CARDS: {
    positive: [
      { id: "pos_tc_10", name: "+10 Tartarus Coin", category: "Positive Effect", effectType: "tc", value: 10, description: "Gain +10 T-Coins from the bank.", image: "assets/cards/board/pos_tc_10.webp" },
      { id: "pos_tc_15", name: "+15 Tartarus Coin", category: "Positive Effect", effectType: "tc", value: 15, description: "Gain +15 T-Coins from the bank.", image: "assets/cards/board/pos_tc_15.webp" },
      { id: "pos_dice_1", name: "+1 Dice Next Turn", category: "Positive Effect", effectType: "dice_next_turn", value: 1, description: "Gain +1 extra movement die on your next turn.", image: "assets/cards/board/pos_dice_1.webp" },
      { id: "pos_draw_1", name: "Draw 1 Card", category: "Positive Effect", effectType: "draw", value: 1, description: "Draw +1 Skill Card from your character deck.", image: "assets/cards/board/pos_draw_1.webp" },
      { id: "pos_draw_2", name: "Draw 2 Cards", category: "Positive Effect", effectType: "draw", value: 2, description: "Draw +2 Skill Cards from your character deck.", image: "assets/cards/board/pos_draw_2.webp" }
    ],
    negative: [
      { id: "neg_tc_5", name: "-5 Tartarus Coin", category: "Negative Effect", effectType: "tc", value: -5, description: "Lose 5 T-Coins to the bank.", image: "assets/cards/board/neg_tc_5.webp" },
      { id: "neg_tc_10", name: "-10 Tartarus Coin", category: "Negative Effect", effectType: "tc", value: -10, description: "Lose 10 T-Coins to the bank.", image: "assets/cards/board/neg_tc_10.webp" },
      { id: "neg_discard_1", name: "Discard 1 Card", category: "Negative Effect", effectType: "discard", value: 1, description: "Discard 1 card from your hand.", image: "assets/cards/board/neg_discard_1.webp" },
      { id: "neg_discard_2", name: "Discard 2 Cards", category: "Negative Effect", effectType: "discard", value: 2, description: "Discard 2 cards from your hand.", image: "assets/cards/board/neg_discard_2.webp" },
      { id: "neg_dice_1", name: "-1 Dice Next Turn", category: "Negative Effect", effectType: "dice_next_turn", value: -1, description: "Lose 1 movement die on your next turn.", image: "assets/cards/board/neg_dice_1.webp" }
    ],
    globalEvents: [
      { id: "ge_x2_tc", name: "Double Coin Gain (x2 TC)", category: "Global Event", effectType: "global_buff", durationTurns: 2, multiplierTC: 2, description: "All T-Coins earned from tiles or minigames are doubled (x2) for 2 turns.", image: "assets/cards/board/ge_x2_tc.webp" },
      { id: "ge_x2_steps", name: "Double Movement (x2 Steps)", category: "Global Event", effectType: "global_buff", durationTurns: 2, multiplierSteps: 2, description: "All movement dice totals are doubled (x2) for 2 turns.", image: "assets/cards/board/ge_x2_steps.webp" },
      { id: "ge_half_steps", name: "Half Movement (x0.5 Steps)", category: "Global Event", effectType: "global_buff", durationTurns: 2, multiplierSteps: 0.5, description: "All movement dice totals are halved (x0.5) for 2 turns.", image: "assets/cards/board/ge_half_steps.webp" },
      { id: "ge_plus1_dice", name: "+1 Dice (Global)", category: "Global Event", effectType: "global_buff", durationTurns: 2, bonusDice: 1, description: "All players roll +1 extra die per Phase for 2 turns.", image: "assets/cards/board/ge_plus1_dice.webp" },
      { id: "ge_minus1_dice", name: "Suppressed Movement (-1 Dice)", category: "Global Event", effectType: "global_buff", durationTurns: 2, bonusDice: -1, description: "All players roll 1 fewer die per Phase for 2 turns.", image: "assets/cards/board/ge_minus1_dice.webp" },
      { id: "ge_minigame", name: "Sudden Minigame", category: "Global Event", effectType: "instant_minigame", description: "Forces all active players into an immediate Clash of Fate minigame.", image: "assets/cards/board/ge_minigame.webp" },
      { id: "ge_plus25_tc", name: "Underworld Bounty (+25 TC)", category: "Global Event", effectType: "instant_all_tc", value: 25, description: "All players immediately receive +25 T-Coins from the bank.", image: "assets/cards/board/ge_plus25_tc.webp" },
      { id: "ge_minus25_tc", name: "Brimstone Tax (-25 TC)", category: "Global Event", effectType: "instant_all_tc", value: -25, description: "All players immediately lose 25 T-Coins.", image: "assets/cards/board/ge_minus25_tc.webp" },
      { id: "ge_shuffle_deck", name: "Reset & Shuffle All Decks", category: "Global Event", effectType: "instant_shuffle_all", description: "All players shuffle their 12-card decks and draw 6 fresh cards.", image: "assets/cards/board/ge_shuffle_deck.webp" }
    ]
  },

  // 4. BASE CHARACTER DEFINITIONS
  CHARACTERS: {
    bocchi: {
      id: "bocchi",
      name: "Bocchi",
      shortName: "Bocchi",
      title: "The Controller",
      specialty: "Macro-Map Control & Precision Displacement",
      color: "#ec4899",
      colorRgb: "236, 72, 153",
      portrait: { src: "assets/portraits/bocchi.webp", widthPct: 238, leftPct: -53, topPct: -15 },
      compPortrait: { src: "assets/portraits/bocchi.webp", objectPosition: "48% 12%" },
      menuPortrait: "assets/menu-portraits/bocchi.webp",
      chibi: "assets/chibi/bocchi.webp",
      ultCost: 70,
      lore: "Bocchi is the master of the board's grid, manipulating where everyone stands using precise chord step adjustments and mass displacement.",
      cards: [
        { id: "bocchi_c1", name: "C# Chord", rarity: "Common", count: 3, activateTile: true, targetType: "any_player", choices: [1, 2, 3], effectKey: "move_steps", description: "[Activate Block Effect] Move 1/2/3 forward for yourself or other player.", image: "assets/cards/characters/bocchi/c1.webp" },
        { id: "bocchi_c2", name: "Absus4 Chord", rarity: "Common", count: 2, activateTile: true, targetType: "any_player", choices: [-1, -2, -3], effectKey: "move_steps", description: "[Activate Block Effect] Move 1/2/3 backward for yourself or other player.", image: "assets/cards/characters/bocchi/c2.webp" },
        { id: "bocchi_uc", name: "Crowd Surfing", rarity: "Uncommon", count: 3, radius: 5, targetType: "normal_tile_in_radius", effectKey: "teleport_normal_radius", description: "Move to any Normal Tile within a 5-block radius.", image: "assets/cards/characters/bocchi/uc.webp" },
        { id: "bocchi_r", name: "EADBGE", rarity: "Rare", count: 2, choices: [-6, -4, -2, 2, 4, 6], effectKey: "move_self_range", description: "Move 1-6 blocks forward or backward.", image: "assets/cards/characters/bocchi/r.webp" },
        { id: "bocchi_e", name: "Substitute Guitarist", rarity: "Epic", count: 1, activateTile: true, targetType: "other_player", effectKey: "swap_position", description: "[Activate Block Effect] Swap positions with another player.", image: "assets/cards/characters/bocchi/e.webp" },
        { id: "bocchi_uq", name: "The Stage Is Mine", rarity: "Unique", count: 1, effectKey: "passive_stage_is_mine", durationCycles: 1, description: "[Activate Block Effect] Passive: When land on Normal Tiles, choose to move (+1/+2/-1). Duration: 1 Cycle (expires on Cycle transition).", image: "assets/cards/characters/bocchi/uq.webp" }
      ],
      ultimate: {
        id: "bocchi_ult", name: "Bocchi The Rock!", rarity: "Ultimate", cost: 70, retain: true, activateTile: true, targetType: "non_event_tile", effectKey: "pull_all_players", description: "[Retain] Pull all other players to one point and activate tiles effect. (except into global event tiles)", image: "assets/cards/characters/bocchi/ult.webp"
      }
    },

    aventurine: {
      id: "aventurine",
      name: "Aventurine",
      shortName: "Aventurine",
      title: "The Economy Specialist",
      specialty: "Financial Monopoly & High-Stakes Gambling",
      color: "#eab308",
      colorRgb: "234, 179, 8",
      portrait: { src: "assets/portraits/aventurine.webp", widthPct: 215, leftPct: -60, topPct: -1 },
      compPortrait: { src: "assets/portraits/aventurine.webp", objectPosition: "50% 8%" },
      menuPortrait: "assets/menu-portraits/aventurine.webp",
      chibi: "assets/chibi/aventurine.webp",
      ultCost: 70,
      lore: "Aventurine rules the game through raw financial dominance, multi-target theft, exponential wealth multipliers, and all-in Shard duels.",
      cards: [
        { id: "avt_c", name: "That's Mine", rarity: "Common", count: 5, radius: 5, targetType: "opponent_in_radius", effectKey: "steal_5_or_10_tc", description: "Randomly steal 5 or 10 TC from one other player on a 5 blocks radius.", image: "assets/cards/characters/aventurine/c.webp" },
        { id: "avt_uc", name: "The Red or The Black", rarity: "Uncommon", count: 3, effectKey: "turn_tc_multiplier", multipliers: [1.15, 1.3, 1.5], description: "Gain a x1.15 / x1.3 / x1.5 multiplier on TC earnings for this turn.", image: "assets/cards/characters/aventurine/uc.webp" },
        { id: "avt_r", name: "Hand of Midas", rarity: "Rare", count: 2, effectKey: "midas_gold", baseAmounts: [15, 20, 25], multipliers: [0.75, 1.0, 1.5], description: "Gain 15/20/25 TC with a random multiplier of x0.75 / x1 / x1.5.", image: "assets/cards/characters/aventurine/r.webp" },
        { id: "avt_e", name: "The House Always Wins", rarity: "Epic", count: 1, effectKey: "tax_all_opponents_15", description: "Take 15 TC from all opponent. If a player cannot pay, they must surrender 1 random card.", image: "assets/cards/characters/aventurine/e.webp" },
        { id: "avt_uq", name: "IPC Gems", rarity: "Unique", count: 1, effectKey: "passive_ipc_gems", passiveMultiplier: 1.3, durationCycles: 1, description: "Passive: Increase all TC earnings by 1.3x (does not apply to the results of your own skill cards). Duration: 1 Cycle (expires on Cycle transition).", image: "assets/cards/characters/aventurine/uq.webp" }
      ],
      ultimate: {
        id: "avt_ult", name: "Forced All-In", rarity: "Ultimate", cost: 70, retain: true, targetType: "other_player", effectKey: "duel_forced_all_in", description: "[Retain] Duel 1v1 with a bet of 25% of the total of opponent's TC. If you win, you can choose to steal all opponent's TC or 1 Tartarus Shard.", image: "assets/cards/characters/aventurine/ult.webp"
      }
    },

    lilith: {
      id: "lilith",
      name: "Lilith: Daemonissa",
      shortName: "Lilith",
      title: "The Attacker",
      specialty: "Resource Destruction & Turn Denials",
      color: "#ef4444",
      colorRgb: "239, 68, 68",
      portrait: { src: "assets/portraits/lilith.webp", widthPct: 168, leftPct: -37, topPct: -18 },
      compPortrait: { src: "assets/portraits/lilith.webp", objectPosition: "50% 10%" },
      menuPortrait: "assets/menu-portraits/lilith.webp",
      chibi: "assets/chibi/lilith.webp",
      ultCost: 70,
      lore: "Lilith leaves opponents resource-starved by shredding enemy hands, placing proximity virus traps, reversing movement, and skipping turns.",
      cards: [
        { id: "lilith_c", name: "Marionette String", rarity: "Common", count: 5, radius: 5, targetType: "any_player_in_radius", effectKey: "discard_1_or_minus3_steps", description: "Target a player in a 5-block radius, they discard 1 random card. If their hand is empty, the target gets -3 steps on their next dice roll.", image: "assets/cards/characters/lilith/c.webp" },
        { id: "lilith_uc", name: "Punishing Virus", rarity: "Uncommon", count: 3, radius: 4, targetType: "normal_tile_in_radius", effectKey: "place_trap_virus", description: "Place a trap on a 4-block radius Normal Tile. Opponents who land on or pass it lose 1 dice on their next turn (max. 1 per player). (Trap lasted for 1 cycle)", image: "assets/cards/characters/lilith/uc.webp" },
        { id: "lilith_r", name: "Mind Deviation", rarity: "Rare", count: 2, targetType: "any_player", effectKey: "debuff_reverse_move", description: "Target 1 player. The target must move backward according to their first dice roll.", image: "assets/cards/characters/lilith/r.webp" },
        { id: "lilith_e", name: "Soul Extraction", rarity: "Epic", count: 1, radius: 8, targetType: "opponents_in_radius_aoe", effectKey: "destroy_half_hand_radius", description: "Destroy 50% of the cards in the hands randomly of all opponents within a 8-block radius instantly.", image: "assets/cards/characters/lilith/e.webp" },
        { id: "lilith_uq", name: "Unpredictable Tricks", rarity: "Unique", count: 1, effectKey: "passive_unpredictable_tricks", durationCycles: 1, description: "Passive: When you pass an opponent or they passed you, they lose 1 random card and must give you 5 TC. Duration: 1 Full Cycle", image: "assets/cards/characters/lilith/uq.webp" }
      ],
      ultimate: {
        id: "lilith_ult", name: "Dreamfall Showdown", rarity: "Ultimate", cost: 70, retain: true, targetType: "any_player", effectKey: "skip_target_turn_buff_self", description: "[Retain] Target 1 player, skips their next full turn. Lilith gains extra dice roll and +2 skill use.", image: "assets/cards/characters/lilith/ult.webp"
      }
    },

    joker: {
      id: "joker",
      name: "Joker",
      shortName: "Joker",
      title: "The All-Rounder",
      specialty: "Adaptability, Card Stealing & Alternative Win-Conditions",
      color: "#dc2626",
      colorRgb: "220, 38, 38",
      portrait: { src: "assets/portraits/joker.webp", widthPct: 145, leftPct: -7, topPct: -2 },
      compPortrait: { src: "assets/portraits/joker.webp", objectPosition: "50% 8%" },
      menuPortrait: "assets/menu-portraits/joker.webp",
      chibi: "assets/chibi/joker.webp",
      ultCost: 70,
      lore: "A wildcard capable of shifting between card cycling, offensive disruption, mirroring enemy skills, and buying an indestructible Meta-Shard.",
      cards: [
        { id: "joker_c", name: "Showtime!", rarity: "Common", count: 5, tcGain: 10, effectKey: "choice_10tc_or_draw1", description: "Choose one: Gain 10 TC or draw 1 card from the deck.", image: "assets/cards/characters/joker/c.webp" },
        { id: "joker_uc", name: "Phantom Thief", rarity: "Uncommon", count: 3, choices: [1, 2, 3, 4, 5, 6], effectKey: "dash_1_6_steal_card", description: "Move 1-6 blocks. If you land on an opponent's tile, steal 1 random Common/Uncommon/Rare card from them.", image: "assets/cards/characters/joker/uc.webp" },
        { id: "joker_r", name: "All-Out Attack", rarity: "Rare", count: 2, radius: 6, targetType: "any_player_in_radius", effectKey: "aoa_15tc_silence", description: "Target in a 6-block radius loses 15 TC and is forbidden from using Skill Cards for 1 Phase.", image: "assets/cards/characters/joker/r.webp" },
        { id: "joker_e", name: "Will of Rebellion", rarity: "Epic", count: 1, effectKey: "copy_last_skill", description: "Choose and copy the effect of other players' used skill card within this cycle. (When copying a Unique card, the effect only lasts for current turn)", image: "assets/cards/characters/joker/e.webp" },
        { id: "joker_uq", name: "Awaken, Arsene!", rarity: "Unique", count: 1, effectKey: "passive_awaken_arsene", durationCycles: 1, description: "Passive: Each time you land on Positive/Negative effect tile, gain +1 extra dice roll (max. 1 each turn). Duration: 1 Cycle", image: "assets/cards/characters/joker/uq.webp" }
      ],
      ultimate: {
        id: "joker_ult", name: "Meta-Shard", rarity: "Ultimate", cost: 70, retain: true, effectKey: "grant_meta_shard", description: "[Retain] Purchase 1 permanent Meta-Shard that cannot be stolen, seized, or destroyed by opponents. (Can only be bought once per game)", image: "assets/cards/characters/joker/ult.webp"
      }
    },

    maomao: {
      id: "maomao",
      name: "Mao-Mao",
      shortName: "Mao-Mao",
      underDevelopment: true,
      devDisclaimer: "Under Development: Mao-Mao masih dalam tahap pengembangan; efek kartu & keseimbangan dapat berubah sewaktu-waktu.",
      title: "The Apothecary",
      specialty: "Reactive Negation, Threat Mitigation & Area Denial",
      color: "#10b981",
      colorRgb: "16, 185, 129",
      portrait: { src: "assets/portraits/maomao.webp", widthPct: 162, leftPct: -30, topPct: -4 },
      compPortrait: { src: "assets/portraits/maomao.webp", objectPosition: "50% 10%" },
      menuPortrait: "assets/menu-portraits/maomao.webp",
      chibi: "assets/chibi/maomao.webp",
      ultCost: 70,
      lore: "Mao-Mao brings a defensive, anti-meta strategy to Tartarus, canceling enemy actions with swift counters, placing Medicinal Herb tiles, taxing basic cards, and locking down pathways with medical quarantine zones.",
      cards: [
        { id: "maomao_c1", name: "Where's the castle", rarity: "Common", count: 3, effectKey: "choice_move1_2_or_10tc", description: "Move +1/+2 Tiles or gain 10 TC.", image: "assets/cards/characters/maomao/c1.webp" },
        { id: "maomao_c2", name: "Poison Testing", rarity: "Common", count: 2, haste: true, effectKey: "reactive_negate_target", description: "Can only be played when targeted by an opponent's card. Negate the card's effect (Exclude Epic or Ultimate Card). (Cooldown: 1 Turn)", image: "assets/cards/characters/maomao/c2.webp" },
        { id: "maomao_uc", name: "Medicinal Herbs", rarity: "Uncommon", count: 3, radius: 4, targetType: "normal_tile_in_radius", effectKey: "place_herb_tile", description: "Place a \"Herb Tile\" on any Normal Tile in a 4-block radius. When a player lands or passes it, you gain 10 TC or draw 1 card. (Duration: Destroy on activation)", image: "assets/cards/characters/maomao/uc.webp" },
        { id: "maomao_r", name: "No Please", rarity: "Rare", count: 2, haste: true, effectKey: "haste_negate_skill", description: "[Haste] Negate the activation of that skill card. Haste: Can be used outside own turn. (Exclude Epic/Unique/Ultimate Cards) (Cooldown: 1 Turn)", image: "assets/cards/characters/maomao/r.webp" },
        { id: "maomao_e", name: "The Emperor's Favor", rarity: "Epic", count: 1, effectKey: "passive_emperor_tax", durationTurns: 8, description: "Passive: For 2 turns, every time an opponent uses a Common or Uncommon card, they must pay you 5 TC as \"tax\" to activate it.", image: "assets/cards/characters/maomao/e.webp" },
        { id: "maomao_uq", name: "Miasma Cloud", rarity: "Unique", count: 1, effectKey: "passive_miasma_cloud", durationCycles: 1, description: "Passive: When a player starts their play in a 4-block radius from you, they cannot play Epic or Ultimate cards. (Duration: 1 Full Cycle)", image: "assets/cards/characters/maomao/uq.webp" }
      ],
      ultimate: {
        id: "maomao_ult", name: "Grand Apothecary", rarity: "Ultimate", cost: 70, retain: true, targetType: "normal_tile_in_radius", effectKey: "place_restricted_zone", description: "[Retain] Place a \"Restricted Zone\" token on 3 adjacent tiles. Any player landing there must pay 20 TC to you as a \"medical fee\"; if they cannot, they must surrender 1 card. (Duration: Permanent)", image: "assets/cards/characters/maomao/ult.webp"
      }
    },

    firefly: {
      id: "firefly",
      name: "Firefly / SAM",
      shortName: "Firefly",
      underDevelopment: true,
      devDisclaimer: "Under Development: Firefly / SAM masih dalam tahap pengembangan; efek kartu & transformasi SAM dapat berubah sewaktu-waktu.",
      title: "Stellaron Hunter",
      specialty: "Tactical Safe Zones & Complete Combustion Transformation",
      color: "#38bdf8",
      colorRgb: "56, 189, 248",
      portrait: { src: "assets/portraits/firefly.webp", widthPct: 215, leftPct: -54, topPct: -42 },
      compPortrait: { src: "assets/portraits/firefly.webp", objectPosition: "50% 24%" },
      menuPortrait: "assets/menu-portraits/firefly.webp",
      chibi: "assets/chibi/firefly.webp",
      samChibi: "assets/chibi/sam.webp",
      ultCost: 50,
      lore: "Starts in Firefly scouting mode with Safe Zones, deck scouting, and trap relocation, then spends 50 TC to transform into SAM for explosive high-impact combustion combat.",
      cards: [
        { id: "ff_c1", name: "Chronicle of Firefly", rarity: "Common", count: 3, effectKey: "ff_move_1_2_normal_bonus", description: "Move +1 or +2 steps. If you land on a blank Normal Tile, gain 10 TC.", image: "assets/cards/characters/firefly/c1.webp" },
        { id: "ff_c2", name: "Insect's Instinct", rarity: "Common", count: 2, effectKey: "scry_2_keep_1", description: "Look at the top 2 cards of your deck; choose to discard 1 and keep 1.", image: "assets/cards/characters/firefly/c2.webp" },
        { id: "ff_uc", name: "Oak Cake Break", rarity: "Uncommon", count: 3, targetType: "any_tile", effectKey: "place_safe_zone", description: "Create a 3-tiles radius \"Safe Zone\" token anywhere on the map. Any player landing there cannot be targeted by cards until their next phase. (Duration: Destroyed on activation).", image: "assets/cards/characters/firefly/uc.webp" },
        { id: "ff_r", name: "Orderly Retreat", rarity: "Rare", count: 2, haste: true, activateTile: true, effectKey: "retreat_2_negate", description: "[Activate Tile Effect] [Haste] Play when targeted by an opponent's card. Move backward 2 blocks to escape; the opponent's card effect is negated.", image: "assets/cards/characters/firefly/r.webp" },
        { id: "ff_e", name: "Entrusted Dream", rarity: "Epic", count: 1, effectKey: "relocate_board_traps", description: "Change the positions of un-activated Tokens/Trap currently on the board and activate the effect immediately. (Players on top of the trap are affected)", image: "assets/cards/characters/firefly/e.webp" },
        { id: "ff_uq", name: "Stellaron Hunter's Resolve", rarity: "Unique", count: 1, effectKey: "passive_immune_steal", durationCycles: 1, description: "Passive: Immune to card-stealing effects. (Duration: 1 Full Cycle)", image: "assets/cards/characters/firefly/uq.webp" }
      ],
      ultimate: {
        id: "ff_ult", name: "Complete Combustion (SAM)", rarity: "Ultimate", cost: 50, retain: true, effectKey: "transform_to_sam", description: "[50 TC | Retain] Transformation: Discard your current hand. Instantly swap your character and deck to SAM. (Round End)", image: "assets/cards/characters/firefly/ult.webp"
      },
      samCards: [
        { id: "sam_c", name: "BDH: Firefly Type-IV", rarity: "Common", count: 5, choices: [1, 2, 3, 4, 5, 6], effectKey: "sam_dash_aoe_5tc", description: "[SAM] Move 1-6 blocks forward. Deal 5 TC damage to all players within a 1-block radius of your landing spot. (Phase End)", image: "assets/cards/characters/firefly/sam_c.webp" },
        { id: "sam_uc", name: "Supernova Overload", rarity: "Uncommon", count: 3, radius: 4, activateTile: true, targetType: "opponent_in_radius", effectKey: "sam_push_back_3", description: "[SAM] Target an opponent within 4 blocks, push them backward 3 blocks and activate tiles effect. If they hit a Player/Token/Trap along the way, they lose 10 TC.", image: "assets/cards/characters/firefly/sam_uc.webp" },
        { id: "sam_r", name: "Scorched Earth Execution", rarity: "Rare", count: 2, radius: 4, targetType: "opponent_in_radius", effectKey: "sam_discounted_versus", description: "[SAM] Force a player within a 4-block radius into an immediate Versus minigame. SAM pays a discounted entry fee of Free/15 TC bet, while the opponent must bet the standard 15/30 TC.", image: "assets/cards/characters/firefly/sam_r.webp" },
        { id: "sam_e", name: "Deathstar Destruction", rarity: "Epic", count: 1, targetType: "any_tile", effectKey: "sam_fire_tiles", description: "[SAM] Set 2 tiles on fire. Any player landing on them loses 15 TC and their next Phase 1 dice roll cannot exceed 6. (Duration: Destroy on activation)", image: "assets/cards/characters/firefly/sam_e.webp" },
        { id: "sam_uq", name: "Firefly Type-IV Armor", rarity: "Unique", count: 1, effectKey: "passive_sam_armor", durationCycles: 1, description: "[SAM] Passive: Immune to being targeted or debuffed by all Common cards. Additionally, SAM moves +1 step on every dice roll. (Duration: 1 Full Cycle).", image: "assets/cards/characters/firefly/sam_uq.webp" }
      ],
      samUltimate: {
        id: "sam_ult", name: "Cooldown Protocol", rarity: "Ultimate", cost: 50, retain: true, effectKey: "transform_to_firefly", description: "[50 TC | Retain] Transformation: Power down the armor. Discard your current hand and revert back to the Firefly character sheet and deck.", image: "assets/cards/characters/firefly/sam_ult.webp"
      }
    },

    mostima: {
      id: "mostima",
      name: "Mostima",
      shortName: "Mostima",
      origin: "Arknights",
      unavailable: true,
      tba: true,
      title: "TBA · Arknights",
      specialty: "To Be Announced",
      color: "#3b82f6",
      colorRgb: "59, 130, 246",
      portrait: { src: "assets/portraits/mostima.svg", widthPct: 140, leftPct: -20, topPct: -8 },
      compPortrait: { src: "assets/portraits/mostima.svg", objectPosition: "50% 30%" },
      menuPortrait: "assets/menu-portraits/mostima.svg",
      chibi: "",
      ultCost: 70,
      lore: "Coming Soon (TBA): Mostima dari Arknights sedang dalam tahap konsep dan perancangan skill set.",
      cards: [],
      ultimate: null
    },

    arlecchino: {
      id: "arlecchino",
      name: "Arlecchino",
      shortName: "Arlecchino",
      origin: "Genshin Impact",
      unavailable: true,
      tba: true,
      title: "TBA · Genshin Impact",
      specialty: "To Be Announced",
      color: "#e11d48",
      colorRgb: "225, 29, 72",
      portrait: { src: "assets/portraits/arlecchino.svg", widthPct: 140, leftPct: -20, topPct: -8 },
      compPortrait: { src: "assets/portraits/arlecchino.svg", objectPosition: "50% 30%" },
      menuPortrait: "assets/menu-portraits/arlecchino.svg",
      chibi: "",
      ultCost: 70,
      lore: "Coming Soon (TBA): Arlecchino dari Genshin Impact sedang dalam tahap konsep dan perancangan skill set.",
      cards: [],
      ultimate: null
    }
  },

  // 5. SHARD SPAWN ZONES (I to VI)
  SHARD_SPAWNS: [
    { die: 1, roman: "I",   tileId: "T8",   x: 94.5, y: 86.8, label: "Zone I (Bottom-Right)" },
    { die: 2, roman: "II",  tileId: "T24",  x: 90.0, y: 7.2,  label: "Zone II (Top-Right)" },
    { die: 3, roman: "III", tileId: "T78",  x: 53.5, y: 23.0, label: "Zone III (Upper-Center)" },
    { die: 4, roman: "IV",  tileId: "T102", x: 47.2, y: 63.2, label: "Zone IV (Lower-Center)" },
    { die: 5, roman: "V",   tileId: "T89",  x: 21.3, y: 49.5, label: "Zone V (Mid-Left River)" },
    { die: 6, roman: "VI",  tileId: "T63",  x: 13.5, y: 95.8, label: "Zone VI (Bottom-Left Warp)" }
  ],

  // 6. COMPLETE BOARD TILE GRAPH
  BOARD_TILES: [
    { id: "T0",  name: "Spawn Point",      type: "spawn",       x: 61.9, y: 96.4, next: ["T1"] },
    { id: "T1",  name: "Normal Tile",      type: "normal",      x: 61.9, y: 91.9, next: ["T2"] },
    { id: "T2",  name: "+1 Card",          type: "card_plus1",  x: 66.6, y: 93.8, next: ["T3"] },
    { id: "T3",  name: "-5 TC",            type: "tc_minus5",   x: 70.9, y: 96.5, next: ["T4"] },
    { id: "T4",  name: "Negative Effect",  type: "neg_effect",  x: 75.8, y: 94.5, next: ["T5"] },
    { id: "T5",  name: "+10 TC",           type: "tc_plus10",   x: 80.6, y: 93.5, next: ["T6"] },
    { id: "T6",  name: "+1 Card",          type: "card_plus1",  x: 84.9, y: 95.6, next: ["T7"] },
    { id: "T7",  name: "Normal Tile",      type: "normal",      x: 89.4, y: 95.8, next: ["T8"] },
    { id: "T8",  name: "Negative (Zone I)",type: "neg_effect",  x: 90.6, y: 89.9, next: ["T9"], shardZone: 1 },

    { id: "T9",  name: "Normal Tile",      type: "normal",      x: 91.7, y: 82.5, next: ["T10"] },
    { id: "T10", name: "-5 TC",            type: "tc_minus5",   x: 94.3, y: 77.6, next: ["T11"] },
    { id: "T11", name: "-1 Card",          type: "card_minus1", x: 92.0, y: 72.7, next: ["T12"] },
    { id: "T12", name: "+10 TC",           type: "tc_plus10",   x: 88.9, y: 68.9, next: ["T13"] },
    { id: "T13", name: "Global Event",     type: "event",       x: 91.2, y: 64.6, next: ["T14"] },
    { id: "T14", name: "Normal Tile",      type: "normal",      x: 94.8, y: 60.8, next: ["T15"] },
    { id: "T15", name: "+1 Card",          type: "card_plus1",  x: 91.9, y: 56.4, next: ["T16"] },
    { id: "T16", name: "Normal Tile",      type: "normal",      x: 89.0, y: 52.0, next: ["T17"] },
    { id: "T17", name: "+10 TC",           type: "tc_plus10",   x: 91.4, y: 48.1, next: ["T18"] },
    { id: "T18", name: "Branch (Up/Left)", type: "intersect",   x: 91.4, y: 42.3, next: ["T19", "T106"] },
    { id: "T19", name: "-5 TC",            type: "tc_minus5",   x: 92.5, y: 36.5, next: ["T20"] },
    { id: "T20", name: "Normal Tile",      type: "normal",      x: 95.9, y: 32.6, next: ["T21"] },
    { id: "T21", name: "+1 Card",          type: "card_plus1",  x: 92.7, y: 28.3, next: ["T22"] },
    { id: "T22", name: "+10 TC",           type: "tc_plus10",   x: 89.8, y: 24.3, next: ["T23"] },
    { id: "T23", name: "Normal Tile",      type: "normal",      x: 92.5, y: 19.6, next: ["T24_INT"] },
    { id: "T24_INT", name: "Branch (Up/Warp)", type: "intersect", x: 92.3, y: 14.3, next: ["T24", "T115"] },
    { id: "T24", name: "Positive (Zone II)", type: "pos_effect", x: 94.1, y: 9.1, next: ["T25"], shardZone: 2 },
    { id: "T25", name: "-5 TC",            type: "tc_minus5",   x: 94.0, y: 3.6,  next: ["T26"] },

    { id: "T26", name: "+10 TC",           type: "tc_plus10",   x: 88.1, y: 2.6,  next: ["T27"] },
    { id: "T27", name: "Normal Tile",      type: "normal",      x: 84.3, y: 4.5,  next: ["T28"] },
    { id: "T28", name: "-5 TC",            type: "tc_minus5",   x: 79.9, y: 3.2,  next: ["T29"] },
    { id: "T29", name: "-5 TC",            type: "tc_minus5",   x: 75.3, y: 4.3,  next: ["T30"] },
    { id: "T30", name: "+1 Card",          type: "card_plus1",  x: 70.7, y: 3.2,  next: ["T31"] },
    { id: "T31", name: "+10 TC",           type: "tc_plus10",   x: 65.8, y: 5.3,  next: ["T32"] },
    { id: "T32", name: "Versus Duel",      type: "versus",      x: 62.0, y: 3.0,  next: ["T33"] },
    { id: "T33", name: "Normal Tile",      type: "normal",      x: 57.4, y: 4.6,  next: ["T34"] },
    { id: "T34", name: "+1 Card",          type: "card_plus1",  x: 53.2, y: 3.6,  next: ["T35"] },
    { id: "T35", name: "Normal Tile",      type: "normal",      x: 49.5, y: 6.5,  next: ["T36_INT"] },
    { id: "T36", name: "Merchant Shop 1",  type: "merchant",    x: 45.5, y: 3.4,  next: [], shopId: 1, offTrack: true, shopArrow: "down", shopTriggerSplit: "T36_INT" },
    { id: "T36_INT", name: "Branch (Left/Down)", type: "intersect", x: 45.5, y: 9.2, next: ["T37", "T75"] },
    { id: "T37", name: "Normal Tile",      type: "normal",      x: 41.5, y: 8.4,  next: ["T38"] },
    { id: "T38", name: "River Entry",      type: "river_top",   x: 37.5, y: 6.5,  next: ["T39"], riverTarget: "T69" },
    { id: "T39", name: "-5 TC",            type: "tc_minus5",   x: 33.3, y: 5.5,  next: ["T40"] },
    { id: "T40", name: "Normal Tile",      type: "normal",      x: 29.2, y: 7.4,  next: ["T41"] },
    { id: "T41", name: "Trading Post",     type: "trading",     x: 25.4, y: 5.5,  next: ["T42"] },
    { id: "T42", name: "+10 TC",           type: "tc_plus10",   x: 21.5, y: 7.1,  next: ["T43"] },
    { id: "T43", name: "+1 Card",          type: "card_plus1",  x: 18.2, y: 5.1,  next: ["T44"] },
    { id: "T44", name: "+10 TC",           type: "tc_plus10",   x: 14.6, y: 2.8,  next: ["T45"] },
    { id: "T45", name: "+10 TC",           type: "tc_plus10",   x: 10.5, y: 3.2,  next: ["T46"] },
    { id: "T46", name: "-5 TC",            type: "tc_minus5",   x: 6.8,  y: 6.8,  next: ["T47"] },

    { id: "T47", name: "+10 TC",           type: "tc_plus10",   x: 7.2,  y: 12.5, next: ["T48"] },
    { id: "T48", name: "Positive Effect",  type: "pos_effect",  x: 9.8,  y: 17.6, next: ["T49"] },
    { id: "T49", name: "+10 TC",           type: "tc_plus10",   x: 7.8,  y: 22.9, next: ["T50"] },
    { id: "T50", name: "Versus Duel",      type: "versus",      x: 10.8, y: 26.6, next: ["T51"] },
    { id: "T51", name: "Branch (Down/Right)", type: "intersect", x: 13.9, y: 30.9, next: ["T52", "T85"] },
    { id: "T52", name: "Global Event",     type: "event",       x: 12.8, y: 36.3, next: ["T53"] },
    { id: "T53", name: "-5 TC",            type: "tc_minus5",   x: 10.8, y: 40.9, next: ["T54"] },
    { id: "T54", name: "Negative Effect",  type: "neg_effect",  x: 8.7,  y: 45.4, next: ["T55"] },
    { id: "T55", name: "+10 TC",           type: "tc_plus10",   x: 10.8, y: 50.3, next: ["T56"] },
    { id: "T56", name: "Normal Tile",      type: "normal",      x: 8.9,  y: 54.7, next: ["T57"] },
    { id: "T57", name: "Branch (Down/Right)", type: "intersect", x: 10.3, y: 59.8, next: ["T58", "T90"] },
    { id: "T58", name: "Normal Tile",      type: "normal",      x: 10.4, y: 65.4, next: ["T59"] },
    { id: "T59", name: "+1 Card",          type: "card_plus1",  x: 8.2,  y: 70.3, next: ["T60"] },
    { id: "T60", name: "+10 TC",           type: "tc_plus10",   x: 10.7, y: 75.5, next: ["T61"] },
    { id: "T61", name: "-1 Card",          type: "card_minus1", x: 8.3,  y: 80.2, next: ["T62"] },
    { id: "T62", name: "-5 TC",            type: "tc_minus5",   x: 5.3,  y: 84.9, next: ["T62_N"] },
    { id: "T62_N", name: "Normal Tile",    type: "normal",      x: 8.0,  y: 89.6, next: ["T63"] },
    { id: "T63", name: "Warp Bottom (Zone VI)", type: "warp",   x: 10.2, y: 94.7, next: ["T64"], warpTarget: "T116", shardZone: 6 },

    { id: "T64", name: "Positive Effect",  type: "pos_effect",  x: 16.5, y: 96.9, next: ["T65"] },
    { id: "T65", name: "Versus Duel",      type: "versus",      x: 20.0, y: 93.8, next: ["T66"] },
    { id: "T66", name: "+10 TC",           type: "tc_plus10",   x: 24.6, y: 94.8, next: ["T67"] },
    { id: "T67", name: "Normal Tile",      type: "normal",      x: 28.4, y: 90.3, next: ["T68_B"] },
    { id: "T68", name: "Merchant Shop 2",  type: "merchant",    x: 31.0, y: 96.2, next: [], shopId: 2, offTrack: true, shopArrow: "up", shopTriggerEdge: ["T67", "T68_B"] },
    { id: "T68_B", name: "+10 TC",         type: "tc_plus10",   x: 33.5, y: 90.6, next: ["T68_C"] },
    { id: "T68_C", name: "-5 TC",          type: "tc_minus5",   x: 36.7, y: 95.4, next: ["T69"] },
    { id: "T69", name: "River Exit",       type: "river_bottom",x: 41.5, y: 94.3, next: ["T70"] },
    { id: "T70", name: "+1 Card",          type: "card_plus1",  x: 45.6, y: 95.6, next: ["T71"] },
    { id: "T71", name: "Normal Tile",      type: "normal",      x: 49.9, y: 95.9, next: ["T72"] },
    { id: "T72", name: "+10 TC",           type: "tc_plus10",   x: 54.1, y: 97.2, next: ["T73"] },
    { id: "T73", name: "Spawn Crossroad",  type: "intersect",   x: 57.9, y: 94.7, next: ["T1", "T121"] },

    { id: "T75", name: "Normal Tile",      type: "normal",      x: 45.5, y: 15.0, next: ["T76"] },
    { id: "T76", name: "-1 Card",          type: "card_minus1", x: 45.6, y: 20.4, next: ["T77"] },
    { id: "T77", name: "+10 TC",           type: "tc_plus10",   x: 49.7, y: 21.2, next: ["T78"] },
    { id: "T78", name: "Normal (Zone III)",type: "normal",      x: 50.9, y: 27.0, next: ["T79"], shardZone: 3 },
    { id: "T79", name: "-5 TC",            type: "tc_minus5",   x: 55.2, y: 28.5, next: ["T80"] },
    { id: "T80", name: "+10 TC",           type: "tc_plus10",   x: 59.5, y: 28.6, next: ["T81"] },
    { id: "T81", name: "Normal Tile",      type: "normal",      x: 60.3, y: 34.0, next: ["T82"] },
    { id: "T82", name: "+10 TC",           type: "tc_plus10",   x: 64.0, y: 38.1, next: ["T83"] },
    { id: "T83", name: "Central-Right Branch", type: "intersect", x: 68.1, y: 39.2, next: ["T84"] },
    { id: "T84", name: "+1 Card",          type: "card_plus1",  x: 67.3, y: 45.1, next: ["T84_B"] },
    { id: "T84_B", name: "Global Event",   type: "event",       x: 69.8, y: 49.8, next: ["T84_C"] },
    { id: "T84_C", name: "Normal Tile",    type: "normal",      x: 69.3, y: 55.4, next: ["T110"] },

    { id: "T85", name: "-5 TC",            type: "tc_minus5",   x: 18.0, y: 29.6, next: ["T86"] },
    { id: "T86", name: "Negative Effect",  type: "neg_effect",  x: 22.1, y: 30.5, next: ["T87"] },
    { id: "T87", name: "Normal Tile",      type: "normal",      x: 26.1, y: 33.7, next: ["T88"] },
    { id: "T88", name: "+1 Card",          type: "card_plus1",  x: 29.2, y: 39.2, next: ["T89"] },
    { id: "T89", name: "+10 TC (Zone V)",  type: "tc_plus10",   x: 31.4, y: 45.1, next: ["T94"], shardZone: 5 },

    { id: "T90", name: "Positive Effect",  type: "pos_effect",  x: 14.1, y: 60.1, next: ["T91"] },
    { id: "T91", name: "+10 TC",           type: "tc_plus10",   x: 18.1, y: 61.1, next: ["T92"] },
    { id: "T92", name: "Normal Tile",      type: "normal",      x: 22.8, y: 62.5, next: ["T93"] },
    { id: "T93", name: "-5 TC",            type: "tc_minus5",   x: 27.0, y: 59.8, next: ["T93_B"] },
    { id: "T93_B", name: "-1 Card",        type: "card_minus1", x: 31.3, y: 56.2, next: ["T94"] },

    { id: "T94", name: "4-Way Crossroad",  type: "intersect",   x: 33.9, y: 51.0, next: ["T95", "T99"] },

    { id: "T95", name: "Normal Tile",      type: "normal",      x: 37.4, y: 47.7, next: ["T96"] },
    { id: "T96", name: "+10 TC",           type: "tc_plus10",   x: 40.8, y: 44.6, next: ["T96_B"] },
    { id: "T96_B", name: "Negative Effect",type: "neg_effect",  x: 38.7, y: 39.8, next: ["T96_C"] },
    { id: "T96_C", name: "Normal Tile",    type: "normal",      x: 40.8, y: 34.8, next: ["T97"] },
    { id: "T97", name: "-5 TC",            type: "tc_minus5",   x: 44.2, y: 32.6, next: ["T97_B"] },
    { id: "T97_B", name: "Normal Tile",    type: "normal",      x: 47.7, y: 35.6, next: ["T98"] },
    { id: "T98", name: "+10 TC",           type: "tc_plus10",   x: 48.7, y: 41.0, next: ["T98_B"] },
    { id: "T98_B", name: "-5 TC",          type: "tc_minus5",   x: 50.7, y: 46.0, next: ["T98_C"] },
    { id: "T98_C", name: "+10 TC",         type: "tc_plus10",   x: 54.4, y: 46.0, next: ["T105"] },

    { id: "T99",  name: "+10 TC",          type: "tc_plus10",   x: 37.4, y: 54.2, next: ["T100"] },
    { id: "T100", name: "Normal Tile",     type: "normal",      x: 41.1, y: 56.8, next: ["T101"] },
    { id: "T101", name: "-5 TC",           type: "tc_minus5",   x: 39.8, y: 61.8, next: ["T101_B"] },
    { id: "T101_B", name: "+10 TC",        type: "tc_plus10",   x: 42.8, y: 65.4, next: ["T101_C"] },
    { id: "T101_C", name: "Normal Tile",   type: "normal",      x: 45.4, y: 70.1, next: ["T102"] },
    { id: "T102", name: "-5 TC (Zone IV)", type: "tc_minus5",   x: 48.4, y: 66.8, next: ["T103"], shardZone: 4 },
    { id: "T103", name: "+10 TC",          type: "tc_plus10",   x: 50.5, y: 60.3, next: ["T104"] },
    { id: "T104", name: "+1 Card",         type: "card_plus1",  x: 50.3, y: 54.7, next: ["T104_B"] },
    { id: "T104_B", name: "Normal Tile",   type: "normal",      x: 54.1, y: 55.1, next: ["T105"] },

    { id: "T105", name: "Central Switch",  type: "intersect",   x: 54.5, y: 50.8, next: ["T98_C", "T104_B"] },

    { id: "T106", name: "Normal Tile",     type: "normal",      x: 87.4, y: 43.2, next: ["T107"] },
    { id: "T107", name: "+10 TC",          type: "tc_plus10",   x: 83.6, y: 47.7, next: ["T108"] },
    { id: "T108", name: "-5 TC",           type: "tc_minus5",   x: 81.2, y: 52.8, next: ["T109"] },
    { id: "T109", name: "Positive Effect", type: "pos_effect",  x: 76.7, y: 55.4, next: ["T109_B"] },
    { id: "T109_B", name: "+10 TC",        type: "tc_plus10",   x: 72.8, y: 60.3, next: ["T110"] },
    { id: "T110", name: "-1 Card",         type: "card_minus1", x: 68.8, y: 61.3, next: ["T111"] },
    { id: "T111", name: "+10 TC",          type: "tc_plus10",   x: 65.3, y: 59.2, next: ["T112"] },
    { id: "T112", name: "+1 Card",         type: "card_plus1",  x: 61.7, y: 56.2, next: ["T113"] },
    { id: "T113", name: "Normal Tile",     type: "normal",      x: 58.3, y: 53.1, next: ["T105"] },
    { id: "T114", name: "Normal Tile",     type: "normal",      x: 59.0, y: 60.7, next: ["T112"] },

    { id: "T115", name: "Normal Tile",     type: "normal",      x: 88.1, y: 15.0, next: ["T116"] },
    { id: "T116", name: "Warp Top-Right",  type: "warp",        x: 84.1, y: 15.0, next: ["T117"], warpTarget: "T63" },
    { id: "T117", name: "+10 TC",          type: "tc_plus10",   x: 80.1, y: 17.2, next: ["T118"] },
    { id: "T118", name: "Normal Tile",     type: "normal",      x: 76.4, y: 20.7, next: ["T119"] },
    { id: "T119", name: "-1 Card",         type: "card_minus1", x: 76.4, y: 27.3, next: ["T120"] },
    { id: "T120", name: "+10 TC",          type: "tc_plus10",   x: 72.6, y: 31.0, next: ["T120_B"] },
    { id: "T120_B", name: "-5 TC",         type: "tc_minus5",   x: 71.7, y: 36.9, next: ["T83"] },

    { id: "T121", name: "Normal Tile",     type: "normal",      x: 56.5, y: 89.6, next: ["T122"] },
    { id: "T122", name: "-1 Card",         type: "card_minus1", x: 53.2, y: 84.9, next: ["T123"] },
    { id: "T123", name: "+10 TC",          type: "tc_plus10",   x: 55.6, y: 80.6, next: ["T124"] },
    { id: "T124", name: "Trading Post",    type: "trading",     x: 59.5, y: 82.5, next: ["T125"] },
    { id: "T125", name: "+1 Card",         type: "card_plus1",  x: 59.2, y: 76.3, next: ["T126"] },
    { id: "T126", name: "-5 TC",           type: "tc_minus5",   x: 55.8, y: 72.9, next: ["T127"] },
    { id: "T127", name: "Normal Tile",     type: "normal",      x: 53.6, y: 68.3, next: ["T128"] },
    { id: "T128", name: "+10 TC",          type: "tc_plus10",   x: 57.3, y: 65.6, next: ["T114"] }
  ]
};
