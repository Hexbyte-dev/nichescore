const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { transformLemmyPost, getAllCommunities } = require("./lemmy");

describe("Lemmy Collector", () => {
  it("transforms a Lemmy post into raw_posts format", () => {
    const post = {
      post: {
        id: 99001,
        name: "Why is property management software so terrible?",
        body: "Every app I try is missing basic features. So frustrated.",
        ap_id: "https://lemmy.world/post/99001",
        published: "2026-02-20T12:00:00Z",
      },
      creator: { name: "testuser" },
      community: { name: "realestate" },
    };
    const result = transformLemmyPost(post);
    assert.equal(result.platform, "lemmy");
    assert.equal(result.platform_id, "lemmy_99001");
    assert.equal(result.author, "testuser");
    assert.ok(result.content.includes("property management"));
    assert.ok(result.content.includes("So frustrated"));
    assert.equal(result.metadata.community, "realestate");
  });

  it("returns all communities as a flat array", () => {
    const communities = getAllCommunities();
    assert.ok(Array.isArray(communities));
    assert.ok(communities.length > 0);
    assert.ok(communities.includes("gardening"));
  });
});
