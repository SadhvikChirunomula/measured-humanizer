/**
 * Profile Registry
 * Resolves domain calibration profiles (engineering, executive, marketing, academic)
 * or loads custom external threshold JSON configurations.
 */

const fs = require("fs");
const path = require("path");

const PROFILES_DIR = path.join(__dirname, "..", "profiles");

const BUILTIN_PROFILES = ["engineering", "executive", "marketing", "academic"];

function listProfiles() {
  return BUILTIN_PROFILES;
}

function resolveProfile(profileNameOrPath) {
  if (!profileNameOrPath) {
    profileNameOrPath = "engineering";
  }

  // 1. Direct file path check
  if (fs.existsSync(profileNameOrPath)) {
    return JSON.parse(fs.readFileSync(profileNameOrPath, "utf8"));
  }

  // 2. Builtin profile check
  const profileFileName = profileNameOrPath.endsWith(".json")
    ? profileNameOrPath
    : `${profileNameOrPath.toLowerCase()}.json`;

  const builtInPath = path.join(PROFILES_DIR, profileFileName);
  if (fs.existsSync(builtInPath)) {
    return JSON.parse(fs.readFileSync(builtInPath, "utf8"));
  }

  throw new Error(
    `Unknown profile '${profileNameOrPath}'. Available built-in profiles: ${BUILTIN_PROFILES.join(", ")}`
  );
}

module.exports = {
  resolveProfile,
  listProfiles,
  BUILTIN_PROFILES,
};
