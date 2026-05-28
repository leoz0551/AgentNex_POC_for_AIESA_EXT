import { AIChat } from "./components/ai-chat"
import { KBEvolutionStudio } from "./components/kb-evol"

export function App() {
  if (window.location.pathname === '/kb-evol') {
    return <KBEvolutionStudio />
  }
  return <AIChat />
}