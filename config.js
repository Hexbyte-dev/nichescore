// ============================================================
// NICHESCORE CONFIGURATION
//
// All tunable settings in one place. Platform credentials
// come from environment variables; everything else is here.
// ============================================================

module.exports = {
  // How often collectors run (cron syntax: "every 6 hours")
  schedule: process.env.NICHESCORE_SCHEDULE || "0 */6 * * *",

  // Frustration keywords to search across platforms
  keywords: [
    "I wish there was",
    "why is there no",
    "why can't I",
    "so annoying that",
    "there should be an app",
    "hate when",
    "frustrated that",
    "somebody should make",
    "wish someone would build",
    "can't believe there's no",
  ],

  // Reddit settings
  reddit: {
    subreddits: {
      general: [
        "mildlyinfuriating",
        "DoesAnybodyElse",
        "AppIdeas",
        "SomebodyMakeThis",
      ],
      realEstate: [
        "RealEstate",
        "PropertyManagement",
        "Landlord",
        "FirstTimeHomeBuyer",
        "RealEstateInvesting",
        "CommercialRealEstate",
      ],
      gardening: [
        "gardening",
        "homestead",
        "BackyardOrchard",
        "UrbanGardening",
        "Permaculture",
        "composting",
        "vegetablegardening",
      ],
      lifestyle: [
        "luxury",
        "LifeProTips",
        "PersonalFinance",
        "FatFIRE",
        "watches",
        "HomeImprovement",
        "InteriorDesign",
        "malelivingspace",
      ],
    },
    postsPerSubreddit: 15,
  },

  // App Store settings
  appStore: {
    googlePlay: [
      "com.zillow.android.zillowmap",
      "com.trulia.android",
      "com.appfolio.appfolio",
      "com.scotts.lawnapp",
      "com.gardentags.gardentags",
    ],
    appStoreIos: [
      "310738695",
      "288487321",
      "1497427849",
    ],
    reviewsPerApp: 40,
  },

  // TikTok settings
  tiktok: {
    hashtags: [
      "frustrated",
      "rant",
      "whyisthisathing",
      "firstworldproblems",
      "appletiktok",
    ],
    commentsPerHashtag: 20,
  },

  // X/Twitter settings (via Nitter scraping)
  twitter: {
    nitterInstances: [
      "nitter.privacydev.net",
      "nitter.poast.org",
    ],
  },

  // Classifier settings
  classifier: {
    batchSize: 50,
    model: "claude-haiku-4-5-20251001",
    mergeModel: "claude-sonnet-4-5-20241022",
    mergeThreshold: 500,
  },

  // Source quality weights for NicheScore
  sourceWeights: {
    niche_subreddit: 9,
    appstore_ios: 8,
    appstore_google: 8,
    idea_subreddit: 8,
    general_subreddit: 5,
    x: 4,
    tiktok: 3,
  },

  // Which subreddits count as "niche" vs "general" vs "idea"
  subredditTiers: {
    idea: ["AppIdeas", "SomebodyMakeThis"],
    general: ["mildlyinfuriating", "DoesAnybodyElse", "LifeProTips"],
  },
};
