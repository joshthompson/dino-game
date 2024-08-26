import { createSignal, type Component, Show, Index } from 'solid-js';

import styles from './App.module.css';
import { Grid, Maze, Mode, Tile } from './models';

const App: Component = () => {

  const textModeTime = 1500;
  const autoMoveDelay = 500;
  const blockConcentration = 0.5;
  const width = 50;
  const height = 40;

  function rand(start: number, end: number) {
    return start + Math.floor(Math.random() * (end - start));
  }

  const [nextMoveTimeout, setNextMoveTimeout] = createSignal<number>(-1);
  const [mode, setMode] = createSignal<Mode>({ type: 'text', text: 'Loading' });
  const [grid, setGrid] = createSignal<Grid>([]);
  const [level, setLevel] = createSignal<number>(1);
  const [score, setScore] = createSignal<number>(0);
  const [highscore, setHighscore] = createSignal<number>(+(window.localStorage.getItem('highscore') ?? 0));

  const cells = () => grid().flat();
  const dinosaurPosition = (): [number, number] => {
    const row = grid().findIndex(row => row.find(cell => cell === Tile.Dinosaur));
    const col = grid()[row].findIndex(cell => cell === Tile.Dinosaur);
    return [row, col];
  }
  const enemyPositions = (): [number, number, Tile][] => {
    const enemies: [number, number, Tile][] = [];
    grid().forEach((row, y) =>
      row.forEach((cell, x) => {
        if ([Tile.Man, Tile.BlockOnMan].includes(cell)) enemies.push([y, x, cell]);
      }),
    );
    return enemies;
  }

  window.addEventListener('keydown', event => {
    if (mode().type !== 'level') return;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') move(0, -1);
    if (event.code === 'KeyD' || event.code === 'ArrowRight') move(0, 1);
    if (event.code === 'KeyW' || event.code === 'ArrowUp') move(-1, 0);
    if (event.code === 'KeyS' || event.code === 'ArrowDown') move(1, 0);
  });

  function scheduleMove() {
    window.clearTimeout(nextMoveTimeout());
    setNextMoveTimeout(window.setTimeout(() => move(0, 0), autoMoveDelay));
  }

  function startLevel(levelNumber: number): void {
    setLevel(levelNumber);
    setupGrid();
    setMode({ type: 'text', text: `Level ${level()}` });
    setTimeout(() => setMode({ type: 'level' }), textModeTime);
  }

  function setupGrid(): void {
    let grid = createGrid();
    grid = placeDino(grid);
    grid = createLakes(grid);
    for (let i = 0; i < 2 ** (level() - 1); i++) grid = placeEnemy(grid);
    setGrid(grid);
    scheduleMove();
  }

  function placeDino(grid: Grid, height = 4, width = 4): Grid {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === height - 1 || x === width - 1) grid[y][x] = Tile.Block;
        else if (y === Math.floor(height / 2) - 1 && x === Math.floor(width / 2) - 1)
          grid[y][x] = Tile.Dinosaur;
        else grid[y][x] = Tile.Blank;
      }
    }
    return grid;
  }

  function createLakes(grid: Grid): Grid {
    const lakes = rand(1, 7);
    for (let n = 0; n < lakes; n++) {
      const [cy, cx] = [rand(6, width - 2), rand(6, height - 2)];
      const size = rand(2, 7);
      for (let y = cy - size; y < cy + size; y++) {
        for (let x = cx - size; x < cx + size; x++) {
          const dist = Math.sqrt((cy - y - Math.random()) ** 2 + (cx - x - Math.random()) ** 2);
          if (dist <= size && grid[y]?.[x] !== undefined) grid[y][x] = Tile.Water;
        }
      }
    }
    return grid;
  }

  function placeEnemy(grid: Grid): Grid {
    while (true) {
      const [ey, ex] = [rand(6, height), rand(6, width)];
      if (grid[ey]?.[ex] === Tile.Blank && areaSize(grid, ey, ex) > 10) {
        grid[ey][ex] = Tile.Man;
        return grid;
      }
    }
  }

  function areaSize(grid: Grid, y: number, x: number): number {
    const tile = grid[y][x];
    const visited: boolean[][] = Array.from({ length: height }, () =>
      Array(width).fill(false),
    );
    const dfs = (row: number, col: number): number => {
      if (row < 0 || row >= height || col < 0 || col >= width) return 0;
      if (grid[row][col] !== tile || visited[row][col]) return 0;
      visited[row][col] = true;
      let areaSize = 1;
      areaSize += dfs(row + 1, col) + dfs(row - 1, col) + dfs(row, col + 1) + dfs(row, col - 1);
      return areaSize;
    };
    return dfs(y, x);
  }

  function createGrid(): Grid {
    const grid: Grid = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        if (Math.random() < blockConcentration) grid[y][x] = Tile.Block;
        else grid[y][x] = Tile.Blank;
      }
    }
    return grid;
  }

  function move(y: number, x: number): void {
    moveDinosaur(y, x);
    moveEnemies();
    checkKills();
    checkWin();
    scheduleMove();
  }

  function moveDinosaur(y: number, x: number): boolean {
    const [dy, dx] = dinosaurPosition();
    const nx = dx + x;
    const ny = dy + y;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
    const to = grid()[ny][nx];
    if (to === Tile.Blank) {
      updateGrid(dy, dx, Tile.Blank);
      updateGrid(ny, nx, Tile.Dinosaur);
      return true;
    }
    if (to === Tile.Block) {
      if (pushBlock(ny, nx, y, x)) {
        updateGrid(dy, dx, Tile.Blank);
        updateGrid(ny, nx, Tile.Dinosaur);
        return true;
      }
    }
    if (to === Tile.Man) {
      updateGrid(dy, dx, Tile.Blank);
      gameOver();
      return false;
    }
    return true;
  }

  function pushBlock(by: number, bx: number, y: number, x: number): boolean {
    const nx = bx + x;
    const ny = by + y;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
    const to = grid()[ny][nx];
    if (to === Tile.Blank) {
      updateGrid(by, bx, Tile.Blank);
      updateGrid(ny, nx, Tile.Block);
      return true;
    }
    if (to === Tile.Block) {
      if (pushBlock(ny, nx, y, x)) {
        updateGrid(by, bx, Tile.Blank);
        updateGrid(ny, nx, Tile.Block);
        return true;
      }
      return false;
    }
    if (to === Tile.Man) {
      updateGrid(by, bx, Tile.Blank);
      updateGrid(ny, nx, Tile.BlockOnMan);
      return true;
    }
    return false;
  }

  function updateGrid(y: number, x: number, tile: Tile): void {
    setGrid(grid => {
      const newGrid = structuredClone(grid);
      newGrid[y][x] = tile;
      return newGrid;
    });
  }

  function moveEnemies(): void {
    enemyPositions().forEach(([ey, ex, tile]) => moveEnemy(ey, ex, tile));
  }

  function moveEnemy(ey: number, ex: number, tile: Tile): void {
    const fromTile = tile === Tile.BlockOnMan ? Tile.Block : Tile.Blank;
    const [dy, dx] = dinosaurPosition();
    let [ny, nx] = findPath(ey, ex, dy, dx);
    if (ny === undefined) {
      const options: [number, number][] = [];
      if (grid()[ey - 1]?.[ex] === Tile.Blank) options.push([ey - 1, ex]);
      if (grid()[ey + 1]?.[ex] === Tile.Blank) options.push([ey + 1, ex]);
      if (grid()[ey]?.[ex - 1] === Tile.Blank) options.push([ey, ex - 1]);
      if (grid()[ey]?.[ex + 1] === Tile.Blank) options.push([ey, ex + 1]);
      [ny, nx] = options[Math.floor(Math.random() * options.length)] ?? [undefined, undefined];
    }
    if (ny !== undefined && nx !== undefined) {
      const nextBlank = grid()[ny]?.[nx] === Tile.Blank;
      const nextDinosaur = tile === Tile.Man ? grid()[ny]?.[nx] === Tile.Dinosaur : false;
      if (nextBlank || nextDinosaur) {
        updateGrid(ey, ex, fromTile);
        updateGrid(ny, nx, Tile.Man);
        if (nextDinosaur) gameOver();
      }
    }
  }

  function findPath(y1: number, x1: number, y2: number, x2: number): [number, number] | [undefined, undefined] {
    const maze: Maze = grid().map(rows =>
      rows.map(cell => ([Tile.Block, Tile.Water].includes(cell) ? '#' : Infinity)),
    );
    maze[y2][x2] = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let lx: number | undefined = undefined;
      let ly: number | undefined = undefined;
      let lowest = Infinity;
      maze.forEach((row, y) =>
        row.forEach((cell, x) => {
          if (cell !== '#' && hasEmptyNeighbour(maze, y, x) && cell < lowest) {
            ly = y;
            lx = x;
            lowest = cell;
          }
        }),
      );
      if (lowest === Infinity) return [undefined, undefined];
      if (ly !== undefined && lx !== undefined) {
        if (
          (ly - 1 === y1 && lx === x1) ||
          (ly + 1 === y1 && lx === x1) ||
          (ly === y1 && lx - 1 === x1) ||
          (ly === y1 && lx + 1 === x1)
        ) {
          return [ly, lx];
        }
        if (maze[ly - 1]?.[lx] === Infinity) maze[ly - 1][lx] = lowest + 1;
        if (maze[ly + 1]?.[lx] === Infinity) maze[ly + 1][lx] = lowest + 1;
        if (maze[ly]?.[lx - 1] === Infinity) maze[ly][lx - 1] = lowest + 1;
        if (maze[ly]?.[lx + 1] === Infinity) maze[ly][lx + 1] = lowest + 1;
      }
    }
  }

  function hasEmptyNeighbour(maze: Maze, y: number, x: number): boolean {
    if (maze[y - 1]?.[x] === Infinity) return true;
    if (maze[y + 1]?.[x] === Infinity) return true;
    if (maze[y]?.[x - 1] === Infinity) return true;
    if (maze[y]?.[x + 1] === Infinity) return true;
    return false;
  }

  function checkKills(): void {
    enemyPositions().forEach(([y, x, tile]) => {
      if (tile === Tile.BlockOnMan) {
        updateGrid(y, x, Tile.Block);
        setScore(n => n + 10);
        setHighscore(current => Math.max(score(), current));
        window.localStorage.setItem('highscore', highscore().toString());
      }
    });
  }

  function checkWin(): void {
    if (enemyPositions().length === 0) {
      startLevel(level() + 1);
    }
  }

  function gameOver(): void {
    setMode({ type: 'text', text: 'Game Over', subtype: 'game-over' });
    setTimeout(() => {
      setScore(0);
      startLevel(1);
    }, textModeTime);
  }


  startLevel(1);

  return (
    <div style={{ '--width': `${width}`, '--height': `${height}`, '--level': `${level()}` }} class='game-box'>
      <h1>Dino Game</h1>
      <header>Level: {level()} • Score: {score()} • Highscore: {highscore()}</header>
      <main>
        <Show when={mode().type === 'text'}>
          <div class="splash-text" data-subtype={mode().subtype}>
            {mode().text}
          </div>
        </Show>
        <Show when={mode().type === 'level'}>
          <div class="game-grid">
            <Index each={cells()}>
              {cell => <div data-cell={cell()}>{cell()}</div>}
            </Index>
          </div>
        </Show>
      </main>
      <footer>Move 🦖 with arrow keys and push 📦 on 👨</footer>
    </div>
  );
};

export default App;
