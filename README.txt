DECIMAL BLACKJACK 21.0 v007
Tempo pass: paced dealing, sequential CPU draws, near-21 pauses, bust/death/raise timing, and fixed initial-deal double-advance bug.


v009 polish: game-over flow, title return/replay, victory FX correction, exact RAISE money conservation, tempo refinement.


v012 polish: async session guards, dynamic money gauge scaling, Joker stale-click guard, reset safety audit.


v015 BALANCE AUDIT
10,000 simulated matches: mean 13.67 rounds, median 8, p95 44, max 267; unresolved 0. Symmetric-team wins 5013/4987. Avg raises 0.94. No balance change applied.

v016 TEMPO PASS
Deal 240→185ms; hit 300→230; CPU think 220→170; CPU draw 330→255; near-21 240→200.
Bust 560→480; win pose 400→360; loser reaction 300→260; money 500→440.
Death hold 280→260; collapse 620→560; post-round 600→460; RAISE 1000→900.
Intent: routine actions ~20–25% faster while preserving payoff beats for win/death/RAISE.

v017 PRESENTATION PASS
Session-safe delayed FX/coin/gain callbacks. Key result FX holds extended selectively.
Enemy RAISE is now visibly announced. Added short beat/turn emphasis with reduced-motion fallback.

v019 FINAL POLISH
Final readability/interaction pass: stronger score/money hierarchy, tabular numeric alignment,
clear active-turn outline, stronger enabled/pressed button feedback, RAISE-ready emphasis,
mobile message/score scaling, reduced-motion fallback. No game-rule or balance changes.

v023 ANIMATION ART REPAIR
Curated animation frames per character. Removed frames containing the wrong fighter or severe edge crops.
Four-frame loops are rebuilt only from valid poses; gameplay/CSS/balance unchanged.


v030 FOUNDATION REBUILD (layout / facing / typography)
- Fixed 540x960 logical canvas; the whole game is scaled to fit by JS (fit()).
  All sizes are plain px, so text/cards stay proportional on every screen (no vw/clamp drift).
- Layout follows the mockup: title-art banner + message strip / arena / team bar / YOUR HAND / buttons.
- Stage: allies face right, ENEMY A/B are mirrored (scaleX(-1)) so both sides face each other.
  Back row (ALLY, ENEMY A) stands behind the table, front row (YOU, ENEMY B) faces off in front.
- Seats: outer column = front actor, inner = back actor. Public cards stack upward, score, expression face, money.
- Expression faces face_<type>_0..7 now used (normal/confident/focus/shock/anger/damage/win/skull).
- Actor animations are CSS poses: draw(lean) / stand(nod) / win(hop+glow) / shout / hurt(knockback) / collapse / revive.
  Dead actors switch to a cut-out skeleton (stage_skeleton_*.png).
- New crops from existing art: banner.png (title_screen), ui_bar.png / ui_hand.png / ui_buttons.png (duel_ui_mobile).
- Fixes: double-HIT window during card draw, revived player kept the old busted hand,
  enemy RAISE now announced, RAISE prompt no longer covers cards, JOKER picker marks the best value.
- Rules/balance unchanged. Money conservation verified across RAISE in automated play.
- Note: anim/<enemy>_revive_3.png show the YOU fighter (wrong identity) and are no longer used.


v031 FX + SOUND
SOUND (assets/sound/, 23MB WAV -> 3.1MB MP3 96kbps mono 44.1kHz)
- bgm_title : title, one-shot (no loop). 1st tap = start audio + title BGM, 2nd tap = enter game
- bgm_game  : loops for the whole game, sample-exact (MP3 encoder-delay checked at load)
- se_card (each card), se_button (all buttons), se_money (money taken)
- vo_bust_ally/enemy (BUST), vo_hurt_ally/enemy (hit but alive), vo_dead_ally/enemy (0円),
  vo_roundwin_enemy (enemy wins a round), vo_team_win (one team wiped out)
- Tiny 3–8ms fades added only where a file started/ended on a non-zero sample (click prevention).
  bgm_game untouched (loop seam preserved).
- file:// (opening index.html directly) cannot fetch(), so sound_data.js (base64) is loaded instead.
  If you replace an MP3, regenerate sound_data.js as well (or serve via http and delete it).
- Volumes: Sound.VOL in sound.js (bgm .70 / se .90 / voice 1.0). ♪ button or M key = mute (remembered).

FX (game.js FX kit, all code-generated, no new art)
- Winner attack: lunge (attack) / heavy leap with background blackout at 20.0+ (attackBig)
- Impact: slash lines (double slash on heavy), pixel blood, sparks, shock ring, white flash, screen shake
- BUST: dark smoke + purple flash + slump
- Death: red flash, heavy blood, ash rising, collapse, skeleton drops with dust
- RAISE: blue flash, light pillar, rising particles

