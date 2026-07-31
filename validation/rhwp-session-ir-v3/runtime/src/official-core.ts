import { assertCoreVersion } from "./contract.js";
import { CoreCompatibilityError } from "./errors.js";
import type { RhwpCoreModule, RhwpCoreProvider } from "./types.js";

export interface OfficialCoreProviderOptions { version?: string; }

export function providerFromCoreModule(
  module: RhwpCoreModule,
  options: OfficialCoreProviderOptions = {},
): RhwpCoreProvider {
  if (!module || typeof module !== "object") throw new CoreCompatibilityError("@rhwp/core module is not an object");
  if (typeof module.HwpDocument !== "function") throw new CoreCompatibilityError("@rhwp/core does not export HwpDocument");
  if (typeof module.HwpDocument.createEmpty !== "function") throw new CoreCompatibilityError("HwpDocument.createEmpty is unavailable");
  let version = options.version;
  if (version === undefined) {
    if (typeof module.version !== "function") {
      throw new CoreCompatibilityError("@rhwp/core does not export version(); pass an explicit verified version");
    }
    version = module.version();
  }
  assertCoreVersion(version);
  return {
    version,
    open(bytes: Uint8Array) { return new module.HwpDocument(new Uint8Array(bytes)); },
    createEmpty() { return module.HwpDocument.createEmpty(); },
  };
}
