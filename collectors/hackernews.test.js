const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformHNItem, buildSearchUrl } = require("./hackernews");

describe("Hacker News Collector", () => {
  it("transforms an HN story into raw_posts format", () => {
    const item = {
      objectID: "12345",
      author: "pg",
      title: "I wish there was a better way to manage properties",
      story_text: null,
      url: "https://example.com/article",
      created_at: "2026-02-20T10:00:00.000Z",
    };
    const result = transformHNItem(item);
    assert.equal(result.platform, "hackernews");
    assert.equal(result.platform_id, "12345");
    assert.equal(result.author, "pg");
    assert.ok(result.content.includes("I wish there was"));
    assert.equal(result.url, "https://news.ycombinator.com/item?id=12345");
    assert.ok(result.posted_at instanceof Date);
  });

  it("transforms an HN comment into raw_posts format", () => {
    const item = {
      objectID: "67890",
      author: "someone",
      comment_text: "So frustrated that no app handles this correctly",
      story_title: "Ask HN: What tools do you wish existed?",
      created_at: "2026-02-21T15:30:00.000Z",
    };
    const result = transformHNItem(item);
    assert.equal(result.platform, "hackernews");
    assert.equal(result.platform_id, "67890");
    assert.ok(result.content.includes("So frustrated"));
  });

  it("builds a search URL with encoded keyword", () => {
    const url = buildSearchUrl("I wish there was");
    assert.ok(url.includes("hn.algolia.com"));
    assert.ok(url.includes("I%20wish%20there%20was"));
  });
});