SPRITE ANIMATION SLOT (for hand-made frames)
- Put PNGs at assets/stage_anim/<type>_<action>_<n>.png and set counts in STAGE_ANIM (game.js top)
  type: you / ally / enemyA / enemyB  (draw FACING RIGHT, same canvas size, feet aligned)
  action: idle, draw, discard, bust, attack, attackBig, win, shout, hurt, collapse, skeleton, revive
  e.g. const STAGE_ANIM={you:{attack:4,hurt:3},ally:{},enemyA:{},enemyB:{}};  STAGE_FPS=12
  idle / skeleton loop; others play once. CSS motion still runs on top (can be tuned per action).


v032 SPRITES / ORIGINAL CARDS / FONTS / WINDOWS / CLEANUP
SPRITES
- 4 hand-made sheets sliced into 161 frames: assets/stage_anim/<type>_<action>_<n>.png
  (360x360 canvas, facing right, feet on the bottom edge; enemies are mirrored in CSS).
- Actions: idle(loop) turn draw discard attack attackBig win shout hurt bust collapse skeleton(loop) revive.
  Counts live in STAGE_ANIM (game.js). FPS per action in STAGE_FPS.
- Mapping notes: attackBig = step-in(2) + punch(4). win = raised-fist frame (YOU: revive roar with aura removed).
  skeleton = 1st revive frame with the blue aura removed (ALLY uses his own skeleton frame).
CARDS (assets/cards/)
- front / back / joker 180x252, suit_* 96px, emblem_J/Q/K 120px. Rank and decimal are text (readable at any size).
FONTS
- Display: Metal Mania / Text: Pirata One / Numbers: VT323 (all SIL OFL, free).
- Loaded from Google Fonts when online. For offline play, put these files in assets/fonts/:
  MetalMania-Regular.ttf  PirataOne-Regular.ttf  VT323-Regular.ttf   (they take priority automatically)
MONEY: kept in 万 units internally, shown as ¥50M5K (= 50万5千). All UI text is English; protagonist = YOU.
WINDOWS: tall frame = GAME OVER / VICTORY (with final money of all 4), wide frame = JOKER picker.
CLEANUP: removed cleanposes/, anim/, master_sheet, source_atlas, duel_ui_mobile, background.png, old 150x180 frames,
  old stage sprites/faces/skeleton cut-outs, audit note. Backgrounds → JPEG, UI/frames → palette PNG. 29MB → 13MB
  (7MB of that is sound: MP3 + its base64 copy for file://).


v033 PACING / CALLOUTS / NEW SOUNDS / LOCAL FONTS
- New sounds: se_round_start (06), vo_raise (07), vo_roundwin_ally (08 — our side wins a round).
- Fonts bundled locally (assets/fonts): MetalMania (display), PirataOne (text), PixelifySans-SemiBold (numbers). No Google Fonts needed.
- Round start: white flash + shake + se_round_start + big "ROUND n" title card, then dealing.
- Every turn opens with a title card (YOUR TURN / ALLY'S TURN / ENEMY A'S TURN ...). HIT/STAND unlock mid-card.
- RAISE is staged in 3 beats: darkness + shout → white flash + vo_raise + "RAISE!!" card → light pillar & revival.
- Overall tempo slowed with explicit beats (TEMPO in game.js). Idle animation 2.2fps ping-pong, breathing 4.2s.


v034
- Number font: DDJDigits.ttf (original pixel font made for this game: dotted 0, square 5). Covers 0-9 . + - ¥ M K A J Q ? :
  Other letters fall back to Pirata One. Generator script is not needed at runtime. PixelifySans removed.
- Title: title_base.jpg (lettering removed) + title_push.png blinking on top. Title BGM starts immediately where
  autoplay is allowed; otherwise a black "TOUCH TO BEGIN" screen takes the first tap (browser rule), then the title plays with music.
- Leader: the seat with the highest valid hand gets a pulsing score box.
- STAND glows at 20.0+ (SURE_STAND in game.js).
- JOKER picker: values that bust are dimmed (still selectable), exact 21.0 glows red/white, best value glows gold.
- Money ≤20M: light red pulse on portrait + sprite. ≤10M: strong fast red pulse.


v035
- se_joker: JOKER drawn (anyone). Purple+gold double flash, shake, light burst on the card, sparkles, "JOKER!!" callout.
  The JOKER card keeps glowing in hand. Picker opens after the callout; CPU/deal waits for it too.
- se_turn_ally / se_turn_enemy with the turn callout. File names were lost in upload: b743b979 = ally, 717bb20c = enemy (guessed).
  If reversed, swap the names se_turn_ally/se_turn_enemy in game.js.


v036
- Money: digits in white, ¥/M/K in the unit colour (gold for seats, blue/red for team totals, gold in the result window).
- Replaced with volume-adjusted versions: se_turn_ally, se_turn_enemy, vo_team_win, vo_dead_enemy.


v037
- Winner moment: winner freezes on the win pose and shines white/gold with se_win_flash + light burst; the other three darken.
  After the freeze (TEMPO.winFreeze) the attack plays as before.
- Enemy RAISE also plays vo_roundwin_enemy (05) at the start.
- Sound mapping fix: the old "08" file was this winner sound, so it was wrongly used at round start.
  Round start now uses the "06" file; the separate ally round-win voice slot was removed.
