export enum Tile {
	Dinosaur = '🦖',
	Blank = ' ',
	Block = '📦',
	BlockOnMan = '📦👨',
	Man = '👨',
	Water = '💧',
}

export type Maze = (number | '#')[][];
export type Grid = Tile[][];

export interface Mode {
  type: 'text' | 'level';
  text?: string;
  subtype?: string;
}
