const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformGoogleReview, transformAppleReview } = require("./appstore");

describe("App Store Collector", () => {
  it("transforms a Google Play review into raw_posts format", () => {
    const review = {
      id: "gp_review_001",
      userName: "JohnD",
      text: "This app crashes every time I try to save. Terrible.",
      score: 1,
      url: "https://play.google.com/store/apps/details?id=com.example",
      date: "2026-02-25T10:00:00.000Z",
      appId: "com.example.app",
    };
    const result = transformGoogleReview(review, "com.example.app");

    assert.equal(result.platform, "appstore_google");
    assert.equal(result.platform_id, "gp_review_001");
    assert.ok(result.content.includes("crashes"));
    assert.equal(result.metadata.star_rating, 1);
    assert.equal(result.metadata.app_id, "com.example.app");
  });

  it("transforms an iOS App Store review into raw_posts format", () => {
    const review = {
      id: "ios_review_001",
      userName: "JaneD",
      text: "Missing basic features that competitors have.",
      score: 2,
      url: "https://apps.apple.com/app/id12345",
      updated: "2026-02-25T10:00:00.000Z",
      appId: 12345,
    };
    const result = transformAppleReview(review, "12345");

    assert.equal(result.platform, "appstore_ios");
    assert.equal(result.platform_id, "ios_review_001");
    assert.ok(result.content.includes("Missing basic"));
    assert.equal(result.metadata.star_rating, 2);
  });
});
