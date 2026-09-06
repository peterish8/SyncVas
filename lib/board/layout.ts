/**
 * @phase 12
 * Deterministic board layout — AIB-04.
 *
 * The model returns content and a count of writing zones. It never returns
 * coordinates: language models are weak at spatial arithmetic and quietly fill
 * the space that was supposed to stay empty. All geometry happens here.
 *
 * Pure and total: same input, same output, so regenerating a draft does not
 * make the board jump.
 */

export type Size = { width: number; height: number };

export type Rect = { x: number; y: number; width: number; height: number };

/** A compiled block reduced to the only thing layout cares about: its extent. */
export type LayoutBlock = { id: string; width: number; height: number };

export type PlacedBlock = LayoutBlock & { x: number; y: number };

export type BoardLayout = {
  placed: PlacedBlock[];
  /** Rectangles deliberately left empty for the teacher to write in. */
  zones: Rect[];
  canvas: Size;
};

export const LAYOUT = {
  padding: 48,
  gutter: 32,
  /** Height of one reserved writing band. */
  zoneHeight: 220,
  minBlock: 24,
} as const;

export const DEFAULT_CANVAS: Size = { width: 1600, height: 900 };

/** Two rectangles overlap only when they overlap on both axes. */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

type Shelf = { blocks: LayoutBlock[]; width: number; height: number };

/**
 * Shelf-packs largest-first. The sort is total — area, then height, then id —
 * so two runs over equal input cannot disagree.
 */
function shelve(blocks: LayoutBlock[], contentWidth: number): Shelf[] {
  const ordered = [...blocks].sort((a, b) => {
    const areaDelta = b.width * b.height - a.width * a.height;
    if (areaDelta !== 0) return areaDelta;
    const heightDelta = b.height - a.height;
    if (heightDelta !== 0) return heightDelta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const shelves: Shelf[] = [];
  for (const block of ordered) {
    const width = Math.max(LAYOUT.minBlock, block.width);
    const height = Math.max(LAYOUT.minBlock, block.height);
    const sized = { ...block, width, height };

    const shelf = shelves[shelves.length - 1];
    const fits = shelf && shelf.width + LAYOUT.gutter + width <= contentWidth;
    if (fits) {
      shelf.blocks.push(sized);
      shelf.width += LAYOUT.gutter + width;
      shelf.height = Math.max(shelf.height, height);
    } else {
      shelves.push({ blocks: [sized], width, height });
    }
  }
  return shelves;
}

/**
 * Places blocks and reserves `zones` full-width writing bands between them.
 *
 * Content rows and writing bands occupy disjoint horizontal strips, so no
 * placed block can intersect a zone. The canvas grows downward rather than
 * letting content spill into reserved space.
 */
export function layoutBoard(blocks: LayoutBlock[], zones: number, canvas: Size = DEFAULT_CANVAS): BoardLayout {
  const zoneCount = Number.isFinite(zones) ? Math.max(0, Math.floor(zones)) : 0;
  const contentWidth = Math.max(LAYOUT.minBlock, canvas.width - LAYOUT.padding * 2);
  const shelves = shelve(blocks.filter((block) => block.width > 0 && block.height > 0), contentWidth);

  const placed: PlacedBlock[] = [];
  const reserved: Rect[] = [];
  let cursorY = LAYOUT.padding;

  // Spread the bands through the lesson instead of dumping them all at the end.
  const interval = shelves.length === 0 ? 0 : Math.max(1, Math.ceil(shelves.length / (zoneCount + 1)));

  const reserveZone = () => {
    reserved.push({
      x: LAYOUT.padding,
      y: cursorY,
      width: contentWidth,
      height: LAYOUT.zoneHeight,
    });
    cursorY += LAYOUT.zoneHeight + LAYOUT.gutter;
  };

  shelves.forEach((shelf, index) => {
    let cursorX = LAYOUT.padding;
    for (const block of shelf.blocks) {
      placed.push({ ...block, x: cursorX, y: cursorY });
      cursorX += block.width + LAYOUT.gutter;
    }
    cursorY += shelf.height + LAYOUT.gutter;

    const rowsDone = index + 1;
    if (interval > 0 && rowsDone % interval === 0 && reserved.length < zoneCount && rowsDone < shelves.length) {
      reserveZone();
    }
  });

  // Any bands the interleave did not place go below the content.
  while (reserved.length < zoneCount) reserveZone();

  const contentBottom = Math.max(
    cursorY - LAYOUT.gutter + LAYOUT.padding,
    LAYOUT.padding * 2,
  );

  return {
    placed,
    zones: reserved,
    canvas: { width: canvas.width, height: Math.max(canvas.height, contentBottom) },
  };
}

/** Bounding box of a set of positioned, sized shapes. */
export function boundingBox(items: Array<Partial<Rect>>): Rect {
  const boxes = items.filter(
    (item): item is Rect =>
      typeof item.x === "number" &&
      typeof item.y === "number" &&
      typeof item.width === "number" &&
      typeof item.height === "number",
  );
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
