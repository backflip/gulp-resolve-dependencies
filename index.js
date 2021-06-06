'use strict';

var fs = require('fs'),
	path = require('path'),
	Vinyl = require('vinyl'),
	Log = require('fancy-log'),
	AnsiColors = require('ansi-colors'),
	merge = require('lodash.merge'),
	Stream = require('stream'),
	DAG = require('dag'),
	cloneRegexp = require('clone-regexp'),
	glob = require('glob'),
	minimatch = require('minimatch');

var PLUGIN_NAME  = 'gulp-resolve-dependencies';

/**
 * Default path resolver.
 * 
 * Return a matched dependency relative to the targetFile.
 * 
 * @param {string} match - Matched dependency
 * @param {object} targetFile - Vinyl file
 * @returns {string} - Path to dependency
 */
function relativePathResolver(match, targetFile) {
	return path.join(path.dirname(path.resolve(targetFile.path)), match);
}

/**
 * Build a regex for matching multiple extensions with glob.
 * 
 * A single extension is returned unmodified:
 * 
 * 	joinExtensionsForGlob([".ext"]) => ".ext"
 * 	joinExtensionsForGlob(["*"]) => "*"
 * 
 * Multiple extensions are joined together in a regex:
 * 
 * 	joinExtensionsForGlob([".ext1", ".ext2", "*"]) => "+(.ext1|.ext2|*)"
 *
 * @param {Array} extensions - List of [".ext1", ".ext2", ...]
 * @returns {string} - "+(.ext1|.ext2|...)" regex
 */
function joinExtensionsForGlob(extensions)
{
	if (!extensions || extensions.length === 0) {
		return "";
	}

	if (extensions.length === 1) {
		// Single extension => no need for ".+"
		return extensions[0];
	}

	// Multiple extensions => build "+(.ext1|.ext2|...)"
	return "+(" + extensions.join("|") + ")"
}

/**
 * Find files or directories matching "filePath + extensions".
 * 
 * This is the same as searching files and directories with:
 * 
 * 	glob.sync(path + extension)
 * 
 * @param {string} filePath - Directory or file glob with or without extension
 * @param {string} extensions - List of extensions to test
 * @returns {Array} - Results of glob.sync
 */
function globWithExtensionsSync(filePath, extensions)
{
	// Check if filePath has extension
	var ext = path.extname(filePath);
	if (ext) {
		// Reject custom extensions
		extensions = [];
	}

	// Find all directories and files matching filePath + extensions glob
	return glob.sync(filePath + joinExtensionsForGlob(extensions));
}

/**
 * Advanced path resolver.
 * 
 * Can search for matched dependency in a list of external
 * directories and with multiple extensions.
 * 
 * @param {object} config - Resolver configuration
 * @returns {any} - Resolver function
 */
function advancedPathResolver(config) {
	var defaults = {
		paths: {},
		extensions: [],
		mainFiles: []
	};

	// Set default values
	config = merge(defaults, config);

	function findFile(match, targetFile) {
		// Try to resolve path in external directories
		if (config.paths) {
			for (var pattern of Object.keys(config.paths)) {
				// Does dependency match glob
				if (!minimatch(match, pattern)) {
					continue;
				}

				// Search in directories
				for(var dir of config.paths[pattern]) {
					var files = globWithExtensionsSync(path.join(dir, match), config.extensions);
					if (files && files.length !== 0) {
						return files[0];
					}
				}
			}
		}

		// Try to resolve path relative to targetFile
		var filePath = relativePathResolver(match, targetFile);
		var files = globWithExtensionsSync(filePath, config.extensions);
		if(files && files.length !== 0) {
			return files[0];
		}

		// Fallback to default resolver
		return filePath;
	}

	return (match, targetFile) => {
		// Find the best match for configuration
		var filePath = findFile(match, targetFile);

		// File doesn't exist, stop here
		if (!fs.existsSync(filePath)) {
			return filePath;
		}

		// File isn't a directory, stop here
		var stat = fs.lstatSync(filePath, {throwIfNoEntry: false});
		if (stat === undefined || !stat.isDirectory) {
			return filePath;
		}

		// Try to find the main file
		if (config.mainFiles) {
			for (var mainFile of config.mainFiles) {
				var mainFilePath = path.join(filePath, mainFile);

				if (fs.existsSync(mainFilePath)) {
					return mainFilePath;
				}
			}
		}

		// Fallback to filePath
		return filePath;
	}
}

function resolveDependencies(config) {
	var defaults = {
			pattern: /\* @requires [\s-]*(.*\.js)/g,
			log: false,
			ignoreCircularDependencies: false,
			resolvePath: relativePathResolver
		},
		stream,
		dag = new DAG(),
		fileCache = [],
		filesReturned = [],
		getFiles = function(targetFile) {
			var pattern = cloneRegexp(config.pattern, {
					lastIndex: 0
				}),
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

resolveDependencies.relativePathResolver = relativePathResolver;
resolveDependencies.advancedPathResolver = advancedPathResolver;
module.exports = resolveDependencies;
