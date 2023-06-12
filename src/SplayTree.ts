import { SplayItem } from './SplayItem';

type f64 = number;
type i32 = number;
type u32 = number;

interface InsertResult<Item> {
	delta: f64;
	node: Item;
}

/** Threaded bottom-up splay tree. */

export class SplayTree<Item extends SplayItem<Key>, Key> {

	constructor(private create: (key: Key) => Item) { }

	insert(key: Key): InsertResult<Item> {
		let child = this.root;
		let node = child;
		let delta: f64 = 0;

		while(child) {
			node = child;

			delta = node.deltaFrom(key);

			if(delta > 0) {
				child = node.left as (Item | null);
			} else if(delta < 0) {
				child = node.right as (Item | null);
			} else {
				break;
			}
		}

		if(!node || delta) {
			child = this.create(key);
			child.parent = node as (Item | null);

			if(!node) {
				this.root = child;
				this.first = child;
				this.last = child;
			} else if(delta > 0) {
				node.left = child.link(node.prev as (Item | null), node);
				if(!child.prev) this.first = child;
			} else {
				node.right = child.link(node, node.next as (Item | null));
				if(!child.next) this.last = child;
			}
		}

		let result = this.insertResult;

		if(result) {
			result.delta = delta;
			result.node = child!;
		} else {
			result = { delta, node: child! };
		}

		return result;
	}

	remove(node: Item): void {
		let replacement: SplayItem<Key> | null = null;

		const parent = node.parent;
		const prev = node.prev;
		const next = node.next;

		if(node.left && node.right) {
			if(!next || !next.parent) {
				// Impossible
				// debugger;
				throw new Error();
			}

			// Swap successor and its right child. Successor can't have a left child.
			replacement = next.right;

			// Connect successor's parent (which can be node) with replacement.
			if(node.right == next) {
				node.right = replacement;
			} else {
				next.parent!.left = replacement;
			}

			if(replacement) replacement.parent = next.parent;

			// Move node's left subtree under successor.
			next.left = node.left;
			next.left!.parent = next;

			// Move node's right subtree under successor.
			next.right = node.right;
			// Right child can be null if successor is node's right child and replacement is null.
			if(next.right) next.right!.parent = next;

			replacement = next;
		} else {
			replacement = (node.left || node.right);
		}

		// Connect node's parent with replacement.
		if(!parent) {
			this.root = replacement as (Item | null);
		} else if(parent.left == node) {
			parent.left = replacement;
		} else {
			parent.right = replacement;
		}

		if(replacement) replacement.parent = parent;

		if(next) {
			next.prev = prev;
		} else {
			this.last = prev as (Item | null);
		}

		if(prev) {
			prev.next = next;
		} else {
			this.first = next as (Item | null);
		}
	}

	root: Item | null = null;
	first: Item | null = null;
	last: Item | null = null;
	insertResult: InsertResult<Item> | null = null;

}
