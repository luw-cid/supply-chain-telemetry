/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MAPTILER_API_KEY?: string
  /** MapTiler map id, e.g. darkmatter, streets-v2, outdoor-v2 */
  readonly VITE_MAPTILER_MAP_ID?: string
}
