import { useEffect, useRef } from 'preact/hooks';
import { useGameStore, engine } from './store';
import { ArenaRenderer } from '../renderer/arena';
import { StarterSelection } from './StarterSelection';
import { TeamBar } from './TeamBar';
import { HUD } from './HUD';
import { UpgradePanel } from './UpgradePanel';
import { GameOverScreen } from './GameOverScreen';
import { BALANCE } from '../config/balance.config';

export function App() {
  const phase = useGameStore(s => s.phase);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const dispatch = useGameStore(s => s.dispatch);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new ArenaRenderer(canvasRef.current, engine);
    rendererRef.current = renderer;
    renderer.startRenderLoop();

    // Start the engine
    engine.start();

    // Keyboard shortcuts
    const handleKey = (e: KeyboardEvent) => {
      // Hot-swap 1-6
      if (e.key >= '1' && e.key <= '6') {
        dispatch({ type: 'HOT_SWAP', index: parseInt(e.key) - 1 });
      }
      // Ultimate
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'USE_ULTIMATE' });
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      renderer.stopRenderLoop();
      engine.stop();
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Canvas click handler
  const handleCanvasClick = (e: MouseEvent) => {
    if (!rendererRef.current) return;
    const coords = rendererRef.current.canvasToLogical(e.clientX, e.clientY);
    dispatch({ type: 'CLICK_DAMAGE', x: coords.x, y: coords.y });
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-950">
      {/* Starter selection modal */}
      {phase === 'STARTER_SELECT' && <StarterSelection />}

      {/* Game over modal */}
      {phase === 'GAME_OVER' && <GameOverScreen />}

      {/* Arena (left side) */}
      <div className="flex items-center justify-center flex-1 p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={BALANCE.ARENA_SIZE}
            height={BALANCE.ARENA_SIZE}
            onClick={(e) => handleCanvasClick(e as any)}
            className="border-2 border-gray-700 rounded shadow-lg shadow-blue-900/20"
            style={{
              width: '432px',  // 3x scale
              height: '432px',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>

      {/* Side panel (right) */}
      <div className="w-72 bg-gray-900 border-l border-gray-800 p-3 flex flex-col gap-3 overflow-y-auto">
        <HUD />
        <div className="h-px bg-gray-800" />
        <TeamBar />
        <div className="h-px bg-gray-800" />
        <UpgradePanel />
      </div>
    </div>
  );
}
