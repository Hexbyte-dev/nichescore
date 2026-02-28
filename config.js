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

  // Hacker News settings (Algolia Search API — no auth needed)
  hackernews: {
    baseUrl: "https://hn.algolia.com/api/v1",
    resultsPerKeyword: 20,
  },

  // Lemmy settings (federated Reddit alternative — no auth needed)
  lemmy: {
    instance: "https://lemmy.world",
    communities: {
      general: ["technology", "asklemmy"],
      realEstate: ["realestate", "homeowners"],
      gardening: ["gardening", "homesteading", "permaculture"],
      lifestyle: ["personalfinance", "homeimprovement", "interiordesign"],
    },
    postsPerCommunity: 15,
  },

  // Stack Exchange settings (free API — optional key for higher rate limit)
  stackexchange: {
    baseUrl: "https://api.stackexchange.com/2.3",
    sites: ["diy", "gardening", "money", "softwarerecs", "webapps"],
    questionsPerSite: 20,
    apiKey: process.env.STACKEXCHANGE_API_KEY || null,
  },

  // Product Hunt settings (requires free OAuth app registration)
  producthunt: {
    apiUrl: "https://api.producthunt.com/v2/api/graphql",
    clientId: process.env.PRODUCTHUNT_CLIENT_ID || null,
    clientSecret: process.env.PRODUCTHUNT_CLIENT_SECRET || null,
    postsPerQuery: 20,
  },

  // Classifier settings
  classifier: {
    batchSize: 25,
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
    hackernews: 7,
    lemmy: 7,
    stackexchange: 8,
    producthunt: 6,
  },

  // Which subreddits count as "niche" vs "general" vs "idea"
  subredditTiers: {
    idea: ["AppIdeas", "SomebodyMakeThis"],
    general: ["mildlyinfuriating", "DoesAnybodyElse", "LifeProTips"],
  },
};
