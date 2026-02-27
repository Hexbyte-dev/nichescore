const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateNicheScore, getFrequencyScore } = require("./scorer");

describe("NicheScore Calculator", () => {
  it("calculates a NicheScore from 0-100", () => {
    const score = calculateNicheScore({
      sentiment: 8,
      frequency: 7,
      sourceQuality: 9,
      solvability: 8,
    });
    // (8*2 + 7*3 + 9*2 + 8*3) / 10 = (16+21+18+24)/10 = 79/10 ... but formula is raw/10*10
    // raw = 16+21+18+24 = 79, then Math.min(Math.round(79/10*10), 100) = Math.min(79, 100) = 79
    assert.equal(score, 79);
  });

  it("caps score at 100", () => {
    const score = calculateNicheScore({
      sentiment: 10,
      frequency: 10,
      sourceQuality: 10,
      solvability: 10,
    });
    // raw = 20+30+20+30 = 100, Math.min(Math.round(100/10*10), 100) = 100
    assert.equal(score, 100);
  });

  it("maps post count to frequency score 1-10", () => {
    assert.equal(getFrequencyScore(1), 1);
    assert.equal(getFrequencyScore(5), 3);
    assert.equal(getFrequencyScore(20), 6);
    assert.equal(getFrequencyScore(100), 10);
  });
});
