import { invoke } from "@tauri-apps/api/core";

export interface InstalledSkillRecord {
  id: string;
  name: string;
  category: string;
  summary: string;
  author: string;
  version: string;
  manifestPath: string;
  directory: string;
  sourceLabel: string;
  sourceType: "bundled" | "local";
  removable: boolean;
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

export function listInstalledSkills() {
  return invoke<InstalledSkillRecord[]>("list_installed_skills");
}

export function listRecognizedSkills() {
  return invoke<RecognizedSkillRecord[]>("list_recognized_skills");
}

export function installSkillFromDirectory(directory: string) {
  return invoke<InstalledSkillRecord>("install_skill_from_directory", {
    payload: {
      directory,
    },
  });
}

export function installSkillFromUrl(url: string) {
  return invoke<InstalledSkillRecord>("install_skill_from_url", {
    payload: {
      url,
    },
  });
}

export function removeSkill(skillId: string) {
  return invoke<boolean>("remove_skill", {
    skillId,
  });
}
