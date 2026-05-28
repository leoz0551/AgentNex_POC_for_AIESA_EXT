import { AIChat } from "./components/ai-chat"
import { KBEvolutionStudio } from "./components/kb-evol"
import { AITrainer } from "./components/ai-trainer"

export function App() {
  if (window.location.pathname === '/kb-evol') {
    return <KBEvolutionStudio />
  }
  if (window.location.pathname === '/ai-trainer') {
    return <AITrainer />
  }
  return <AIChat />
}