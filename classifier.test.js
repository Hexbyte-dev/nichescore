const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildClassifierPrompt, parseClassifierResponse } = require("./classifier");

describe("AI Classifier", () => {
  it("builds a prompt with numbered posts", () => {
    const posts = [
      { id: "a1", content: "Why is there no good plant tracker app?" },
      { id: "b2", content: "Tenant screening apps are all terrible." },
    ];
    const prompt = buildClassifierPrompt(posts);

    assert.ok(prompt.includes("1."));
    assert.ok(prompt.includes("2."));
    assert.ok(prompt.includes("plant tracker"));
    assert.ok(prompt.includes("Tenant screening"));
    assert.ok(prompt.includes("JSON"));
  });

  it("parses a valid classifier response", () => {
    const response = JSON.stringify([
      {
        index: 1,
        category: "gardening tools",
        subcategory: "plant tracking",
        sentiment_score: 7,
        is_app_solvable: true,
        summary: "User wants a plant watering tracker app",
      },
    ]);
    const results = parseClassifierResponse(response);

    assert.equal(results.length, 1);
    assert.equal(results[0].category, "gardening tools");
    assert.equal(results[0].sentiment_score, 7);
    assert.equal(results[0].is_app_solvable, true);
  });

  it("handles markdown-wrapped JSON in response", () => {
    const response = "```json\n[{\"index\":1,\"category\":\"test\",\"subcategory\":\"sub\",\"sentiment_score\":5,\"is_app_solvable\":false,\"summary\":\"test\"}]\n```";
    const results = parseClassifierResponse(response);

    assert.equal(results.length, 1);
    assert.equal(results[0].category, "test");
  });
});
