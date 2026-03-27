import { invoke } from "@tauri-apps/api/core";

export type MarketSkillSort = "updated" | "downloads" | "stars" | "trending";

export interface InstalledSkillRecord {
  id: string;
  name: string;
  category: string;
  summary: string;
  author: string;
  version: string;
  manifestPath: string;
  directory: string;
}

export interface RecognizedSkillRecord {
  name: string;
  description: string;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
}

export interface MarketSkillSummary {
  id: string;
  name: string;
  summary: string;
  version: string;
  updatedAt?: number | null;
  installs?: number | null;
  downloads?: number | null;
  stars?: number | null;
  platformTargets: string[];
  systemTargets: string[];
  sourceUrl: string;
}

export interface MarketSkillDetail extends MarketSkillSummary {
  author: string;
  changelog: string;
}

export interface InstallableSkill {
  id: string;
  name: string;
  summary: string;
  category?: string;
  author?: string;
  version?: string;
  sourceUrl?: string;
}

export function listInstalledSkills() {
  return invoke<InstalledSkillRecord[]>("list_installed_skills");
}

export function listRecognizedSkills() {
  return invoke<RecognizedSkillRecord[]>("list_recognized_skills");
}

export function listMarketSkills(query?: string, limit = 24, sort: MarketSkillSort = "updated") {
  return invoke<MarketSkillSummary[]>("list_market_skills", {
    query,
    limit,
    sort,
  });
}

export function getMarketSkillDetail(skillId: string) {
  return invoke<MarketSkillDetail>("get_market_skill_detail", {
    skillId,
  });
}

export function installSkill(skill: InstallableSkill) {
  return invoke<InstalledSkillRecord>("install_skill", {
    payload: {
      id: skill.id,
      name: skill.name,
      summary: skill.summary,
      category: skill.category ?? "ClawHub",
      author: skill.author ?? "ClawHub",
      version: skill.version,
      sourceUrl: skill.sourceUrl,
    },
  });
}

export function removeSkill(skillId: string) {
  return invoke<boolean>("remove_skill", {
    skillId,
  });
}
