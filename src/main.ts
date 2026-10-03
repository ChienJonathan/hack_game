import './style.css'
import pressStart2PFontUrl from './assets/game/fonts/PressStart2P-Regular.ttf'
import { createGame } from './game/createGame.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app game mount element.')
}

async function startGame(parent: HTMLDivElement): Promise<void> {
  try {
    const pressStart2PFont = new FontFace('Press Start 2P', `url("${pressStart2PFontUrl}")`)
    document.fonts.add(await pressStart2PFont.load())
  } catch (error) {
    console.error('Could not load the Press Start 2P font.', error)
  }

  createGame(parent)
}

void startGame(app)
