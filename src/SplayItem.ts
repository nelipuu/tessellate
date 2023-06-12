type f64 = number;
type i32 = number;
type u32 = number;

export abstract class SplayItem<Key> {

	rotateLeft(): void {
		const top = this.right!;

		this.right = top.left;
		if(this.right) this.right!.parent = this;
		top.left = this;

		if(this.parent) {
			if(this.parent!.left == this) {
				this.parent!.left = top;
			} else {
				this.parent!.right = top;
			}
		}

		top.parent = this.parent;
		this.parent = top;
	}

	rotateRight(): void {
		const top = this.left!;

		this.left = top.right;
		if(this.left) this.left!.parent = this;
		top.right = this;

		if(this.parent) {
			if(this.parent!.left == this) {
				this.parent!.left = top;
			} else {
				this.parent!.right = top;
			}
		}

		top.parent = this.parent;
		this.parent = top;
	};

	/** Splay this node to the root of the splay tree. */

	splay(): this {
		let node = this;
		let grand: SplayItem<Key> | null = null;
		let parent: SplayItem<Key>;

		while(node.parent) {
			parent = node.parent!;
			grand = parent.parent;

			if(!grand) {
				if(node == parent.left) {
					parent.rotateRight();
				} else {
					parent.rotateLeft();
				}

				return this;
			}

			if(node == parent.left) {
				if(parent == grand.left) {
					grand.rotateRight();
					parent.rotateRight();
				} else {
					parent.rotateRight();
					grand.rotateLeft();
				}
			} else {
				if(parent == grand.left) {
					parent.rotateLeft();
					grand.rotateRight();
				} else {
					grand.rotateLeft();
					parent.rotateLeft();
				}
			}
		}

		return this;
	}

	link(prev: this | null, next: this | null): this {
		this.prev = prev;
		this.next = next;

		if(prev) prev.next = this;
		if(next) next.prev = this;

		return this;
	}

	reset(): void {
		this.parent = null;
		this.left = null;
		this.right = null;
		this.prev = null;
		this.next = null;
	}

	abstract deltaFrom(key: Key): f64;

	parent: SplayItem<Key> | null = null;
	left: SplayItem<Key> | null = null;
	right: SplayItem<Key> | null = null;
	prev: SplayItem<Key> | null = null;
	next: SplayItem<Key> | null = null;

}
