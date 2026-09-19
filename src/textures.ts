import Phaser from "phaser";

/**
 * Placeholder art: flat shapes generated at runtime, no image files.
 *
 * DESIGN.md 4.2 picks flat shapes over AI sprite sheets deliberately — style
 * consistency across 18 characters and 10 environments is the thing that fails
 * late and cannot be fixed. Everything here is addressed by key, so a commissioned
 * set drops in as an atlas swap without touching the scenes.
 */

export const TS = 32;

const C = {
  grass: 0x93a88f,
  grassDot: 0x8a9f86,
  path: 0xcbbea2,
  pathDot: 0xc2b496,
  bark: 0x6a5c4e,
  leafDark: 0x4f6b4c,
  leaf: 0x5e7c58,
  rock: 0x8b8f86,
  rockLit: 0x9da298,
  hide: 0x9c8c7a,
  hideDark: 0x7c6e5e,
  skin: 0xe8c9a0,
  ink: 0x16222e,
  slate: 0x4b5a63,
  persimmon: 0xc4512a,
  jade: 0x4a7c6f,
  gold: 0xb8891f,
  crate: 0xb08f5e,
  tiger: 0xc98a32,
  tigerDark: 0x7a4a16,
  cream: 0xf2e6ce,
  fruit: [0xc4512a, 0xb8891f, 0x7a9a3c, 0x9a4a6a, 0xd08a3a],
} as const;

