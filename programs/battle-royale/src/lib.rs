use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("BattLE1111111111111111111111111111111111111");

// ─── Seeds ────────────────────────────────────────────────────────────────────
pub const TOURNAMENT_SEED: &[u8]   = b"tournament";
pub const REWARD_POOL_SEED: &[u8]  = b"reward_pool";
pub const PARTICIPANT_SEED: &[u8]  = b"participant";
pub const ROUND_RESULT_SEED: &[u8] = b"round_result";

pub const MAX_ROUNDS: u8 = 10;

// ─── Program ──────────────────────────────────────────────────────────────────
#[program]
pub mod battle_royale {
    use super::*;

    // ── 1. Initialize Tournament ────────────────────────────────────────────
    //
    // Creates a TournamentState PDA and a RewardPool PDA.
    // Called once by the backend authority before any round begins.
    //
    //  tournament_id      – unique u64 identifier (use unix timestamp or sequence)
    //  total_rounds       – how many rounds (max 10)
    //  entry_fee_lamports – how much SOL each participant pays to enter a round
    //                       (set to 0 if participation is free / tracked via webhook)
    pub fn initialize_tournament(
        ctx: Context<InitializeTournament>,
        tournament_id: u64,
        total_rounds: u8,
        entry_fee_lamports: u64,
    ) -> Result<()> {
        require!(
            total_rounds > 0 && total_rounds <= MAX_ROUNDS,
            BattleError::InvalidRoundCount
        );

        let ts = &mut ctx.accounts.tournament;
        ts.authority           = ctx.accounts.authority.key();
        ts.tournament_id       = tournament_id;
        ts.total_rounds        = total_rounds;
        ts.current_round       = 1;
        ts.entry_fee_lamports  = entry_fee_lamports;
        ts.total_pool          = 0;
        ts.is_active           = true;
        ts.is_complete         = false;
        ts.tournament_bump     = ctx.bumps.tournament;
        ts.pool_bump           = ctx.bumps.reward_pool;

        emit!(TournamentInitialized {
            tournament_id,
            authority: ctx.accounts.authority.key(),
            total_rounds,
            entry_fee_lamports,
        });

        Ok(())
    }

