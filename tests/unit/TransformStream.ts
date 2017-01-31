import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import Promise from '@dojo/shim/Promise';
import { Strategy } from '../../src/interfaces';
import { State as ReadableState } from '../../src/ReadableStream';
import ReadableStreamReader, { ReadResult } from '../../src/ReadableStreamReader';
import TransformStream, { Transform } from '../../src/TransformStream';
import { State as WritableState } from '../../src/WritableStream';

class CharToCodeTransform implements Transform<number, string> {
	readableStrategy: Strategy<number>;
	writableStrategy: Strategy<string>;

	constructor() {
		this.readableStrategy = {
			size(chunk: number) {
				return 1;
			},
			highWaterMark: Infinity
		};

		this.writableStrategy = {
			size(chunk: string) {
				return 1;
			},
			highWaterMark: Infinity
		};
	}

	transform(chunk: string, enqueue: (chunk: number) => void, transformDone: () => void): void {
		enqueue(chunk.charCodeAt(0));
		transformDone();
	}

	flush(enqueue: Function, close: Function): void {
		close();
	}
}

let transform: Transform<number, string>;
let stream: TransformStream<number, string>;
let reader: ReadableStreamReader<number>;

registerSuite({
	name: 'TransformStream',

	beforeEach() {
		transform = new CharToCodeTransform();
		stream = new TransformStream(transform);
		reader = stream.readable.getReader();
	},

	'simple transform'() {
		let testValue = 'a';

		return stream.writable.write(testValue).then(function () {
			return reader.read().then(function (result: ReadResult<number>) {
				assert.strictEqual(result.value, testValue.charCodeAt(0));
			});
		});
	},

	'async transform'() {
		let testValues = ['a', 'b', 'c'];
		let results: (undefined | number)[] = [];

		transform.transform = (chunk: string, enqueue: (chunk: number) => void, transformDone: () => void): void => {
			setTimeout(function () {
				enqueue(chunk.charCodeAt(0));
				transformDone();
			}, 20);
		};

		for (let testValue of testValues) {
			stream.writable.write(testValue);
		}

		stream.writable.close();

		function readNext(): Promise<void> {
			return reader.read().then(function (result: ReadResult<number>) {
				if (result.done) {
					return Promise.resolve();
				}
				else {
					results.push(result.value);
					return readNext();
				}
			});
		}

		return readNext().then(function () {
			for (let i = 0; i < results.length; i++) {
				assert.strictEqual(results[i], testValues[i].charCodeAt(0));
			}
		});
	},

	'transform.flush throws error'() {
		transform.flush = function () {
			throw new Error('Transform#flush test error');
		};

		return stream.writable.close().then(function () {
			assert.fail(null, null, 'Errored stream should not resolve call to \'close\'');
		}, function (error: Error) {
			assert.strictEqual(stream.readable.state, ReadableState.Errored);
			assert.strictEqual(stream.writable.state, WritableState.Errored);
		});
	},

	'transform.transform throws error'() {
		transform.transform = function () {
			throw new Error('Transform#transform test error');
		};

		return stream.writable.write('a').then(function () {
			assert.fail(null, null, 'Errored stream should not resolve call to \'write\'');
		}, function (error: Error) {
			assert.strictEqual(stream.readable.state, ReadableState.Errored);
			assert.strictEqual(stream.writable.state, WritableState.Errored);
		});
	},

	'sink.abort resolves'() {
		return stream.writable.abort('reason').then(() => {
			assert.strictEqual(stream.writable.state, WritableState.Errored);
		}, () => {
			assert.fail('should have succeeded');
		});
	},

	'sink.cancel resolves'() {
		return stream.readable.cancel('reason').then(() => {
			assert.strictEqual(stream.readable.state, ReadableState.Closed);
		}, () => {
			assert.fail('should have succeeded');
		});
	}
});
