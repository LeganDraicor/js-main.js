import { GRAVITY, PLAYER_SPEED, PLAYER_JUMP, GAME_WIDTH, GAME_HEIGHT, LIVES_START, EXTRA_LIFE_SCORE, HIGH_SCORE_KEY } from './main.js';
import { Particle } from './particle.js';

let particles = [];
let highScore = 0;

export function setPlayerDependencies(particleArray, initialHighScore) {
    particles = particleArray;
    highScore = initialHighScore;
}

export function updateHighScore(newScore) {
    highScore = newScore;
}

export class Player {
    constructor(id, controls, sprite, checkGameOverFn) {
        this.id = id;
        this.width = 40;
        this.height = 40;
        this.x = GAME_WIDTH / 2 - this.width / 2 + (id === 1 ? -50 : 50);
        this.y = GAME_HEIGHT - this.height - 50;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.sprite = sprite;
        this.onFrozenPlatform = false;
        this.controls = controls;
        this.isDead = false;
        this.score = 0;
        this.lives = LIVES_START;
        this.nextExtraLifeScore = EXTRA_LIFE_SCORE;
        this.checkGameOver = checkGameOverFn; // Function to check if the game is over
    }

    draw(ctx) {
        if (this.isDead) return;
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.sprite, this.x + this.width / 2, this.y + this.height / 2);
    }

    update(keys) {
        if (this.isDead) return;

        if (this.onFrozenPlatform) {
            if (!keys[this.controls.left] && !keys[this.controls.right]) {
                this.vx *= 0.97;
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
            } else {
                if (keys[this.controls.left]) this.vx = -PLAYER_SPEED;
                if (keys[this.controls.right]) this.vx = PLAYER_SPEED;
            }
        } else {
            this.vx = 0;
            if (keys[this.controls.left]) this.vx = -PLAYER_SPEED;
            if (keys[this.controls.right]) this.vx = PLAYER_SPEED;
        }

        this.x += this.vx;

        // Screen wrap
        if (this.x < -this.width) this.x = GAME_WIDTH;
        if (this.x > GAME_WIDTH) this.x = -this.width;

        this.vy += GRAVITY;
        this.y += this.vy;
        this.onGround = false;
        this.onFrozenPlatform = false;
    }

    jump() {
        if (this.onGround && !this.isDead) {
            this.vy = PLAYER_JUMP;
        }
    }

    die() {
        if (this.isDead) return;
        this.lives--;

        for (let i = 0; i < 50; i++) {
            particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, this.sprite));
        }

        if (this.lives <= 0) {
            this.isDead = true;
            this.checkGameOver();
        } else {
            this.x = GAME_WIDTH / 2 - this.width / 2;
            this.y = GAME_HEIGHT - this.height - 100;
            this.vx = 0;
            this.vy = 0;
        }
    }

    addScore(points) {
        this.score += points;
        if (this.score >= this.nextExtraLifeScore) {
            this.lives++;
            this.nextExtraLifeScore += EXTRA_LIFE_SCORE;
        }
        if (this.score > highScore) {
            highScore = this.score;
            localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
            updateHighScore(highScore);
        }
    }
}
