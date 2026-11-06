/**
 * 1943: The Battle of Midway - Arcade Game Engine
 * Features:
 * - Carrier Takeoff Animation (航母升空過場動畫)
 * - Progressive Stage-by-Stage Difficulty (逐關難度上升與彈幕增加)
 * - Boss Dossier Cinematic Introduction (魔王出場介紹與規格)
 * - Boss Sunk Confirmation Announcement (擊破此關魔王全名)
 * - Collectible Golden Stars (打掉飛機掉落加分星星)
 * - Post-Stage Debriefing Report (過關數據報告: 擊落數、星星數、分數、評價)
 * - 5 Stages with Infinite Loop System & Leaderboard Name Entry
 */

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = 600;
        this.height = 800;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.credits = 0;

        // Stage & Loop
        this.stage = 1;
        this.maxStages = 5;
        this.loop = 1;
        this.stageTime = 0;
        this.stageIntroTimer = 0;

        // Game States: 'TITLE', 'CARRIER_TAKEOFF', 'STAGE_INTRO', 'PLAYING', 'BOSS_INTRO', 'STAGE_REPORT', 'PAUSED', 'NAME_ENTRY', 'LEADERBOARD', 'GAMEOVER'
        this.state = 'TITLE';

        // Takeoff Animation
        this.takeoffFrame = 0;
        this.takeoffDuration = 240; // ~4 seconds

        // Boss Intro Dossier
        this.bossIntroTimer = 0;
        this.currentBossData = null;

        // Scores & Stats Tracking
        this.score1P = 0;
        this.score2P = 0;
        this.highScore = parseInt(localStorage.getItem('1943_hi_score') || '60000', 10);
        this.isTwoPlayer = false;
        this.autoFire = true;

        // Stage Performance Statistics
        this.stagePlanesDestroyed = 0;
        this.stageStarsCollected = 0;
        this.stageBossSunkName = '';
        this.totalStarsAllStages = 0;

        // Leaderboard
        this.leaderboard = this.loadLeaderboard();

        // Players
        this.p1 = this.createPlayer(1, this.width * 0.35, this.height * 0.85);
        this.p2 = this.createPlayer(2, this.width * 0.65, this.height * 0.85);

        // Entities
        this.playerBullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.boss = null;

        // Background
        this.oceanScrollY = 0;
        this.islands = [
            { x: 140, y: -200, scale: 1.2 },
            { x: 460, y: -700, scale: 0.9 },
            { x: 280, y: -1300, scale: 1.4 }
        ];
        this.clouds = [
            { x: 50, y: 100, width: 160, height: 75, speed: 1.6, opacity: 0.4 },
            { x: 380, y: 350, width: 220, height: 90, speed: 1.9, opacity: 0.45 },
            { x: 200, y: 650, width: 180, height: 80, speed: 1.7, opacity: 0.4 }
        ];

        // Screen Shake & Mega Crash
        this.shakeTime = 0;
        this.shakeMagnitude = 0;
        this.megaCrashActive = false;
        this.megaCrashTimer = 0;
        this.megaCrashStrikes = [];

        this.formationTracker = {};

        // Inputs
        this.keys = {};
        this.last1PFire = 0;
        this.last2PFire = 0;

        this.initInput();
        this.bindEvents();
        this.updateCoinDisplay();
        this.renderLeaderboardTable();
    }

    createPlayer(id, x, y) {
        return {
            id,
            active: true,
            x,
            y,
            speed: 5.2,
            energy: 64,
            maxEnergy: 64,
            bombs: 3,
            lives: 3,
            weapon: 'NORMAL',
            weaponTimer: 0,
            invincibleTimer: 120,
            isLooping: false,
            loopTimer: 0,
            loopDuration: 40,
            bank: 0,
            width: 36,
            height: 34
        };
    }

    // --- Progressive Stage Difficulty Settings ---
    // Every stage increases bullet limit and bullet speed
    getStageDifficulty() {
        const loopFactor = (this.loop - 1) * 0.12;

        const stageSettings = {
            1: { maxBullets: 6,  speed: 2.1, shootInterval: 140, name: '突入中途島海域' },
            2: { maxBullets: 9,  speed: 2.4, shootInterval: 120, name: '珊瑚海截擊作戰' },
            3: { maxBullets: 12, speed: 2.7, shootInterval: 105, name: '鐵底海峽夜戰' },
            4: { maxBullets: 15, speed: 3.0, shootInterval: 90,  name: '馬里亞納海空戰' },
            5: { maxBullets: 18, speed: 3.3, shootInterval: 75,  name: '雷伊泰灣終極決戰' }
        };

        const current = stageSettings[this.stage] || stageSettings[1];
        return {
            maxBullets: current.maxBullets + (this.loop - 1) * 2,
            speed: current.speed * (1 + loopFactor),
            shootInterval: Math.max(50, Math.round(current.shootInterval / (1 + loopFactor * 0.5))),
            name: current.name
        };
    }

    // --- Leaderboard System ---
    loadLeaderboard() {
        const defaultBoard = [
            { rank: 1, name: 'ACE-TOP', score: 65000, stage: 'STAGE 5 (LOOP 1)' },
            { rank: 2, name: 'RED-BARON', score: 48000, stage: 'STAGE 4 (LOOP 1)' },
            { rank: 3, name: 'PACIFIC', score: 36000, stage: 'STAGE 3 (LOOP 1)' },
            { rank: 4, name: 'MIDWAY', score: 26000, stage: 'STAGE 2 (LOOP 1)' },
            { rank: 5, name: 'PILOT', score: 16000, stage: 'STAGE 1 (LOOP 1)' }
        ];
        try {
            const saved = localStorage.getItem('1943_leaderboard');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return defaultBoard;
    }

    saveLeaderboard() {
        try {
            localStorage.setItem('1943_leaderboard', JSON.stringify(this.leaderboard));
        } catch(e) {}
    }

    addRecordToLeaderboard(playerName) {
        const topScore = Math.max(this.score1P, this.score2P);
        const stageInfo = `STAGE ${this.stage} (LOOP ${this.loop})`;
        const cleanName = (playerName || 'ACE').trim().slice(0, 10).toUpperCase();

        this.leaderboard.push({
            name: cleanName,
            score: topScore,
            stage: stageInfo
        });

        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 10);

        this.leaderboard.forEach((entry, idx) => {
            entry.rank = idx + 1;
        });

        this.saveLeaderboard();
        this.renderLeaderboardTable();
    }

    renderLeaderboardTable() {
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.leaderboard.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color: #f1c40f;">${entry.rank}</td>
                <td style="color: #fff;">${entry.name}</td>
                <td style="color: #2ecc71;">${entry.score.toLocaleString()}</td>
                <td style="color: #3498db; font-size: 8px;">${entry.stage}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Coin & Credit System ---
    insertCoin() {
        window.sound.ensureContext();
        this.credits++;
        window.sound.playCoin();
        this.updateCoinDisplay();

        this.addFloatingText('COIN INSERTED! (+1)', this.width * 0.5, this.height * 0.7, '#f1c40f', 16);

        const coinAlert = document.getElementById('coinAlert');
        if (coinAlert) {
            coinAlert.innerText = `投幣成功！目前硬幣: ${this.credits} 枚`;
            coinAlert.style.color = '#2ecc71';
            setTimeout(() => {
                this.updateCoinDisplay();
            }, 2500);
        }
    }

    updateCoinDisplay() {
        const creditEl = document.getElementById('creditCount');
        if (creditEl) creditEl.innerText = this.credits;

        const coinAlert = document.getElementById('coinAlert');
        if (coinAlert) {
            if (this.credits === 0) {
                coinAlert.innerText = '請投幣！按 P 鍵或點擊上方投幣按鈕 (單人需 1 枚，雙人需 2 枚)';
                coinAlert.style.color = '#e74c3c';
            } else if (this.credits === 1) {
                coinAlert.innerText = '已投 1 枚硬幣：可開始單人遊玩 (雙人需再投 1 枚)';
                coinAlert.style.color = '#f39c12';
            } else {
                coinAlert.innerText = `已投 ${this.credits} 枚硬幣：已達雙人出擊標準！`;
                coinAlert.style.color = '#2ecc71';
            }
        }
    }

    initInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (window.sound && !window.sound.ctx) window.sound.init();

            if (e.code === 'KeyP') {
                this.insertCoin();
                return;
            }

            if (e.code === 'Escape') {
                this.togglePause();
                return;
            }

            if (this.state === 'PLAYING') {
                if (e.code === 'KeyB') this.triggerMegaCrash(this.p1);
                if (e.code === 'Digit1' || e.code === 'Numpad1') this.triggerMegaCrash(this.p2);
                if (e.code === 'KeyC') this.triggerLoop(this.p1);
                if (e.code === 'Digit2' || e.code === 'Numpad2') this.triggerLoop(this.p2);
            }

            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    bindEvents() {
        document.getElementById('btnInsertCoin')?.addEventListener('click', () => this.insertCoin());

        // 1P Start
        document.getElementById('btnStart1P')?.addEventListener('click', () => {
            if (this.credits < 1) {
                alert('請先投幣！按 P 鍵或點擊「🪙 投幣」按鈕 (單人需 1 枚硬幣)');
                return;
            }
            this.credits -= 1;
            this.updateCoinDisplay();
            this.startNewGameSequence(false);
        });

        // 2P Start
        document.getElementById('btnStart2P')?.addEventListener('click', () => {
            if (this.credits < 2) {
                alert(`硬幣不足！雙人遊玩需要 2 枚硬幣 (目前有 ${this.credits} 枚，請按 P 鍵再投幣)`);
                return;
            }
            this.credits -= 2;
            this.updateCoinDisplay();
            this.startNewGameSequence(true);
        });

        // Debriefing Report "Next Stage" button
        document.getElementById('btnNextStage')?.addEventListener('click', () => {
            document.getElementById('stageReportModal')?.classList.add('hidden');
            if (this.stage < this.maxStages) {
                this.initStage(this.stage + 1);
            } else {
                // Next Loop
                this.loop++;
                this.initStage(1);
            }
        });

        // Name Entry & Save Score
        document.getElementById('btnConfirmSave')?.addEventListener('click', () => {
            const nameInput = document.getElementById('playerNameInput');
            const name = nameInput ? nameInput.value : 'P1';
            this.addRecordToLeaderboard(name);

            document.getElementById('saveScoreModal')?.classList.add('hidden');
            document.getElementById('leaderboardModal')?.classList.remove('hidden');
        });

        document.getElementById('btnSkipSave')?.addEventListener('click', () => {
            document.getElementById('saveScoreModal')?.classList.add('hidden');
            document.getElementById('leaderboardModal')?.classList.remove('hidden');
        });

        document.getElementById('btnCloseLeaderboard')?.addEventListener('click', () => {
            document.getElementById('leaderboardModal')?.classList.add('hidden');
            this.state = 'TITLE';
            document.getElementById('titleModal')?.classList.remove('hidden');
            this.updateCoinDisplay();
        });

        document.getElementById('btnReCoin')?.addEventListener('click', () => {
            document.getElementById('leaderboardModal')?.classList.add('hidden');
            document.getElementById('saveScoreModal')?.classList.add('hidden');
            this.insertCoin();
            this.state = 'TITLE';
            document.getElementById('titleModal')?.classList.remove('hidden');
        });

        document.getElementById('btnViewLeaderboard')?.addEventListener('click', () => {
            this.renderLeaderboardTable();
            document.getElementById('leaderboardModal')?.classList.remove('hidden');
        });

        // Toolbar
        document.getElementById('btnPause')?.addEventListener('click', () => this.togglePause());
        document.getElementById('btnSound')?.addEventListener('click', () => {
            const muted = window.sound.toggleMute();
            const btn = document.getElementById('btnSound');
            if (btn) btn.innerText = muted ? '🔇 聲音: 關' : '🔊 聲音: 開';
        });
        document.getElementById('btnAutofire')?.addEventListener('click', () => {
            this.autoFire = !this.autoFire;
            const btn = document.getElementById('btnAutofire');
            if (btn) btn.innerText = this.autoFire ? '⚡ 連射: 開' : '⚡ 連射: 關';
        });
        document.getElementById('btnCrt')?.addEventListener('click', () => {
            const crt = document.getElementById('crtOverlay');
            if (crt) crt.classList.toggle('hidden');
        });
    }

    // --- CARRIER TAKEOFF ANIMATION (航母升空過場動畫) ---
    startNewGameSequence(twoPlayer = false) {
        window.sound.ensureContext();

        this.isTwoPlayer = twoPlayer;
        this.stage = 1;
        this.loop = 1;
        this.score1P = 0;
        this.score2P = 0;
        this.totalStarsAllStages = 0;

        // Reset players and put them on carrier runway
        this.p1 = this.createPlayer(1, twoPlayer ? this.width * 0.5 - 40 : this.width * 0.5, this.height * 0.72);
        this.p2 = this.createPlayer(2, this.width * 0.5 + 40, this.height * 0.72);
        this.p2.active = twoPlayer;

        // Enter Carrier Takeoff State
        this.state = 'CARRIER_TAKEOFF';
        this.takeoffFrame = 0;
        window.sound.playCarrierTakeoff();

        // Hide title modal
        document.getElementById('titleModal')?.classList.add('hidden');
        document.getElementById('gameOverModal')?.classList.add('hidden');
        document.getElementById('saveScoreModal')?.classList.add('hidden');
        document.getElementById('leaderboardModal')?.classList.add('hidden');
        document.getElementById('stageReportModal')?.classList.add('hidden');
    }

    initStage(stageNum) {
        this.stage = stageNum;
        this.stageTime = 0;
        this.state = 'STAGE_INTRO';
        this.stageIntroTimer = 140;

        // Reset stage statistics
        this.stagePlanesDestroyed = 0;
        this.stageStarsCollected = 0;
        this.stageBossSunkName = '';

        if (!this.p1.active || this.p1.energy <= 0) {
            this.p1 = this.createPlayer(1, this.isTwoPlayer ? this.width * 0.35 : this.width * 0.5, this.height * 0.85);
        } else {
            this.p1.x = this.isTwoPlayer ? this.width * 0.35 : this.width * 0.5;
            this.p1.y = this.height * 0.85;
            this.p1.energy = Math.min(64, this.p1.energy + 28);
            this.p1.invincibleTimer = 100;
        }

        if (this.isTwoPlayer) {
            if (!this.p2.active || this.p2.energy <= 0) {
                this.p2 = this.createPlayer(2, this.width * 0.65, this.height * 0.85);
            } else {
                this.p2.x = this.width * 0.65;
                this.p2.y = this.height * 0.85;
                this.p2.energy = Math.min(64, this.p2.energy + 28);
                this.p2.invincibleTimer = 100;
            }
            this.p2.active = true;
        } else {
            this.p2.active = false;
        }

        this.playerBullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.boss = null;
        this.currentBossData = null;

        window.sound.startBGM();
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pauseModal')?.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pauseModal')?.classList.add('hidden');
        }
    }

    triggerLoop(player) {
        if (!player.active || player.isLooping) return;
        player.isLooping = true;
        player.loopTimer = 0;
        player.invincibleTimer = player.loopDuration + 10;
        window.sound.playLoopManeuver();
    }

    triggerMegaCrash(player) {
        if (!player.active || player.bombs <= 0) return;
        player.bombs--;

        this.megaCrashActive = true;
        this.megaCrashTimer = 60;
        this.shakeTime = 40;
        this.shakeMagnitude = 12;

        window.sound.playMegaCrash();
        this.enemyBullets = [];

        this.megaCrashStrikes = [];
        for (let i = 0; i < 6; i++) {
            this.megaCrashStrikes.push({
                x: Math.random() * this.width,
                startY: 0,
                endY: this.height * (0.4 + Math.random() * 0.6)
            });
        }

        this.enemies.forEach((enemy) => {
            if (enemy.isBoss) {
                enemy.hp -= 400;
                this.createHitSparks(enemy.x, enemy.y, 15);
            } else {
                enemy.hp = 0;
                this.destroyEnemy(enemy, player.id);
            }
        });

        this.addFloatingText('MEGA CRASH!!', this.width * 0.5, this.height * 0.45, '#ffff00', 20);
    }

    // --- Main Update Loop ---
    update() {
        if (['PAUSED', 'TITLE', 'STAGE_REPORT', 'GAMEOVER', 'NAME_ENTRY', 'LEADERBOARD', 'VICTORY'].includes(this.state)) {
            return;
        }

        // 1. CARRIER TAKEOFF ANIMATION SEQUENCE
        if (this.state === 'CARRIER_TAKEOFF') {
            this.takeoffFrame++;

            // In revving phase (0-60 frames), engine vibrates
            if (this.takeoffFrame < 60) {
                this.p1.y = this.height * 0.72 + (Math.random() - 0.5) * 1.5;
                if (this.p2.active) this.p2.y = this.height * 0.72 + (Math.random() - 0.5) * 1.5;
            }
            // Launch acceleration down the flight deck (60-180 frames)
            else if (this.takeoffFrame < 180) {
                const accel = (this.takeoffFrame - 60) * 0.08;
                this.p1.y -= accel;
                if (this.p2.active) this.p2.y -= accel;
            }
            // Airborne climb & transition to sky (180-240 frames)
            else {
                this.p1.y -= 1.5;
                if (this.p2.active) this.p2.y -= 1.5;
            }

            if (this.takeoffFrame >= this.takeoffDuration) {
                this.initStage(1);
            }
            return;
        }

        this.oceanScrollY += 1.8;

        // 2. STAGE INTRO COUNTDOWN
        if (this.state === 'STAGE_INTRO') {
            this.stageIntroTimer--;
            if (this.stageIntroTimer <= 0) {
                this.state = 'PLAYING';
            }
            this.updateParallax();
            return;
        }

        // 3. BOSS INTRO DOSSIER COUNTDOWN
        if (this.state === 'BOSS_INTRO') {
            this.bossIntroTimer--;
            if (this.bossIntroTimer <= 0) {
                this.state = 'PLAYING';
            }
            this.updateParallax();
            this.updatePlayersMovementOnly();
            return;
        }

        this.stageTime++;

        if (this.shakeTime > 0) this.shakeTime--;

        if (this.megaCrashActive) {
            this.megaCrashTimer--;
            if (this.megaCrashTimer <= 0) this.megaCrashActive = false;
        }

        this.updatePlayer(this.p1);
        if (this.p2.active) this.updatePlayer(this.p2);

        // Check Game Over
        if (!this.p1.active && (!this.p2.active || !this.isTwoPlayer)) {
            this.gameOver();
            return;
        }

        this.handleShooting();
        this.handleWaveSpawner();
        this.updateBullets();
        this.updateEnemies();
        this.updatePowerups();
        this.updateParticles();
        this.checkCollisions();
        this.updateParallax();
    }

    updatePlayersMovementOnly() {
        this.updatePlayer(this.p1);
        if (this.p2.active) this.updatePlayer(this.p2);
    }

    updateParallax() {
        this.clouds.forEach((cloud) => {
            cloud.y += cloud.speed;
            if (cloud.y > this.height + 100) {
                cloud.y = -120;
                cloud.x = Math.random() * (this.width - 100);
            }
        });

        this.islands.forEach((isl) => {
            isl.y += 1.2;
            if (isl.y > this.height + 250) {
                isl.y = -400 - Math.random() * 300;
                isl.x = 80 + Math.random() * (this.width - 160);
            }
        });
    }

    updatePlayer(player) {
        if (!player.active) return;

        let moveX = 0;
        let moveY = 0;

        if (player.id === 1) {
            if (this.keys['KeyW']) moveY -= 1;
            if (this.keys['KeyS']) moveY += 1;
            if (this.keys['KeyA']) moveX -= 1;
            if (this.keys['KeyD']) moveX += 1;
        }

        if (player.id === 2) {
            if (this.keys['ArrowUp']) moveY -= 1;
            if (this.keys['ArrowDown']) moveY += 1;
            if (this.keys['ArrowLeft']) moveX -= 1;
            if (this.keys['ArrowRight']) moveX += 1;
        }

        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
        }

        if (moveX < 0) {
            player.bank = Math.max(-1, player.bank - 0.2);
        } else if (moveX > 0) {
            player.bank = Math.min(1, player.bank + 0.2);
        } else {
            player.bank *= 0.75;
        }

        player.x += moveX * player.speed;
        player.y += moveY * player.speed;

        player.x = Math.max(28, Math.min(this.width - 28, player.x));
        player.y = Math.max(35, Math.min(this.height - 35, player.y));

        if (player.invincibleTimer > 0) player.invincibleTimer--;

        if (player.isLooping) {
            player.loopTimer++;
            if (player.loopTimer >= player.loopDuration) {
                player.isLooping = false;
            }
        }

        if (player.weaponTimer > 0) {
            player.weaponTimer--;
            if (player.weaponTimer <= 0) {
                player.weapon = 'NORMAL';
            }
        }
    }

    handleShooting() {
        const now = Date.now();

        const p1FirePressed = this.keys['Space'] || this.keys['KeyJ'];
        if (this.p1.active && (p1FirePressed || this.autoFire)) {
            const fireInterval = this.p1.weapon === 'AUTO' ? 100 : 170;
            if (now - this.last1PFire > fireInterval) {
                this.firePlayerWeapon(this.p1);
                this.last1PFire = now;
            }
        }

        const p2FirePressed = this.keys['Enter'] || this.keys['Numpad0'] || this.keys['KeyK'] || this.keys['ControlRight'];
        if (this.p2.active && (p2FirePressed || this.autoFire)) {
            const fireInterval = this.p2.weapon === 'AUTO' ? 100 : 170;
            if (now - this.last2PFire > fireInterval) {
                this.firePlayerWeapon(this.p2);
                this.last2PFire = now;
            }
        }
    }

    firePlayerWeapon(player) {
        if (player.isLooping) return;
        const isP2 = player.id === 2;

        switch (player.weapon) {
            case 'NORMAL':
                this.playerBullets.push(
                    { x: player.x - 9, y: player.y - 18, vx: 0, vy: -13, dmg: 12, type: 'NORMAL', isPlayer: true, isP2 },
                    { x: player.x + 9, y: player.y - 18, vx: 0, vy: -13, dmg: 12, type: 'NORMAL', isPlayer: true, isP2 }
                );
                window.sound.playShoot(isP2);
                break;

            case '3WAY':
                this.playerBullets.push(
                    { x: player.x, y: player.y - 18, vx: 0, vy: -13, dmg: 14, type: '3WAY', isPlayer: true, isP2 },
                    { x: player.x - 10, y: player.y - 16, vx: -3.0, vy: -12, dmg: 14, type: '3WAY', isPlayer: true, isP2 },
                    { x: player.x + 10, y: player.y - 16, vx: 3.0, vy: -12, dmg: 14, type: '3WAY', isPlayer: true, isP2 }
                );
                window.sound.playShoot(isP2);
                break;

            case 'AUTO':
                this.playerBullets.push(
                    { x: player.x - 12, y: player.y - 18, vx: -0.5, vy: -15, dmg: 14, type: 'AUTO', isPlayer: true, isP2 },
                    { x: player.x - 4, y: player.y - 20, vx: 0, vy: -15, dmg: 14, type: 'AUTO', isPlayer: true, isP2 },
                    { x: player.x + 4, y: player.y - 20, vx: 0, vy: -15, dmg: 14, type: 'AUTO', isPlayer: true, isP2 },
                    { x: player.x + 12, y: player.y - 18, vx: 0.5, vy: -15, dmg: 14, type: 'AUTO', isPlayer: true, isP2 }
                );
                window.sound.playShoot(isP2);
                break;

            case 'LASER':
                this.playerBullets.push(
                    { x: player.x, y: player.y - 24, vx: 0, vy: -16, dmg: 30, type: 'LASER', pierce: 4, isPlayer: true, isP2 }
                );
                window.sound.playLaser();
                break;

            case 'SHOTGUN':
                for (let i = -2; i <= 2; i++) {
                    this.playerBullets.push({
                        x: player.x + i * 4,
                        y: player.y - 16,
                        vx: i * 2.0,
                        vy: -11 + Math.abs(i) * 0.5,
                        dmg: 18,
                        type: 'SHOTGUN',
                        cancelsBullets: true,
                        isPlayer: true,
                        isP2
                    });
                }
                window.sound.playShotgun();
                break;
        }
    }

    // --- Wave Spawner with Progressive Difficulty & Boss Dossier ---
    handleWaveSpawner() {
        const t = this.stageTime;
        const diff = this.getStageDifficulty();

        if (t % 360 === 60 && t < 2200) {
            this.spawnRedSquadron();
        }

        if (t % diff.shootInterval === 0 && t < 2300) {
            this.spawnZero(60 + Math.random() * (this.width - 120), -30);
        }

        if (t % 420 === 200 && t > 450 && t < 2100) {
            this.spawnMediumBomber(this.width * (Math.random() > 0.5 ? 0.3 : 0.7), -40);
        }

        if (t > 1400 && t < 2300) {
            if (t % 260 === 0) this.spawnGunboat(80 + Math.random() * (this.width - 160), -40);
            if (t % 550 === 0) this.spawnDestroyer(this.width * (Math.random() > 0.5 ? 0.35 : 0.65), -90);
        }

        // Mid-boss Ayako (t: 900)
        if (t === 900 && !this.boss) {
            this.spawnAyakoMidBoss(this.stage >= 4 ? 'III' : (this.stage >= 2 ? 'II' : 'I'));
        }

        // Trigger Stage Boss with Cinematic Intro Dossier (t: 2400)
        if (t === 2400 && !this.boss) {
            this.triggerStageBossIntro();
        }
    }

    // --- Cinematic Boss Dossier Presentation (魔王出場介紹) ---
    triggerStageBossIntro() {
        window.sound.playWarningSiren();

        const bossDossiers = {
            1: {
                name: '重巡洋艦「利根」 (TONE)',
                type: 'TONE-CLASS HEAVY CRUISER',
                specs: '全長: 201m ‧ 排水量: 15,200t',
                armament: '203mm 雙聯裝主砲 4座 / 密集防空機砲'
            },
            2: {
                name: '航空母艦「加賀」 (KAGA)',
                type: 'FLEET AIRCRAFT CARRIER',
                specs: '全長: 247m ‧ 排水量: 43,600t',
                armament: '90架艦載機編隊 / 側舷高射機砲火網'
            },
            3: {
                name: '高速戰艦「金剛」 (KONGŌ)',
                type: 'KONGŌ-CLASS BATTLESHIP',
                specs: '全長: 222m ‧ 排水量: 36,600t',
                armament: '356mm 雙聯裝主砲 4座 / 深海夜戰雷擊防護'
            },
            4: {
                name: '裝甲空母「大鳳」 (TAIHŌ)',
                type: 'ARMORED AIRCRAFT CARRIER',
                specs: '全長: 260m ‧ 重裝甲飛行甲板',
                armament: '重裝甲機庫 / 全防禦防空連裝砲群'
            },
            5: {
                name: '超弩級戰艦「大和」 (YAMATO)',
                type: 'DREADNOUGHT BATTLESHIP',
                specs: '全長: 263m ‧ 滿載: 72,800t 帝國旗艦',
                armament: '460mm 史上最大巨砲 9門 / 全方位死角防空網'
            }
        };

        this.currentBossData = bossDossiers[this.stage] || bossDossiers[1];
        this.state = 'BOSS_INTRO';
        this.bossIntroTimer = 180; // ~3 seconds presentation

        // Spawn actual boss object into battle
        setTimeout(() => {
            switch(this.stage) {
                case 1: this.spawnBattleshipTone(); break;
                case 2: this.spawnCarrierKaga(); break;
                case 3: this.spawnBattleshipKongo(); break;
                case 4: this.spawnCarrierTaiho(); break;
                case 5: this.spawnBattleshipYamato(); break;
            }
        }, 1000);
    }

    spawnRedSquadron() {
        const squadId = 'squad_' + Date.now();
        this.formationTracker[squadId] = 5;

        const startX = Math.random() > 0.5 ? 80 : this.width - 80;
        const targetX = startX > this.width / 2 ? 100 : this.width - 100;

        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (this.state !== 'PLAYING') return;
                this.enemies.push({
                    type: 'RED_SQUAD',
                    squadId,
                    x: startX,
                    y: -30,
                    vx: (targetX - startX) * 0.005,
                    vy: 3.0,
                    angle: Math.PI,
                    hp: 20,
                    scoreValue: 500,
                    width: 28,
                    height: 28,
                    timer: 0
                });
            }, i * 320);
        }
    }

    spawnZero(x, y) {
        this.enemies.push({
            type: 'ZERO',
            x,
            y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 3.2,
            angle: Math.PI,
            hp: 15,
            scoreValue: 200,
            shootTimer: 60 + Math.random() * 60,
            width: 26,
            height: 26
        });
    }

    spawnMediumBomber(x, y) {
        this.enemies.push({
            type: 'BOMBER',
            x,
            y,
            vx: 0,
            vy: 1.8,
            hp: 70,
            scoreValue: 1000,
            shootTimer: 80,
            width: 48,
            height: 40
        });
    }

    spawnGunboat(x, y) {
        this.enemies.push({
            type: 'GUNBOAT',
            x,
            y,
            vx: 0,
            vy: 1.2,
            hp: 40,
            scoreValue: 600,
            shootTimer: 90,
            width: 30,
            height: 40,
            isSeaTarget: true
        });
    }

    spawnDestroyer(x, y) {
        this.enemies.push({
            type: 'DESTROYER',
            x,
            y,
            vx: 0,
            vy: 0.9,
            hp: 220,
            maxHp: 220,
            scoreValue: 3000,
            shootTimer: 90,
            turrets: [0, 0],
            width: 44,
            height: 120,
            isSeaTarget: true
        });
    }

    spawnAyakoMidBoss(variant = 'I') {
        window.sound.playWarningSiren();
        const names = {
            'I': 'MID-BOSS: AYAKO (亞夜子)',
            'II': 'MID-BOSS: AYAKO II (亞夜子改)',
            'III': 'MID-BOSS: SUPER AYAKO (超弩級要塞)'
        };
        const loopScale = 1 + (this.loop - 1) * 0.15;
        const hp = Math.round(750 * loopScale);

        this.addFloatingText(names[variant], this.width * 0.5, this.height * 0.4, '#e74c3c', 20);

        const boss = {
            type: 'AYAKO',
            variant,
            isBoss: true,
            name: names[variant],
            x: this.width * 0.5,
            y: -120,
            targetY: 170,
            vx: 1.4,
            vy: 1.6,
            hp,
            maxHp: hp,
            scoreValue: 15000,
            shootTimer: 60,
            propFrame: 0,
            width: 140,
            height: 80
        };
        this.enemies.push(boss);
        this.boss = boss;
    }

    spawnBattleshipTone() {
        const loopScale = 1 + (this.loop - 1) * 0.15;
        const hp = Math.round(2000 * loopScale);

        const boss = {
            type: 'BATTLESHIP',
            isBoss: true,
            name: 'STAGE 1: 重巡洋艦「利根」',
            x: this.width * 0.5,
            y: -200,
            targetY: 250,
            vx: 0.5,
            vy: 0.7,
            hp,
            maxHp: hp,
            scoreValue: 30000,
            shootTimer: 75,
            turrets: [0, 0, 0, 0],
            partsDestroyed: {},
            width: 90,
            height: 280,
            isSeaTarget: true
        };
        this.enemies.push(boss);
        this.boss = boss;
    }

    spawnCarrierKaga() {
        const loopScale = 1 + (this.loop - 1) * 0.15;
        const hp = Math.round(2600 * loopScale);

        const boss = {
            type: 'CARRIER',
            isBoss: true,
            name: 'STAGE 2: 航空母艦「加賀」',
            x: this.width * 0.5,
            y: -220,
            targetY: 260,
            vx: 0.5,
            vy: 0.7,
            hp,
            maxHp: hp,
            scoreValue: 40000,
            shootTimer: 70,
            launchTimer: 120,
            turrets: [0, 0, 0, 0],
            partsDestroyed: {},
            width: 100,
            height: 320,
            isSeaTarget: true
        };
        this.enemies.push(boss);
        this.boss = boss;
    }

    spawnBattleshipKongo() {
        const loopScale = 1 + (this.loop - 1) * 0.15;
        const hp = Math.round(3200 * loopScale);

        const boss = {
            type: 'KONGO',
            isBoss: true,
            name: 'STAGE 3: 高速戰艦「金剛」',
            x: this.width * 0.5,
            y: -220,
            targetY: 260,
            vx: 0.5,
            vy: 0.7,
            hp,
            maxHp: hp,
            scoreValue: 50000,
            shootTimer: 65,
            turrets: [0, 0, 0, 0],
            partsDestroyed: {},
            width: 95,
            height: 300,
            isSeaTarget: true
        };
        this.enemies.push(boss);
        this.boss = boss;
    }

    spawnCarrierTaiho() {
        const loopScale = 1 + (this.loop - 1) * 0.15;
        const hp = Math.round(3800 * loopScale);

        const boss = {
            type: 'TAIHO',
            isBoss: true,
            name: 'STAGE 4: 裝甲空母「大鳳」',
            x: this.width * 0.5,
            y: -230,
            targetY: 270,
            vx: 0.45,
            vy: 0.7,
            hp,
            maxHp: hp,
            scoreValue: 60000,
            shootTimer: 65,
            turrets: [0, 0, 0, 0],
            partsDestroyed: {},
            width: 105,
            height: 330,
            isSeaTarget: true
        };
        this.enemies.push(boss);
        this.boss = boss;
    }

    spawnBattleshipYamato() {
        const loopScale = 1 + (this.loop - 1) * 0.15;
        const hp = Math.round(4800 * loopScale);

        const boss = {
            type: 'YAMATO',
            isBoss: true,
            name: 'FINAL BOSS: 超弩級戰艦「大和」',
            x: this.width * 0.5,
            y: -250,
            targetY: 275,
            vx: 0.4,
            vy: 0.6,
            hp,
            maxHp: hp,
            scoreValue: 100000,
            shootTimer: 60,
            turrets: [0, 0, 0],
            partsDestroyed: {},
            width: 110,
            height: 360,
            isSeaTarget: true
        };
        this.enemies.push(boss);
        this.boss = boss;
    }

    // --- Entity Updates with Progressive Bullet Patterns ---
    updateEnemies() {
        const diff = this.getStageDifficulty();

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];

            switch (e.type) {
                case 'ZERO':
                    e.y += e.vy;
                    e.x += e.vx;
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        this.enemyAimShot(e, diff.speed);
                        e.shootTimer = diff.shootInterval;
                    }
                    break;

                case 'RED_SQUAD':
                    e.timer++;
                    e.y += e.vy;
                    e.x += Math.sin(e.timer * 0.08) * 3.2;
                    break;

                case 'BOMBER':
                    e.y += e.vy;
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        const count = this.stage >= 3 ? 3 : 2;
                        this.enemySpreadShot(e, count, diff.speed * 0.95);
                        e.shootTimer = diff.shootInterval * 0.9;
                    }
                    break;

                case 'GUNBOAT':
                    e.y += e.vy;
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        this.enemyAimShot(e, diff.speed * 0.9);
                        e.shootTimer = diff.shootInterval;
                    }
                    break;

                case 'DESTROYER':
                    e.y += e.vy;
                    e.shootTimer--;
                    const targetP = this.getClosestPlayer(e.x, e.y);
                    if (targetP) {
                        const targetAngle = Math.atan2(targetP.y - e.y, targetP.x - e.x) - Math.PI / 2;
                        e.turrets[0] = targetAngle;
                        e.turrets[1] = targetAngle;
                    }
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        this.enemyAimShot(e, diff.speed);
                        e.shootTimer = diff.shootInterval * 0.85;
                    }
                    break;

                case 'AYAKO':
                    if (e.y < e.targetY) {
                        e.y += e.vy;
                    } else {
                        e.x += e.vx;
                        if (e.x < 110 || e.x > this.width - 110) e.vx = -e.vx;
                    }
                    e.propFrame += 0.5;
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        this.enemyAimShot({ x: e.x - 45, y: e.y + 10 }, diff.speed);
                        this.enemyAimShot({ x: e.x + 45, y: e.y + 10 }, diff.speed);
                        if (this.stage >= 3) {
                            this.enemySpreadShot({ x: e.x, y: e.y + 35 }, 3, diff.speed * 0.9);
                        }
                        e.shootTimer = diff.shootInterval * 0.8;
                    }
                    break;

                case 'BATTLESHIP': // Stage 1 Tone
                case 'KONGO':      // Stage 3 Kongo
                    if (e.y < e.targetY) {
                        e.y += e.vy;
                    } else {
                        e.x += Math.sin(this.stageTime * 0.015) * 0.7;
                    }
                    const nearest1 = this.getClosestPlayer(e.x, e.y);
                    if (nearest1) {
                        for (let tIdx = 0; tIdx < 4; tIdx++) {
                            const turretY = e.y - 120 + tIdx * 35;
                            e.turrets[tIdx] = Math.atan2(nearest1.y - turretY, nearest1.x - e.x) - Math.PI / 2;
                        }
                    }
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        this.enemyAimShot({ x: e.x, y: e.y - 60 }, diff.speed * 1.05);
                        this.enemyAimShot({ x: e.x, y: e.y + 60 }, diff.speed * 1.05);
                        if (this.stage === 3) {
                            this.enemySpreadShot({ x: e.x, y: e.y }, 3, diff.speed * 0.95);
                        }
                        e.shootTimer = diff.shootInterval * 0.85;
                    }
                    break;

                case 'CARRIER': // Stage 2 Kaga
                case 'TAIHO':   // Stage 4 Taiho
                    if (e.y < e.targetY) {
                        e.y += e.vy;
                    } else {
                        e.x += Math.sin(this.stageTime * 0.012) * 0.9;
                    }
                    const nearest2 = this.getClosestPlayer(e.x, e.y);
                    if (nearest2) {
                        for (let k = 0; k < 4; k++) {
                            e.turrets[k] = Math.atan2(nearest2.y - e.y, nearest2.x - e.x) - Math.PI / 2;
                        }
                    }
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        const fanCount = this.stage === 4 ? 4 : 3;
                        this.enemySpreadShot({ x: e.x, y: e.y + 60 }, fanCount, diff.speed);
                        e.shootTimer = diff.shootInterval * 0.8;
                    }
                    break;

                case 'YAMATO': // Stage 5 Yamato
                    if (e.y < e.targetY) {
                        e.y += e.vy;
                    } else {
                        e.x += Math.sin(this.stageTime * 0.01) * 1.0;
                    }
                    const nearest3 = this.getClosestPlayer(e.x, e.y);
                    if (nearest3) {
                        e.turrets[0] = Math.atan2(nearest3.y - (e.y - 160), nearest3.x - e.x) - Math.PI / 2;
                        e.turrets[1] = Math.atan2(nearest3.y - (e.y - 110), nearest3.x - e.x) - Math.PI / 2;
                        e.turrets[2] = Math.atan2(nearest3.y - (e.y + 115), nearest3.x - e.x) - Math.PI / 2;
                    }
                    e.shootTimer--;
                    if (e.shootTimer <= 0 && this.enemyBullets.length < diff.maxBullets) {
                        this.enemyHeavyShot({ x: e.x, y: e.y - 140 }, e.turrets[0], diff.speed * 1.1);
                        this.enemyHeavyShot({ x: e.x, y: e.y + 115 }, e.turrets[2], diff.speed * 1.1);
                        this.enemySpreadShot({ x: e.x, y: e.y - 40 }, 5, diff.speed * 0.95);
                        e.shootTimer = diff.shootInterval * 0.75;
                    }
                    break;
            }

            if (e.y > this.height + 150 && !e.isBoss) {
                this.enemies.splice(i, 1);
            }
        }
    }

    getClosestPlayer(x, y) {
        const candidates = [];
        if (this.p1.active) candidates.push(this.p1);
        if (this.p2.active) candidates.push(this.p2);
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        const d1 = Math.hypot(this.p1.x - x, this.p1.y - y);
        const d2 = Math.hypot(this.p2.x - x, this.p2.y - y);
        return d1 < d2 ? this.p1 : this.p2;
    }

    enemyAimShot(emitter, speed = 2.4) {
        const diff = this.getStageDifficulty();
        if (this.enemyBullets.length >= diff.maxBullets) return;
        const target = this.getClosestPlayer(emitter.x, emitter.y);
        if (!target) return;
        const angle = Math.atan2(target.y - emitter.y, target.x - emitter.x);
        this.enemyBullets.push({
            x: emitter.x,
            y: emitter.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            isPlayer: false
        });
        window.sound.playEnemyShoot();
    }

    enemyHeavyShot(emitter, angleOffset, speed = 2.6) {
        const diff = this.getStageDifficulty();
        if (this.enemyBullets.length >= diff.maxBullets) return;
        const angle = angleOffset + Math.PI / 2;
        this.enemyBullets.push({
            x: emitter.x,
            y: emitter.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            isHeavyShell: true,
            isPlayer: false
        });
        window.sound.playEnemyShoot();
    }

    enemySpreadShot(emitter, count = 2, speed = 2.2) {
        const diff = this.getStageDifficulty();
        if (this.enemyBullets.length >= diff.maxBullets) return;
        const target = this.getClosestPlayer(emitter.x, emitter.y);
        const baseAngle = target ? Math.atan2(target.y - emitter.y, target.x - emitter.x) : Math.PI / 2;
        const spreadStep = 0.24;
        const startAngle = baseAngle - ((count - 1) / 2) * spreadStep;

        for (let i = 0; i < count; i++) {
            if (this.enemyBullets.length >= diff.maxBullets) break;
            const angle = startAngle + i * spreadStep;
            this.enemyBullets.push({
                x: emitter.x,
                y: emitter.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                isPlayer: false
            });
        }
        window.sound.playEnemyShoot();
    }

    updateBullets() {
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i];
            b.x += b.vx;
            b.y += b.vy;
            if (b.y < -30 || b.y > this.height + 30 || b.x < -30 || b.x > this.width + 30) {
                this.playerBullets.splice(i, 1);
            }
        }

        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.x += b.vx;
            b.y += b.vy;
            if (b.y < -30 || b.y > this.height + 30 || b.x < -30 || b.x > this.width + 30) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    updatePowerups() {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += p.vy;
            p.x += p.vx;
            p.frame++;
            if (p.x < 30 || p.x > this.width - 30) p.vx = -p.vx;
            if (p.y > this.height + 40) this.powerups.splice(i, 1);
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            p.size = Math.max(0, p.size * 0.95);
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.life--;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    // --- Collision Detection ---
    checkCollisions() {
        for (let bi = this.playerBullets.length - 1; bi >= 0; bi--) {
            const b = this.playerBullets[bi];

            // Shotgun cancels enemy bullets
            if (b.cancelsBullets) {
                for (let ebi = this.enemyBullets.length - 1; ebi >= 0; ebi--) {
                    const eb = this.enemyBullets[ebi];
                    if (Math.hypot(b.x - eb.x, b.y - eb.y) < 24) {
                        this.enemyBullets.splice(ebi, 1);
                        this.createHitSparks(eb.x, eb.y, 4);
                    }
                }
            }

            // Powerup morph (Stars cannot be shot to change, only badges)
            for (let pi = 0; pi < this.powerups.length; pi++) {
                const pup = this.powerups[pi];
                if (pup.type !== 'STAR_COIN' && Math.hypot(b.x - pup.x, b.y - pup.y) < 22) {
                    this.cyclePowerup(pup);
                    this.createHitSparks(pup.x, pup.y, 6);
                    this.playerBullets.splice(bi, 1);
                    break;
                }
            }
            if (!this.playerBullets[bi]) continue;

            // Player Bullets vs Enemies
            for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
                const enemy = this.enemies[ei];
                const halfW = enemy.width * 0.5;
                const halfH = enemy.height * 0.5;

                if (b.x >= enemy.x - halfW && b.x <= enemy.x + halfW &&
                    b.y >= enemy.y - halfH && b.y <= enemy.y + halfH) {

                    enemy.hp -= b.dmg;
                    this.createHitSparks(b.x, b.y, 4);
                    this.addScore(b.isP2 ? 2 : 1, 10);

                    if (b.pierce && b.pierce > 1) {
                        b.pierce--;
                    } else {
                        this.playerBullets.splice(bi, 1);
                    }

                    if (enemy.hp <= 0) {
                        this.destroyEnemy(enemy, b.isP2 ? 2 : 1);
                        this.enemies.splice(ei, 1);
                    }
                    break;
                }
            }
        }

        // Enemy Bullets vs Players
        for (let bi = this.enemyBullets.length - 1; bi >= 0; bi--) {
            const b = this.enemyBullets[bi];
            const hitRadius = b.isHeavyShell ? 16 : 12;

            [this.p1, this.p2].forEach((player) => {
                if (player.active && player.invincibleTimer <= 0 && !player.isLooping) {
                    if (Math.hypot(b.x - player.x, b.y - player.y) < hitRadius) {
                        this.damagePlayer(player, b.isHeavyShell ? 16 : 12);
                        this.enemyBullets.splice(bi, 1);
                    }
                }
            });
        }

        // Plane Collisions vs Players
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
            const enemy = this.enemies[ei];

            [this.p1, this.p2].forEach((player) => {
                if (player.active && player.invincibleTimer <= 0 && !player.isLooping) {
                    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 24) {
                        this.damagePlayer(player, 16);
                        if (!enemy.isBoss) {
                            enemy.hp -= 50;
                            if (enemy.hp <= 0) {
                                this.destroyEnemy(enemy, player.id);
                                this.enemies.splice(ei, 1);
                            }
                        }
                    }
                }
            });
        }

        // Collectibles (Powerups and Golden Stars)
        for (let pi = this.powerups.length - 1; pi >= 0; pi--) {
            const pup = this.powerups[pi];
            [this.p1, this.p2].forEach((player) => {
                if (player.active && Math.hypot(pup.x - player.x, pup.y - player.y) < 32) {
                    this.collectItem(player, pup);
                    this.powerups.splice(pi, 1);
                }
            });
        }
    }

    damagePlayer(player, amount) {
        player.energy -= amount;
        this.createExplosion(player.x, player.y, 'small');
        this.shakeScreen(10, 4);

        if (player.energy <= 0) {
            player.lives--;
            this.createExplosion(player.x, player.y, 'big');
            window.sound.playExplosion('big');

            if (player.lives > 0) {
                player.energy = player.maxEnergy;
                player.invincibleTimer = 180;
                player.weapon = 'NORMAL';
                player.x = player.id === 1 ? this.width * 0.35 : this.width * 0.65;
                player.y = this.height * 0.85;
                this.addFloatingText('READY!', player.x, player.y - 30, '#00ffff', 16);
            } else {
                player.active = false;
                this.addFloatingText((player.id === 1 ? '1P' : '2P') + ' DOWN!', player.x, player.y, '#e74c3c', 18);
            }
        } else {
            player.invincibleTimer = 60;
        }
    }

    // --- Enemy Destroyed: Drops Stars & POW ---
    destroyEnemy(enemy, playerId) {
        this.stagePlanesDestroyed++;
        this.addScore(playerId, enemy.scoreValue);
        this.createExplosion(enemy.x, enemy.y, enemy.isBoss ? 'big' : (enemy.width > 35 ? 'medium' : 'small'));
        window.sound.playExplosion(enemy.isBoss ? 'big' : 'small');

        this.addFloatingText('+' + enemy.scoreValue, enemy.x, enemy.y - 10, '#f1c40f', 12);

        // 1. Formation drop: 1 POW + 1 Golden Star
        if (enemy.type === 'RED_SQUAD') {
            this.formationTracker[enemy.squadId]--;
            if (this.formationTracker[enemy.squadId] <= 0) {
                this.spawnPowerup(enemy.x, enemy.y, 'POW');
                this.spawnStar(enemy.x + 20, enemy.y);
                this.addFloatingText('POW & STAR!', enemy.x, enemy.y - 30, '#ff3838', 15);
            }
        }

        // 2. Medium Bomber drops a Golden Star!
        if (enemy.type === 'BOMBER') {
            this.spawnStar(enemy.x, enemy.y);
        }

        // 3. Destroyer drops 2 Golden Stars
        if (enemy.type === 'DESTROYER') {
            this.spawnStar(enemy.x - 15, enemy.y);
            this.spawnStar(enemy.x + 15, enemy.y);
            this.spawnPowerup(enemy.x, enemy.y - 20, '3WAY');
        }

        // Boss defeat check
        if (enemy.isBoss) {
            this.shakeScreen(65, 16);
            if (enemy.type === 'AYAKO') {
                this.boss = null;
                this.spawnStar(enemy.x - 20, enemy.y);
                this.spawnStar(enemy.x + 20, enemy.y);
                this.addFloatingText('MID-BOSS SUNK!', this.width * 0.5, this.height * 0.4, '#2ecc71', 22);
            } else {
                this.boss = null;
                this.onStageBossDefeated(enemy);
            }
        }
    }

    // --- Boss Defeated: Announcement with full ship name ---
    onStageBossDefeated(bossEnemy) {
        this.stageBossSunkName = bossEnemy.name;
        this.shakeScreen(90, 20);

        // Full Boss Sunk Announcement banner
        this.addFloatingText(`【擊破確認】`, this.width * 0.5, this.height * 0.38, '#ffeb3b', 22);
        this.addFloatingText(`${bossEnemy.name} 徹底擊沉！`, this.width * 0.5, this.height * 0.45, '#22c55e', 18);

        window.sound.playStageClear();

        // Clear remaining hostile entities
        this.enemyBullets = [];
        this.enemies = [];

        // Transition to Post-Stage Debriefing Report after 2.8s
        setTimeout(() => {
            this.showStageReport(bossEnemy.name);
        }, 2800);
    }

    // --- Post-Stage Combat Debriefing Report (過關數據報告) ---
    showStageReport(bossName) {
        this.state = 'STAGE_REPORT';
        window.sound.stopBGM();

        const stageBonus = this.stage * 20000;
        const planesBonus = this.stagePlanesDestroyed * 500;
        const starBonus = this.stageStarsCollected * 2000;
        const totalBonus = stageBonus + planesBonus + starBonus;

        this.addScore(1, totalBonus);
        if (this.isTwoPlayer) this.addScore(2, totalBonus);

        // Grade calculation (S, A, B, C)
        let grade = 'B';
        if (this.stagePlanesDestroyed >= 18 && this.stageStarsCollected >= 4) grade = 'S';
        else if (this.stagePlanesDestroyed >= 12) grade = 'A';

        // Populate Modal Fields
        document.getElementById('reportStageTitle').innerText = `STAGE ${this.stage} 戰役大捷 (LOOP ${this.loop})`;
        document.getElementById('reportBossName').innerText = `【擊破旗艦】: ${bossName}`;
        document.getElementById('reportPlanesCount').innerText = `${this.stagePlanesDestroyed} 架 (+${planesBonus.toLocaleString()} PTS)`;
        document.getElementById('reportStarsCount').innerText = `${this.stageStarsCollected} 顆 (+${starBonus.toLocaleString()} PTS)`;
        document.getElementById('reportClearBonus').innerText = `+${stageBonus.toLocaleString()} PTS`;
        document.getElementById('reportTotalScore1P').innerText = this.score1P.toLocaleString();
        document.getElementById('reportTotalScore2P').innerText = this.isTwoPlayer ? this.score2P.toLocaleString() : '-';
        document.getElementById('reportGrade').innerText = grade;

        document.getElementById('stageReportModal')?.classList.remove('hidden');
    }

    spawnStar(x, y) {
        this.powerups.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 1.6,
            vy: 1.1,
            type: 'STAR_COIN',
            frame: Math.floor(Math.random() * 20)
        });
    }

    cyclePowerup(pup) {
        const cycle = ['POW', '3WAY', 'AUTO', 'LASER', 'SHOTGUN', 'BOMB'];
        let idx = cycle.indexOf(pup.type);
        idx = (idx + 1) % cycle.length;
        pup.type = cycle[idx];
        pup.vy = -1.5;
        window.sound.playPowerupHit();
    }

    spawnPowerup(x, y, type = 'POW') {
        this.powerups.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1.2,
            type,
            frame: 0
        });
    }

    // Collect Powerup or Star
    collectItem(player, item) {
        if (item.type === 'STAR_COIN') {
            // Golden Star Collect
            window.sound.playStarCollect();
            this.stageStarsCollected++;
            this.totalStarsAllStages++;
            this.addScore(player.id, 2000);
            this.addFloatingText('+2000 ⭐', player.x, player.y - 25, '#ffeb3b', 15);
            return;
        }

        // Standard 1943 Weapon / POW Badge
        window.sound.playPowerupCollect();
        this.addScore(player.id, 1000);

        switch (item.type) {
            case 'POW':
                player.energy = Math.min(player.maxEnergy, player.energy + 28);
                this.addFloatingText('+ENERGY!', player.x, player.y - 25, '#2ecc71', 14);
                break;
            case '3WAY':
                player.weapon = '3WAY';
                player.weaponTimer = 700;
                this.addFloatingText('3-WAY!', player.x, player.y - 25, '#27ae60', 14);
                break;
            case 'AUTO':
                player.weapon = 'AUTO';
                player.weaponTimer = 700;
                this.addFloatingText('AUTO FIRE!', player.x, player.y - 25, '#00bcd4', 14);
                break;
            case 'LASER':
                player.weapon = 'LASER';
                player.weaponTimer = 600;
                this.addFloatingText('SUPER LASER!', player.x, player.y - 25, '#8e44ad', 14);
                break;
            case 'SHOTGUN':
                player.weapon = 'SHOTGUN';
                player.weaponTimer = 700;
                this.addFloatingText('SHOTGUN!', player.x, player.y - 25, '#e67e22', 14);
                break;
            case 'BOMB':
                player.bombs++;
                this.addFloatingText('+1 BOMB!', player.x, player.y - 25, '#f39c12', 14);
                break;
        }
    }

    addScore(playerId, pts) {
        if (playerId === 1) {
            this.score1P += pts;
            if (this.score1P > this.highScore) {
                this.highScore = this.score1P;
                localStorage.setItem('1943_hi_score', this.highScore);
            }
        } else {
            this.score2P += pts;
            if (this.score2P > this.highScore) {
                this.highScore = this.score2P;
                localStorage.setItem('1943_hi_score', this.highScore);
            }
        }
    }

    shakeScreen(duration, magnitude) {
        this.shakeTime = duration;
        this.shakeMagnitude = magnitude;
    }

    createHitSparks(x, y, count = 4) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.2 + Math.random() * 2.5;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.5 ? '#f39c12' : '#ffffff',
                size: 2.5,
                life: 10 + Math.random() * 6
            });
        }
    }

    createExplosion(x, y, size = 'small') {
        const count = size === 'big' ? 36 : (size === 'medium' ? 20 : 10);
        const maxSpeed = size === 'big' ? 5.0 : (size === 'medium' ? 3.5 : 2.5);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * maxSpeed;
            const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#34495e', '#ffffff'];
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: size === 'big' ? 5 + Math.random() * 5 : 3 + Math.random() * 3,
                life: size === 'big' ? 30 + Math.random() * 15 : 16 + Math.random() * 10
            });
        }
    }

    addFloatingText(text, x, y, color = '#ffffff', size = 12) {
        this.floatingTexts.push({
            text,
            x,
            y,
            vy: -1.0,
            color,
            size,
            life: 55
        });
    }

    gameOver() {
        this.state = 'GAMEOVER';
        window.sound.stopBGM();

        document.getElementById('saveFinalScore1P').innerText = this.score1P.toLocaleString();
        document.getElementById('saveFinalScore2P').innerText = this.score2P.toLocaleString();
        document.getElementById('saveFinalStage').innerText = `STAGE ${this.stage} (LOOP ${this.loop})`;

        document.getElementById('saveScoreModal')?.classList.remove('hidden');
    }

    // --- Render Loop ---
    render() {
        this.ctx.save();

        if (this.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * this.shakeMagnitude;
            const dy = (Math.random() - 0.5) * this.shakeMagnitude;
            this.ctx.translate(dx, dy);
        }

        // 1. CARRIER TAKEOFF ANIMATION RENDER
        if (this.state === 'CARRIER_TAKEOFF') {
            const progress = this.takeoffFrame / this.takeoffDuration;
            Sprites.drawCarrierTakeoffDeck(this.ctx, this.width, this.height, progress);

            // Draw takeoff player plane(s)
            Sprites.drawP38(this.ctx, this.p1.x, this.p1.y, {
                isP2: false,
                bank: 0,
                propellerFrame: this.takeoffFrame,
                scale: 1.0 + Math.min(0.2, progress * 0.25)
            });

            if (this.p2.active) {
                Sprites.drawP38(this.ctx, this.p2.x, this.p2.y, {
                    isP2: true,
                    bank: 0,
                    propellerFrame: this.takeoffFrame,
                    scale: 1.0 + Math.min(0.2, progress * 0.25)
                });
            }

            // Cinematic Banner
            this.ctx.fillStyle = '#f59e0b';
            this.ctx.font = 'bold 16px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            if (this.takeoffFrame < 60) {
                this.ctx.fillText('ENGINES REV UP...', this.width * 0.5, this.height * 0.2);
            } else if (this.takeoffFrame < 180) {
                this.ctx.fillText('CATAPULT LAUNCH!!', this.width * 0.5, this.height * 0.2);
            } else {
                this.ctx.fillStyle = '#22c55e';
                this.ctx.fillText('AIRBORNE! GOOD LUCK!', this.width * 0.5, this.height * 0.2);
            }

            this.ctx.restore();
            return;
        }

        // 2. Normal Game Scene
        Sprites.drawOcean(this.ctx, this.width, this.height, this.oceanScrollY, this.stage);

        this.islands.forEach((isl) => {
            Sprites.drawIsland(this.ctx, isl.x, isl.y, isl.scale);
        });

        // Sea Targets & Bosses
        this.enemies.forEach((e) => {
            if (e.isSeaTarget) {
                if (e.type === 'GUNBOAT') Sprites.drawGunboat(this.ctx, e.x, e.y);
                else if (e.type === 'DESTROYER') Sprites.drawDestroyer(this.ctx, e.x, e.y, e.turrets, e.hp / e.maxHp);
                else if (e.type === 'BATTLESHIP') Sprites.drawBattleshipBoss(this.ctx, e.x, e.y, { turrets: e.turrets, hpRatio: e.hp / e.maxHp, partsDestroyed: e.partsDestroyed });
                else if (e.type === 'CARRIER') Sprites.drawCarrierBoss(this.ctx, e.x, e.y, { turrets: e.turrets, hpRatio: e.hp / e.maxHp, partsDestroyed: e.partsDestroyed });
                else if (e.type === 'KONGO') Sprites.drawKongoBoss(this.ctx, e.x, e.y, { turrets: e.turrets, hpRatio: e.hp / e.maxHp, partsDestroyed: e.partsDestroyed });
                else if (e.type === 'TAIHO') Sprites.drawTaihoBoss(this.ctx, e.x, e.y, { turrets: e.turrets, hpRatio: e.hp / e.maxHp, partsDestroyed: e.partsDestroyed });
                else if (e.type === 'YAMATO') Sprites.drawYamatoBoss(this.ctx, e.x, e.y, { turrets: e.turrets, hpRatio: e.hp / e.maxHp, partsDestroyed: e.partsDestroyed });
            }
        });

        // Lower Clouds
        this.clouds.forEach((cloud, idx) => {
            if (idx % 2 === 0) Sprites.drawCloud(this.ctx, cloud.x, cloud.y, cloud.width, cloud.height, cloud.opacity);
        });

        // Collectibles: Powerups and Golden Stars
        this.powerups.forEach((pup) => {
            if (pup.type === 'STAR_COIN') {
                Sprites.drawGoldenStar(this.ctx, pup.x, pup.y, pup.frame);
            } else {
                Sprites.drawPowerup(this.ctx, pup.x, pup.y, pup.type, pup.frame);
            }
        });

        // Bullets
        this.playerBullets.forEach((b) => Sprites.drawBullet(this.ctx, b));
        this.enemyBullets.forEach((b) => Sprites.drawBullet(this.ctx, b));

        // Airborne Enemies
        this.enemies.forEach((e) => {
            if (!e.isSeaTarget) {
                if (e.type === 'ZERO') Sprites.drawZero(this.ctx, e.x, e.y, e.angle);
                else if (e.type === 'RED_SQUAD') Sprites.drawRedSquadron(this.ctx, e.x, e.y, e.angle);
                else if (e.type === 'BOMBER') Sprites.drawMediumBomber(this.ctx, e.x, e.y);
                else if (e.type === 'AYAKO') Sprites.drawAyakoBoss(this.ctx, e.x, e.y, e.hp / e.maxHp, e.propFrame, e.variant);
            }
        });

        // Players
        if (this.p1.active) {
            Sprites.drawP38(this.ctx, this.p1.x, this.p1.y, {
                isP2: false,
                bank: this.p1.bank,
                propellerFrame: this.stageTime,
                isInvincible: this.p1.invincibleTimer > 0,
                isLooping: this.p1.isLooping,
                loopProgress: this.p1.loopTimer / this.p1.loopDuration
            });
        }
        if (this.p2.active) {
            Sprites.drawP38(this.ctx, this.p2.x, this.p2.y, {
                isP2: true,
                bank: this.p2.bank,
                propellerFrame: this.stageTime,
                isInvincible: this.p2.invincibleTimer > 0,
                isLooping: this.p2.isLooping,
                loopProgress: this.p2.loopTimer / this.p2.loopDuration
            });
        }

        // Upper Clouds
        this.clouds.forEach((cloud, idx) => {
            if (idx % 2 !== 0) Sprites.drawCloud(this.ctx, cloud.x, cloud.y, cloud.width, cloud.height, cloud.opacity);
        });

        // Particles
        this.particles.forEach((p) => {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Mega Crash Flash
        if (this.megaCrashActive) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(this.megaCrashTimer * 0.4) * 0.35 + 0.35})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.megaCrashStrikes.forEach((strike) => {
                Sprites.drawLightningBolt(this.ctx, strike.x, strike.startY, strike.x + (Math.random() - 0.5) * 80, strike.endY);
            });
        }

        // Floating Texts
        this.floatingTexts.forEach((ft) => {
            this.ctx.save();
            this.ctx.fillStyle = ft.color;
            this.ctx.font = `bold ${ft.size}px "Press Start 2P", monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = '#000000';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.restore();
        });

        // Stage Intro Banner
        if (this.state === 'STAGE_INTRO') {
            this.renderStageIntro();
        }

        // Cinematic Boss Dossier Intro
        if (this.state === 'BOSS_INTRO' && this.currentBossData) {
            this.renderBossIntroCard();
        }

        this.renderHUD();

        this.ctx.restore();
    }

    renderStageIntro() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(0, this.height * 0.36, this.width, 150);

        ctx.textAlign = 'center';
        ctx.font = 'bold 20px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`STAGE ${this.stage} / ${this.maxStages}`, this.width * 0.5, this.height * 0.41);

        if (this.loop > 1) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#ff7043';
            ctx.fillText(`★ LOOP ${this.loop} (難易度上升) ★`, this.width * 0.5, this.height * 0.45);
        }

        const diff = this.getStageDifficulty();
        ctx.font = 'bold 12px "Press Start 2P", monospace';
        ctx.fillStyle = '#3498db';
        ctx.fillText(diff.name, this.width * 0.5, this.height * 0.50);

        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('ALL AIRCRAFT ENGAGE!!', this.width * 0.5, this.height * 0.53);

        ctx.restore();
    }

    // --- Boss Dossier Presentation Card (魔王出場介紹卡) ---
    renderBossIntroCard() {
        const ctx = this.ctx;
        const b = this.currentBossData;
        ctx.save();

        // Strobe warning border
        const flash = Math.floor(Date.now() / 150) % 2 === 0;
        ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.85)' : 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(20, this.height * 0.28, this.width - 40, 180);

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, this.height * 0.28, this.width - 40, 180);

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px "Press Start 2P", monospace';
        ctx.fillStyle = '#facc15';
        ctx.fillText('⚠️ WARNING: FLAGSHIP INCOMING ⚠️', this.width * 0.5, this.height * 0.33);

        ctx.font = 'bold 13px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.name, this.width * 0.5, this.height * 0.38);

        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(b.type, this.width * 0.5, this.height * 0.42);

        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(b.specs, this.width * 0.5, this.height * 0.46);
        ctx.fillText(b.armament, this.width * 0.5, this.height * 0.49);

        ctx.restore();
    }

    renderHUD() {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = '10px "Press Start 2P", monospace';

        // 1P HUD
        ctx.fillStyle = '#3498db';
        ctx.fillText('1P SCORE', 15, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.score1P.toString().padStart(6, '0'), 15, 38);

        ctx.fillStyle = '#bdc3c7';
        ctx.fillText('ENERGY', 15, 54);
        ctx.fillStyle = '#111';
        ctx.fillRect(80, 44, 96, 12);
        const p1EnergyRatio = Math.max(0, this.p1.energy / this.p1.maxEnergy);
        ctx.fillStyle = p1EnergyRatio > 0.3 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(82, 46, 92 * p1EnergyRatio, 8);

        ctx.fillStyle = '#f39c12';
        ctx.fillText(`BOMBS[B]: ${this.p1.bombs}`, 15, 72);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillText(`LIVES: ${this.p1.lives}`, 15, 88);

        // Center: High Score & Stars Count
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText('HI-SCORE', this.width * 0.5, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.highScore.toString().padStart(6, '0'), this.width * 0.5, 34);

        ctx.fillStyle = '#facc15';
        ctx.fillText(`⭐ STARS: ${this.stageStarsCollected}`, this.width * 0.5, 48);

        // 2P HUD
        if (this.isTwoPlayer) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e74c3c';
            ctx.fillText('2P SCORE', this.width - 15, 22);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(this.score2P.toString().padStart(6, '0'), this.width - 15, 38);

            ctx.fillStyle = '#bdc3c7';
            ctx.fillText('ENERGY', this.width - 110, 54);
            ctx.fillStyle = '#111';
            ctx.fillRect(this.width - 105, 44, 90, 12);
            const p2EnergyRatio = Math.max(0, this.p2.energy / this.p2.maxEnergy);
            ctx.fillStyle = p2EnergyRatio > 0.3 ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(this.width - 103, 46, 86 * p2EnergyRatio, 8);

            ctx.fillStyle = '#f39c12';
            ctx.fillText(`BOMBS[1]: ${this.p2.bombs}`, this.width - 15, 72);
            ctx.fillStyle = '#ecf0f1';
            ctx.fillText(`LIVES: ${this.p2.lives}`, this.width - 15, 88);
        }

        // BOSS HEALTH BAR
        if (this.boss) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff3838';
            ctx.fillText(this.boss.name, this.width * 0.5, 70);

            const barW = 260;
            const barH = 10;
            const barX = (this.width - barW) * 0.5;
            const barY = 78;

            ctx.fillStyle = '#222';
            ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

            const hpRatio = Math.max(0, this.boss.hp / this.boss.maxHp);
            const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
            grad.addColorStop(0, '#e74c3c');
            grad.addColorStop(1, '#f1c40f');
            ctx.fillStyle = grad;
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }

        // Bottom Bar
        ctx.textAlign = 'left';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`CREDIT(S): ${this.credits} [P鍵投幣]`, 15, this.height - 12);

        ctx.textAlign = 'right';
        ctx.fillText(`STAGE ${this.stage}-${this.maxStages} (L${this.loop})`, this.width - 15, this.height - 12);

        ctx.restore();
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

// Global game instance
window.game = new GameEngine();
window.game.startLoop();
