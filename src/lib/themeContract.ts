import { STUDIO_LIGHT, STUDIO_DARK } from './themes/studio'
import { WORKSHOP_LIGHT, WORKSHOP_DARK } from './themes/workshop'

export {
  THEME_TOKEN_CSS_PROPERTIES,
  THEME_TOKEN_NAMES,
  freezeThemeDefinition,
  validateThemeDefinition,
} from '@openforge-app/plugin-sdk'
export type {
  ThemeAppearance,
  ThemeDefinition,
  ThemeTokenName,
  ThemeTokens,
  ThemeValidationResult,
} from '@openforge-app/plugin-sdk'

// Keep persisted identities stable while replacing the built-in visual design.
export const LIGHT_THEME = STUDIO_LIGHT
export const DARK_THEME = STUDIO_DARK
export const BUILTIN_LIGHT_THEME_ID = LIGHT_THEME.id
export const BUILTIN_DARK_THEME_ID = DARK_THEME.id

export const BUILTIN_THEMES = Object.freeze([
  LIGHT_THEME, DARK_THEME, WORKSHOP_LIGHT, WORKSHOP_DARK,
])