    // ── 2. Deposit SOL into Reward Pool ─────────────────────────────────────
    //
    // Anyone (admin / sponsor) can top-up the reward pool with SOL.
    // This is the prize money that winners receive after the tournament.
    pub fn deposit_to_pool(
        ctx: Context<DepositToPool>,
        amount: u64,
    ) -> Result<()> {
        let ts = &mut ctx.accounts.tournament;
        require!(ts.is_active, BattleError::TournamentNotActive);
        require!(!ts.is_complete, BattleError::TournamentComplete);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to:   ctx.accounts.reward_pool.to_account_info(),
                },
            ),
            amount,
        )?;

        ts.total_pool = ts.total_pool.checked_add(amount).unwrap();

        emit!(PoolDeposited {
            depositor:  ctx.accounts.depositor.key(),
            amount,
            new_total: ts.total_pool,
        });

        Ok(())
    }

    // ── 3. Participate (Buy-to-Enter) ────────────────────────────────────────
    //
    // Called when a user buys the game token.
    // Two modes:
    //   a) entry_fee > 0  → user signs this TX themselves and pays SOL
    //   b) entry_fee == 0 → backend authority calls on behalf of user
    //      (backend verifies the Solana SPL token purchase via webhook first)
    //
    // Creates an immutable on-chain ParticipantRecord proving entry.
    pub fn participate(
        ctx: Context<Participate>,
        round_id: u8,
        tx_signature: String,   // the token purchase TX signature (proof)
    ) -> Result<()> {
        let ts = &mut ctx.accounts.tournament;
        require!(ts.is_active, BattleError::TournamentNotActive);
        require!(!ts.is_complete, BattleError::TournamentComplete);
        require_eq!(ts.current_round, round_id, BattleError::WrongRound);

        let rec = &mut ctx.accounts.participant_record;
        require!(!rec.is_active, BattleError::AlreadyParticipating);

        // Collect entry fee if configured
        if ts.entry_fee_lamports > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.participant.to_account_info(),
                        to:   ctx.accounts.reward_pool.to_account_info(),
                    },
                ),
                ts.entry_fee_lamports,
            )?;
            ts.total_pool = ts
                .total_pool
                .checked_add(ts.entry_fee_lamports)
                .unwrap();
        }

        rec.wallet       = ctx.accounts.participant.key();
        rec.round_id     = round_id;
        rec.tx_signature = tx_signature.clone();
        rec.joined_at    = Clock::get()?.unix_timestamp;
        rec.is_active    = true;
        rec.removed_at   = None;
        rec.bump         = ctx.bumps.participant_record;

        emit!(ParticipantJoined {
            wallet: ctx.accounts.participant.key(),
            round_id,
            tx_signature,
        });

        Ok(())
    }

    // ── 4. Remove Participant (Token-Sell Penalty) ──────────────────────────
    //
    // Called by the backend authority when a user SELLS their tokens.
    // Marks the on-chain record as inactive — they forfeit this round.
    pub fn remove_participant(
        ctx: Context<RemoveParticipant>,
        round_id: u8,
    ) -> Result<()> {
        let ts = &ctx.accounts.tournament;
        require!(ts.is_active, BattleError::TournamentNotActive);
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ts.authority,
            BattleError::Unauthorized
        );

        let rec = &mut ctx.accounts.participant_record;
        require!(rec.is_active, BattleError::NotParticipating);

        rec.is_active  = false;
        rec.removed_at = Some(Clock::get()?.unix_timestamp);

        emit!(ParticipantRemoved {
            wallet:   rec.wallet,
            round_id,
            reason:   "token_sold".to_string(),
        });

        Ok(())
    }

    // ── 5. Record Round Result (On-Chain Proof) ──────────────────────────────
    //
    // Backend calls this after selecting the winner to create an immutable
    // on-chain record of every battle outcome (provable fairness).
    // Also advances the tournament's current_round counter.
    pub fn record_round_result(
        ctx: Context<RecordRoundResult>,
        round_id: u8,
        winner: Pubkey,
        participant_count: u32,
    ) -> Result<()> {
        let ts = &mut ctx.accounts.tournament;
        require!(ts.is_active, BattleError::TournamentNotActive);
        require!(!ts.is_complete, BattleError::TournamentComplete);
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ts.authority,
            BattleError::Unauthorized
        );
        require_eq!(ts.current_round, round_id, BattleError::WrongRound);

        let res = &mut ctx.accounts.round_result;
        res.round_id          = round_id;
        res.winner            = winner;
        res.participant_count = participant_count;
        res.completed_at      = Clock::get()?.unix_timestamp;
        res.bump              = ctx.bumps.round_result;

        // Advance round or mark complete
        if round_id >= ts.total_rounds {
            ts.is_complete = true;
            ts.is_active   = false;
        } else {
            ts.current_round += 1;
        }

        emit!(RoundCompleted {
            round_id,
            winner,
            participant_count,
        });

        Ok(())
    }

    // ── 6. Distribute Rewards (Tournament End) ───────────────────────────────
    //
    // Called by backend after the final round completes.
    // Splits the reward pool:
    //   • 1st place  →  50%
    //   • 2nd place  →  30%
    //   • 3rd place  →  20%
    //
    // Uses direct lamport manipulation since reward_pool is owned by this
    // program (initialized via `init` below).
    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
        _tournament_id: u64,
    ) -> Result<()> {
        let ts = &mut ctx.accounts.tournament;
        require!(ts.is_complete, BattleError::TournamentNotComplete);
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ts.authority,
            BattleError::Unauthorized
        );

        // Minimum lamports required to keep the reward_pool rent-exempt
        let rent          = Rent::get()?;
        let min_rent      = rent.minimum_balance(RewardPool::LEN);
        let pool_balance  = ctx.accounts.reward_pool.get_lamports();
        let distributable = pool_balance
            .checked_sub(min_rent)
            .ok_or(BattleError::InsufficientFunds)?;

        require!(distributable > 0, BattleError::NoRewardsAvailable);

        // 50 / 30 / 20 split  (remaining lamports go to 3rd to avoid rounding dust)
        let first  = distributable * 50 / 100;
        let second = distributable * 30 / 100;
        let third  = distributable - first - second;

        // Transfer using direct lamport manipulation (program owns the PDA)
        ctx.accounts.reward_pool.sub_lamports(first)?;
        ctx.accounts.winner1.add_lamports(first)?;

        ctx.accounts.reward_pool.sub_lamports(second)?;
        ctx.accounts.winner2.add_lamports(second)?;

        ctx.accounts.reward_pool.sub_lamports(third)?;
        ctx.accounts.winner3.add_lamports(third)?;

        emit!(RewardsDistributed {
            tournament_id: ts.tournament_id,
            winner1:      ctx.accounts.winner1.key(),
            winner2:      ctx.accounts.winner2.key(),
            winner3:      ctx.accounts.winner3.key(),
            first_place:  first,
            second_place: second,
            third_place:  third,
            timestamp:    Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ── 7. Emergency Withdraw ────────────────────────────────────────────────
    //
    // Safety valve — authority drains pool and deactivates tournament.
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        let ts = &mut ctx.accounts.tournament;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ts.authority,
            BattleError::Unauthorized
        );

        let rent         = Rent::get()?;
        let min_rent     = rent.minimum_balance(RewardPool::LEN);
        let pool_balance = ctx.accounts.reward_pool.get_lamports();
        let withdrawable = pool_balance.saturating_sub(min_rent);

        if withdrawable > 0 {
            ctx.accounts.reward_pool.sub_lamports(withdrawable)?;
            ctx.accounts.authority.add_lamports(withdrawable)?;
        }

        ts.is_active = false;

        emit!(EmergencyWithdrawn {
            authority: ctx.accounts.authority.key(),
            amount:    withdrawable,
        });

        Ok(())
    }
}

