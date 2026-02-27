const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformSEQuestion, buildSearchUrl } = require("./stackexchange");

describe("Stack Exchange Collector", () => {
  it("transforms an SE question into raw_posts format", () => {
    const question = {
      question_id: 55001,
      title: "Why is there no good tool for tracking garden plant schedules?",
      body: "I've tried 5 different apps and none of them work properly.",
      owner: { display_name: "greenthumb42" },
      link: "https://gardening.stackexchange.com/questions/55001",
      creation_date: 1708430400,
      tags: ["tools", "scheduling"],
      score: -2,
    };
    const result = transformSEQuestion(question, "gardening");
    assert.equal(result.platform, "stackexchange");
    assert.equal(result.platform_id, "se_gardening_55001");
    assert.equal(result.author, "greenthumb42");
    assert.ok(result.content.includes("no good tool"));
    assert.equal(result.metadata.site, "gardening");
    assert.deepEqual(result.metadata.tags, ["tools", "scheduling"]);
  });

  it("builds a search URL with API key when available", () => {
    const url = buildSearchUrl("diy", "wish there was", "test-key");
    assert.ok(url.includes("api.stackexchange.com"));
    assert.ok(url.includes("site=diy"));
    assert.ok(url.includes("key=test-key"));
  });

  it("builds a search URL without API key", () => {
    const url = buildSearchUrl("gardening", "frustrated", null);
    assert.ok(url.includes("site=gardening"));
    assert.ok(!url.includes("key="));
  });
});
