import { defineMermaidSetup } from '@slidev/types'

// Mermaid in the typography-as-architecture palette (styles/type.css, light values: Cream & Ink).
export default defineMermaidSetup(() => ({
  theme: 'base',
  themeVariables: {
    fontFamily: 'Google Sans, Roboto, system-ui, sans-serif',
    primaryColor: '#fbf8f1',
    primaryTextColor: '#111111',
    primaryBorderColor: '#a83e16',
    lineColor: '#5c5648',
    secondaryColor: '#fbf8f1',
    tertiaryColor: '#ede6d8',
    clusterBkg: '#ede6d8',
    clusterBorder: '#dcd4c4',
    edgeLabelBackground: '#fbf8f1',
  },
}))
