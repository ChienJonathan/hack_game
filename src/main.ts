import './style.css'
import { createGame } from './game/createGame.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app game mount element.')
}

createGame(app)
