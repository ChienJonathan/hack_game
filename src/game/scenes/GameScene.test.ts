import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockScene {
    scene: { key: string }
    constructor(config?: { key: string }) {
      this.scene = { key: config?.key ?? 'mock-scene' }
    }
  }

  return {
    default: {
      Scene: MockScene,
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
        },
      },
      Core: {
        Events: {
          BLUR: 'blur',
        },
      },
    },
  }
})

import { GameScene } from './GameScene.ts'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'

describe('GameScene key handling', () => {
  const memoryStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  } as unknown as Storage

  function setupScene() {
    const scene = new GameScene()
    const session = createRoom1Session({ movementBindings: INPUT_BINDINGS.movement, storage: memoryStorage })
    const mockCommandInputView = {
      setInputEnabled: vi.fn(),
      clearInput: vi.fn(),
    }

    // Assign private session and commandInputView for targeted handler testing
    const mockCommandEditor = {
      isOpen: vi.fn(() => false),
      isModalPromptOpen: vi.fn(() => false),
      open: vi.fn(),
      close: vi.fn(),
      toggle: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    }

    Object.assign(scene, {
      session,
      commandInputView: mockCommandInputView,
      commandEditor: mockCommandEditor,
    })

    const handleKeyDown = (scene as unknown as { handleKeyDown: (event: KeyboardEvent) => boolean }).handleKeyDown

    return { scene, session, mockCommandInputView, mockCommandEditor, handleKeyDown }
  }

  it('enters command mode when Enter is pressed in movement mode', () => {
    const { session, mockCommandInputView, handleKeyDown } = setupScene()
    expect(session.inputMode).toBe('movement')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Enter',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(session.inputMode).toBe('command')
    expect(mockCommandInputView.setInputEnabled).toHaveBeenCalledWith(true)
    // Key gate returns false so command input view does not submit immediately on the opening Enter
    expect(result).toBe(false)
  })

  it('does not re-enter or trigger command mode when Enter is repeated in movement mode', () => {
    const { session, mockCommandInputView, handleKeyDown } = setupScene()
    const spy = vi.spyOn(session, 'enterCommandMode')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Enter',
      repeat: true,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    expect(mockCommandInputView.setInputEnabled).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('allows Enter to pass through to command input when already in command mode', () => {
    const { session, handleKeyDown } = setupScene()
    session.enterCommandMode()
    expect(session.inputMode).toBe('command')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Enter',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    // In command mode, typeable is returned so PhaserCommandInputView can handle the submission
    expect(result).toBe(true)
  })

  it('exits command mode when Escape is pressed in command mode', () => {
    const { session, mockCommandInputView, handleKeyDown } = setupScene()
    session.enterCommandMode()

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Escape',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(session.inputMode).toBe('movement')
    expect(mockCommandInputView.clearInput).toHaveBeenCalled()
    expect(mockCommandInputView.setInputEnabled).toHaveBeenCalledWith(false)
    expect(result).toBe(false)
  })

  describe('command editor overlay integration (F1)', () => {
    it('toggles command editor when F1 is pressed', () => {
      const { scene, mockCommandEditor, handleKeyDown } = setupScene()
      const toggleSpy = vi.spyOn(scene, 'toggleCommandEditor')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'F1',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(toggleSpy).toHaveBeenCalled()
      expect(mockCommandEditor.toggle).toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('closes command editor when Escape is pressed while command editor is open', () => {
      const { scene, mockCommandEditor, handleKeyDown, mockCommandInputView } = setupScene()
      mockCommandEditor.isOpen.mockReturnValue(true)
      const closeSpy = vi.spyOn(scene, 'closeCommandEditor')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'Escape',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(closeSpy).toHaveBeenCalled()
      expect(mockCommandEditor.close).toHaveBeenCalled()
      // Does not pass to command input view clearInput
      expect(mockCommandInputView.clearInput).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('initializes with openCommandEditor flag from init data', () => {
      const scene = new GameScene()
      scene.init({ openCommandEditor: true })
      expect((scene as any).initialOpenCommandEditor).toBe(true)
    })
  })
})
