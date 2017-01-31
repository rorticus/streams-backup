import * as assert from 'intern/chai!assert';
import * as registerSuite from 'intern!object';
import has from '@dojo/has/has';
import ByteLengthQueuingStrategy from '../../src/ByteLengthQueuingStrategy';
import WritableStream, { State } from '../../src/WritableStream';
import ManualSink from './helpers/ManualSink';

const ASYNC_TIMEOUT = 1000;

registerSuite({
	name: 'ByteLengthQueuingStrategy',

	size(this: any) {
		if (!has('arraybuffer')) {
			this.skip('ArrayBuffer doesn\'t exist in this environment');
		}
		let dfd = this.async(ASYNC_TIMEOUT);
		let sink = new ManualSink<ArrayBuffer>();

		let stream = new WritableStream<ArrayBuffer>(sink, new ByteLengthQueuingStrategy<ArrayBuffer>({
			highWaterMark: 2 * 1024
		}));

		let promise = stream.write(new ArrayBuffer(1024));
		assert.strictEqual(stream.state, State.Writable);

		stream.write(new ArrayBuffer(1024));
		assert.strictEqual(stream.state, State.Writable);

		stream.write(new ArrayBuffer(1));
		assert.strictEqual(stream.state, State.Waiting);

		setTimeout(function () {
			sink.next();
		}, 20);

		promise.then(dfd.callback(function () {
			assert.strictEqual(stream.state, State.Writable);
		}), function (error: Error) {
			dfd.reject(error);
		});
	},

	'size with object'(this: any) {
		let dfd = this.async(ASYNC_TIMEOUT);
		let sink = new ManualSink<any>();

		let stream = new WritableStream<any>(sink, new ByteLengthQueuingStrategy<any>({
			highWaterMark: 50
		}));

		// approximateByteSize = 44
		let testObject1 = {
			0: true,
			abc: 'def',
			xyz: [
				true,
				8,
				'abcdef'
			]
		};

		// approximateByteSize = 74
		let testObject2 = {
			100: false,
			abc: 'def',
			xyz: [
				true,
				8,
				'abcdefghijklmnopq'
			]
		};

		stream.write(testObject1).then(function () {
			sink.next();
		});
		assert.strictEqual(stream.state, State.Writable);

		let promise = stream.write(testObject2);
		assert.strictEqual(stream.state, State.Waiting);

		setTimeout(function () {
			sink.next();
		}, 20);

		promise.then(dfd.callback(function () {
			assert.strictEqual(stream.state, State.Writable);
		}), function (error: Error) {
			dfd.reject(error);
		});
	}
});