// ─── Account Data Structures ──────────────────────────────────────────────────

#[account]
pub struct TournamentState {
    pub authority:          Pubkey,  // 32  backend wallet that controls the tournament
    pub tournament_id:      u64,     //  8
    pub total_rounds:       u8,      //  1
    pub current_round:      u8,      //  1
    pub entry_fee_lamports: u64,     //  8  0 = free / webhook-only entry
    pub total_pool:         u64,     //  8  lamports collected so far
    pub is_active:          bool,    //  1
    pub is_complete:        bool,    //  1
    pub tournament_bump:    u8,      //  1
    pub pool_bump:          u8,      //  1
}

impl TournamentState {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 1 + 1 + 1;
    //  discriminator ──┘
}

#[account]
pub struct RewardPool {
    pub bump: u8,   // 1  stored so we can sign CPI calls if needed
}

impl RewardPool {
    pub const LEN: usize = 8 + 1;
}

#[account]
pub struct ParticipantRecord {
    pub wallet:       Pubkey,       // 32
    pub round_id:     u8,           //  1
    pub tx_signature: String,       //  4 + 88  (base58 Solana tx sig ≤ 88 chars)
    pub joined_at:    i64,          //  8
    pub is_active:    bool,         //  1
    pub removed_at:   Option<i64>,  //  1 + 8
    pub bump:         u8,           //  1
}

impl ParticipantRecord {
    // string prefix (4) + max sig length (88)
    pub const LEN: usize = 8 + 32 + 1 + (4 + 88) + 8 + 1 + (1 + 8) + 1;
}

#[account]
pub struct RoundResult {
    pub round_id:          u8,     //  1
    pub winner:            Pubkey, // 32
    pub participant_count: u32,    //  4
    pub completed_at:      i64,    //  8
    pub bump:              u8,     //  1
}

impl RoundResult {
    pub const LEN: usize = 8 + 1 + 32 + 4 + 8 + 1;
}

// ─── Instruction Contexts ─────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(tournament_id: u64)]
pub struct InitializeTournament<'info> {
    #[account(
        init,
        payer  = authority,
        space  = TournamentState::LEN,
        seeds  = [TOURNAMENT_SEED, &tournament_id.to_le_bytes()],
        bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        init,
        payer  = authority,
        space  = RewardPool::LEN,
        seeds  = [REWARD_POOL_SEED, &tournament_id.to_le_bytes()],
        bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositToPool<'info> {
    #[account(
        mut,
        seeds = [TOURNAMENT_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.tournament_bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        mut,
        seeds = [REWARD_POOL_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.pool_bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u8, tx_signature: String)]
pub struct Participate<'info> {
    #[account(
        mut,
        seeds = [TOURNAMENT_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.tournament_bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        mut,
        seeds = [REWARD_POOL_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.pool_bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(
        init_if_needed,
        payer  = participant,
        space  = ParticipantRecord::LEN,
        seeds  = [
            PARTICIPANT_SEED,
            &tournament.tournament_id.to_le_bytes(),
            participant.key().as_ref(),
            &[round_id],
        ],
        bump
    )]
    pub participant_record: Account<'info, ParticipantRecord>,

    #[account(mut)]
    pub participant: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(round_id: u8)]
