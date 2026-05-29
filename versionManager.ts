/**
 * MatchPro™ Version Manager
 * Controls feature gates for v1–v10 progressive unlocks
 * 
 * Philosophy (Steve Jobs model):
 * The final product ("iPhone 5S") is already designed.
 * We ship it as 10 versioned tiers, each unlocking more intelligence.
 */

import fs from "fs";
import path from "path";

// ─── Version Feature Map ────────────────────────────────────────────────────

export interface VersionInfo {
  version: number;
  name: string;
  tagline: string;
  features: string[];
  description: string;
  icon: string;
}

export const VERSION_MAP: Record<number, VersionInfo> = {
  1: {
    version: 1,
    name: "Core Engine",
    tagline: "The foundation",
    icon: "⚡",
    features: ["whatsapp_ingestion", "nlp_parse", "matching", "dashboard", "export_csv"],
    description: "WhatsApp message ingestion, Arabic NLP parser, supply/demand extraction, AI matching engine, live dashboard",
  },
  2: {
    version: 2,
    name: "My Assets",
    tagline: "See who wants your property",
    icon: "🏠",
    features: ["my_assets", "asset_matching", "contact_management", "follow_up"],
    description: "Add your properties and instantly see every buyer or renter searching for something like yours",
  },
  3: {
    version: 3,
    name: "My Search",
    tagline: "Find exactly what you need",
    icon: "🔍",
    features: ["my_search", "demand_search", "saved_searches", "search_alerts"],
    description: "Search for a property and see all matching supply ranked by AI confidence score",
  },
  4: {
    version: 4,
    name: "Platform Connectors",
    tagline: "Property Finder + Dubizzle",
    icon: "🌐",
    features: ["property_finder", "dubizzle", "multi_source_matching"],
    description: "Pull listings from Property Finder Egypt and Dubizzle — merged into one unified intelligence feed",
  },
  5: {
    version: 5,
    name: "Facebook Groups",
    tagline: "The social intelligence layer",
    icon: "📱",
    features: ["facebook_groups", "social_ingestion"],
    description: "Ingest listings and buyer requests from Egyptian real estate Facebook groups",
  },
  6: {
    version: 6,
    name: "More Platforms",
    tagline: "Aqarmap + OLX Egypt",
    icon: "🗺️",
    features: ["aqarmap", "olx_egypt", "full_market_coverage"],
    description: "Complete Egypt real estate platform coverage — every listing, every buyer, one dashboard",
  },
  7: {
    version: 7,
    name: "Cross-Market",
    tagline: "Any market, any vertical",
    icon: "🌍",
    features: ["multi_market", "export_import", "logistics", "jobs", "wholesale", "vehicles", "medical"],
    description: "Activate any market vertical: export/import, logistics, jobs, wholesale, vehicles, medical equipment",
  },
  8: {
    version: 8,
    name: "Enterprise",
    tagline: "Scale your team",
    icon: "🏢",
    features: ["multi_tenant", "white_label", "org_isolation", "team_management", "audit_log"],
    description: "Multi-tenant organizations, white-labeling, data isolation per org, team management",
  },
  9: {
    version: 9,
    name: "AI Eye",
    tagline: "The Eye of the Market",
    icon: "👁️",
    features: ["price_prediction", "heatmap", "investment_scoring", "trend_alerts", "market_intelligence_ai"],
    description: "AI price prediction, investment scoring, demand heat maps, market trend alerts — true market intelligence",
  },
  10: {
    version: 10,
    name: "Full SaaS",
    tagline: "The platform others build on",
    icon: "🚀",
    features: ["payments", "subscriptions", "public_api", "marketplace", "developer_portal"],
    description: "Payment processing, subscription tiers, public REST API, developer marketplace",
  },
};

// ─── Active Version Management ──────────────────────────────────────────────

// Default: v3 active (Core + My Assets + My Search)
let _activeVersion: number = parseInt(process.env.MATCHPRO_ACTIVE_VERSION || "3", 10);

const VERSION_FILE = path.join(process.cwd(), "data", "version.json");

function loadVersionFromDisk(): void {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(VERSION_FILE, "utf8"));
      if (data.version && data.version >= 1 && data.version <= 10) {
        _activeVersion = data.version;
      }
    }
  } catch {
    // Use default
  }
}

function saveVersionToDisk(version: number): void {
  try {
    const dir = path.dirname(VERSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VERSION_FILE, JSON.stringify({ version, updatedAt: new Date().toISOString() }, null, 2));
  } catch {
    // Non-critical
  }
}

// Load on startup
loadVersionFromDisk();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if a feature is available in the current version
 * Features accumulate — v3 includes all features from v1, v2, v3
 */
export function hasFeature(feature: string, versionOverride?: number): boolean {
  const version = versionOverride ?? _activeVersion;
  for (let v = 1; v <= version; v++) {
    if (VERSION_MAP[v]?.features.includes(feature)) return true;
  }
  return false;
}

/**
 * Get the currently active version number
 */
export function getActiveVersion(): number {
  return _activeVersion;
}

/**
 * Set the active version (admin only — validate in router)
 * Version must be ≥1 and ≤10
 */
export function setActiveVersion(version: number): void {
  if (version < 1 || version > 10) throw new Error("Version must be between 1 and 10");
  _activeVersion = version;
  saveVersionToDisk(version);
}

/**
 * Get full version info for all 10 versions
 */
export function getAllVersions(): Array<VersionInfo & { active: boolean; unlocked: boolean }> {
  return Object.values(VERSION_MAP).map((v) => ({
    ...v,
    active: v.version === _activeVersion,
    unlocked: v.version <= _activeVersion,
  }));
}

/**
 * Get features unlocked at current version
 */
export function getUnlockedFeatures(): string[] {
  const features: string[] = [];
  for (let v = 1; v <= _activeVersion; v++) {
    features.push(...(VERSION_MAP[v]?.features ?? []));
  }
  return [...new Set(features)];
}
