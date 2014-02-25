'use strict';

var fs = require('fs'),
	path = require('path'),
	gutil = require('gulp-util'),
	_ = require('lodash'),
	Stream = require('stream');

var PLUGIN_NAME  = 'gulp-resolve-dependencies';

function resolveDependencies(config) {
	var stream,
		fileCache = [],
		filesReturned = [],
		getFiles = function(targetFile) {
			var pattern = _.clone(config, true).pattern,
				files = [],
				content,
				match,
				relFilePath,
				filePath,
				file,
				dependencies;

			// Skip if already added to dependencies
			if (_.indexOf(fileCache, targetFile.path) !== -1) {
				return false;
			} else {
				fileCache.push(targetFile.path);
			}

			content = targetFile.contents.toString('utf8');

			while (match = pattern.exec(content)) {
				filePath = path.join(path.dirname(targetFile.path), match[1]);

				// Skip if already added to dependencies
				if (_.indexOf(fileCache, filePath) !== -1) {
					continue;
				}

				// Check existence
				if (!fs.existsSync(filePath)) {
					gutil.log('[' + gutil.colors.red(PLUGIN_NAME) + '] File not found: ', filePath);
					continue;
				}

				// Create new file
				file = new gutil.File({
					base: targetFile.base,
					path: filePath,
					contents: fs.readFileSync(filePath)
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
	config = _.merge({
		pattern: /\* @requires [\s-]*(.*?\.js)/g,
		log: false
	}, config);

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
		files.forEach(_.bind(function(file) {
			this.push(file);
		}, this));

		if (config.log) {
			filesReturned = filesReturned.concat(files.map(function(file) {
				return file.path;
			}));
		}

		cb();
	};

	stream._flush = function(cb) {
		if (config.log) {
			gutil.log('[' + gutil.colors.green(PLUGIN_NAME) + '] Files returned to stream:', filesReturned);
		}

		cb();
	};

	return stream;
};

module.exports = resolveDependencies;