pub struct RemoveParticipant<'info> {
    #[account(
        seeds = [TOURNAMENT_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.tournament_bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        mut,
        seeds = [
            PARTICIPANT_SEED,
            &tournament.tournament_id.to_le_bytes(),
            participant_wallet.key().as_ref(),
            &[round_id],
        ],
        bump = participant_record.bump
    )]
    pub participant_record: Account<'info, ParticipantRecord>,

    /// CHECK: the wallet of the participant being removed (not a signer)
    pub participant_wallet: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(round_id: u8)]
pub struct RecordRoundResult<'info> {
    #[account(
        mut,
        seeds = [TOURNAMENT_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.tournament_bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        init,
        payer  = authority,
        space  = RoundResult::LEN,
        seeds  = [
            ROUND_RESULT_SEED,
            &tournament.tournament_id.to_le_bytes(),
            &[round_id],
        ],
        bump
    )]
    pub round_result: Account<'info, RoundResult>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(_tournament_id: u64)]
pub struct DistributeRewards<'info> {
    #[account(
        mut,
        seeds = [TOURNAMENT_SEED, &_tournament_id.to_le_bytes()],
        bump  = tournament.tournament_bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        mut,
        seeds = [REWARD_POOL_SEED, &_tournament_id.to_le_bytes()],
        bump  = tournament.pool_bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    /// CHECK: 1st place winner — receives 50%
    #[account(mut)]
    pub winner1: UncheckedAccount<'info>,

    /// CHECK: 2nd place winner — receives 30%
    #[account(mut)]
    pub winner2: UncheckedAccount<'info>,

    /// CHECK: 3rd place winner — receives 20%
    #[account(mut)]
    pub winner3: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        mut,
        seeds = [TOURNAMENT_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.tournament_bump
    )]
    pub tournament: Account<'info, TournamentState>,

    #[account(
        mut,
        seeds = [REWARD_POOL_SEED, &tournament.tournament_id.to_le_bytes()],
        bump  = tournament.pool_bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct TournamentInitialized {
    pub tournament_id:      u64,
    pub authority:          Pubkey,
    pub total_rounds:       u8,
    pub entry_fee_lamports: u64,
}

#[event]
pub struct PoolDeposited {
    pub depositor:  Pubkey,
    pub amount:     u64,
    pub new_total:  u64,
}

#[event]
pub struct ParticipantJoined {
    pub wallet:       Pubkey,
    pub round_id:     u8,
    pub tx_signature: String,
}

#[event]
pub struct ParticipantRemoved {
    pub wallet:   Pubkey,
    pub round_id: u8,
    pub reason:   String,
}

#[event]
pub struct RoundCompleted {
    pub round_id:          u8,
    pub winner:            Pubkey,
    pub participant_count: u32,
}

#[event]
pub struct RewardsDistributed {
    pub tournament_id: u64,
    pub winner1:       Pubkey,
    pub winner2:       Pubkey,
    pub winner3:       Pubkey,
    pub first_place:   u64,
    pub second_place:  u64,
    pub third_place:   u64,
    pub timestamp:     i64,
}

#[event]
pub struct EmergencyWithdrawn {
    pub authority: Pubkey,
    pub amount:    u64,
}

// ─── Error Codes ──────────────────────────────────────────────────────────────

#[error_code]
pub enum BattleError {
    #[msg("Tournament is not active")]
    TournamentNotActive,
    #[msg("Tournament is already complete — no more entries")]
    TournamentComplete,
    #[msg("Tournament is not yet complete — cannot distribute yet")]
    TournamentNotComplete,
    #[msg("Round count must be between 1 and 10")]
    InvalidRoundCount,
    #[msg("Provided round_id does not match the current round")]
    WrongRound,
    #[msg("This wallet is already participating in the current round")]
    AlreadyParticipating,
    #[msg("This wallet is not participating in the current round")]
    NotParticipating,
    #[msg("Only the tournament authority can perform this action")]
    Unauthorized,
    #[msg("Reward pool has no distributable balance")]
    NoRewardsAvailable,
    #[msg("Reward pool balance is below rent-exempt minimum")]
    InsufficientFunds,
}
