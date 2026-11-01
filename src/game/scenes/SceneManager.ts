import type Phaser from 'phaser'

export interface EditorConfig {
  key: string
  hotkey: string
}

export const DEFAULT_EDITORS: EditorConfig[] = [
  { key: 'level-editor', hotkey: 'F2' },
  { key: 'speed-editor', hotkey: 'F3' },
  { key: 'behavior-tree-editor', hotkey: 'F4' },
]

export const DEFAULT_PLAYABLE_SCENE = 'game'

export interface SceneManagerOptions {
  game?: Phaser.Game
  editors?: EditorConfig[]
  defaultPlayableScene?: string
}

export class SceneManager {
  private static readonly instances = new WeakMap<Phaser.Game, SceneManager>()
  private static defaultInstance: SceneManager | undefined

  private readonly game?: Phaser.Game
  private readonly editors: EditorConfig[]
  private activePlayableSceneKey: string
  private currentSceneKey: string
  private keydownListener?: (event: KeyboardEvent) => void
  private isDestroyed = false

  constructor(gameOrOptions?: Phaser.Game | SceneManagerOptions) {
    let game: Phaser.Game | undefined
    let editors = DEFAULT_EDITORS
    let defaultPlayableScene = DEFAULT_PLAYABLE_SCENE

    if (
      gameOrOptions &&
      'scene' in gameOrOptions &&
      typeof (gameOrOptions as Phaser.Game).scene?.getScenes === 'function'
    ) {
      game = gameOrOptions as Phaser.Game
    } else if (gameOrOptions && typeof gameOrOptions === 'object') {
      const opts = gameOrOptions as SceneManagerOptions
      game = opts.game
      if (opts.editors) {
        editors = opts.editors
      }
      if (opts.defaultPlayableScene) {
        defaultPlayableScene = opts.defaultPlayableScene
      }
    }

    this.game = game
    this.editors = [...editors]
    this.activePlayableSceneKey = defaultPlayableScene
    this.currentSceneKey = defaultPlayableScene

    if (game) {
      SceneManager.instances.set(game, this)
      game.registry?.set('sceneManager', this)
      game.events?.once('destroy', () => {
        this.destroy()
      })
    }
    SceneManager.defaultInstance = this

    this.setupGlobalInput()
  }

  public static get(game?: Phaser.Game): SceneManager | undefined {
    if (game && SceneManager.instances.has(game)) {
      return SceneManager.instances.get(game)
    }
    return SceneManager.defaultInstance
  }

  public getEditors(): readonly EditorConfig[] {
    return this.editors
  }

  public isEditorScene(key: string): boolean {
    return this.editors.some((e) => e.key === key)
  }

  public isPlayableScene(key: string): boolean {
    return !this.isEditorScene(key)
  }

  public getEditorForHotkey(key: string): EditorConfig | undefined {
    const normalized = key.toUpperCase()
    return this.editors.find((e) => e.hotkey.toUpperCase() === normalized)
  }

  public getActivePlayableScene(): string {
    return this.activePlayableSceneKey
  }

  public setActivePlayableScene(key: string): void {
    this.activePlayableSceneKey = key
  }

  public getActiveScene(): Phaser.Scene | undefined {
    if (!this.game) return undefined
    const activeScenes = this.game.scene.getScenes(true)
    return activeScenes[0]
  }

  public getActiveSceneKey(): string {
    const active = this.getActiveScene()
    if (active?.scene?.key) {
      const key = active.scene.key
      this.currentSceneKey = key
      if (this.isPlayableScene(key)) {
        this.activePlayableSceneKey = key
      }
      return key
    }
    return this.currentSceneKey
  }

  public openEditor(editorKey: string): void {
    const activeScene = this.getActiveScene()
    if (activeScene) {
      if (this.isPlayableScene(activeScene.scene.key)) {
        this.activePlayableSceneKey = activeScene.scene.key
      }
      this.beforeLeave(activeScene)
      this.currentSceneKey = editorKey
      activeScene.scene.start(editorKey)
    } else if (this.game) {
      this.currentSceneKey = editorKey
      this.game.scene.start(editorKey)
    } else {
      this.currentSceneKey = editorKey
    }
  }

  public exitEditor(): void {
    const activeScene = this.getActiveScene()
    const targetKey = this.activePlayableSceneKey
    if (activeScene) {
      this.beforeLeave(activeScene)
      this.currentSceneKey = targetKey
      activeScene.scene.start(targetKey)
    } else if (this.game) {
      this.currentSceneKey = targetKey
      this.game.scene.start(targetKey)
    } else {
      this.currentSceneKey = targetKey
    }
  }

  public handleKeyDown = (event: KeyboardEvent): boolean => {
    const key = event.key.toUpperCase()
    const activeKey = this.getActiveSceneKey()

    // 1. Check if an editor's hotkey was pressed (e.g. F2, F3, F4)
    const editorConfig = this.getEditorForHotkey(key)
    if (editorConfig) {
      event.preventDefault()
      event.stopImmediatePropagation?.()

      if (activeKey === editorConfig.key) {
        // Pressing an editor's own hotkey exits to active playable scene
        this.exitEditor()
      } else {
        // Pressing another editor's hotkey opens that editor
        this.openEditor(editorConfig.key)
      }
      return true
    }

    // 2. Check if Escape was pressed
    if (key === 'ESCAPE') {
      if (this.isEditorScene(activeKey)) {
        // In an editor, Escape exits to active playable scene
        event.preventDefault()
        event.stopImmediatePropagation?.()
        this.exitEditor()
        return true
      }
      // In playable scene, allow scene to process Escape
      return false
    }

    return false
  }

  public destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true

    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener, { capture: true })
      this.keydownListener = undefined
    }

    if (this.game) {
      SceneManager.instances.delete(this.game)
      this.game.registry?.remove('sceneManager')
    }

    if (SceneManager.defaultInstance === this) {
      SceneManager.defaultInstance = undefined
    }
  }

  private setupGlobalInput(): void {
    if (typeof window === 'undefined') return

    this.keydownListener = (event: KeyboardEvent) => {
      this.handleKeyDown(event)
    }

    window.addEventListener('keydown', this.keydownListener, { capture: true })
  }

  private beforeLeave(scene?: Phaser.Scene): void {
    if (!scene) return
    if ('syncToRoom1Objects' in scene && typeof (scene as any).syncToRoom1Objects === 'function') {
      (scene as any).syncToRoom1Objects()
    }
  }
}
