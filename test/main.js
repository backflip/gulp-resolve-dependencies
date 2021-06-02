var gulp = require('gulp'),
	fs = require('fs'),
	file = require('gulp-file'),
	path = require('path'),
	es = require('event-stream'),
	assert = require('assert'),
	concat = require('gulp-concat'),
	tap = require('gulp-tap'),
	rewire = require('rewire'),
	resolveDependencies = rewire('../');

function assertFilesEqual(file) {
	var result = path.join(__dirname, 'results', file);
	var expected = path.join(__dirname, 'expected', file);

	assert.strictEqual(
		fs.readFileSync(result, 'utf8'),
		fs.readFileSync(expected, 'utf8')
	);

	fs.unlinkSync(result);
	fs.rmdirSync(__dirname + '/results/');
}

describe('gulp-resolve-dependencies', function() {
	describe('#joinExtensionsForGlob', function() {
		var joinExtensionsForGlob = resolveDependencies.__get__("joinExtensionsForGlob");
	
		it('should handle undefined', function() {
			assert.strictEqual(joinExtensionsForGlob(), "");
		});

		it('should handle []', function() {
			assert.strictEqual(joinExtensionsForGlob([]), "");
		});
	
		it('should keep [".ext"] unmodified', function() {
			assert.strictEqual(joinExtensionsForGlob([".ext"]), ".ext");
		});
	
		it('should keep ["*"] unmodified', function() {
			assert.strictEqual(joinExtensionsForGlob(["*"]), "*");
		});

		it('should join [".ext1", ".ext2", "*"]', function() {
			assert.strictEqual(joinExtensionsForGlob([".ext1", ".ext2", "*"]), "+(.ext1|.ext2|*)");
		});
	});

	describe('#globWithExtensionsSync', function() {
		var globWithExtensionsSync = resolveDependencies.__get__("globWithExtensionsSync");
	
		function assertGlobWithExtensionsSync(filePath, expected, extensions) {
			var files = globWithExtensionsSync(filePath, extensions);
			assert.ok(files !== undefined && Array.isArray(files));
			assert.strictEqual(files.length, expected.length);
			for (var i = 0; i < files.length; ++i) {
				assert.strictEqual(path.resolve(files[i]), path.resolve(expected[i]));
			}
		}

		it('should handle non-existent file path', function() {
			assertGlobWithExtensionsSync(path.join(__dirname, "invalid"), []);
		});

		it('should return ./test for "__dirname"', function() {
			assertGlobWithExtensionsSync(__dirname, [__dirname]);
		});

		it('should return nothing for "__dirname" and [".ts", ".js"] extensions', function() {
			assertGlobWithExtensionsSync(__dirname, [], [".ts", ".js"]);
		});

		it('should return ./test for "__dirname" and [".ts", ".js", ""] extensions', function() {
			assertGlobWithExtensionsSync(__dirname, [__dirname], [".ts", ".js", ""]);
		});

		it('should find ./test/fixtures/test for "__dirname/**/test"', function() {
			assertGlobWithExtensionsSync(path.join(__dirname, "**", "test"), [path.join(__dirname, "fixtures", "test")]);
		});

		it('should find ./test/fixtures/test/test.js for "__dirname/**/test" and [".ts", ".js"] extensions', function() {
			assertGlobWithExtensionsSync(
				path.join(__dirname, "**", "test"),
				[path.join(__dirname, "fixtures", "test", "test.js")],
				[".ts", ".js"]
			);
		});

		it('should find ./test/fixtures/test/test(2)?.js for "__dirname/**/test*" and [".ts", ".js"] extensions', function() {
			assertGlobWithExtensionsSync(
				path.join(__dirname, "**", "test*"),
				[
					path.join(__dirname, "fixtures", "test", "test.js"),
					path.join(__dirname, "fixtures", "test", "test2.js")
				],
				[".ts", ".js"]
			);
		});

		it('should find ./test/fixtures/test(/test(2)?.js)? for "__dirname/**/test*" and [".ts", ".js", ""] extensions', function() {
			assertGlobWithExtensionsSync(
				path.join(__dirname, "**", "test*"),
				[
					path.join(__dirname, "fixtures", "test"),
					path.join(__dirname, "fixtures", "test", "test.js"),
					path.join(__dirname, "fixtures", "test", "test2.js")
				],
				[".ts", ".js", ""]
			);
		});

		it('should find ./test/fixtures/test for "__dirname/**/test" and [""] extensions', function() {
			assertGlobWithExtensionsSync(
				path.join(__dirname, "**", "test"),
				[path.join(__dirname, "fixtures", "test")],
				[""]
			);
		});
	});

	describe('#advancedPathResolver', function() {
		it('should resolve dependencies in external directories with advancedPathResolver', function(done) {
			gulp.src(__dirname + '/advanced/app/e.scss')
				.pipe(resolveDependencies({
					// Match @use 'name';
					pattern: /@use '(.*)';/g,
					resolvePath: resolveDependencies.advancedPathResolver({
						paths: {
							"*": [
								__dirname + "/advanced/liba",
								__dirname + "/advanced/libb",
								// For libc directory
								__dirname + "/advanced"
							]
						},
						// .scss and .css are for allowing a.scss and b.css,
						// "" is for allowing libc directory
						extensions: [".scss", ".css", ""],
						// To resolve libc/index.scss
						mainFiles: ["index.scss"]
					})
				}))
				.pipe(concat('advanced.scss'))
				.pipe(gulp.dest(__dirname + '/results/'))
				.pipe(es.wait(function() {
					assertFilesEqual('advanced.scss');
					done();
				}));
		});
	});

	it('should generate concatenated JS file', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies())
			.pipe(concat('main.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assertFilesEqual('main.js');
				done();
			}));
	});

	it('should handle relative file paths', function(done) {

		gulp.src(__dirname + '/fixtures/main.js')
			// Add a new file
			.pipe(file('test/fixtures/relative.js', ['/**\n', ' * @requires main.js\n', ' */\n', 'console.log(\'relative.js\');\n'].join('')))
			.pipe(resolveDependencies())
			.pipe(concat('relative.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assertFilesEqual('relative.js');
				done();
			}));
	});

	it('should use resolvePath and generate concatenated JS file', function(done) {
		function resolvePath(match, targetFile) {
			match = match.replace(/com\.example\./, '').replace(/\./g, '/');
			match += '.js';

			return path.join(path.dirname(targetFile.path), match);
		}

		gulp.src(__dirname + '/fixtures/resolvepath.js')
			.pipe(resolveDependencies({
				pattern: /\* @requires [\s-]*(.*)/g,
				resolvePath: resolvePath
			}))
			.pipe(concat('resolvepath.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assertFilesEqual('resolvepath.js');
				done();
			}));
	});

	it('should throw error due to circular dependency', function(done) {
		gulp.src(__dirname + '/circular/a.js')
			.pipe(resolveDependencies())
			.on('error', function() {
				done();
			});
	});

	it('should report the initial file stats', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies())
			.pipe(tap(function(file) {
				assert.deepEqual(
					fs.statSync(file.path).mtime,
					file.stat.mtime
				);
			}))
			.on('finish', function() {
				done();
			});
	});
});
