/**
 * The Excuse That Almost Works — entry program.
 *
 * One job: write a single line of plain text to /output/entry.txt — the
 * message a gamer texts the boss to skip work during GTA 6 launch week.
 *
 * The line has to survive a tired manager's sniff test, so the program runs
 * a small local tournament first: eight excuses I wrote, each scored on the
 * judge's own brief, most important first — believable (a real, specific,
 * boring workplace detail), funny on its own terms (the laugh comes from
 * the excuse's own logic), reads like a text sent in a hurry, and finds an
 * angle the obvious excuses miss. The winner is written out, and that is
 * the whole output.
 *
 * Gate (sealed scorer): /output/entry.txt must be UTF-8 text of 1 to 140
 * characters, not only white space, one line, at most 20 words.
 *
 * Deterministic by construction: fixed candidate table, fixed rubric
 * scores, fixed tie-breaks, no clock, no randomness, no network, no reads
 * outside this file. Two runs produce byte-identical output.
 *
 * Style guard (authorship hygiene): this file uses no loop-skipping
 * statement, no empty-result return, no exception block, and no
 * fallback-branch keyword anywhere in its code.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Competition constants
// ---------------------------------------------------------------------------

const OUTPUT_PATH = "/output/entry.txt";
const MAX_WORDS = 20;
const MAX_CHARS = 140;
const MIN_CHARS = 1;

// Rubric weights follow the judge's brief order: believability first,
// then humour from the excuse's own logic, then the hurried-text feel,
// then freshness of angle.
const BELIEVABILITY_WEIGHT = 5;
const HUMOUR_WEIGHT = 4;
const HURRIED_WEIGHT = 3;
const FRESHNESS_WEIGHT = 3;

// Clichés the judge explicitly names as dead angles. Any candidate carrying
// one is disqualified from the tournament before scoring begins.
const DEAD_ANGLE_WORDS = [
  "grandmother",
  "grandma",
  "tyre",
  "tire",
  "fever",
  "sick",
  "doctor",
  "dentist",
  "hospital",
  "funeral",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CriterionScores = {
  believability: number;
  humour: number;
  hurried: number;
  freshness: number;
};

type ExcuseCandidate = {
  label: string;
  text: string;
  scores: CriterionScores;
  rationale: string;
};

type ScoredExcuse = {
  candidate: ExcuseCandidate;
  weightedTotal: number;
  wordCount: number;
  charCount: number;
};

type TournamentOutcome = {
  winner: ScoredExcuse;
  runnerUp: ScoredExcuse;
  entrants: number;
  disqualified: number;
};

// ---------------------------------------------------------------------------
// Candidate table — eight excuses, written for this competition.
// ---------------------------------------------------------------------------

const EXCUSE_CANDIDATES: ExcuseCandidate[] = [
  {
    label: "vpn-it-freeze",
    text: "Sorry, the VPN keeps dropping me every ten minutes since the update and IT said wait till Thursday",
    scores: { believability: 5, humour: 5, hurried: 5, freshness: 4 },
    rationale:
      "IT itself forbids logging in, so the excuse authorises itself; the ten-minute drop is a lived, boring detail.",
  },
  {
    label: "carpet-charger-hostage",
    text: "Sorry, facilities shut our floor for carpet cleaning and my charger is in my desk drawer",
    scores: { believability: 4, humour: 4, hurried: 5, freshness: 4 },
    rationale:
      "A charger held hostage by carpet cleaning is funny, but a floor closure alone never stops remote work.",
  },
  {
    label: "shared-drive-lockout",
    text: "Sorry, the shared drive locked me out after the password reset and IT's queue is till Thursday",
    scores: { believability: 4, humour: 3, hurried: 5, freshness: 3 },
    rationale:
      "Plausible and boring, yet a lockout is fixed with one phone call, so the stall feels thin.",
  },
  {
    label: "keycard-update",
    text: "Sorry, my keycard stopped working after the update and security said wait for a new one Thursday",
    scores: { believability: 4, humour: 3, hurried: 5, freshness: 3 },
    rationale:
      "A dead keycard keeps you out of the building, but it says nothing about working from home.",
  },
  {
    label: "fire-alarm-laptop",
    text: "Sorry, the building's doing fire alarm testing all day and my laptop's locked in the office",
    scores: { believability: 3, humour: 4, hurried: 4, freshness: 4 },
    rationale:
      "Two boring facts combine into a trap, but the manager can answer it with one question about the spare laptop.",
  },
  {
    label: "monitor-spreadsheet",
    text: "Sorry, my monitor died and the replacement's coming Thursday, can't do the spreadsheet till then",
    scores: { believability: 4, humour: 3, hurried: 4, freshness: 3 },
    rationale:
      "Specific and work-shaped, yet a dead monitor is an old excuse and the spreadsheet plea overplays it.",
  },
  {
    label: "roadworks-bus",
    text: "Sorry, roadworks closed our street and the bus replacement only runs twice an hour",
    scores: { believability: 4, humour: 2, hurried: 4, freshness: 3 },
    rationale:
      "Entirely believable and entirely dull; the laugh never arrives, and a slow bus still gets you there.",
  },
  {
    label: "storm-router",
    text: "Sorry, the wifi died in last night's storm and the router's been blinking red since midnight",
    scores: { believability: 4, humour: 2, hurried: 4, freshness: 2 },
    rationale:
      "The blinking router is a nice detail, but weather excuses are the first drawer every manager opens.",
  },
];

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

function countWords(line: string): number {
  const trimmedLine = line.trim();
  if (trimmedLine.length === 0) {
    return 0;
  }
  const wordPieces = trimmedLine.split(/\s+/u);
  return wordPieces.length;
}

function measureCharacters(line: string): number {
  return [...line].length;
}

function hasDeadAngle(line: string): boolean {
  const loweredLine = line.toLowerCase();
  let foundDeadAngle = false;
  for (const deadWord of DEAD_ANGLE_WORDS) {
    if (loweredLine.includes(deadWord)) {
      foundDeadAngle = true;
    }
  }
  return foundDeadAngle;
}

function isSingleLine(line: string): boolean {
  return line.includes("\n") === false && line.includes("\r") === false;
}

function isGatePassing(line: string): boolean {
  const charCount = measureCharacters(line);
  const wordCount = countWords(line);
  if (line.trim().length === 0) {
    return false;
  }
  if (charCount < MIN_CHARS) {
    return false;
  }
  if (charCount > MAX_CHARS) {
    return false;
  }
  if (wordCount > MAX_WORDS) {
    return false;
  }
  if (isSingleLine(line) === false) {
    return false;
  }
  if (hasDeadAngle(line)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

function weightedTotal(scores: CriterionScores): number {
  const believabilityPart = scores.believability * BELIEVABILITY_WEIGHT;
  const humourPart = scores.humour * HUMOUR_WEIGHT;
  const hurriedPart = scores.hurried * HURRIED_WEIGHT;
  const freshnessPart = scores.freshness * FRESHNESS_WEIGHT;
  return believabilityPart + humourPart + hurriedPart + freshnessPart;
}

function scoreCandidate(candidate: ExcuseCandidate): ScoredExcuse {
  const scoredExcuse: ScoredExcuse = {
    candidate,
    weightedTotal: weightedTotal(candidate.scores),
    wordCount: countWords(candidate.text),
    charCount: measureCharacters(candidate.text),
  };
  return scoredExcuse;
}

// Earlier candidate wins an exact tie on total, then the shorter text.
function isBetterChallenger(challenger: ScoredExcuse, champion: ScoredExcuse): boolean {
  if (challenger.weightedTotal !== champion.weightedTotal) {
    return challenger.weightedTotal > champion.weightedTotal;
  }
  if (challenger.charCount !== champion.charCount) {
    return challenger.charCount < champion.charCount;
  }
  return false;
}

function runTournament(candidates: ExcuseCandidate[]): TournamentOutcome {
  let champion: ScoredExcuse | undefined;
  let runnerUp: ScoredExcuse | undefined;
  let disqualifiedCount = 0;
  let entrantCount = 0;

  for (const candidate of candidates) {
    const passingGate = isGatePassing(candidate.text);
    if (passingGate === false) {
      disqualifiedCount += 1;
    }
    if (passingGate) {
      entrantCount += 1;
      const scoredExcuse = scoreCandidate(candidate);
      if (champion === undefined) {
        champion = scoredExcuse;
      }
      if (champion !== undefined && scoredExcuse !== champion && isBetterChallenger(scoredExcuse, champion)) {
        runnerUp = champion;
        champion = scoredExcuse;
      }
      if (runnerUp === undefined && scoredExcuse !== champion) {
        runnerUp = scoredExcuse;
      }
      if (runnerUp !== undefined && scoredExcuse !== champion && scoredExcuse !== runnerUp && isBetterChallenger(scoredExcuse, runnerUp)) {
        runnerUp = scoredExcuse;
      }
    }
  }

  if (champion === undefined) {
    throw new Error("tournament ended with no eligible excuse");
  }
  if (runnerUp === undefined) {
    throw new Error("tournament ended with no runner-up excuse");
  }
  const outcome: TournamentOutcome = {
    winner: champion,
    runnerUp,
    entrants: entrantCount,
    disqualified: disqualifiedCount,
  };
  return outcome;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function ensureOutputDirectory(outputPath: string): void {
  const outputDirectory = dirname(outputPath);
  mkdirSync(outputDirectory, { recursive: true });
}

function writeEntryFile(outputPath: string, line: string): void {
  ensureOutputDirectory(outputPath);
  writeFileSync(outputPath, line, { encoding: "utf8" });
}

function readBackEntryFile(outputPath: string): string {
  const fileContents = readFileSync(outputPath, { encoding: "utf8" });
  return fileContents;
}

function buildReport(outcome: TournamentOutcome): string {
  const winner = outcome.winner;
  const reportLines = [
    `tournament entrants: ${outcome.entrants}`,
    `disqualified: ${outcome.disqualified}`,
    `winner: ${winner.candidate.label}`,
    `winner score: ${winner.weightedTotal}`,
    `runner-up: ${outcome.runnerUp.candidate.label} (${outcome.runnerUp.weightedTotal})`,
    `words: ${winner.wordCount}`,
    `chars: ${winner.charCount}`,
    `line: ${winner.candidate.text}`,
  ];
  return reportLines.join("\n");
}

function main(): void {
  const outcome = runTournament(EXCUSE_CANDIDATES);
  const winningLine = outcome.winner.candidate.text;
  if (isGatePassing(winningLine) === false) {
    throw new Error("winning excuse fails the competition gate");
  }
  writeEntryFile(OUTPUT_PATH, winningLine);
  const writtenBack = readBackEntryFile(OUTPUT_PATH);
  if (writtenBack !== winningLine) {
    throw new Error("read-back of /output/entry.txt differs from the winning line");
  }
  const report = buildReport(outcome);
  process.stdout.write(`${report}\n`);
}

main();
