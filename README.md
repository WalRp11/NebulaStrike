# NEBULA STRIKE — Retro Space Shooter

A classic arcade-style space shooter built with vanilla JavaScript and HTML5 Canvas. Survive waves of enemies, defeat cosmic bosses, and chain combos for massive scores.

## Features

### Core Gameplay
- **Wave-based combat**: Progressively challenging enemy formations
- **Three boss encounters** per session with unique attack patterns
- **Combo system**: Chain enemy kills for multiplied score rewards
- **Physics-based shield deflection**: Armor absorbs damage based on momentum and kinetic energy
- **Procedural audio**: All sound effects and background music synthesized in real-time via Web Audio API

### Player Mechanics
- **Dual movement systems**: Arrow keys/WASD or mouse aiming
- **Charged shots**: Hold Space (or click) to build up power
- **Dash evasion**: Shift (or right-click) with limited uses per wave
- **Smart bomb**: Immediate screen clear on cooldown
- **Multifire power-ups**: Unlock additional simultaneous weapon slots

### Weapon System
- **8 unique weapons**: Pulse, Burst, Beam, Flare, Blast, Nova, Cannon, Void
- **Progressive unlocking**: Weapons obtained as drops from enemies
- **Single-fire progression**: Start with 1 weapon firing—collect multifire pickups to enable more
- **Per-weapon toggles**: Enable/disable specific weapons (1-8 keys)
- **Mass-based physics**: Each weapon has distinct projectile mass for deflection calculations

### Visual Effects
- **Bloom lighting**: Post-process bloom buffer for glowing effects
- **CRT overlay**: Retro scanline and vignette filter
- **Screen shake**: Dynamic camera feedback on events
- **Particle system**: Explosions, weapon trails, and status effects
- **Floating text**: Score numbers and status messages

### Difficulty Modes
- **EASY**: 65% enemy HP, 55% damage dealt, 140% pickup drops
- **NORMAL**: Baseline difficulty (100% all values)
- **HARD**: 145% enemy HP, 135% damage taken, 180% boss damage
- **NIGHTMARE**: 200% enemy HP, 180% damage taken, 50% pickup drop rate

## How to Play

### Starting the Game
1. Open `index.html` in a web browser
2. Click **PLAY**
3. Select your difficulty level
4. Survive!

### Controls

| Action | Keyboard | Mouse |
|--------|----------|-------|
| Move | Arrow Keys / WASD | - |
| Shoot | Space (hold to charge) | Left Click (hold to charge) |
| Dash | Shift | Right Click |
| Smart Bomb | B | - |
| Pause | P / Esc | - |
| Toggle Weapon (1-8) | 1-8 keys | - |
| Mute Audio | M | - |
| CRT Filter Toggle | C | - |

### Objective
- **Survive 5 waves** of enemies before each boss encounter
- **Defeat 3 bosses** to win
- **Maximize your score** through combo kills and weapon diversity
- **Collect pickups**: Armor, speed boosts, bombs, dashes, and weapons

### Pickup Types
- 🔵 **Armor (S)**: Restore shield health
- ⚡ **Speed**: Increase movement velocity
- 💣 **Bomb**: Gain smart bomb charge
- 🏃 **Dash**: Gain evasion charge
- 💎 **Gem**: Bonus score
- 🔫 **Weapon (W)**: Unlock new weapon
- 🆳 **Multifire (M)**: Unlock additional simultaneous weapons

## Game Mechanics

### Scoring
- Base enemy kill: 100 points
- Combo multiplier: 1.0x → 2.0x → 3.0x → 4.0x (requires consecutive kills)
- Elite enemies: Higher base values (150–250 points)
- Gems: 250 × combo tier
- Boss defeat: 2000 + (100 × wave number)

