export const parseLocalSkillsDirsInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
