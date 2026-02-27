const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformPHPost, buildGraphQLQuery } = require("./producthunt");

describe("Product Hunt Collector", () => {
  it("transforms a PH post into raw_posts format", () => {
    const post = {
      id: "ph_44001",
      name: "GardenTracker Pro",
      tagline: "Track your garden plants and schedules",
      description: null,
      url: "https://www.producthunt.com/posts/gardentracker-pro",
      createdAt: "2026-02-22T08:00:00Z",
      user: { name: "plantlover" },
      votesCount: 42,
      commentsCount: 8,
      topics: { edges: [{ node: { name: "Productivity" } }] },
    };
    const result = transformPHPost(post);
    assert.equal(result.platform, "producthunt");
    assert.equal(result.platform_id, "ph_44001");
    assert.equal(result.author, "plantlover");
    assert.ok(result.content.includes("GardenTracker Pro"));
    assert.ok(result.content.includes("Track your garden"));
    assert.equal(result.metadata.votes, 42);
  });

  it("builds a valid GraphQL query", () => {
    const query = buildGraphQLQuery();
    assert.ok(query.includes("posts"));
    assert.ok(query.includes("name"));
    assert.ok(query.includes("tagline"));
  });
});
