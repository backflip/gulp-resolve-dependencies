var gulp = require('gulp'),
	fs = require('fs'),
	file = require('gulp-file'),
	path = require('path'),
	es = require('event-stream'),
	assert = require('assert'),
	concat = require('gulp-concat'),
	tap = require('gulp-tap'),
	resolveDependencies = require('../');

function assertFilesEqual(file) {
	var result = path.join(__dirname, 'results', file);
	var expected = path.join(__dirname, 'expected', file);

	assert.equal(
		fs.readFileSync(result, 'utf8'),
		fs.readFileSync(expected, 'utf8')
	);

	fs.unlinkSync(result);
	fs.rmdirSync(__dirname + '/results/');
}

describe('gulp-resolve-dependencies', function() {
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

	it('should ignore lib2.js', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies({
				resolvePath: function(match, targetFile) {
					// Ignore specific matches
					if (match.match(/\/lib2\.js$/)) {
						return null;
					}
					
					return path.join(path.dirname(path.resolve(targetFile.path)), match);
				},
				log: true
			}))
			.pipe(concat('filtered.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assertFilesEqual('filtered.js');
				done();
			}));
	});

	it('should exclude depencencies from fixtures/libs', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies({
				exclude: [path.resolve(__dirname, "fixtures/libs/**/*")]
			}))
			.pipe(concat('mainexclude.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assertFilesEqual('mainexclude.js');
				done();
			}));
	});

	it('should only include depencencies from fixtures/test', function(done) {
		gulp.src(__dirname + '/fixtures/main.js')
			.pipe(resolveDependencies({
				include: [path.resolve(__dirname, "fixtures/test/**/*")]
			}))
			.pipe(concat('maininclude.js'))
			.pipe(gulp.dest(__dirname + '/results/'))
			.pipe(es.wait(function() {
				assertFilesEqual('maininclude.js');
				done();
			}));
	});
});
