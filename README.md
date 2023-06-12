# tessellate

This is a TypeScript library for splitting arbitrary 2D complex polygons with floating point coordinates into simple [monotone polygons](https://en.wikipedia.org/wiki/Monotone_polygon).

It should be able to handle *any* finite normal floating point coordinates and give a correct result, with the caveat that new points produced by self-intersections are rounded to floating point numbers using normal rounding rules when writing them to output. This might cause invalid topology meaning generated polygons overlapping or failing to touch with an error of one ULP, in pathological self-intersecting/touching cases.

It uses a Bentley-Ottmann sweep line algorithm to detect self-intersections. The overall computational complexity should be O(n log k + m) where n is the number of input points, k is the number of corners pointing towards the sweep line start (so just one per convex polygon) and m is the number of self-intersections.

There is a [live demo](https://nelipuu.github.io/tessellate/) to test it.

## Usage

```TypeScript
import { Tessellation } from 'tessellation';

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
