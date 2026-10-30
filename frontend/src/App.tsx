import { AnalysisProvider } from "./context/AnalysisContext";
import { AccessibilityProvider } from "./context/AccessibilityContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AppShell } from "./components/layout/AppShell";
export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AccessibilityProvider>
          <AnalysisProvider>
            <AppShell />
          </AnalysisProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
export default App;
