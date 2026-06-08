/**
 * Factory for test data with partial overrides.
 *
 * @example
 * const createReading = createFixture({ deviceId: "hochbeet-001", soilMoisture: 42 });
 * const dry = createReading({ soilMoisture: 5 });
 */
export function createFixture<T extends object>(base: T): (overrides?: Partial<T>) => T {
  return (overrides: Partial<T> = {}) => ({ ...base, ...overrides });
}
