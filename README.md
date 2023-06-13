# @nelipuu/tessellate

This is a TypeScript library for splitting arbitrary 2D complex polygons with floating point coordinates into simple [monotone polygons](https://en.wikipedia.org/wiki/Monotone_polygon).

It should be able to handle *any* finite normal floating point coordinates and give a correct result, with the caveat that new points produced by self-intersections are rounded to floating point numbers using normal rounding rules when writing them to output. This might cause invalid topology meaning generated polygons overlapping or failing to touch with an error of one ULP, in pathological self-intersecting/touching cases.

There is a [live demo](https://nelipuu.github.io/tessellate/) to test it.

## Usage

```TypeScript
import { Tessellation } from '@nelipuu/tessellate';

const rings = [
  [
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 4, y: 3 },
    { x: 4, y: 4 },
    { x: 3, y: 4 }
  ], [
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 1, y: 4 },
    { x: 0, y: 4 },
    { x: 0, y: 3 }
  ]
]

const tessellation = new Tessellation(rings)
while(tessellation.step()) { }

console.log(tessellation.monotoneRegions.vertices);
/* Prints:
[
  [
    { x: 0, y: 0, isLeft: true },
    { x: 0, y: 0, isLeft: false },
    { x: 1, y: 0, isLeft: false },
    { x: 0, y: 1, isLeft: true },
    { x: 2, y: 1, isLeft: false },
    { x: 2, y: 1, isLeft: false },
    { x: 1, y: 2, isLeft: true },
    { x: 1, y: 2, isLeft: false }
  ],
  [
    { x: 3, y: 0, isLeft: true },
    { x: 3, y: 0, isLeft: false },
    { x: 4, y: 0, isLeft: false },
    { x: 2, y: 1, isLeft: true },
    { x: 2, y: 1, isLeft: true },
    { x: 4, y: 1, isLeft: false },
    { x: 3, y: 2, isLeft: true },
    { x: 3, y: 2, isLeft: false }
  ],
  [
    { x: 1, y: 2, isLeft: true },
    { x: 1, y: 2, isLeft: false },
    { x: 0, y: 3, isLeft: true },
    { x: 2, y: 3, isLeft: false },
    { x: 2, y: 3, isLeft: false },
    { x: 0, y: 4, isLeft: true },
    { x: 1, y: 4, isLeft: true },
    { x: 1, y: 4, isLeft: false }
  ],
  [
    { x: 3, y: 2, isLeft: true },
    { x: 3, y: 2, isLeft: false },
    { x: 2, y: 3, isLeft: true },
    { x: 2, y: 3, isLeft: true },
    { x: 4, y: 3, isLeft: false },
    { x: 3, y: 4, isLeft: true },
    { x: 4, y: 4, isLeft: true },
    { x: 4, y: 4, isLeft: false }
  ]
]
*/

console.log(tessellation.intersectionPoints);
/* Prints:
[ { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 } ]
*/
```

## Algorithms and data structures

Any number of complex polygons with (self-)intersections and holes are handled in one pass. This uses a Bentley-Ottmann sweep line algorithm to detect intersections. The overall computational complexity should be O((n + m) log (k + m)) where n is the number of input points, k is the number of corners pointing towards the sweep line start (so just one per convex polygon) and m is the number of intersections.

First we search every polygon ring for start points that the sweep line will encounter before either of their neighbors, meaning their both neighbors have a larger y coordinate or equal y and larger x coordinate. They are sorted and then we only need to insert the first start point into a splay tree of event points. The next is inserted when the previous start point's event is reached and all other non-starting points are only inserted when processing their neighbors.

When reaching an event point, all edges starting from it are added to another splay tree, the sweep line structure, sorted by position along the sweep line and angle. First previous edges ending at the event point are removed and the order of intersecting but continuing edges is reversed. Then, we need to check if the first or last edges continuing from the event point cross a neighbor edge (not involved with the event point) below or further along the sweep line. New event points are inserted for such intersections.
The splay tree structure was chosen because it supports these operations efficiently:
- Insert edges while maintaining sorting order
- Reverse the order of intersecting edges referenced by an event point
- Find neighbor nodes along the sweep line
- Remove edges that end at an event point

For the sweep line structure, inserting the first new edge from a start point requires an amortized logarithmic time lookup and logarithmic time splay after inserting all new edges. All other operations take O(1) per edge because event points contain direct pointers to edges represented as tree nodes which know their neighbors. We choose not to splay when deleting nodes, because finding them didn't involve any lookup. The logarithmic lookup time depends on how many nodes are in the tree. Two new edges are added at every start point. The computational complexity of this is k log k, which disappears because k < n. For other events, edges are only reversed, replaced or removed without otherwise altering the shape of the splay tree.

The event point structure only contains the next start point, the k end points of edges in the sweep line structure, and intersection points found. Events may be generated by all input and intersection points. This causes the (n + m) log (k + m) computational complexity term.

All angle and coordinate comparisons use robust predicates. Ordinary floating point comparison results are only used if they're within error bounds. Otherwise more precision is used by storing numbers as sums of multiple floating point values with different exponents, each less significant term representing the rounding error left after summing all preceding terms.

## License

Copyright 2022- Nelipuu

Permission to use, copy, modify, and/or distribute this software for
any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL
WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY
DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