### Weapon Progression
1. Start with **Pulse** weapon only
2. Defeat enemies to collect **Weapon** pickups (magenta W icons)
3. Each weapon adds to your loadout but fires sequentially
4. Collect **Multifire** pickups (magenta M icons with 3 circles) to unlock additional simultaneous firing slots
5. Toggle weapons on/off (keys 1-8) while keeping at least one active

### Shield System
Armor absorbs damage based on physics:
```
Armor Cost = (ShieldMass × Momentum × DeflectMomentumCost) 
           + (KineticEnergy × DeflectEnergyMultiplier)
```
- Heavy enemy projectiles cost more armor
- Faster projectiles cost more armor
- Charged shots have high kinetic energy
- Difficulty affects armor cost (Nightmare: 2.0x multiplier)

### Boss Encounters
- **3 unique boss designs** with rotating attack patterns
- **5 attack types per boss**: Spiral spread, homing, beam, salvo, and mines
- **Progressive difficulty**: Boss 2 is stronger than Boss 1; Boss 3 is the ultimate challenge
- **Boss defeat rewards**: Guaranteed multifire pickup (if not maxed), +1 bomb, +1 dash, 2000 base score

### Enemy Archetypes
| Type | Behavior | Notes |
|------|----------|-------|
| Drone | Weak, direct approach | Common; fast spawning |
| Kamikaze | Charging ramming attacks | Explodes in shrapnel on death |
| Sniper | Precision homing shots | Elite; high single value |
| Swarm | Spreads projectiles | Weak but numerous |
| Shielded | Heavy armor, slow | Elite; must break shield |
| Tank | High health, power attacks | Elite; rare; high value |
| Specter | Darts evasively | Elite; fast movement |
| Phantom | Cloaks periodically | Elite; hard to hit |
| Pulsar | Emits energy pulses | Elite; dangerous mid-range |

## Technical Details

### Architecture
- **Vanilla JavaScript**: No frameworks or bundlers
- **HTML5 Canvas**: All rendering via 2D context
- **Web Audio API**: Procedural sound synthesis
- **Modular structure**: 10+ separate script files loaded in order

### Performance
- **60 FPS target**: requestAnimationFrame-driven
- **Delta time clamping**: Max 50ms per frame
- **Particle cap**: 5000 particles max with FIFO culling
- **Canvas resolution**: 1000 × 1200 pixels
- **Bloom downsampling**: 4x for performance

### File Structure
```
index.html                 // Page shell, script loader
style.css                  // Styling, animations, overlays
game.js                    // Bootstrap, state, game flow
js/constants.js            // Global constants, weapon defs, balance knobs
js/player_combat.js        // Player rendering, weapon firing
js/enemies_bosses.js       // Enemy spawning, boss AI, enemy bullets
js/pickups_effects.js      // Pickups, particles, floating text
js/update_loop.js          // Main game loop, collision, scoring
js/sfx.js                  // Audio synthesis, music generation
js/rendering.js            // Bloom effects, CRT overlay, composition
js/input.js                // Keyboard/mouse input handling
```

### Dependencies
None! Runs in any modern browser with HTML5 Canvas and Web Audio API support.

## Browser Compatibility
- ✅ Chrome/Edge (67+)
- ✅ Firefox (55+)
- ✅ Safari (11+)
- ❌ Internet Explorer (not supported)

## Development

### Running Locally
Simply open `index.html` in a browser. No build step required.

### Customization
Edit `js/constants.js` to adjust:
- Enemy spawn rates and patterns
- Weapon stats (damage, speed, cooldown, mass)
- Difficulty multipliers
- Balance knobs (combo thresholds, armor costs, pickup drops)
- Enemy and boss behavior parameters

## Credits
**Developer**: WalRp11
**Engine**: HTML5 Canvas, Web Audio API  
**Inspiration**: Classic arcade shooters (Galaga, Asteroids, Gradius)  
**Audio**: Procedurally synthesized  
**Font**: Orbitron

## License
MIT License. Free to use and modify for any purpose. No attribution required but appreciated.

---

**Survive. Score. Ascend.**
