const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformTweet, buildSearchUrl } = require("./twitter");

describe("Twitter Collector", () => {
  it("transforms scraped tweet data into raw_posts format", () => {
    const tweet = {
      id: "tweet_12345",
      author: "frustrated_user",
      content: "I wish there was an app that tracks my rent payments automatically",
      timestamp: "2026-02-25T14:30:00Z",
      permalink: "/frustrated_user/status/12345",
    };
    const result = transformTweet(tweet, "nitter.privacydev.net");

    assert.equal(result.platform, "x");
    assert.equal(result.platform_id, "tweet_12345");
    assert.ok(result.content.includes("rent payments"));
    assert.ok(result.url.includes("nitter.privacydev.net"));
  });

  it("builds a Nitter search URL with keywords", () => {
    const url = buildSearchUrl("nitter.privacydev.net", "I wish there was");
    assert.ok(url.includes("nitter.privacydev.net"));
    assert.ok(url.includes("search"));
    assert.ok(url.includes("I+wish+there+was"));
  });
});
