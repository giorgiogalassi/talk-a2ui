import { defineMermaidSetup } from '@slidev/types'

// Mermaid in the typography-as-architecture palette (styles/type.css, light values).
export default defineMermaidSetup(() => ({
  theme: 'base',
  themeVariables: {
    fontFamily: 'Roboto, system-ui, sans-serif',
    primaryColor: '#ffffff',
    primaryTextColor: '#1f1f24',
    primaryBorderColor: '#ad5230',
    lineColor: '#6b6b72',
    secondaryColor: '#ffffff',
    tertiaryColor: '#f6f6f7',
    clusterBkg: '#f6f6f7',
    clusterBorder: '#e2e2e6',
    edgeLabelBackground: '#ffffff',
  },
}))
