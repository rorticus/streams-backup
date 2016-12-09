import ReadableNodeStreamSource from './adapters/ReadableNodeStreamSource';
import WritableNodeStreamSink from './adapters/WritableNodeStreamSink';
import ReadableStream from './ReadableStream';
import WritableStream from './WritableStream';

import * as http from 'http';
import { Response, RequestError } from 'dojo-core/request';
import { NodeRequestOptions, streamHandlers } from 'dojo-core/request/node';

function nodeStreamHandler<T>(options: NodeRequestOptions<T>, request: http.ClientRequest, nativeResponse: http.ClientResponse, response: Response<T>, resolve: (p?: any) => void, reject: (_?: Error) => void) {
	const responseSource = new ReadableNodeStreamSource(nativeResponse);
	const responseReadableStream = new ReadableStream(responseSource);

	responseReadableStream.pipeTo(<any> options.streamTarget)
		.then(
			function () {
				resolve(response);
			},
			function (error: RequestError<any>) {
				if (options.streamTarget) {
					// abort the stream, swallowing any errors,
					// (because we've already got an error, and we can't catch this one)
					options.streamTarget.abort(error).catch(() => {
					});
				}
				request.abort();
				error.response = response;
				reject(error);
			}
		);
}

function nodeStreamCompleteHandler(options: NodeRequestOptions<any>) {
	if (options.streamTarget) {
		options.streamTarget.close().catch(() => {
		});
	}
}

function nodeStreamDataHandler(options: NodeRequestOptions<any>, request: http.ClientRequest, response: Response<any>, reject: (_?: Error) => void) {
	const requestSink = new WritableNodeStreamSink(request);
	const writableRequest = new WritableStream(requestSink);
	options.data.pipeTo(writableRequest)
		.catch(function (error: RequestError<any>) {
			error.response = response;
			writableRequest.abort(error).catch(() => {
			});
			reject(error);
		});
}

export function enableNodeStreams() {
	streamHandlers.streamDataHandler = nodeStreamDataHandler;
	streamHandlers.streamTargetHandler = nodeStreamHandler;
	streamHandlers.streamCompleteHandler = nodeStreamCompleteHandler;
}
