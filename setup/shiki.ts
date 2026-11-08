import { defineShikiSetup } from '@slidev/types'

// Syntax colour for the deck's TypeScript/HTML snippets. GitHub's themes keep token colours
// readable on the white and dark slide backgrounds (Slidev's default Vitesse drops some under 4.5:1).
export default defineShikiSetup(() => ({
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
}))
