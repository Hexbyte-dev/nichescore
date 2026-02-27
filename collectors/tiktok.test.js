const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformTikTokComment } = require("./tiktok");

describe("TikTok Collector", () => {
  it("transforms a TikTok comment into raw_posts format", () => {
    const comment = {
      cid: "tt_comment_789",
      text: "OMG why is there no app that does this??",
      uniqueId: "tiktoker123",
      createTime: 1740500000,
      videoUrl: "https://www.tiktok.com/@user/video/123",
      hashtag: "frustrated",
    };
    const result = transformTikTokComment(comment);

    assert.equal(result.platform, "tiktok");
    assert.equal(result.platform_id, "tt_comment_789");
    assert.ok(result.content.includes("no app"));
    assert.equal(result.metadata.hashtag, "frustrated");
  });
});
