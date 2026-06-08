import { afterAll, beforeAll } from "vitest";

/**
 * Set `process.env` values for the duration of a `describe` block. Original
 * values are restored in `afterAll`. Pass `null` to remove a key.
 */
export function withEnvVars(vars: Record<string, string | null>): void {
  const originals = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const [key, value] of Object.entries(vars)) {
      originals.set(key, process.env[key]);
      if (value === null) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  });

  afterAll(() => {
    for (const [key, original] of originals) {
      if (original === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = original;
      }
    }
    originals.clear();
  });
}
