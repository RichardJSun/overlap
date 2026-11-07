// Stub with the final API. The audio track replaces the bodies with procedural WebAudio.
export const sfx = {
  /** Call from the first user gesture (required on iOS). Safe to call repeatedly. */
  unlock(): void {},
  step(): void {},
  ping(): void {},
  lightOn(): void {},
  lightOff(): void {},
  /** Guide tried to exceed the power budget. */
  denied(): void {},
  substation(): void {},
  exitOpen(): void {},
  respawn(): void {},
  /** Loudness of the nearest visible drone, 0 (silent) to 1 (adjacent). Called every frame. */
  drone(_level: number): void {},
  /** Start or update the ambient pad. `brightness` is 0..1 and rises with each substation. */
  ambient(_brightness: number): void {},
  ending(): void {},
  muted: false,
  setMuted(m: boolean): void { sfx.muted = m; },
};
