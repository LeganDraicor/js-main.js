import { Player, setPlayerDependencies, updateHighScore } from './player.js';
import { BasicEnemy, FastEnemy, JumpingEnemy, IceBomberEnemy, ToughEnemy, setEnemyDependencies } from './enemy.js';
import { Platform, ExplosiveBlock, setPlatformDependencies } from './platform.js';
import { Particle } from './particle.js';

// Game Constants (export to be used by other modules)
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;
export const GRAVITY = 0.6;
export const PLAYER_SPEED = 5;
export const PLAYER_JUMP = -15;
export const ENEMY_SPEED = 1.5;
export const FLIP_DURATION = 5000;
export const HIGH_SCORE_KEY = 'retroArcadeHighScore';
export const LIVES_START = 3;
export const EXTRA_LIFE_SCORE = 20000;
export const LEVEL_TRANSITION_TIME = 1500;
export const EXPLOSIVE_BLOCK_USES = 3;
export const spawnPoints = [{ x: 150, y: 60 }, { x: GAME_WIDTH - 150, y: 60 }];

try {
    console.log("DEBUG: Script execution started.");

    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isMobile) {
        document.body.classList.add('mobile');
    }

    const canvas = document.getElementById('game-canvas');
    if (!canvas) throw new Error("Canvas element not found!");
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context could not be created!");

    // Game State Variables
    let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0');
    let level = 1,
        players = [],
        enemies = [],
        platforms = [],
        particles = [],
        explosiveBlock;
    let keys = {},
        gameState = 'playerSelect',
        levelTransitionTimer = 0,
        playerSelectOption = 1;
    
    // Injecting dependencies into modules
    setPlayerDependencies(particles, highScore);
    setEnemyDependencies(enemies, particles, platforms);
    setPlatformDependencies(enemies, particles);


    function resizeGame() {
        const container = document.getElementById('game-canvas-container');
        if (!container) return;
        const mainLayout = document.getElementById('main-layout');
        if (mainLayout) mainLayout.style.height = window.innerHeight + 'px';
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
        let newWidth = containerWidth;
        let newHeight = newWidth / aspectRatio;
        if (newHeight > containerHeight) {
            newHeight = containerHeight;
            newWidth = newHeight * aspectRatio;
        }
        const gameContainer = document.getElementById('game-container');
        gameContainer.style.width = newWidth + 'px';
        gameContainer.style.height = newHeight + 'px';
    }

    const levelLayouts = [
        () => [new Platform(0, 550, 250), new Platform(GAME_WIDTH - 250, 550, 250), new Platform(300, 400, 360), new Platform(0, 250, 350), new Platform(GAME_WIDTH - 350, 250, 350)],
        () => [new Platform(0, 580, 200), new Platform(GAME_WIDTH - 200, 580, 200), new Platform(250, 450, 150), new Platform(GAME_WIDTH - 400, 450, 150), new Platform(0, 300, 200), new Platform(GAME_WIDTH - 200, 300, 200), new Platform(300, 180, 360)],
        () => [new Platform(0, 550, 200), new Platform(GAME_WIDTH - 200, 550, 200), new Platform(380, 400, 200).makeMobile(1, 100), new Platform(0, 250, 300), new Platform(GAME_WIDTH - 300, 250, 300)],
        () => [new Platform(0, 580, 150).makeMobile(1.2, 80), new Platform(GAME_WIDTH - 150, 580, 150).makeMobile(-1.2, 80), new Platform(300, 420, 360), new Platform(0, 250, 350).makeMobile(1.5, 150), new Platform(GAME_WIDTH - 350, 250, 350).makeMobile(-1.5, 150)],
    ];

    function startGame(numPlayers) {
        level = 1;
        players.length = 0; // Clear players array
        const p1Controls = { left: 'a', right: 'd', jump: 'w' };
        players.push(new Player(1, p1Controls, '🤖', checkGameOver));
        if (numPlayers === 2) {
            const p2Controls = { left: 'arrowleft', right: 'arrowright', jump: 'arrowup' };
            players.push(new Player(2, p2Controls, '🧑‍🚀', checkGameOver));
        }
        explosiveBlock = new ExplosiveBlock(GAME_WIDTH, GAME_HEIGHT);
        setupLevel(level);
        gameState = 'playing';
    }

    function setupLevel(levelNum) {
        const layoutIndex = Math.floor((levelNum - 1) / 4) % levelLayouts.length;
        platforms.length = 0;
        platforms.push(new Platform(0, GAME_HEIGHT - 40, GAME_WIDTH, 40, true), ...levelLayouts[layoutIndex]());
        platforms.forEach(p => { p.isFrozen = false; });
        enemies.length = 0;
        explosiveBlock.reset(GAME_HEIGHT);

        const finalLevel = Math.min(levelNum, 50);
        const enemyCount = 2 + Math.floor(finalLevel / 2);
        for (let i = 0; i < enemyCount; i++) {
            const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
            const x = spawnPoint.x, y = spawnPoint.y;
            let enemyType = Math.random();

            if (finalLevel >= 25 && enemyType < 0.15) enemies.push(new ToughEnemy(x, y));
            else if (finalLevel >= 20 && enemyType < 0.3) {
                const validPlatforms = platforms.filter(p => !p.isFloor && p.vx === 0 && !enemies.some(e => e instanceof IceBomberEnemy && e.platform === p));
                if (validPlatforms.length > 0) {
                    const platformForBomber = validPlatforms[Math.floor(Math.random() * validPlatforms.length)];
                    enemies.push(new IceBomberEnemy(0, 0, platformForBomber));
                } else enemies.push(new BasicEnemy(x, y));
            }
            else if (finalLevel >= 10 && enemyType < 0.5) enemies.push(new JumpingEnemy(x, y));
            else if (finalLevel >= 5 && enemyType < 0.75) enemies.push(new FastEnemy(x, y));
            else enemies.push(new BasicEnemy(x, y));
        }
    }

    function update() {
        if (gameState === 'playing') {
            players.forEach(p => p.update(keys));
            enemies.forEach(e => e.update(spawnPoints, GAME_WIDTH));
            platforms.forEach(p => p.update());
            explosiveBlock.update();
            handleCollisions();
            if (enemies.length === 0 && players.some(p => !p.isDead)) {
                level++;
                gameState = 'levelTransition';
                levelTransitionTimer = LEVEL_TRANSITION_TIME;
            }
        } else if (gameState === 'levelTransition') {
            levelTransitionTimer -= 1000 / 60;
            if (levelTransitionTimer <= 0) {
                setupLevel(level);
                gameState = 'playing';
            }
        }
        particles.forEach(p => p.update());
        // Filter particles
        for (let i = particles.length - 1; i >= 0; i--) {
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function handleCollisions() {
        players.forEach(player => {
            if (player.isDead) return;
            const block = explosiveBlock;
            if (block.usesLeft > 0 && player.x < block.x + block.width && player.x + player.width > block.x && player.y + player.height >= block.y && player.y + player.height <= block.y + 10 + player.vy && player.vy >= 0) {
                player.y = block.y - player.height;
                player.vy = 0;
                player.onGround = true;
            }

            let onAnyPlatform = player.onGround;
            let isCurrentlyOnFrozenPlatform = false;

            platforms.forEach(p => {
                if (player.x < p.x + p.width && player.x + player.width > p.x && player.y + player.height >= p.y && player.y + player.height <= p.y + p.height + player.vy && player.vy >= 0) {
                    player.y = p.y - player.height;
                    player.vy = 0;
                    onAnyPlatform = true;
                    if (p.isFrozen) isCurrentlyOnFrozenPlatform = true;
                    player.x += p.vx;
                }
                if (player.x < p.x + p.width && player.x + player.width > p.x && player.y > p.y && player.y <= p.y + p.height && player.vy < 0) {
                    player.y = p.y + p.height;
                    player.vy = 0;
                    const hitCenterX = player.x + player.width / 2;
                    enemies.forEach(enemy => {
                        const onThisPlatform = Math.abs((enemy.y + enemy.height) - p.y) < 10;
                        const withinHitRange = enemy.x < hitCenterX + 20 && (enemy.x + enemy.width) > hitCenterX - 20;
                        if (!enemy.isFlipped && onThisPlatform && withinHitRange) {
                            enemy.flip();
                            player.addScore(50);
                        }
                    });
                }
            });
            player.onGround = onAnyPlatform;
            player.onFrozenPlatform = isCurrentlyOnFrozenPlatform;

            if (player.x < block.x + block.width && player.x + player.width > block.x && player.y > block.y && player.y <= block.y + block.height && player.vy < 0) {
                player.y = block.y + block.height;
                player.vy = 0;
                block.hit();
            }

            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                 if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x && player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
                    if (enemy.isFlipped) {
                        enemies.splice(i, 1);
                        for (let j = 0; j < 20; j++) particles.push(new Particle(enemy.x, enemy.y, enemy.sprite));
                        player.addScore(200);
                    } else {
                        player.die();
                    }
                }
            }
        });

        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
                const e1 = enemies[i], e2 = enemies[j];
                if (e1.x < e2.x + e2.width && e1.x + e1.width > e2.x && e1.y < e2.y + e2.height && e1.y + e1.height > e2.y) {
                    if (!e1.isFlipped && !e2.isFlipped && e1.onGround && e2.onGround) {
                        const tempVx = e1.vx;
                        e1.vx = e2.vx; e2.vx = tempVx;
                        if (e1.x < e2.x) { e1.x -= 1; e2.x += 1; }
                        else { e1.x += 1; e2.x -= 1; }
                    }
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (gameState === 'playerSelect') { drawPlayerSelect(); }
        else {
            platforms.forEach(p => p.draw(ctx));
            explosiveBlock.draw(ctx);
            enemies.forEach(e => e.draw(ctx));
            players.forEach(p => p.draw(ctx));
            drawUI();
            if (gameState === 'paused') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                ctx.fillStyle = 'white';
                ctx.font = '50px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2);
            } else if (gameState === 'levelTransition') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                ctx.fillStyle = 'white';
                ctx.font = '50px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText(`LEVEL ${level}`, GAME_WIDTH / 2, GAME_HEIGHT / 2);
            } else if (gameState === 'gameOver') {
                drawGameOver();
            }
        }
        particles.forEach(p => p.draw(ctx));
    }

    function drawUI() {
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ff4136';
        ctx.fillText('P1 SCORE', 40, 30);
        ctx.fillStyle = 'white';
        ctx.fillText((players[0]?.score || 0).toString().padStart(6, '0'), 40, 60);
        ctx.fillText('LIVES', 240, 30);
        ctx.fillStyle = 'white';
        ctx.fillText((players[0]?.lives || 0).toString(), 240, 60);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4136';
        ctx.fillText('HI-SCORE', GAME_WIDTH / 2, 30);
        ctx.fillStyle = 'white';
        ctx.fillText(highScore.toString().padStart(6, '0'), GAME_WIDTH / 2, 60);
        if (players.length > 1) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ff4136';
            ctx.fillText('P2 SCORE', GAME_WIDTH - 40, 30);
            ctx.fillStyle = 'white';
            ctx.fillText((players[1]?.score || 0).toString().padStart(6, '0'), GAME_WIDTH - 40, 60);
        }
    }

    function drawPlayerSelect() {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4136';
        ctx.font = '80px "Press Start 2P"';
        ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2 + 5, GAME_HEIGHT / 2 - 150 + 5);
        ctx.fillStyle = '#ffdc00';
        ctx.fillText('DRAICOR BROS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150);
        ctx.fillStyle = 'white';
        ctx.font = '40px "Press Start 2P"';
        ctx.fillText('SELECT PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
        ctx.font = '30px "Press Start 2P"';
        ctx.fillStyle = playerSelectOption === 1 ? '#ffdc00' : 'white';
        ctx.fillText('1 PLAYER', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
        ctx.fillStyle = playerSelectOption === 2 ? '#ffdc00' : 'white';
        ctx.fillText('2 PLAYERS', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = 'white';
        ctx.fillText('Use Arrow Keys and Enter', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 180);
    }

    function drawGameOver() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#ff4136';
        ctx.font = '60px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
        ctx.fillStyle = 'white';
        ctx.font = '20px "Press Start 2P"';
        ctx.fillText('Press Enter to return to menu', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
    }

    function checkGameOver() {
        if (players.every(p => p.isDead)) {
            gameState = 'gameOver';
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    function handleStartPress() {
        if (gameState === 'playing') gameState = 'paused';
        else if (gameState === 'paused') gameState = 'playing';
        else if (gameState === 'playerSelect') startGame(playerSelectOption);
        else if (gameState === 'gameOver') gameState = 'playerSelect';
    }

    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        keys[key] = true;
        if (gameState === 'playing') {
            if (key === 'w' || key === ' ') players.find(p => p.id === 1)?.jump();
            if (key === 'arrowup') players.find(p => p.id === 2)?.jump();
            if (key === 'enter') handleStartPress();
        } else if (gameState === 'paused' && key === 'enter') {
            handleStartPress();
        } else if (gameState === 'playerSelect') {
            if (key === 'arrowdown') playerSelectOption = 2;
            if (key === 'arrowup') playerSelectOption = 1;
            if (key === 'enter') handleStartPress();
        } else if (gameState === 'gameOver' && key === 'enter') {
            handleStartPress();
        }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    if (isMobile) {
        const dpadLeft = document.querySelector('#dpad-container .left'),
            dpadRight = document.querySelector('#dpad-container .right'),
            buttonA = document.getElementById('button-a'),
            startButtonTouch = document.getElementById('button-start-touch');
        if (dpadLeft && dpadRight && buttonA && startButtonTouch) {
            dpadLeft.addEventListener('touchstart', e => { e.preventDefault(); keys['a'] = true; });
            dpadLeft.addEventListener('touchend', e => { e.preventDefault(); keys['a'] = false; });
            dpadRight.addEventListener('touchstart', e => { e.preventDefault(); keys['d'] = true; });
            dpadRight.addEventListener('touchend', e => { e.preventDefault(); keys['d'] = false; });
            buttonA.addEventListener('touchstart', e => { e.preventDefault(); players.find(p => p.id === 1)?.jump(); });
            startButtonTouch.addEventListener('touchstart', e => { e.preventDefault(); handleStartPress(); });
        }
    }

    window.addEventListener('load', () => {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        resizeGame();
        gameLoop();
    });
    window.addEventListener('resize', resizeGame);

} catch (e) {
    console.error("FATAL ERROR:", e);
    document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;"><h1>Error</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
}
