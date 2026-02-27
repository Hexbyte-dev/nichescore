const { describe, it, mock, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { transformRedditPost, getSubredditTier } = require("./reddit");

const mockSubmissions = [
  {
    id: "abc123",
    title: "Why is there no app for tracking plant watering?",
    selftext: "I keep killing my plants because I forget to water them.",
    author: { name: "plantlover99" },
    subreddit: { display_name: "gardening" },
    permalink: "/r/gardening/comments/abc123/why_is_there_no_app/",
    created_utc: Date.now() / 1000,
    score: 42,
    num_comments: 15,
  },
];

describe("Reddit Collector", () => {
  it("transforms a reddit post into raw_posts format", () => {
    const result = transformRedditPost(mockSubmissions[0]);

    assert.equal(result.platform, "reddit");
    assert.equal(result.platform_id, "abc123");
    assert.equal(result.author, "plantlover99");
    assert.ok(result.content.includes("plant watering"));
    assert.ok(result.url.includes("abc123"));
    assert.equal(result.metadata.subreddit, "gardening");
    assert.equal(result.metadata.score, 42);
  });

  it("classifies subreddit tier correctly", () => {
    assert.equal(getSubredditTier("AppIdeas"), "idea_subreddit");
    assert.equal(getSubredditTier("mildlyinfuriating"), "general_subreddit");
    assert.equal(getSubredditTier("PropertyManagement"), "niche_subreddit");
  });
});
