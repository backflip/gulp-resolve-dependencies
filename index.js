'use strict';

var fs = require('fs'),
	path = require('path'),
	Vinyl = require('vinyl'),
	Log = require('fancy-log'),
	AnsiColors = require('ansi-colors'),
	merge = require('lodash.merge'),
	Stream = require('stream'),
	DAG = require('dag'),
	cloneRegexp = require('clone-regexp');

var PLUGIN_NAME  = 'gulp-resolve-dependencies';

function resolveDependencies(config) {
	var defaults = {
			pattern: /\* @requires [\s-]*(.*\.js)/g,
			log: false,
			ignoreCircularDependencies: false,
			resolvePath: function(match, targetFile) {
				return path.join(path.dirname(path.resolve(targetFile.path)), match);
			}
		},
		stream,
		dag = new DAG(),
		fileCache = [],
		filesReturned = [],
		getFiles = function(targetFile) {
			var pattern = cloneRegexp(config.pattern),
				files = [],
				content,
				match,
				filePath,
				file,
				dependencies;

			// Skip if already added to dependencies
			if (fileCache.includes(targetFile.path)) {
				return false;
			} else {
				fileCache.push(targetFile.path);
			}

			content = targetFile.contents.toString('utf8');
			
			while (match = pattern.exec(content)) {
				filePath = config.resolvePath(match[1], targetFile);

				// Check for circular dependencies
				try {
					dag.addEdge(targetFile.path, filePath);
				} catch (e) {
					// Emit error or just continue
					if (!config.ignoreCircularDependencies) {
						stream.emit('error', new Error(PLUGIN_NAME + ': Circular dependency between "' + targetFile.path + '" and "' + filePath + '"'));
					} else {
						continue;
					}
				}

				// Check existence
				if (!fs.existsSync(filePath)) {
					stream.emit('error', new Error(PLUGIN_NAME + ': File not found: ' + filePath));

					continue;
				}
				
				// Create new file
				file = new Vinyl({
					base: targetFile.base,
					path: filePath,
					contents: fs.readFileSync(filePath),
					stat: fs.statSync(filePath)
				});

				// Get new dependencies
				while (dependencies = getFiles(file)) {
					files = files.concat(dependencies);
				}
			}

			// Add file itself
			files.push(targetFile);

			return files;
		};

	// Set default values
	config = merge(defaults, config);

	// Happy streaming
	stream = Stream.Transform({
		objectMode: true
	});

	stream._transform = function(file, unused, cb) {
		var files;

		if (file.isNull()) {
			this.push(file);

			return cb();
		}

		files = getFiles(file);
		
		if (!files) {
			return cb();
		}

		// Add dependencies and file itself to stream
		files.forEach(function(file) {
			this.push(file);
		}.bind(this));

		if (config.log) {
			filesReturned = filesReturned.concat(files.map(function(file) {
				return file.path;
			}));
		}

		cb();
	};

	stream._flush = function(cb) {
		if (config.log) {
			Log('[' + AnsiColors.green(PLUGIN_NAME) + '] Files returned to stream:', filesReturned);
		}

		cb();
	};

	return stream;
};

module.exports = resolveDependencies;
