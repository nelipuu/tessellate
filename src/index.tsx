import { React, VNode, cloneElement } from 'react';
import { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { srlch2rgb } from './srlab2';
import { Tessellation } from './Tessellation';

export interface MarkerProps {
	x: number;
	y: number;
	ring?: number;
	rings?: number;
	point: number;
	label?: string;
	selected?: boolean;
	onSelect?: (x: number, y: number) => void;
	onMove?: (x: number, y: number) => void;
}

function hex(luminance: number, chroma: number, hue: number) {
	return 'rgb(' + srlch2rgb(luminance, chroma, hue).join(',') + ')';
}

const markerRadius = 12;

export function Marker(
	{ x, y, ring, rings, point, label, selected, onSelect, onMove, children }: MarkerProps & { children?: VNode<SVGElement> }
) {
	let hue: number;
	let fill: string;
	let stroke: string;
	let color: string;

	if(rings) {
		hue = 240 + (360 * ring / rings);
		fill = hex(381 / 512, 201 / 512, hue);
		stroke = hex(255 / 512, 146 / 512, hue);
		color = hex(127 / 512, 91 / 512, hue);
	} else {
		fill = hex(381 / 512, 0, 0);
		stroke = hex(255 / 512, 0, 0);
		color = hex(127 / 512, 0, 0);
	}

	if(selected) {
		fill = stroke;
		stroke = color;
		color = hex(0, 0, 0);
	}

	function dragMove(event: MouseEvent) {
		event.preventDefault();

		if(onMove) onMove(event.clientX, event.clientY);
	}

	function dragEnd(event: MouseEvent) {
		event.preventDefault();

		window.removeEventListener('mousemove', dragMove);
		window.removeEventListener('mouseup', dragEnd);
	}

	function dragStart(event: JSX.TargetedMouseEvent<SVGElement>) {
		event.preventDefault();

		if(onMove) {
			window.addEventListener('mousemove', dragMove);
			window.addEventListener('mouseup', dragEnd);
		}

		if(onSelect) onSelect(event.clientX, event.clientY);
	}

	// <circle cx={0} cy={0} r={markerRadius} style={{ fill, stroke }} />

	return <g onMouseDown={dragStart} transform={'translate(' + x + ' ' + y + ')'} className='marker'>
		{cloneElement(children, { style: { fill, stroke } })}
		<text x={0} y={1} dominantBaseline="middle" textAnchor="middle" style={{ fill: color }}>
			{label || point}
		</text>
	</g>
}

export function Anchor(props: MarkerProps) {
	return <Marker {...props}><circle cx={0} cy={0} r={markerRadius} /></Marker>;
}

export function Inserter(props: MarkerProps) {
	return <Marker {...props}><rect x={-markerRadius * 0.75} y={-markerRadius * 0.75} width={markerRadius * 1.5} height={markerRadius * 1.5} /></Marker>;
}

export function EditPolygon() {
	const [rings, setRings] = useState([
		[
			{ x: 0, y: 1 },
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 4, y: 3 },
			{ x: 4, y: 4 },
			{ x: 3, y: 4 }
		], [
			{ x: 3, y: 0 },
			// { x: 5, y: 1 },
			{ x: 4, y: 0 },
			{ x: 4, y: 1 },
			{ x: 1, y: 4 },
			{ x: 0, y: 4 },
			{ x: 0, y: 3 }
		]
	].map((ring) => ring.map(({ x, y }) => ({ x: (x + 1) * 128, y: (y + 1) * 128 }))));
	const [selectedAnchor, setSelectedAnchor] = useState({ point: -1, ring: -1 });
	const svgRef = useRef<SVGSVGElement>();
	let dx = 0, dy = 0;

	function dragStart(ring: number, point: number, x: number, y: number, x0: number, y0: number) {
		const ctm = svgRef.current.getScreenCTM()!;

		dx = (x - ctm.e) / ctm.a - x0;
		dy = (y - ctm.f) / ctm.d - y0;

		setSelectedAnchor({ point, ring });
	}

	function dragMove(dragRing: number, dragPoint: number, x: number, y: number) {
		const ctm = svgRef.current.getScreenCTM()!;

		x = (x - ctm.e) / ctm.a - dx;
		y = (y - ctm.f) / ctm.d - dy;

		if(x < markerRadius + 1) x = markerRadius + 1;
		if(y < markerRadius + 1) y = markerRadius + 1;

		setRings(rings.map(
			(points, ring) => (
				ring != dragRing ? rings[ring] : rings[ring].map(
					(xy, point) => point != dragPoint ? xy : { x, y }
				)
			)
		));
	}

	function dragInsert(dragRing: number, dragPoint: number, x: number, y: number) {
		const ctm = svgRef.current.getScreenCTM()!;

		x = (x - ctm.e) / ctm.a - dx;
		y = (y - ctm.f) / ctm.d - dy;

		if(x < markerRadius + 1) x = markerRadius + 1;
		if(y < markerRadius + 1) y = markerRadius + 1;

		setRings(rings.map(
			(points, ring) => (
				ring != dragRing ? rings[ring] : rings[ring].slice(0, dragPoint + 0.5).concat([{ x, y }], rings[ring].slice(dragPoint + 0.5))
			)
		));

		setSelectedAnchor({ point: dragPoint + 0.5, ring: dragRing });
	}

	const tessellation = new Tessellation(rings)
	while(tessellation.step()) { }

	return <svg ref={svgRef} style={{ width: '100%', height: '768' }}>
		<g>
			{tessellation.monotoneRegions.map(({ vertices }, region) => {
				const regions = tessellation.monotoneRegions.length;
				const path: (string | number)[] = [];
				const count = vertices.length;
				let num = 0;
				let op = 'M';

				while(num < count) {
					const { x, y, isLeft } = vertices[num++];
					if(isLeft) {
						path.push(op, x, y);
						op = 'L';
					}
				}

				while(num) {
					const { x, y, isLeft } = vertices[--num];
					if(!isLeft) {
						path.push(op, x, y);
						op = 'L';
					}
				}

				path.push('Z');

				return <path d={path.join(' ')} className='polygon' style={{
					fill: hex(448 / 512, 91 / 512, 240 + (360 * region / regions)),
					stroke: hex(255 / 512, 146 / 512, 240 + (360 * region / regions))
				}} />
			})}
			{tessellation.intersectionPoints.map(({ x, y }, point) => {
				return <Anchor
					key={'cross-' + point}
					x={x}
					y={y}
					point={point}
					selected={false}
				/>
			})}
			{rings.map((points, ring) => points.map(({ x, y }, point) => <>
				<Anchor
					key={'anchor-' + point}
					x={x}
					y={y}
					ring={ring}
					rings={rings.length}
					point={point}
					selected={point == selectedAnchor.point && ring == selectedAnchor.ring}
					onSelect={(mx, my) => dragStart(ring, point, mx, my, x, y)}
					onMove={(x, y) => dragMove(ring, point, x, y)}
				/>
				<Inserter
					key={'insert-' + point}
					x={(x + points[(point || points.length) - 1].x) / 2}
					y={(y + points[(point || points.length) - 1].y) / 2}
					ring={ring}
					rings={rings.length}
					point={point}
					selected={point - 0.5 == selectedAnchor.point && ring == selectedAnchor.ring}
					label='+'
					onSelect={(mx, my) => dragStart(ring, point - 0.5, mx, my, (x + points[(point || points.length) - 1].x) / 2, (y + points[(point || points.length) - 1].y) / 2)}
					onMove={(x, y) => dragInsert(ring, point - 0.5, x, y)}
				/>
			</>))}
		</g>
	</svg>;
}

const root = createRoot(document.body);
root.render(<EditPolygon />);