function tex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function buildTextures(scene: Phaser.Scene): void {
  // --- terrain -------------------------------------------------------------
  tex(scene, "tree", TS, TS + 16, (g) => {
    g.fillStyle(C.bark).fillRect(13, 30, 6, 16);
    g.fillStyle(C.leafDark).fillCircle(16, 20, 15);
    g.fillStyle(C.leaf).fillCircle(12, 16, 10);
  });
  tex(scene, "bigtree", TS * 2, TS * 2 + 20, (g) => {
    g.fillStyle(C.bark).fillRect(27, 58, 10, 26);
    g.fillStyle(C.leafDark).fillCircle(32, 36, 31);
    g.fillStyle(C.leaf).fillCircle(24, 28, 20);
  });
  tex(scene, "fruittree", TS * 2, TS * 2 + 20, (g) => {
    g.fillStyle(C.bark).fillRect(27, 58, 10, 26);
    g.fillStyle(C.leafDark).fillCircle(32, 36, 30);
    g.fillStyle(C.leaf).fillCircle(25, 29, 18);
    const spots: [number, number][] = [
      [18, 26], [42, 24], [30, 18], [14, 42], [46, 44],
      [24, 48], [38, 46], [32, 36], [20, 34], [44, 34],
    ];
    spots.forEach(([x, y], i) => {
      g.fillStyle(C.fruit[i % C.fruit.length]).fillCircle(x, y, 5);
    });
  });
  tex(scene, "rock", TS, TS, (g) => {
    g.fillStyle(C.rock).fillCircle(16, 19, 12);
    g.fillStyle(C.rockLit).fillCircle(12, 15, 7);
  });
  tex(scene, "fence", TS, TS, (g) => {
    g.fillStyle(C.hideDark).fillRect(11, 0, 9, TS).fillRect(0, 7, TS, 5).fillRect(0, 20, TS, 5);
  });
  tex(scene, "crate", TS, TS, (g) => {
    g.fillStyle(C.crate).fillRect(3, 10, 26, 20);
    g.lineStyle(2, C.hideDark).strokeRect(3, 10, 26, 20);
    g.fillStyle(C.fruit[0]).fillCircle(10, 17, 4).fillCircle(20, 15, 4);
    g.fillStyle(C.fruit[2]).fillCircle(15, 24, 4);
  });

  // --- people --------------------------------------------------------------
  const person = (
    key: string,
    coat: number,
    hair: number,
    hat?: (g: Phaser.GameObjects.Graphics) => void
  ) =>
    tex(scene, key, 26, 44, (g) => {
      g.fillStyle(C.slate).fillRect(6, 30, 5, 13).fillRect(15, 30, 5, 13);
      g.fillStyle(coat).fillRoundedRect(3, 12, 20, 20, 7);
      g.fillStyle(C.skin).fillCircle(13, 11, 9);
      g.fillStyle(hair).fillRoundedRect(4, 1, 18, 8, 4);
      g.fillStyle(C.ink).fillCircle(10, 12, 1.6).fillCircle(16, 12, 1.6);
      if (hat) hat(g);
    });

  person("kid0", C.persimmon, C.ink);
  person("kid1", C.jade, 0x3a2e22);
  person("kid2", C.gold, C.ink);
  person("kid3", 0x5b6bb0, 0x4a2e1e);
  person("pal", C.jade, 0x3a2e22);
  person("keeper", C.gold, C.ink, (g) => {
    g.fillStyle(C.path).fillEllipse(13, 5, 26, 8);
  });

  // --- animals -------------------------------------------------------------
  tex(scene, "donkey", 44, 34, (g) => {
    g.fillStyle(C.hideDark).fillRect(4, 22, 5, 12).fillRect(24, 22, 5, 12);
    g.fillStyle(C.hide).fillRect(11, 23, 5, 11).fillRect(31, 23, 5, 11);
    g.fillStyle(C.hide).fillRoundedRect(2, 6, 32, 18, 8);
    g.fillStyle(C.hideDark).fillTriangle(30, 10, 40, 3, 38, 13);
    g.fillStyle(C.hide).fillCircle(38, 8, 7);
    g.fillStyle(C.hideDark).fillRoundedRect(34, -2, 3, 8, 1.5).fillRoundedRect(39, -2, 3, 8, 1.5);
    g.fillStyle(C.ink).fillCircle(40, 7, 1.5);
  });
  tex(scene, "tiger", 52, 40, (g) => {
    g.fillStyle(C.tiger).fillRoundedRect(2, 12, 34, 20, 9);
    g.fillStyle(C.tigerDark).fillRect(10, 12, 4, 20).fillRect(20, 12, 4, 20).fillRect(29, 12, 4, 20);
    g.fillStyle(C.tiger).fillCircle(41, 17, 11).fillCircle(35, 7, 4).fillCircle(46, 7, 4);
    g.fillStyle(C.cream).fillCircle(41, 21, 5);
    g.fillStyle(C.ink).fillCircle(38, 15, 1.8).fillCircle(45, 15, 1.8);
    g.fillStyle(C.tigerDark).fillRect(4, 28, 6, 3);
  });
  tex(scene, "squirrel", 30, 28, (g) => {
    g.fillStyle(C.hideDark).fillEllipse(7, 12, 11, 21);
    g.fillStyle(C.hide).fillCircle(16, 16, 8).fillCircle(23, 10, 6);
    g.fillStyle(C.hideDark).fillCircle(21, 4, 2.6).fillCircle(26, 5, 2.6);
    g.fillStyle(C.ink).fillCircle(25, 9, 1.3);
  });

  // --- ui ------------------------------------------------------------------
  tex(scene, "bang", 24, 28, (g) => {
    g.fillStyle(C.persimmon).fillRoundedRect(0, 0, 24, 21, 6).fillTriangle(7, 20, 15, 20, 9, 28);
    g.fillStyle(0xffffff).fillRect(10.5, 4, 3, 9).fillRect(10.5, 15, 3, 3);
  });
  tex(scene, "shadow", 30, 12, (g) => {
    g.fillStyle(0x000000, 0.16).fillEllipse(15, 6, 30, 12);
  });
}

/** One baked image for the whole ground layer: 1 draw call instead of w*h sprites. */
export function bakeGround(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  isPath: (x: number, y: number) => boolean
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const p = isPath(x, y);
      g.fillStyle(p ? C.path : C.grass).fillRect(x * TS, y * TS, TS, TS);
      g.fillStyle(p ? C.pathDot : C.grassDot);
      g.fillRect(x * TS + 6, y * TS + 9, 5, 3).fillRect(x * TS + 20, y * TS + 20, 5, 3);
    }
  }
  g.generateTexture(key, w * TS, h * TS);
  g.destroy();
}

export const GRASS_HEX = "#93a88f";
