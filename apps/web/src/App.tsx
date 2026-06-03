import { AIChat } from "./components/ai-chat"
import { KBEvolutionStudio } from "./components/kb-evol"
import { AITrainer } from "./components/ai-trainer"
import { VoiceTrainer } from "./components/voice-trainer"

export function App() {
  if (window.location.pathname === '/kb-evol') {
    return <KBEvolutionStudio />
  }
  if (window.location.pathname === '/ai-trainer') {
    return <AITrainer />
  }
  if (window.location.pathname === '/voice-trainer') {
    return <VoiceTrainer />
  }
  return <AIChat />
}