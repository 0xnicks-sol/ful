import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import logger from '../config/logger';

export enum TimerStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export interface TimerState {
  countdown: number;
  round: number;
  status: TimerStatus;
  participantCount: number;
}

class TimerService extends EventEmitter {
  private currentRound: number = 1;
  private timerActive: boolean = false;
  private hasEnded:    boolean = false;   // true while fight is running (no new joins)
  private countdown: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private io: SocketIOServer | null = null;
  private roundDuration: number;
  private participantCount: number = 0;

  constructor() {
    super();
    this.roundDuration = parseInt(process.env.ROUND_DURATION_SECONDS || '60', 10);
  }

  /**
   * Initialize the timer service with Socket.IO instance
   */
  public initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info('TimerService initialized');
  }

  /**
   * Start a new round timer
   */
  public startTimer(roundId?: number): void {
    if (this.timerActive) {
      logger.warn('Timer already active, cannot start new timer');
      return;
    }

    if (roundId) {
      this.currentRound = roundId;
    }

    this.timerActive = true;
    this.hasEnded    = false;
    this.countdown   = this.roundDuration;
    this.participantCount = 0;

    logger.info(`Starting timer for round ${this.currentRound}`);

    // Emit timer start event
    this.broadcastTimerState();

    // Start countdown interval
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Tick function called every second
   */
  private tick(): void {
    if (this.countdown > 0) {
      this.countdown--;
      this.broadcastTimerState();
      
      if (this.countdown === 10) {
        logger.info('⚠️  10 seconds remaining!');
      }
    } else {
      this.endTimer();
    }
  }

  /**
   * End the current timer
   */
  private endTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.timerActive = false;
    this.hasEnded    = true;   // Block new joins until next round resets this
    logger.info(`Timer ended for round ${this.currentRound} — ${this.participantCount} participant(s)`);

    const payload = {
      round: this.currentRound,
      participantCount: this.participantCount,
    };

    // Broadcast to all connected browsers
    if (this.io) {
      this.io.emit('timer-end', payload);
    }

    // Fire internal Node.js event so battle-engine can react directly
    // (Socket.IO io.emit goes to CLIENTS only — server cannot listen to its own broadcasts)
    this.emit('round-ended', payload);
  }

  /**
   * Stop the timer manually (admin function)
   */
  public stopTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.timerActive = false;
    logger.info('Timer manually stopped');
  }

  /**
   * Broadcast current timer state to all clients
   */
  private broadcastTimerState(): void {
    if (!this.io) return;

    const state: TimerState = {
      countdown: this.countdown,
      round: this.currentRound,
      status: this.timerActive ? TimerStatus.ACTIVE : TimerStatus.ENDED,
      participantCount: this.participantCount,
    };

    this.io.emit('timer-tick', state);
  }

  /**
   * Increment participant count
   */
  public incrementParticipantCount(): void {
    this.participantCount++;
    this.broadcastTimerState();
  }

  /**
   * Get current timer state
   */
  public getTimerState(): TimerState {
    return {
      countdown: this.countdown,
      round: this.currentRound,
      status: this.timerActive ? TimerStatus.ACTIVE : TimerStatus.IDLE,
      participantCount: this.participantCount,
    };
  }

  /**
   * Check if timer is currently active
   */
  public isActive(): boolean {
    return this.timerActive;
  }

  /**
   * Get current round number
   */
  public getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Get remaining time
   */
  public getRemainingTime(): number {
    return this.countdown;
  }

  /**
   * Advance to next round and open the entry window for new participants.
   * The timer itself does NOT start here — it starts when the first participant
   * of the new round joins (via battle-entry.ts).
   */
  public advanceToNextRound(): void {
    this.currentRound++;
    this.hasEnded         = false;   // Open entry window again
    this.participantCount = 0;
    logger.info(`Round ${this.currentRound} ready — waiting for first participant`);
    // Broadcast updated idle state to all browsers
    if (this.io) {
      this.io.emit('timer-tick', {
        countdown:        0,
        round:            this.currentRound,
        status:           TimerStatus.IDLE,
        participantCount: 0,
      });
    }
  }

  /**
   * Returns true when a fight is in progress (timer expired, no new joins allowed)
   */
  public isFightInProgress(): boolean {
    return this.hasEnded;
  }

  /**
   * Reset to round 1
   */
  public resetRounds(): void {
    this.currentRound = 1;
    this.participantCount = 0;
    logger.info('Rounds reset to 1');
  }
}

// Export singleton instance
export const timerService = new TimerService();
export default timerService;
