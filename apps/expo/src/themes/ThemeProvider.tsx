import { createContext, useContext, type ComponentType, type PropsWithChildren } from 'react'
import { ScopedTheme } from 'uniwind'
import themes, { baseTheme, themeNames, type Theme } from './index'

const ThemeContext = createContext<Theme>(baseTheme)

/** Keep reader fonts and non-CSS consumers on the same palette as Uniwind. */
export const ThemeProvider = ({
  theme,
  scope,
  children,
}: PropsWithChildren<{ theme: Theme; scope?: (typeof themeNames)[number] }>) => {
  // `scope` lets a screen bring its own colours on top of a built-in theme's class names.
  const name = scope ?? themeNames.find(name => themes[name].colors === theme.colors) ?? 'default'
  return (
    <ThemeContext.Provider value={theme}>
      <ScopedTheme theme={name}>{children}</ScopedTheme>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

export function withTheme<P extends { theme?: Theme }>(Component: ComponentType<P>) {
  return function ThemedComponent(props: Omit<P, 'theme'> & { theme?: Theme }) {
    const theme = useTheme()
    return <Component {...(props as P)} theme={props.theme ?? theme} />
  }
}

export type { Theme } from './index'
